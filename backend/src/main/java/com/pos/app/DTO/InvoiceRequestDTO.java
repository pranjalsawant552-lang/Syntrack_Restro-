package com.pos.app.DTO;

import java.util.List;
import com.pos.app.Enum.PaymentMethod;
import com.pos.app.Enum.PaymentStatus;
import lombok.Data;

@Data
public class InvoiceRequestDTO {

    /**
     * Server-side only (never read from JSON): the restaurant settle flow has already deducted
     * recipe ingredients at KOT time, so createInvoice must not deduct them a second time.
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    private boolean inventoryHandled;

    private PaymentMethod payMethod;
    private PaymentStatus payStatus;
    private double discountValue;
    private List<InvoiceItemRequestDTO> items;

    // ✅ NEW: split payment (only used when payMethod == SPLIT)
    private Double cashAmount;
    private Double onlineAmount;
    private PaymentMethod onlinePayMethod; // CARD or UPI

    // ✅ NEW: customer snapshot (optional)
    private Long customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private String customerAddress;
}