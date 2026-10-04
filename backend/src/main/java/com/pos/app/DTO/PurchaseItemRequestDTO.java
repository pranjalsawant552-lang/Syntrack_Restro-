package com.pos.app.DTO;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One purchase line. EITHER a product line (productId + integer quantity) OR an
 * ingredient line (ingredientId + ingredientQty + unit) -- never both.
 */
@Data
public class PurchaseItemRequestDTO {
    private Long productId;
    private int quantity;

    /** Ingredient line: which ingredient was bought. */
    private Long ingredientId;
    /** Ingredient line: quantity in {@link #unit} (decimals allowed, e.g. 2.5 KG). */
    private BigDecimal ingredientQty;
    /** Ingredient line: KG / G / MG / L / ML / PCS / DOZEN (must match the ingredient's unit family). */
    private String unit;
    /** Ingredient line: optional batch / lot number. */
    private String batchNo;
    /** Ingredient line: optional expiry date (enables FEFO + expiry alerts). */
    private LocalDate expiryDate;

    /** What we're paying per unit this purchase (per {@link #unit} for ingredients). If omitted for a product, falls back to its current buy price; required for ingredients. */
    private Double unitCost;
    /** GST% for this line. If omitted: product's configured GST%, or 0 for an ingredient. */
    private Double gstPercent;
}
