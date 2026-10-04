package com.pos.app.DTO;

import com.pos.app.Enum.PaymentMethod;
import com.pos.app.Enum.PaymentStatus;
import lombok.Data;

/**
 * What the waiter/cashier fills in at the point of billing a table out.
 * The line items themselves are NOT repeated here -- they're whatever is
 * already on the {@link com.pos.app.Entity.RestaurantOrder}, so a settle
 * request can never silently bill different items than what the kitchen
 * actually prepared.
 */
@Data
public class SettleOrderRequestDTO {
    private PaymentMethod payMethod;
    private PaymentStatus payStatus;
    private double discountValue;

    // split payment, only used when payMethod == SPLIT (mirrors InvoiceRequestDTO)
    private Double cashAmount;
    private Double onlineAmount;
    private PaymentMethod onlinePayMethod;

    // optional customer snapshot
    private Long customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private String customerAddress;

    /**
     * Optional: bill only these order-item IDs (a "split the bill" partial
     * settle). Null or empty = settle every not-yet-billed item on the order
     * (the normal, whole-table case).
     */
    private java.util.List<Long> itemIds;
}
