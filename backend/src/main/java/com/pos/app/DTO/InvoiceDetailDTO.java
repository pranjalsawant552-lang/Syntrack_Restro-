package com.pos.app.DTO;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceDetailDTO {

    private String invoiceNumber;
    private LocalDate invoiceDate;

    private double subTotal;
    private double gstTotal;
    private double discountValue;
    private double netTotal;

    private Object payMethod; // (you can keep enum type if you want)
    private Object payStatus;

    // ✅ split payment (only set when payMethod == SPLIT)
    private Double cashAmount;
    private Double onlineAmount;
    private Object onlinePayMethod; // CARD or UPI

    // ✅ customer snapshot
    private Long customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private String customerAddress;

    private List<InvoiceItemResponseDTO> items;

    // ✅ AUDIT (NEW)
    private String createdBy;
    private LocalDateTime createdAt;
    private String updatedBy;
    private LocalDateTime updatedAt;
}
