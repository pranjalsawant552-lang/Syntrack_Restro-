package com.pos.app.Service;

import com.pos.app.DTO.inventory.KotDTO.*;
import com.pos.app.Entity.*;
import com.pos.app.Enum.KotItemStatus;
import com.pos.app.Enum.KotStatus;
import com.pos.app.Exception.InvalidRequestException;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.*;
import com.pos.app.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Kitchen tickets. A LEAF service (never calls RestaurantServiceImpl) so there is no circular
 * dependency: RestaurantServiceImpl creates KOTs and tells this service when items are served/voided.
 */
@Service
@Transactional
public class KotService {

    private static final List<KotStatus> ACTIVE = List.of(KotStatus.NEW, KotStatus.PREPARING); // READY is the kitchen's final step: a ready ticket leaves the kitchen screen

    @Autowired private KitchenStationRepository stationRepo;
    @Autowired private MenuItemStationRepository mappingRepo;
    @Autowired private com.pos.app.Repository.ComboItemRepository comboItemRepo;
    @Autowired private com.pos.app.Repository.ProductRepository productRepo;
    @Autowired private KotRepository kotRepo;
    @Autowired private KotItemRepository kotItemRepo;
    @Autowired private SimpMessagingTemplate messagingTemplate;

    /* ===================== stations ===================== */

    @Transactional(readOnly = true)
    public List<StationView> listStations() {
        ensureDefaultStation();
        return stationRepo.findAllByOrderByNameAsc().stream().map(this::view).collect(Collectors.toList());
    }

    public StationView saveStation(Long id, StationRequest req) {
        String name = req.name().trim();
        stationRepo.findByNameIgnoreCase(name).ifPresent(o -> {
            if (!o.getStationId().equals(id)) throw new InvalidRequestException("A station named '" + name + "' already exists");
        });
        KitchenStation s = id == null ? new KitchenStation()
                : stationRepo.findById(id).orElseThrow(() -> new ResourceNotFoundExceptionHandling("Station not found"));
        s.setName(name);
        s.setPrinterName(req.printerName() == null || req.printerName().isBlank() ? null : req.printerName().trim());
        if (req.active() != null) {
            if (!req.active() && s.isDefault()) throw new InvalidRequestException("The default station can't be deactivated");
            s.setActive(req.active());
        }
        if (Boolean.TRUE.equals(req.isDefault())) {
            stationRepo.findAll().forEach(o -> { if (o.isDefault()) { o.setDefault(false); stationRepo.save(o); } });
            s.setDefault(true);
            s.setActive(true);
        }
        return view(stationRepo.save(s));
    }

    @Transactional(readOnly = true)
    public List<MappingView> listMappings() {
        return mappingRepo.findAll().stream().map(m -> new MappingView(m.getProductId(), m.getStationId())).collect(Collectors.toList());
    }

    public void assignProduct(Long productId, Long stationId) {
        if (stationId == null) {
            mappingRepo.findByProductId(productId).ifPresent(mappingRepo::delete);
            return;
        }
        stationRepo.findById(stationId).orElseThrow(() -> new ResourceNotFoundExceptionHandling("Station not found"));
        MenuItemStation m = mappingRepo.findByProductId(productId).orElseGet(MenuItemStation::new);
        m.setProductId(productId);
        m.setStationId(stationId);
        mappingRepo.save(m);
    }

    private KitchenStation ensureDefaultStation() {
        return stationRepo.findFirstByIsDefaultTrue().orElseGet(() -> {
            KitchenStation s = stationRepo.findByNameIgnoreCase("Kitchen").orElseGet(KitchenStation::new);
            s.setName("Kitchen");
            s.setDefault(true);
            s.setActive(true);
            return stationRepo.save(s);
        });
    }

    /* ===================== creating tickets ===================== */

