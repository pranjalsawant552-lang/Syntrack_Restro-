package com.pos.app.Service;

import com.pos.app.Entity.ComboItem;
import com.pos.app.Entity.Product;
import com.pos.app.Exception.InvalidRequestException;
import com.pos.app.Repository.ComboItemRepository;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Repository.StockRepository;
import com.pos.app.common.service.AuditService;
import com.pos.app.tenant.TenantContext;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The single source of truth for "can this dish be ordered right now, and if not, why?".
 *
 * Two independent things can hide a dish, and the owner needs to tell them apart:
 *  - {@code manualOff}: the owner/kitchen switched it off (optionally with an auto-return time).
 *  - {@code blockReason}: the system can't make it -- recipe ingredient ran out, shelf stock is 0, or a combo
 *    component is unavailable. Nothing to switch; restock instead.
 * A dish is {@code sellable} only when it is active, not manually off and has no block reason.
 *
 * The QR customer menu, the owner's Availability screen and (via the same rules) the waiter picker all agree
 * because they read from here.
 */
@Service
@Transactional
public class MenuAvailabilityService {

    private static final int MAX_IDS = 3000;

    @Value("${app.menu.day-cutover-hour:4}")
    private int cutoverHour;

    @Autowired private ProductRepository productRepo;
    @Autowired private StockRepository stockRepo;
    @Autowired private ComboItemRepository comboRepo;
    @Autowired private RecipeService recipeService;
    @Autowired private AuditService auditService;
    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private com.pos.app.common.util.QrMenuCache qrMenuCache;

    /* ===================== read ===================== */

    public record Row(Long productId, String name, Long categoryId, String categoryName, double price, Boolean veg,
                      boolean combo, boolean active, boolean manualOff, LocalDateTime offUntil, String blockReason,
                      Integer portionsLeft, Integer shelfQty, boolean sellable) {}

    public record Board(List<Row> items, int dayCutoverHour, LocalDateTime serverTime) {}

    @Transactional
    public Board board() {
        return new Board(rows(), cutoverHour, LocalDateTime.now());
    }

    /** Every menu item with its effective availability. Six bulk queries in total, regardless of menu size. */
    @Transactional
    public List<Row> rows() {
        Map<Long, com.pos.app.DTO.inventory.InventoryDTO.AvailabilityRow> recipe = new HashMap<>();
        for (var a : recipeService.availability()) recipe.put(a.productId(), a);

        Map<Long, Integer> shelf = new HashMap<>();
        for (Object[] r : stockRepo.findAllProductIdAndQty()) {
            shelf.put(((Number) r[0]).longValue(), ((Number) r[1]).intValue());
        }

        Map<Long, List<ComboItem>> comboParts = comboRepo.findAll().stream()
                .collect(Collectors.groupingBy(ComboItem::getComboProductId));

        List<Product> products = productRepo.findAllWithCategory();
        Map<Long, Product> byId = products.stream().collect(Collectors.toMap(Product::getProductId, p -> p));

        List<Row> out = new ArrayList<>(products.size());
        for (Product p : products) {
            String block = blockReason(p, recipe, shelf, comboParts, byId);
            var av = recipe.get(p.getProductId());
            boolean manual = p.isTemporarilyUnavailable();
            out.add(new Row(p.getProductId(), p.getProductName(),
                    p.getCategoryID() == null ? null : p.getCategoryID().getCategoryId(),
                    p.getCategoryID() == null ? "Other" : p.getCategoryID().getCategoryName(),
                    p.getProdPrice(), p.getIsVeg(), p.isCombo(), p.isActive(), manual,
                    manual ? p.getUnavailableUntil() : null, block,
                    av == null ? null : av.availablePortions(),
                    isShelfItem(p, av != null) ? shelf.getOrDefault(p.getProductId(), 0) : null,
                    p.isActive() && !manual && block == null));
        }
        return out;
    }

    private static boolean isShelfItem(Product p, boolean hasRecipe) {
        return p.isTrackStock() && !p.isCombo() && !hasRecipe;
    }

    private String blockReason(Product p, Map<Long, com.pos.app.DTO.inventory.InventoryDTO.AvailabilityRow> recipe,
                               Map<Long, Integer> shelf, Map<Long, List<ComboItem>> comboParts, Map<Long, Product> byId) {
        if (p.isCombo()) {
            for (ComboItem c : comboParts.getOrDefault(p.getProductId(), List.of())) {
                Product comp = byId.get(c.getComponentProductId());
                if (comp == null) continue;
                String why = ownReason(comp, recipe, shelf, c.getQuantity(), true);
                if (why != null) return comp.getProductName() + " in this combo is unavailable (" + why + ")";
            }
            return null;
        }
        return ownReason(p, recipe, shelf, 1, false);
    }

