package com.pos.app.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.pos.app.Entity.ComboItem;
import com.pos.app.Entity.ModifierGroup;
import com.pos.app.Entity.ModifierOption;
import com.pos.app.Entity.Product;
import com.pos.app.Entity.ProductModifierGroup;
import com.pos.app.Entity.ProductVariant;
import com.pos.app.Exception.InvalidRequestException;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.ComboItemRepository;
import com.pos.app.Repository.ModifierGroupRepository;
import com.pos.app.Repository.ModifierOptionRepository;
import com.pos.app.Repository.ProductModifierGroupRepository;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Repository.ProductVariantRepository;
import com.pos.app.common.service.AuditService;

import jakarta.transaction.Transactional;

/**
 * Menu customisation: variants (Half/Full), modifier groups (add-ons / choices) and combos.
 * Also validates and prices a waiter's selection when an item is added to an order, so the price
 * can never be trusted from the client.
 */
@Service
@Transactional
public class MenuOptionsService {

    @Autowired private ProductRepository productRepo;
    @Autowired private ProductVariantRepository variantRepo;
    @Autowired private ModifierGroupRepository groupRepo;
    @Autowired private ModifierOptionRepository optionRepo;
    @Autowired private ProductModifierGroupRepository linkRepo;
    @Autowired private ComboItemRepository comboRepo;
    @Autowired private AuditService auditService;

    /* ===================== views ===================== */

    public record VariantView(Long variantId, String name, double price, double recipeFactor, boolean active) {}
    public record OptionView(Long optionId, String name, double price, boolean active) {}
    public record GroupView(Long groupId, String name, boolean required, int minSelect, int maxSelect,
                            boolean active, List<OptionView> options) {}
    public record ComboLine(Long componentProductId, String componentName, int quantity) {}
    public record ProductOptions(Long productId, boolean combo, List<VariantView> variants,
                                 List<GroupView> groups, List<ComboLine> comboItems) {}

    /** Result of validating a selection: what to store on the order line. */
    public record Selection(double unitPrice, Long variantId, String variantName, String optionsText,
                            double portionFactor) {}

    /* ===================== requests ===================== */

    public record VariantRequest(Long variantId, String name, Double price, Double recipeFactor, Boolean active) {}
    public record OptionRequest(Long optionId, String name, Double price, Boolean active) {}
    public record GroupRequest(String name, Boolean required, Integer minSelect, Integer maxSelect,
                               Boolean active, List<OptionRequest> options) {}
    public record ComboRequest(Long componentProductId, Integer quantity) {}

    /* ===================== reads ===================== */

    /**
     * Everything selectable on one menu item. {@code forOrdering=true} hides inactive variants /
     * groups / options (what a waiter sees); false returns them all (what the editor needs).
     */
    public ProductOptions getForProduct(Long productId, boolean forOrdering) {
        Product p = productRepo.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Menu item not found"));

        List<VariantView> variants = variantRepo.findByProductIdOrderBySortOrderAscVariantIdAsc(productId).stream()
                .filter(v -> !forOrdering || v.isActive())
                .map(v -> new VariantView(v.getVariantId(), v.getName(), v.getPrice(), v.getRecipeFactor(), v.isActive()))
                .collect(Collectors.toList());

        List<Long> groupIds = linkRepo.findByProductIdOrderBySortOrderAscIdAsc(productId).stream()
                .map(ProductModifierGroup::getGroupId).collect(Collectors.toList());
        List<GroupView> groups = buildGroups(groupIds, forOrdering);

        List<ComboLine> combo = new ArrayList<>();
        if (p.isCombo()) {
            for (ComboItem c : comboRepo.findByComboProductIdOrderByIdAsc(productId)) {
                String name = productRepo.findById(c.getComponentProductId()).map(Product::getProductName).orElse("(deleted item)");
                combo.add(new ComboLine(c.getComponentProductId(), name, c.getQuantity()));
            }
        }
        return new ProductOptions(productId, p.isCombo(), variants, groups, combo);
    }

    public List<GroupView> listGroups() {
        List<Long> ids = groupRepo.findAllByOrderByNameAsc().stream().map(ModifierGroup::getGroupId).collect(Collectors.toList());
        return buildGroups(ids, false);
    }

