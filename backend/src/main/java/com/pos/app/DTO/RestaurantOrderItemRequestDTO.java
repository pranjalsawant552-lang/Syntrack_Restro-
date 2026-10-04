package com.pos.app.DTO;

import lombok.Data;

@Data
public class RestaurantOrderItemRequestDTO {
    private Long productId;
    private int quantity;
    private String notes;

    /** Optional: chosen variant of the menu item. */
    private Long variantId;

    /** Optional: chosen add-on option ids (from the item's modifier groups). Validated server-side. */
    private java.util.List<Long> modifierIds;
}
