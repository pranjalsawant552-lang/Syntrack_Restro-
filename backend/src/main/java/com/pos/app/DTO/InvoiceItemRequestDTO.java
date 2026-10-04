package com.pos.app.DTO;

import lombok.Data;

@Data
public class InvoiceItemRequestDTO {
    private Long productId;
    private int quantity;

    /**
     * Optional price lock. Null (the normal POS/Products-page path) means
     * "use the product's current price/GST, looked up fresh" -- unchanged
     * behavior. Non-null means "bill at exactly this price/GST regardless of
     * what the product's current price is" -- used by the restaurant module's
     * settle flow so a menu price change mid-service can't silently reprice
     * a dish that was already ordered at the old price.
     */
    private Double unitPriceOverride;
    private Double gstPercentOverride;

    /** Snapshot of the chosen variant/add-ons (restaurant settle only; null for plain sales). */
    private String variantName;
    private String optionsText;
}