    private List<GroupView> buildGroups(List<Long> orderedGroupIds, boolean forOrdering) {
        if (orderedGroupIds.isEmpty()) return new ArrayList<>();
        Map<Long, ModifierGroup> groups = groupRepo.findAllById(orderedGroupIds).stream()
                .collect(Collectors.toMap(ModifierGroup::getGroupId, g -> g));
        Map<Long, List<ModifierOption>> options = optionRepo.findByGroupIdInOrderBySortOrderAscOptionIdAsc(orderedGroupIds).stream()
                .collect(Collectors.groupingBy(ModifierOption::getGroupId, LinkedHashMap::new, Collectors.toList()));
        List<GroupView> out = new ArrayList<>();
        for (Long id : orderedGroupIds) {
            ModifierGroup g = groups.get(id);
            if (g == null || (forOrdering && !g.isActive())) continue;
            List<OptionView> opts = options.getOrDefault(id, List.of()).stream()
                    .filter(o -> !forOrdering || o.isActive())
                    .map(o -> new OptionView(o.getOptionId(), o.getName(), o.getPrice(), o.isActive()))
                    .collect(Collectors.toList());
            if (forOrdering && opts.isEmpty()) continue; // nothing to choose from
            out.add(new GroupView(g.getGroupId(), g.getName(), g.isRequired(), g.getMinSelect(), g.getMaxSelect(), g.isActive(), opts));
        }
        return out;
    }

    /* ===================== modifier groups ===================== */

    public GroupView createGroup(GroupRequest req) {
        ModifierGroup g = new ModifierGroup();
        applyGroup(g, req);
        g = groupRepo.save(g);
        replaceOptions(g.getGroupId(), req.options());
        auditService.log("MODIFIER_GROUP_CREATED", "ModifierGroup", String.valueOf(g.getGroupId()), "Created modifier group " + g.getName());
        return buildGroups(List.of(g.getGroupId()), false).get(0);
    }

    public GroupView updateGroup(Long groupId, GroupRequest req) {
        ModifierGroup g = groupRepo.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Modifier group not found"));
        applyGroup(g, req);
        groupRepo.save(g);
        replaceOptions(groupId, req.options());
        auditService.log("MODIFIER_GROUP_UPDATED", "ModifierGroup", String.valueOf(groupId), "Updated modifier group " + g.getName());
        return buildGroups(List.of(groupId), false).get(0);
    }

    public void deleteGroup(Long groupId) {
        ModifierGroup g = groupRepo.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Modifier group not found"));
        // Past orders/invoices only keep a text snapshot of what was chosen, so this is safe.
        linkRepo.deleteAllByGroupId(groupId);
        optionRepo.deleteAllByGroupId(groupId);
        groupRepo.delete(g);
        auditService.log("MODIFIER_GROUP_DELETED", "ModifierGroup", String.valueOf(groupId), "Deleted modifier group " + g.getName());
    }

    private void applyGroup(ModifierGroup g, GroupRequest req) {
        String name = req.name() == null ? "" : req.name().trim();
        if (name.isEmpty()) throw new InvalidRequestException("Group name is required");
        if (name.length() > 80) throw new InvalidRequestException("Group name is too long (max 80)");
        int min = req.minSelect() == null ? 0 : req.minSelect();
        int max = req.maxSelect() == null ? 0 : req.maxSelect();
        boolean required = req.required() != null && req.required();
        if (min < 0 || max < 0) throw new InvalidRequestException("Min/max selections cannot be negative");
        if (required && min < 1) min = 1;
        if (max > 0 && min > max) throw new InvalidRequestException("Minimum selections cannot exceed the maximum");
        g.setName(name);
        g.setRequired(required);
        g.setMinSelect(min);
        g.setMaxSelect(max);
        g.setActive(req.active() == null || req.active());
    }

    private void replaceOptions(Long groupId, List<OptionRequest> options) {
        if (options == null || options.isEmpty()) throw new InvalidRequestException("Add at least one option to the group");
        Set<String> seen = new HashSet<>();
        List<ModifierOption> rows = new ArrayList<>();
        int order = 0;
        for (OptionRequest o : options) {
            String name = o.name() == null ? "" : o.name().trim();
            if (name.isEmpty()) throw new InvalidRequestException("Every option needs a name");
            if (!seen.add(name.toLowerCase())) throw new InvalidRequestException("Option \"" + name + "\" is listed twice");
            double price = o.price() == null ? 0 : o.price();
            if (Double.isNaN(price) || price < 0) throw new InvalidRequestException("Option price cannot be negative");
            ModifierOption row = new ModifierOption();
            row.setGroupId(groupId);
            row.setName(name);
            row.setPrice(price);
            row.setActive(o.active() == null || o.active());
            row.setSortOrder(order++);
            rows.add(row);
        }
        optionRepo.deleteAllByGroupId(groupId);
        optionRepo.flush();
        optionRepo.saveAll(rows);
    }

