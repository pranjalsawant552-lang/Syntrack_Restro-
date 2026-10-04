package com.pos.app.DTO.inventory;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Request/response shapes for the ingredient inventory + recipe modules. */
public final class InventoryDTO {

    private InventoryDTO() {}

    /* ---------- requests ---------- */

    public record IngredientRequest(
            @NotBlank @Size(max = 120) String name,
            @NotBlank String baseUnit,
            @DecimalMin("0") BigDecimal reorderLevel,
            Boolean active) {}

    public record ReceiveRequest(
            @NotNull Long ingredientId,
            @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal qty,
            @NotBlank String unit,
            /** price per ONE entered unit (e.g. per KG when unit=KG) */
            @NotNull @DecimalMin("0") BigDecimal costPerUnit,
            @Size(max = 60) String batchNo,
            LocalDate expiryDate,
            Long supplierId,
            @Size(max = 60) String invoiceRef) {}

    public record WastageRequest(
            @NotNull Long ingredientId,
            @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal qty,
            @NotBlank String unit,
            @NotBlank @Size(max = 200) String reason) {}

    public record AdjustRequest(
            @NotNull Long ingredientId,
            /** the physically COUNTED quantity now on the shelf */
            @NotNull @DecimalMin("0") BigDecimal countedQty,
            @NotBlank String unit,
            @NotBlank @Size(max = 200) String reason) {}

    public record RecipeLineRequest(
            @NotNull Long ingredientId,
            @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal quantity,
            @NotBlank String unit,
            @DecimalMin("0") BigDecimal wastagePercent) {}

    public record RecipeRequest(@NotEmpty @Valid List<RecipeLineRequest> lines) {}

    /* ---------- responses ---------- */

    public record IngredientView(
            Long ingredientId, String name, String baseUnit,
            BigDecimal currentQty, BigDecimal reorderLevel, BigDecimal avgCost,
            BigDecimal stockValue, String status, boolean active) {}

    public record BatchView(
            Long batchId, String batchNo, LocalDate expiryDate,
            BigDecimal qtyRemaining, BigDecimal unitCost, LocalDateTime receivedAt) {}

    public record MovementView(
            Long movementId, Long ingredientId, String ingredientName, String baseUnit,
            String type, BigDecimal qty, BigDecimal unitCost, BigDecimal balanceAfter,
            String refType, String refId, String reason, String actionUser, LocalDateTime createdAt) {}

    public record ExpiryAlert(
            Long batchId, Long ingredientId, String ingredientName, String baseUnit,
            String batchNo, LocalDate expiryDate, BigDecimal qtyRemaining, long daysLeft) {}

    public record AlertsView(
            List<IngredientView> lowStock,
            List<IngredientView> outOfStock,
            List<IngredientView> negativeStock,
            List<ExpiryAlert> expiringSoon,
            List<ExpiryAlert> expired) {}

    public record RecipeLineView(
            Long ingredientId, String ingredientName, String baseUnit,
            BigDecimal quantity, String unit, BigDecimal wastagePercent, BigDecimal lineCost) {}

    public record RecipeView(
            Long productId, String productName, BigDecimal sellingPrice,
            List<RecipeLineView> lines, BigDecimal foodCost,
            BigDecimal marginAmount, BigDecimal marginPercent, BigDecimal foodCostPercent) {}

    public record CostingRow(
            Long productId, String productName, boolean active, boolean hasRecipe,
            BigDecimal sellingPrice, BigDecimal foodCost,
            BigDecimal marginAmount, BigDecimal marginPercent, BigDecimal foodCostPercent) {}

    /**
     * How many portions of a recipe-based menu item can be made RIGHT NOW from ingredient stock
     * (the limiting ingredient decides). Products without a recipe are unlimited/untracked, same as
     * a retail Product with its own stock count -- this is the "food stock" equivalent for dishes.
     */
    public record AvailabilityRow(
            Long productId, boolean hasRecipe, Integer availablePortions,
            String limitingIngredient, boolean outOfStock) {}
}