    /** One KOT per station for the given (just-sent) order items. */
    public List<Kot> createKots(RestaurantOrder order, List<RestaurantOrderItem> items, String actor) {
        KitchenStation dflt = ensureDefaultStation();
        Map<Long, Long> stationOfProduct = mappingRepo.findByProductIdIn(
                        items.stream().map(i -> i.getProduct().getProductId()).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(MenuItemStation::getProductId, MenuItemStation::getStationId));
        Map<Long, KitchenStation> stations = stationRepo.findAll().stream()
                .collect(Collectors.toMap(KitchenStation::getStationId, s -> s));

        Map<Long, List<RestaurantOrderItem>> byStation = new LinkedHashMap<>();
        for (RestaurantOrderItem i : items) {
            Long sid = stationOfProduct.get(i.getProduct().getProductId());
            KitchenStation st = sid == null ? null : stations.get(sid);
            if (st == null || !st.isActive()) st = dflt;
            byStation.computeIfAbsent(st.getStationId(), k -> new ArrayList<>()).add(i);
        }

        String label = order.getTable() != null ? order.getTable().getTableName()
                : (order.getOrderType() == null ? "Counter" : order.getOrderType().name())
                  + (order.getCustomerName() != null && !order.getCustomerName().isBlank() ? " - " + order.getCustomerName() : "")
                  + (order.getOrderSource() != null && !order.getOrderSource().isBlank() ? " (" + order.getOrderSource() + ")" : "");

        List<Kot> created = new ArrayList<>();
        for (Map.Entry<Long, List<RestaurantOrderItem>> e : byStation.entrySet()) {
            KitchenStation st = stations.get(e.getKey());
            Kot k = new Kot();
            k.setOrderId(order.getOrderId());
            k.setStationId(st.getStationId());
            k.setStationName(st.getName());
            k.setTableLabel(label);
            k.setOrderType(order.getOrderType() == null ? null : order.getOrderType().name());
            k.setWaiterName(order.getWaiterName());
            k.setCreatedBy(actor);
            for (RestaurantOrderItem oi : e.getValue()) {
                KotItem ki = new KotItem();
                ki.setKot(k);
                ki.setOrderItemId(oi.getOrderItemId());
                ki.setProductName(oi.getDisplayName());
                ki.setQuantity(oi.getQuantity());
                ki.setNotes(kitchenNotes(oi));
                k.getItems().add(ki);
            }
            Kot saved = kotRepo.saveAndFlush(k);
            saved.setKotNumber("K" + String.format("%05d", saved.getKotId()));
            created.add(kotRepo.save(saved));
        }
        broadcast();
        return created;
    }

    /**
     * What the cook needs to see under the dish name: chosen add-ons, the contents of a combo, then the
     * waiter's free-text note. Kept under the notes column's 255-char limit (existing tenant schemas
     * aren't widened by schema repair, so never rely on a longer column).
     */
    private String kitchenNotes(RestaurantOrderItem oi) {
        List<String> parts = new ArrayList<>();
        if (oi.getOptionsText() != null && !oi.getOptionsText().isBlank()) parts.add(oi.getOptionsText().trim());
        if (oi.getProduct() != null && oi.getProduct().isCombo()) {
            List<String> inc = new ArrayList<>();
            for (com.pos.app.Entity.ComboItem c : comboItemRepo.findByComboProductIdOrderByIdAsc(oi.getProduct().getProductId())) {
                String n = productRepo.findById(c.getComponentProductId()).map(com.pos.app.Entity.Product::getProductName).orElse("?");
                inc.add(c.getQuantity() * oi.getQuantity() + "x " + n);
            }
            if (!inc.isEmpty()) parts.add("Includes: " + String.join(", ", inc));
        }
        if (oi.getNotes() != null && !oi.getNotes().isBlank()) parts.add(oi.getNotes().trim());
        if (parts.isEmpty()) return null;
        String joined = String.join(" | ", parts);
        return joined.length() > 250 ? joined.substring(0, 247) + "..." : joined;
    }

    /* ===================== queries ===================== */