    /* ===================== per-product assignment ===================== */

    public ProductOptions setVariants(Long productId, List<VariantRequest> reqs) {
        productRepo.findById(productId).orElseThrow(() -> new ResourceNotFoundExceptionHandling("Menu item not found"));
        List<ProductVariant> rows = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int order = 0;
        for (VariantRequest r : (reqs == null ? List.<VariantRequest>of() : reqs)) {
            String name = r.name() == null ? "" : r.name().trim();
            if (name.isEmpty()) throw new InvalidRequestException("Every variant needs a name");
            if (!seen.add(name.toLowerCase())) throw new InvalidRequestException("Variant \"" + name + "\" is listed twice");
            double price = r.price() == null ? -1 : r.price();
            if (Double.isNaN(price) || price < 0) throw new InvalidRequestException("Variant \"" + name + "\" needs a price (0 or more)");
            double factor = r.recipeFactor() == null ? 1.0 : r.recipeFactor();
            if (Double.isNaN(factor) || factor <= 0 || factor > 10) throw new InvalidRequestException("Portion factor must be between 0 and 10");
            ProductVariant v = new ProductVariant();
            v.setProductId(productId);
            v.setName(name);
            v.setPrice(price);
            v.setRecipeFactor(factor);
            v.setActive(r.active() == null || r.active());
            v.setSortOrder(order++);
            rows.add(v);
        }
        variantRepo.deleteAllByProductId(productId);
        variantRepo.flush();
        variantRepo.saveAll(rows);
        auditService.log("MENU_VARIANTS_SAVED", "Product", String.valueOf(productId), rows.size() + " variant(s) saved");
        return getForProduct(productId, false);
    }

    public ProductOptions setModifierGroups(Long productId, List<Long> groupIds) {
        productRepo.findById(productId).orElseThrow(() -> new ResourceNotFoundExceptionHandling("Menu item not found"));
        List<Long> ids = groupIds == null ? List.of() : groupIds.stream().distinct().collect(Collectors.toList());
        Set<Long> existing = groupRepo.findAllById(ids).stream().map(ModifierGroup::getGroupId).collect(Collectors.toSet());
        for (Long id : ids) {
            if (!existing.contains(id)) throw new InvalidRequestException("Modifier group #" + id + " not found");
        }
        linkRepo.deleteAllByProductId(productId);
        linkRepo.flush();
        int order = 0;
        List<ProductModifierGroup> rows = new ArrayList<>();
        for (Long id : ids) {
            ProductModifierGroup l = new ProductModifierGroup();
            l.setProductId(productId);
            l.setGroupId(id);
            l.setSortOrder(order++);
            rows.add(l);
        }
        linkRepo.saveAll(rows);
        auditService.log("MENU_MODIFIERS_ASSIGNED", "Product", String.valueOf(productId), ids.size() + " modifier group(s) assigned");
        return getForProduct(productId, false);
    }