    /** Ingredient / shelf reasons only (the owner's own switch is reported separately, except for combo parts). */
    private String ownReason(Product p, Map<Long, com.pos.app.DTO.inventory.InventoryDTO.AvailabilityRow> recipe,
                             Map<Long, Integer> shelf, int wantQty, boolean includeManual) {
        if (!p.isActive()) return includeManual ? "not on the menu" : null;
        if (includeManual && p.isTemporarilyUnavailable()) return "switched off";
        var av = recipe.get(p.getProductId());
        if (av != null) {
            if (av.outOfStock()) return "no " + (av.limitingIngredient() == null ? "ingredients" : av.limitingIngredient()) + " left";
            return null;
        }
        if (isShelfItem(p, false)) {
            int q = shelf.getOrDefault(p.getProductId(), 0);
            if (q < wantQty) return q <= 0 ? "out of stock" : "only " + q + " left";
        }
        return null;
    }

    /* ===================== write ===================== */

    public record SetRequest(List<Long> productIds, List<Long> categoryIds, Boolean available, String until, Integer minutes) {}

    /**
     * Turn dishes on/off in bulk. Turning ON always clears any auto-return time. Turning OFF uses {@code until}:
     * MANUAL (stays off until switched on), END_OF_DAY (auto back on at the day cut-over hour) or MINUTES.
     * Categories expand to their active items.
     */
    public Board set(SetRequest req, String actor) {
        applyChange(req, actor);
        return board();
    }

    private void applyChange(SetRequest req, String actor) {
        if (req == null || req.available() == null) throw new InvalidRequestException("Say whether to turn the items on or off");

        Set<Long> ids = new LinkedHashSet<>();
        if (req.productIds() != null) ids.addAll(req.productIds());
        if (req.categoryIds() != null && !req.categoryIds().isEmpty()) {
            productRepo.findActiveByCategoryIds(req.categoryIds()).forEach(p -> ids.add(p.getProductId()));
        }
        ids.remove(null);
        if (ids.isEmpty()) throw new InvalidRequestException("Choose at least one menu item");
        if (ids.size() > MAX_IDS) throw new InvalidRequestException("Too many items in one go");

        boolean turnOn = req.available();
        LocalDateTime until = turnOn ? null : resolveUntil(req.until(), req.minutes());

        List<Product> items = productRepo.findAllById(ids);
        List<Product> changed = new ArrayList<>();
        for (Product p : items) {
            boolean off = !turnOn;
            if (p.isTemporarilyUnavailable() == off && Objects.equals(p.getUnavailableUntil(), until)) continue;
            p.setTemporarilyUnavailable(off);
            p.setUnavailableUntil(off ? until : null);
            changed.add(p);
        }
        if (!changed.isEmpty()) {
            productRepo.saveAll(changed);
            String names = changed.stream().limit(8).map(Product::getProductName).collect(Collectors.joining(", "));
            auditService.log(turnOn ? "MENU_ITEMS_TURNED_ON" : "MENU_ITEMS_TURNED_OFF", "Product", "bulk",
                    changed.size() + " item(s) " + (turnOn ? "turned ON" : "turned OFF"
                            + (until == null ? " until switched back on" : " until " + until))
                            + " by " + actor + ": " + names + (changed.size() > 8 ? ", ..." : ""));
            pushMenuChanged();
        }
    }

    /** Single item (used by the older "86" endpoints so they share the same rules, audit and live push). */
    public void setOne(Long productId, boolean turnOn, String actor) {
        applyChange(new SetRequest(List.of(productId), null, turnOn, "MANUAL", null), actor);
    }

    /** Clears every manual "off" (start of a new day, or "turn everything on"). */
    public int clearAllOff(String actor) {
        int n = productRepo.clearAll86s();
        if (n > 0) {
            auditService.log("MENU_ITEMS_TURNED_ON", "Product", "bulk", n + " item(s) turned ON (everything reset) by " + actor);
            pushMenuChanged();
        }
        return n;
    }

    /** Called every minute per tenant by the scheduler (TenantContext already set). Returns how many came back on. */
    public int restoreExpired() {
        int n = productRepo.restoreExpired(LocalDateTime.now());
        if (n > 0) {
            auditService.log("MENU_ITEMS_AUTO_RESTORED", "Product", "bulk", n + " item(s) switched back on automatically");
            pushMenuChanged();
        }
        return n;
    }

    private LocalDateTime resolveUntil(String mode, Integer minutes) {
        String m = mode == null ? "MANUAL" : mode.trim().toUpperCase();
        LocalDateTime now = LocalDateTime.now();
        switch (m) {
            case "END_OF_DAY": {
                LocalDateTime cut = now.toLocalDate().atTime(LocalTime.of(Math.max(0, Math.min(23, cutoverHour)), 0));
                return now.isBefore(cut) ? cut : cut.plusDays(1);
            }
            case "MINUTES": {
                int mins = minutes == null ? 60 : Math.max(5, Math.min(24 * 60, minutes));
                return now.plusMinutes(mins);
            }
            case "MANUAL":
                return null;
            default:
                throw new InvalidRequestException("Unknown duration: " + mode);
        }
    }

    /** Tells every open screen of this tenant to refetch. Sent AFTER the DB commit so a refetch never reads stale data. */
    private void pushMenuChanged() {
        String tenant = TenantContext.getCurrentTenant();
        if (tenant == null) return;
        qrMenuCache.invalidate(tenant); // customers' QR menu must reflect "out for today" straight away
        Runnable send = () -> messagingTemplate.convertAndSend("/topic/restaurant/" + tenant + "/menu",
                Map.of("at", System.currentTimeMillis()));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }
}