    @Transactional(readOnly = true)
    public List<KotView> listActive(Long stationId) {
        return kotRepo.findActive(ACTIVE, stationId).stream().map(this::view).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<KotView> forOrder(Long orderId) {
        return kotRepo.findByOrderIdWithItems(orderId).stream().map(this::view).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public KotView get(Long kotId) {
        return view(kotRepo.findByIdWithItems(kotId).orElseThrow(() -> new ResourceNotFoundExceptionHandling("KOT not found")));
    }

    /* ===================== kitchen actions ===================== */

    /** NEW lines -> PREPARING (whole ticket). */
    public KotView start(Long kotId) {
        Kot k = load(kotId);
        for (KotItem i : k.getItems()) if (i.getStatus() == KotItemStatus.NEW) i.setStatus(KotItemStatus.PREPARING);
        recompute(k);
        kotRepo.save(k);
        broadcast();
        return view(k);
    }

    /** Every line still being made -> READY (whole ticket). */
    public KotView ready(Long kotId) {
        Kot k = load(kotId);
        for (KotItem i : k.getItems()) {
            if (i.getStatus() == KotItemStatus.NEW || i.getStatus() == KotItemStatus.PREPARING) i.setStatus(KotItemStatus.READY);
        }
        recompute(k);
        kotRepo.save(k);
        broadcast();
        return view(k);
    }

    /** Single line to PREPARING or READY. */
    public KotView setItemStatus(Long kotItemId, String status) {
        KotItem ki = kotItemRepo.findByIdWithKot(kotItemId).orElseThrow(() -> new ResourceNotFoundExceptionHandling("KOT line not found"));
        KotItemStatus target;
        try { target = KotItemStatus.valueOf(status.trim().toUpperCase(Locale.ROOT)); }
        catch (Exception e) { throw new InvalidRequestException("Invalid status: " + status); }
        if (target != KotItemStatus.PREPARING && target != KotItemStatus.READY) {
            throw new InvalidRequestException("Lines can only be set to PREPARING or READY here");
        }
        if (ki.getStatus() == KotItemStatus.SERVED || ki.getStatus() == KotItemStatus.VOIDED) {
            throw new InvalidRequestException("This line is already " + ki.getStatus());
        }
        ki.setStatus(target);
        recompute(ki.getKot());
        kotRepo.save(ki.getKot());
        broadcast();
        return view(ki.getKot());
    }

    /** order-item ids on this ticket that are not yet served/voided (controller then serves them through the order flow). */
    @Transactional(readOnly = true)
    public List<Long> servableOrderItemIds(Long kotId) {
        return load(kotId).getItems().stream()
                .filter(i -> i.getStatus() != KotItemStatus.SERVED && i.getStatus() != KotItemStatus.VOIDED)
                .map(KotItem::getOrderItemId).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Long orderItemIdOf(Long kotItemId) {
        return kotItemRepo.findByIdWithKot(kotItemId).orElseThrow(() -> new ResourceNotFoundExceptionHandling("KOT line not found")).getOrderItemId();
    }

    /* ===================== hooks called by RestaurantServiceImpl ===================== */

    public void onOrderItemServed(Long orderItemId) {
        kotItemRepo.findByOrderItemIdWithKot(orderItemId).ifPresent(ki -> {
            if (ki.getStatus() != KotItemStatus.VOIDED) ki.setStatus(KotItemStatus.SERVED);
            recompute(ki.getKot());
            kotRepo.save(ki.getKot());
            broadcast();
        });
    }

    /** @return the line's status BEFORE the void (null if it never reached a KOT). */
    public KotItemStatus onOrderItemVoided(Long orderItemId) {
        var opt = kotItemRepo.findByOrderItemIdWithKot(orderItemId);
        if (opt.isEmpty()) return null;
        KotItem ki = opt.get();
        KotItemStatus before = ki.getStatus();
        ki.setStatus(KotItemStatus.VOIDED);
        recompute(ki.getKot());
        kotRepo.save(ki.getKot());
        broadcast();
        return before;
    }

    public void onOrderCancelled(Long orderId) {
        for (Kot k : kotRepo.findByOrderIdWithItems(orderId)) {
            boolean changed = false;
            for (KotItem i : k.getItems()) {
                if (i.getStatus() != KotItemStatus.SERVED && i.getStatus() != KotItemStatus.VOIDED) { i.setStatus(KotItemStatus.VOIDED); changed = true; }
            }
            if (changed) { recompute(k); kotRepo.save(k); }
        }
        broadcast();
    }

    /* ===================== internals ===================== */

    private Kot load(Long id) {
        return kotRepo.findByIdWithItems(id).orElseThrow(() -> new ResourceNotFoundExceptionHandling("KOT not found"));
    }

    private void recompute(Kot k) {
        List<KotItem> live = k.getItems().stream().filter(i -> i.getStatus() != KotItemStatus.VOIDED).collect(Collectors.toList());
        LocalDateTime now = LocalDateTime.now();
        if (live.isEmpty()) { k.setStatus(KotStatus.CANCELLED); return; }
        if (live.stream().allMatch(i -> i.getStatus() == KotItemStatus.SERVED)) {
            k.setStatus(KotStatus.SERVED);
            if (k.getServedAt() == null) k.setServedAt(now);
            return;
        }
        List<KotItem> open = live.stream().filter(i -> i.getStatus() != KotItemStatus.SERVED).collect(Collectors.toList());
        if (open.stream().allMatch(i -> i.getStatus() == KotItemStatus.READY)) {
            k.setStatus(KotStatus.READY);
            if (k.getReadyAt() == null) k.setReadyAt(now);
        } else if (open.stream().anyMatch(i -> i.getStatus() != KotItemStatus.NEW) || live.stream().anyMatch(i -> i.getStatus() == KotItemStatus.SERVED)) {
            k.setStatus(KotStatus.PREPARING);
            if (k.getStartedAt() == null) k.setStartedAt(now);
        } else {
            k.setStatus(KotStatus.NEW);
        }
    }

    private void broadcast() {
        String tenant = TenantContext.getCurrentTenant();
        if (tenant == null) return;
        messagingTemplate.convertAndSend("/topic/restaurant/" + tenant + "/kots", listActive(null));
    }

    private StationView view(KitchenStation s) {
        return new StationView(s.getStationId(), s.getName(), s.getPrinterName(), s.isDefault(), s.isActive());
    }

    private KotView view(Kot k) {
        List<KotItemView> items = k.getItems().stream()
                .sorted(Comparator.comparing(KotItem::getKotItemId))
                .map(i -> new KotItemView(i.getKotItemId(), i.getOrderItemId(), i.getProductName(), i.getQuantity(), i.getNotes(), i.getStatus().name()))
                .collect(Collectors.toList());
        return new KotView(k.getKotId(), k.getKotNumber(), k.getOrderId(), k.getStationId(), k.getStationName(),
                k.getTableLabel(), k.getOrderType(), k.getWaiterName(), k.getStatus().name(), k.getCreatedAt(),
                Math.max(0, Duration.between(k.getCreatedAt(), LocalDateTime.now()).getSeconds()), items);
    }
}