    public ProductOptions setCombo(Long productId, List<ComboRequest> reqs) {
        Product combo = productRepo.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Menu item not found"));
        if (!combo.isCombo()) throw new InvalidRequestException("Mark this item as a combo first");
        if (reqs == null || reqs.isEmpty()) throw new InvalidRequestException("A combo needs at least one component");
        Map<Long, Integer> merged = new LinkedHashMap<>();
        for (ComboRequest r : reqs) {
            if (r.componentProductId() == null) throw new InvalidRequestException("Pick a product for every combo line");
            if (r.componentProductId().equals(productId)) throw new InvalidRequestException("A combo cannot contain itself");
            int qty = r.quantity() == null ? 1 : r.quantity();
            if (qty < 1 || qty > 99) throw new InvalidRequestException("Component quantity must be between 1 and 99");
            merged.merge(r.componentProductId(), qty, Integer::sum);
        }
        Map<Long, Product> comps = new HashMap<>();
        for (Product c : productRepo.findAllById(merged.keySet())) comps.put(c.getProductId(), c);
        List<ComboItem> rows = new ArrayList<>();
        for (Map.Entry<Long, Integer> e : merged.entrySet()) {
            Product c = comps.get(e.getKey());
            if (c == null) throw new InvalidRequestException("Component #" + e.getKey() + " not found");
            if (c.isCombo()) throw new InvalidRequestException("\"" + c.getProductName() + "\" is itself a combo; combos cannot be nested");
            ComboItem ci = new ComboItem();
            ci.setComboProductId(productId);
            ci.setComponentProductId(e.getKey());
            ci.setQuantity(e.getValue());
            rows.add(ci);
        }
        comboRepo.deleteAllByComboProductId(productId);
        comboRepo.flush();
        comboRepo.saveAll(rows);
        auditService.log("COMBO_SAVED", "Product", String.valueOf(productId), "Combo " + combo.getProductName() + " has " + rows.size() + " component(s)");
        return getForProduct(productId, false);
    }

    public List<ComboItem> comboComponents(Long comboProductId) {
        return comboRepo.findByComboProductIdOrderByIdAsc(comboProductId);
    }

    /* ===================== ordering: validate + price a selection ===================== */

    /**
     * Turns a waiter's picks into a trusted price + snapshot. Throws InvalidRequestException (HTTP 400)
     * with a plain-English message when a required choice is missing, a choice doesn't belong to the item,
     * or min/max limits are violated.
     */
    @Transactional
    public Selection resolveSelection(Product product, Long variantId, List<Long> modifierIds) {
        double price = product.getProdPrice();
        Long vId = null;
        String vName = null;
        double factor = 1.0;

        List<ProductVariant> variants = variantRepo.findByProductIdOrderBySortOrderAscVariantIdAsc(product.getProductId()).stream()
                .filter(ProductVariant::isActive).collect(Collectors.toList());
        if (!variants.isEmpty()) {
            if (variantId == null) throw new InvalidRequestException("Choose a size/variant for " + product.getProductName());
            ProductVariant v = variants.stream().filter(x -> x.getVariantId().equals(variantId)).findFirst()
                    .orElseThrow(() -> new InvalidRequestException("That variant isn't available for " + product.getProductName()));
            price = v.getPrice();
            vId = v.getVariantId();
            vName = v.getName();
            factor = v.getRecipeFactor();
        } else if (variantId != null) {
            throw new InvalidRequestException(product.getProductName() + " has no variants");
        }

        List<GroupView> groups = buildGroups(
                linkRepo.findByProductIdOrderBySortOrderAscIdAsc(product.getProductId()).stream()
                        .map(ProductModifierGroup::getGroupId).collect(Collectors.toList()), true);
        Set<Long> picked = modifierIds == null ? new HashSet<>() : new HashSet<>(modifierIds);

        Map<Long, OptionView> optionById = new HashMap<>();
        Map<Long, Long> groupOfOption = new HashMap<>();
        for (GroupView g : groups) {
            for (OptionView o : g.options()) { optionById.put(o.optionId(), o); groupOfOption.put(o.optionId(), g.groupId()); }
        }
        for (Long id : picked) {
            if (!optionById.containsKey(id)) throw new InvalidRequestException("One of the chosen add-ons isn't available for " + product.getProductName());
        }

        List<String> names = new ArrayList<>();
        for (GroupView g : groups) {
            List<OptionView> chosen = g.options().stream().filter(o -> picked.contains(o.optionId())).collect(Collectors.toList());
            int min = g.required() ? Math.max(1, g.minSelect()) : g.minSelect();
            if (chosen.size() < min) {
                throw new InvalidRequestException("Choose " + (min == 1 ? "an option" : "at least " + min + " options")
                        + " for \"" + g.name() + "\"");
            }
            if (g.maxSelect() > 0 && chosen.size() > g.maxSelect()) {
                throw new InvalidRequestException("\"" + g.name() + "\" allows at most " + g.maxSelect() + " choice(s)");
            }
            for (OptionView o : chosen) { price += o.price(); names.add(o.name()); }
        }
        price = Math.round(price * 100.0) / 100.0;
        return new Selection(price, vId, vName, names.isEmpty() ? null : String.join(", ", names), factor);
    }
}
