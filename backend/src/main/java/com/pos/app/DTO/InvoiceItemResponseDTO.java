package com.pos.app.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceItemResponseDTO {
    private Long itemId;
    private Long productId;
    private String productName;
    private double unitPrice;
    private double gstPercent;
    private int quantity;
    private double taxableAmount;
    private double gstAmount;
    private double totalAmount;
    private String variantName;
    private String optionsText;
}
