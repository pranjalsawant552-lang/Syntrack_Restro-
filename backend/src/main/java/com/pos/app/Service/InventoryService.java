package com.pos.app.Service;

import com.pos.app.DTO.inventory.InventoryDTO.*;
import com.pos.app.Entity.*;
import com.pos.app.Enum.IngredientMovementType;
import com.pos.app.Exception.InsufficientStockException;
import com.pos.app.Exception.InvalidRequestException;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.*;
import com.pos.app.common.service.AuditService;
import com.pos.app.common.util.BatchAllocator;
import com.pos.app.common.util.UnitConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Ingredient inventory. THE ONLY place ingredient stock is changed: every change
 * writes an append-only {@link IngredientMovement}, updates the cached balance and
 * depletes/creates batches in the same transaction, under a row lock.
 */
@Service
@Transactional
public class InventoryService {

    private static final BigDecimal ZERO = BigDecimal.ZERO;

    @Autowired private IngredientRepository ingredientRepo;
    @Autowired private IngredientBatchRepository batchRepo;
    @Autowired private IngredientMovementRepository movementRepo;
    @Autowired private RecipeRepository recipeRepo;
    @Autowired private AuditService auditService;

    /**
     * false (default): a kitchen order is NEVER blocked by an inaccurate stock count -- stock may
     * go negative and shows up under "negative stock" alerts for the manager to fix.
     * true: sending a KOT fails with a clear message when an ingredient is short.
     */
    @Value("${app.inventory.block-on-insufficient:false}")
    private boolean blockOnInsufficient;

    /* ===================== queries ===================== */

