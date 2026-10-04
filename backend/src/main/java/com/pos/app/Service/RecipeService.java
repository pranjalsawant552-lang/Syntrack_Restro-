package com.pos.app.Service;

import com.pos.app.DTO.inventory.InventoryDTO.*;
import com.pos.app.Entity.Ingredient;
import com.pos.app.Entity.Product;
import com.pos.app.Entity.Recipe;
import com.pos.app.Entity.RecipeItem;
import com.pos.app.Exception.InvalidRequestException;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.IngredientRepository;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Repository.RecipeRepository;
import com.pos.app.common.service.AuditService;
import com.pos.app.common.util.UnitConverter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/** Recipe / BOM: menu item -> ingredients per portion, plus food cost and margin. */
@Service
@Transactional
public class RecipeService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    @Autowired private RecipeRepository recipeRepo;
    @Autowired private ProductRepository productRepo;
    @Autowired private IngredientRepository ingredientRepo;
    @Autowired private AuditService auditService;

    @Transactional(readOnly = true)
    public boolean hasRecipe(Long productId) {
        return productId != null && recipeRepo.existsByProduct_ProductId(productId);
    }

    @Transactional(readOnly = true)
    public RecipeView getRecipe(Long productId) {
        Product p = productRepo.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Menu item not found"));
        Recipe r = recipeRepo.findByProductIdWithItems(productId).orElse(null);
        return toView(p, r);
    }

    public RecipeView saveRecipe(Long productId, RecipeRequest req) {
        Product p = productRepo.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Menu item not found"));

        Set<Long> seen = new HashSet<>();
        for (RecipeLineRequest l : req.lines()) {
            if (!seen.add(l.ingredientId())) throw new InvalidRequestException("The same ingredient is listed twice in this recipe");
        }
        Map<Long, Ingredient> ingredients = ingredientRepo.findAllById(seen).stream()
                .collect(Collectors.toMap(Ingredient::getIngredientId, i -> i));

        Recipe recipe = recipeRepo.findByProductIdWithItems(productId).orElse(null);
        if (recipe == null) {
            recipe = new Recipe();
            recipe.setProduct(p);
        }
        recipe.getItems().clear(); // orphanRemoval replaces the old lines
        for (RecipeLineRequest l : req.lines()) {
            Ingredient ing = ingredients.get(l.ingredientId());
            if (ing == null) throw new InvalidRequestException("Ingredient #" + l.ingredientId() + " not found");
            if (!UnitConverter.isSupported(l.unit())) throw new InvalidRequestException("Unsupported unit: " + l.unit());
            try {
                UnitConverter.convert(BigDecimal.ONE, l.unit(), ing.getBaseUnit());
            } catch (IllegalArgumentException e) {
                throw new InvalidRequestException(ing.getName() + " is measured in " + ing.getBaseUnit() + "; " + e.getMessage());
            }
            RecipeItem it = new RecipeItem();
            it.setRecipe(recipe);
            it.setIngredient(ing);
            it.setQuantity(l.quantity());
            it.setUnit(UnitConverter.norm(l.unit()));
            it.setWastagePercent(l.wastagePercent() == null ? BigDecimal.ZERO : l.wastagePercent());
            recipe.getItems().add(it);
        }
        Recipe saved = recipeRepo.save(recipe);
        auditService.log("RECIPE_SAVED", "Recipe", String.valueOf(productId),
                "Saved recipe for " + p.getProductName() + " (" + saved.getItems().size() + " ingredients)");
        return toView(p, saved);
    }

    /** Removes only the recipe definition. Past consumption stays in the stock ledger. */
    public void deleteRecipe(Long productId) {
        Recipe r = recipeRepo.findByProductIdWithItems(productId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("This menu item has no recipe"));
        String name = r.getProduct().getProductName();
        recipeRepo.delete(r);
        auditService.log("RECIPE_DELETED", "Recipe", String.valueOf(productId), "Deleted recipe for " + name);
    }

    /** Every menu item with its food cost and margin (or hasRecipe=false so the UI can prompt). */
    @Transactional(readOnly = true)
    public List<CostingRow> costing() {
        Map<Long, Recipe> byProduct = new HashMap<>();
        for (Recipe r : recipeRepo.findAllWithItems()) byProduct.put(r.getProduct().getProductId(), r);

        List<CostingRow> rows = new ArrayList<>();
        for (Product p : productRepo.findAll()) {
            Recipe r = byProduct.get(p.getProductId());
            BigDecimal price = money(p.getProdPrice());
            if (r == null) {
                rows.add(new CostingRow(p.getProductId(), p.getProductName(), p.isActive(), false,
                        price, null, null, null, null));
            } else {
                BigDecimal cost = foodCost(r);
                rows.add(new CostingRow(p.getProductId(), p.getProductName(), p.isActive(), true, price, cost,
                        price.subtract(cost), marginPct(price, cost), foodCostPct(price, cost)));
            }
        }
        rows.sort(Comparator.comparing(CostingRow::productName, String.CASE_INSENSITIVE_ORDER));
        return rows;
    }

    /**
     * How many portions of EVERY active menu item can be made right now, from current ingredient
     * stock -- the "10 plates of paneer left" equivalent for a dish, computed live from the recipe
     * instead of being a number someone has to type in. The limiting ingredient (the one that runs
     * out first) is reported so the picker/kitchen can see exactly what to reorder.
     * Products with no recipe are reported with hasRecipe=false, availablePortions=null (untracked,
     * same as today) so the UI can distinguish "unlimited" from "actually zero".
     */
    @Transactional(readOnly = true)
    public List<AvailabilityRow> availability() {
        List<AvailabilityRow> rows = new ArrayList<>();
        for (Recipe r : recipeRepo.findAllWithItems()) {
            if (!r.getProduct().isActive() || r.getItems().isEmpty()) continue;
            int best = Integer.MAX_VALUE;
            String limiting = null;
            for (RecipeItem it : r.getItems()) {
                BigDecimal perPortion = UnitConverter.convert(it.getQuantity(), it.getUnit(), it.getIngredient().getBaseUnit())
                        .multiply(BigDecimal.ONE.add(it.getWastagePercent().movePointLeft(2)));
                if (perPortion.signum() <= 0) continue;
                BigDecimal onHand = it.getIngredient().getCurrentQty().max(BigDecimal.ZERO);
                int portionsFromThis = onHand.divide(perPortion, 0, RoundingMode.DOWN).intValue();
                if (portionsFromThis < best) { best = portionsFromThis; limiting = it.getIngredient().getName(); }
            }
            int available = best == Integer.MAX_VALUE ? 0 : Math.max(0, best);
            rows.add(new AvailabilityRow(r.getProduct().getProductId(), true, available, limiting, available <= 0));
        }
        return rows;
    }

    /* ---------- helpers ---------- */

    private RecipeView toView(Product p, Recipe r) {
        BigDecimal price = money(p.getProdPrice());
        if (r == null) {
            return new RecipeView(p.getProductId(), p.getProductName(), price, List.of(), BigDecimal.ZERO,
                    price, price.signum() == 0 ? BigDecimal.ZERO : HUNDRED, BigDecimal.ZERO);
        }
        List<RecipeLineView> lines = r.getItems().stream()
                .map(it -> new RecipeLineView(it.getIngredient().getIngredientId(), it.getIngredient().getName(),
                        it.getIngredient().getBaseUnit(), it.getQuantity(), it.getUnit(), it.getWastagePercent(), lineCost(it)))
                .sorted(Comparator.comparing(RecipeLineView::ingredientName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
        BigDecimal cost = foodCost(r);
        return new RecipeView(p.getProductId(), p.getProductName(), price, lines, cost,
                price.subtract(cost), marginPct(price, cost), foodCostPct(price, cost));
    }

    private BigDecimal lineCost(RecipeItem it) {
        BigDecimal baseQty = UnitConverter.convert(it.getQuantity(), it.getUnit(), it.getIngredient().getBaseUnit())
                .multiply(BigDecimal.ONE.add(it.getWastagePercent().movePointLeft(2)));
        return baseQty.multiply(it.getIngredient().getAvgCost()).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal foodCost(Recipe r) {
        return r.getItems().stream().map(this::lineCost).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal money(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal marginPct(BigDecimal price, BigDecimal cost) {
        if (price.signum() <= 0) return BigDecimal.ZERO;
        return price.subtract(cost).multiply(HUNDRED).divide(price, 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal foodCostPct(BigDecimal price, BigDecimal cost) {
        if (price.signum() <= 0) return BigDecimal.ZERO;
        return cost.multiply(HUNDRED).divide(price, 1, RoundingMode.HALF_UP);
    }
}
