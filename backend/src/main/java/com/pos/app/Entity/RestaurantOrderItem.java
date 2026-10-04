package com.pos.app.Entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.pos.app.Enum.OrderItemStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One line on a {@link RestaurantOrder}'s tab. Menu items reuse the existing
 * {@link Product} entity (name/price/GST/category all already fit) rather than
 * introducing a parallel "MenuItem" concept -- Products already power search,
 * categories and reporting, and a restaurant's dishes are just priced,
 * categorised, billable things, same as retail products are.
 */
@Entity
@Table(name = "restaurant_order_item", indexes = {
        @Index(name = "idx_restaurant_order_item_order", columnList = "order_id"),
        // ✅ Kitchen Display View polls "everything currently SENT_TO_KITCHEN" across all orders
        @Index(name = "idx_restaurant_order_item_status", columnList = "status")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantOrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long orderItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    @JsonBackReference
    private RestaurantOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    /** Snapshot at the time this was added, so a later price change doesn't reprice an open tab. */
    private String productName;
    private double unitPrice;
    private double gstPercent;

    private int quantity;

    /** Kitchen instruction, e.g. "no onion", "extra spicy". */
    private String notes;

    /** Chosen size/portion (Half, Full...). unitPrice already reflects the variant's price. */
    private Long variantId;
    private String variantName;

    /** Chosen add-ons, comma separated ("Extra cheese, Less spicy"). unitPrice already includes their prices. */
    @Column(length = 500)
    private String optionsText;

    /** Recipe ingredient multiplier for this line (variant "Half" = 0.5). Snapshot, like the price. */
    @Column(columnDefinition = "DOUBLE PRECISION DEFAULT 1")
    private double portionFactor = 1.0;

    /** "Paneer Tikka (Half)" -- what waiters, KOTs and receipts should show for this line. */
    public String getDisplayName() {
        return variantName == null || variantName.isBlank() ? productName : productName + " (" + variantName + ")";
    }

    @Enumerated(EnumType.STRING)
    private OrderItemStatus status = OrderItemStatus.PENDING;

    /**
     * True once this line has been included in a settled invoice. Distinct from
     * order-level SETTLED status so a bill can be SPLIT: some items billed now,
     * the rest still open on the table for later (see RestaurantServiceImpl#settleOrder).
     */
    private boolean billed = false;
}