    @Transactional(readOnly = true)
    public List<IngredientView> listIngredients(String search, Boolean active) {
        String q = (search == null || search.isBlank()) ? null : search.trim();
        return ingredientRepo.search(q, active).stream().map(this::toView).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<BatchView> listOpenBatches(Long ingredientId) {
        return batchRepo.findOpenByIngredient(ingredientId).stream()
                .sorted(Comparator.comparing((IngredientBatch b) -> b.getExpiryDate() == null ? LocalDate.MAX : b.getExpiryDate()))
                .map(b -> new BatchView(b.getBatchId(), b.getBatchNo(), b.getExpiryDate(),
                        b.getQtyRemaining(), b.getUnitCost(), b.getReceivedAt()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MovementView> listMovements(Long ingredientId, String type, LocalDate from, LocalDate to, int limit) {
        IngredientMovementType t = null;
        if (type != null && !type.isBlank()) {
            try { t = IngredientMovementType.valueOf(type.trim().toUpperCase(Locale.ROOT)); }
            catch (IllegalArgumentException e) { throw new InvalidRequestException("Invalid movement type: " + type); }
        }
        LocalDate f = from != null ? from : LocalDate.now().minusDays(30);
        LocalDate tt = to != null ? to : LocalDate.now();
        int size = Math.max(1, Math.min(limit, 1000));
        return movementRepo.search(ingredientId, t, f.atStartOfDay(), tt.plusDays(1).atStartOfDay(), PageRequest.of(0, size))
                .stream().map(m -> new MovementView(m.getMovementId(), m.getIngredient().getIngredientId(),
                        m.getIngredient().getName(), m.getIngredient().getBaseUnit(), m.getType().name(),
                        m.getQty(), m.getUnitCost(), m.getBalanceAfter(), m.getRefType(), m.getRefId(),
                        m.getReason(), m.getActionUser(), m.getCreatedAt()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AlertsView alerts(int daysAhead) {
        int days = Math.max(0, Math.min(daysAhead, 90));
        List<Ingredient> all = ingredientRepo.search(null, true);
        List<IngredientView> low = new ArrayList<>(), out = new ArrayList<>(), neg = new ArrayList<>();
        for (Ingredient i : all) {
            IngredientView v = toView(i);
            switch (v.status()) {
                case "NEGATIVE" -> neg.add(v);
                case "OUT" -> out.add(v);
                case "LOW" -> low.add(v);
                default -> { }
            }
        }
        LocalDate today = LocalDate.now();
        List<ExpiryAlert> soon = new ArrayList<>(), expired = new ArrayList<>();
        for (IngredientBatch b : batchRepo.findOpenExpiringOnOrBefore(today.plusDays(days))) {
            long left = ChronoUnit.DAYS.between(today, b.getExpiryDate());
            ExpiryAlert a = new ExpiryAlert(b.getBatchId(), b.getIngredient().getIngredientId(),
                    b.getIngredient().getName(), b.getIngredient().getBaseUnit(), b.getBatchNo(),
                    b.getExpiryDate(), b.getQtyRemaining(), left);
            if (left < 0) expired.add(a); else soon.add(a);
        }
        return new AlertsView(low, out, neg, soon, expired);
    }

    /* ===================== master data ===================== */

    public IngredientView createIngredient(IngredientRequest req) {
        String baseUnit = requireBaseUnit(req.baseUnit());
        String name = req.name().trim();
        if (ingredientRepo.findByNameIgnoreCase(name).isPresent()) {
            throw new InvalidRequestException("An ingredient named '" + name + "' already exists");
        }
        Ingredient i = new Ingredient();
        i.setName(name);
        i.setBaseUnit(baseUnit);
        i.setReorderLevel(req.reorderLevel() == null ? ZERO : req.reorderLevel());
        i.setActive(req.active() == null || req.active());
        Ingredient saved = ingredientRepo.save(i);
        auditService.log("INGREDIENT_CREATED", "Ingredient", String.valueOf(saved.getIngredientId()),
                "Created ingredient " + saved.getName() + " (" + saved.getBaseUnit() + ")");
        return toView(saved);
    }

    public IngredientView updateIngredient(Long id, IngredientRequest req) {
        Ingredient i = ingredientRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Ingredient not found"));
        String name = req.name().trim();
        ingredientRepo.findByNameIgnoreCase(name).ifPresent(other -> {
            if (!other.getIngredientId().equals(id)) throw new InvalidRequestException("An ingredient named '" + name + "' already exists");
        });
        String baseUnit = requireBaseUnit(req.baseUnit());
        if (!baseUnit.equals(i.getBaseUnit()) && movementRepo.existsByIngredient_IngredientId(id)) {
            // changing G -> ML after stock exists would silently corrupt every quantity/cost
            throw new InvalidRequestException("Base unit can't be changed once the ingredient has stock history");
        }
        i.setName(name);
        i.setBaseUnit(baseUnit);
        if (req.reorderLevel() != null) i.setReorderLevel(req.reorderLevel());
        if (req.active() != null) i.setActive(req.active());
        Ingredient saved = ingredientRepo.save(i);
        auditService.log("INGREDIENT_UPDATED", "Ingredient", String.valueOf(id), "Updated ingredient " + saved.getName());
        return toView(saved);
    }

    /* ===================== stock in / out ===================== */

    /** Goods received: new batch + PURCHASE movement + weighted-average cost update. */
    public IngredientView receive(ReceiveRequest req) {
        Ingredient ing = lockOne(req.ingredientId());
        BigDecimal qtyBase = toBase(req.qty(), req.unit(), ing);
        // cost per entered unit -> cost per base unit
        BigDecimal baseUnitsPerEntered = UnitConverter.convert(BigDecimal.ONE, req.unit(), ing.getBaseUnit());
        BigDecimal unitCost = req.costPerUnit().divide(baseUnitsPerEntered, 6, RoundingMode.HALF_UP);

        IngredientBatch b = new IngredientBatch();
        b.setIngredient(ing);
        b.setBatchNo(blankToNull(req.batchNo()));
        b.setExpiryDate(req.expiryDate());
        b.setQtyReceived(qtyBase);
        b.setQtyRemaining(qtyBase);
        b.setUnitCost(unitCost);
        b.setSupplierId(req.supplierId());
        b.setInvoiceRef(blankToNull(req.invoiceRef()));
        batchRepo.save(b);

        BigDecimal onHand = ing.getCurrentQty().max(ZERO);
        BigDecimal newTotal = onHand.add(qtyBase);
        BigDecimal newAvg = newTotal.signum() == 0 ? unitCost
                : onHand.multiply(ing.getAvgCost()).add(qtyBase.multiply(unitCost)).divide(newTotal, 6, RoundingMode.HALF_UP);
        ing.setAvgCost(newAvg);
        ing.setCurrentQty(ing.getCurrentQty().add(qtyBase));
        ingredientRepo.save(ing);

        writeMovement(ing, IngredientMovementType.PURCHASE, qtyBase, unitCost, "RECEIPT",
                b.getInvoiceRef(), req.supplierId() == null ? null : "Supplier #" + req.supplierId(), null);
        auditService.log("INGREDIENT_RECEIVED", "Ingredient", String.valueOf(ing.getIngredientId()),
                "Received " + req.qty() + " " + UnitConverter.norm(req.unit()) + " of " + ing.getName());
        return toView(ing);
    }

    /**
     * Takes back what a (now cancelled) purchase invoice added. Written as an ADJUSTMENT movement so the
     * ledger stays append-only. Never blocks on an inactive ingredient (cancelling must always be possible).
     */
    public void reversePurchaseReceipt(Long ingredientId, BigDecimal qty, String unit, String reason) {
        List<Ingredient> l = ingredientRepo.lockAllByIds(List.of(ingredientId));
        if (l.isEmpty()) return;
        Ingredient ing = l.get(0);
        BigDecimal qtyBase = toBase(qty, unit, ing);
        deduct(ing, qtyBase, IngredientMovementType.ADJUSTMENT, "PURCHASE_CANCEL", null, reason, null, false);
        auditService.log("INGREDIENT_PURCHASE_REVERSED", "Ingredient", String.valueOf(ingredientId),
                "Reversed " + qty + " " + UnitConverter.norm(unit) + " of " + ing.getName() + ": " + reason);
    }

    /** Spoilage / spillage / staff meal etc. Reason is mandatory. Batches are depleted FEFO. */
    public IngredientView recordWastage(WastageRequest req) {
        Ingredient ing = lockOne(req.ingredientId());
        BigDecimal qtyBase = toBase(req.qty(), req.unit(), ing);
        deduct(ing, qtyBase, IngredientMovementType.WASTAGE, "WASTAGE", null, req.reason().trim(), null, false);
        auditService.log("INGREDIENT_WASTAGE", "Ingredient", String.valueOf(ing.getIngredientId()),
                "Wasted " + req.qty() + " " + UnitConverter.norm(req.unit()) + " of " + ing.getName() + ": " + req.reason().trim());
        return toView(ing);
    }

    /** Stock-count correction: sets the balance to what was physically counted. */
    public IngredientView adjust(AdjustRequest req) {
        Ingredient ing = lockOne(req.ingredientId());
        BigDecimal counted = toBase(req.countedQty(), req.unit(), ing);
        BigDecimal diff = counted.subtract(ing.getCurrentQty());
        if (diff.signum() == 0) return toView(ing);

        String reason = req.reason().trim();
        if (diff.signum() < 0) {
            deduct(ing, diff.negate(), IngredientMovementType.ADJUSTMENT, "ADJUSTMENT", null, reason, null, false);
        } else {
            IngredientBatch b = new IngredientBatch();
            b.setIngredient(ing);
            b.setBatchNo("ADJ-" + LocalDate.now());
            b.setQtyReceived(diff);
            b.setQtyRemaining(diff);
            b.setUnitCost(ing.getAvgCost());
            batchRepo.save(b);
            ing.setCurrentQty(ing.getCurrentQty().add(diff));
            ingredientRepo.save(ing);
            writeMovement(ing, IngredientMovementType.ADJUSTMENT, diff, ing.getAvgCost(), "ADJUSTMENT", null, reason, null);
        }
        auditService.log("INGREDIENT_ADJUSTED", "Ingredient", String.valueOf(ing.getIngredientId()),
                ing.getName() + " counted " + req.countedQty() + " " + UnitConverter.norm(req.unit()) + " (" + reason + ")");
        return toView(ing);
    }

    /* ===================== recipe-based consumption ===================== */

    /**
     * Deducts the recipe ingredients for {@code portions} of a menu item. IDEMPOTENT per
     * (refType, refId): calling it twice for the same order item deducts once.
     * @return true if the item has a recipe (stock handled here), false if it has none
     */
    public boolean consumeForRecipe(Long productId, int portions, String refType, String refId) {
        return consumeForRecipe(productId, BigDecimal.valueOf(portions), refType, refId);
    }

    /** Same as above but for fractional portions (a "Half" variant consumes 0.5 of the recipe). */
    public boolean consumeForRecipe(Long productId, BigDecimal portions, String refType, String refId) {
        Optional<Recipe> opt = recipeRepo.findByProductIdWithItems(productId);
        if (opt.isEmpty() || opt.get().getItems().isEmpty()) return false;
        if (portions == null || portions.signum() <= 0) return true;
        if (movementRepo.existsByRefTypeAndRefIdAndType(refType, refId, IngredientMovementType.CONSUMPTION)) return true;

        // total need per ingredient, in base units
        Map<Long, BigDecimal> need = new LinkedHashMap<>();
        for (RecipeItem ri : opt.get().getItems()) {
            BigDecimal perPortion = UnitConverter.convert(ri.getQuantity(), ri.getUnit(), ri.getIngredient().getBaseUnit())
                    .multiply(BigDecimal.ONE.add(ri.getWastagePercent().movePointLeft(2)));
            need.merge(ri.getIngredient().getIngredientId(), perPortion.multiply(portions), BigDecimal::add);
        }
        Map<Long, Ingredient> locked = ingredientRepo.lockAllByIds(need.keySet()).stream()
                .collect(Collectors.toMap(Ingredient::getIngredientId, x -> x));
        for (Map.Entry<Long, BigDecimal> e : need.entrySet()) {
            Ingredient ing = locked.get(e.getKey());
            if (ing == null) continue;
            deduct(ing, e.getValue().setScale(4, RoundingMode.HALF_UP), IngredientMovementType.CONSUMPTION,
                    refType, refId, null, productId, blockOnInsufficient);
        }
        return true;
    }

    /* ===================== internals ===================== */

    private void deduct(Ingredient ing, BigDecimal qtyBase, IngredientMovementType type, String refType,
                        String refId, String reason, Long productId, boolean blockIfShort) {
        if (qtyBase.signum() <= 0) return;
        if (blockIfShort && ing.getCurrentQty().compareTo(qtyBase) < 0) {
            throw new InsufficientStockException("Not enough " + ing.getName() + " in stock. Available="
                    + ing.getCurrentQty().stripTrailingZeros().toPlainString() + " " + ing.getBaseUnit()
                    + ", needed=" + qtyBase.stripTrailingZeros().toPlainString() + " " + ing.getBaseUnit());
        }
        List<IngredientBatch> open = batchRepo.findOpenByIngredient(ing.getIngredientId());
        Map<Long, IngredientBatch> byId = new HashMap<>();
        List<BatchAllocator.Slot> slots = new ArrayList<>();
        for (IngredientBatch b : open) {
            byId.put(b.getBatchId(), b);
            slots.add(new BatchAllocator.Slot() {
                public Object id() { return b.getBatchId(); }
                public BigDecimal remaining() { return b.getQtyRemaining(); }
                public LocalDate expiry() { return b.getExpiryDate(); }
                public LocalDateTime receivedAt() { return b.getReceivedAt(); }
            });
        }
        BatchAllocator.Result r = BatchAllocator.allocate(slots, qtyBase);
        for (BatchAllocator.Take t : r.takes()) {
            IngredientBatch b = byId.get((Long) t.batchId());
            b.setQtyRemaining(b.getQtyRemaining().subtract(t.qty()));
            batchRepo.save(b);
        }
        // any shortfall has no batch to draw from: the balance still goes down (may go negative)
        ing.setCurrentQty(ing.getCurrentQty().subtract(qtyBase));
        ingredientRepo.save(ing);
        writeMovement(ing, type, qtyBase.negate(), ing.getAvgCost(), refType, refId, reason, productId);
    }

    private void writeMovement(Ingredient ing, IngredientMovementType type, BigDecimal signedQty, BigDecimal unitCost,
                               String refType, String refId, String reason, Long productId) {
        IngredientMovement m = new IngredientMovement();
        m.setIngredient(ing);
        m.setType(type);
        m.setQty(signedQty);
        m.setUnitCost(unitCost == null ? ZERO : unitCost);
        m.setBalanceAfter(ing.getCurrentQty());
        m.setRefType(refType);
        m.setRefId(refId);
        m.setReason(reason);
        m.setProductId(productId);
        m.setActionUser(currentActor());
        movementRepo.save(m);
    }

    private Ingredient lockOne(Long id) {
        List<Ingredient> l = ingredientRepo.lockAllByIds(List.of(id));
        if (l.isEmpty()) throw new ResourceNotFoundExceptionHandling("Ingredient not found");
        Ingredient i = l.get(0);
        if (!i.isActive()) throw new InvalidRequestException(i.getName() + " is inactive");
        return i;
    }

    private BigDecimal toBase(BigDecimal qty, String unit, Ingredient ing) {
        if (!UnitConverter.isSupported(unit)) throw new InvalidRequestException("Unsupported unit: " + unit);
        try {
            return UnitConverter.convert(qty, unit, ing.getBaseUnit());
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException(ing.getName() + " is measured in " + ing.getBaseUnit() + "; " + e.getMessage());
        }
    }

    private String requireBaseUnit(String unit) {
        if (!UnitConverter.isSupported(unit)) throw new InvalidRequestException("Unsupported unit: " + unit + " (use G, ML or PCS)");
        String base = UnitConverter.norm(unit);
        if (!base.equals(UnitConverter.baseUnitOf(base))) {
            throw new InvalidRequestException("Base unit must be G, ML or PCS (got " + base + ")");
        }
        return base;
    }

    IngredientView toView(Ingredient i) {
        BigDecimal q = i.getCurrentQty();
        String status;
        if (q.signum() < 0) status = "NEGATIVE";
        else if (q.signum() == 0) status = "OUT";
        else if (i.getReorderLevel().signum() > 0 && q.compareTo(i.getReorderLevel()) <= 0) status = "LOW";
        else status = "OK";
        BigDecimal value = q.max(ZERO).multiply(i.getAvgCost()).setScale(2, RoundingMode.HALF_UP);
        return new IngredientView(i.getIngredientId(), i.getName(), i.getBaseUnit(), q, i.getReorderLevel(),
                i.getAvgCost(), value, status, i.isActive());
    }

    private static String blankToNull(String s) { return (s == null || s.isBlank()) ? null : s.trim(); }

    private static String currentActor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth == null || auth.getName() == null) ? "SYSTEM" : auth.getName();
    }
}
