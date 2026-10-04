package com.pos.app.DTO;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductDTO {

    private Long productId;
    private String productName;
    private double prodPrice;
    private double prodGST;
    private double prodBuyPrice;

    // UI expects "isActive"
    @JsonProperty("isActive")
    private boolean isActive;

    private String barcode;

    // for all-products
    private Long categoryId;
    private String categoryName;

    // ✅ restaurant menu flags -- appended at the end so existing positional
    // JPQL "select new ProductDTO(...)" constructor calls elsewhere in the
    // codebase that predate these fields don't need to change.
    private Boolean isVeg;
    private boolean temporarilyUnavailable;

    /**
     * true = stock product (quantity tracked), false = menu item (no quantity). Boxed so a client
     * that doesn't send it (older screens) leaves an existing product unchanged instead of
     * silently flipping it.
     */
    private Boolean trackStock;

    /** true = combo/meal deal (components defined in menu-options). */
    private Boolean combo;

    /** Convenience constructor matching the pre-existing 9-arg JPQL projections (no menu flags). */
    public ProductDTO(Long productId, String productName, double prodPrice, double prodGST, double prodBuyPrice,
                       boolean isActive, String barcode, Long categoryId, String categoryName) {
        this(productId, productName, prodPrice, prodGST, prodBuyPrice, isActive, barcode, categoryId, categoryName,
                null, false, true, false);
    }
}
