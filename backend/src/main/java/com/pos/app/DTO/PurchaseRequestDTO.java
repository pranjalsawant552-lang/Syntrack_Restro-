package com.pos.app.DTO;

import com.pos.app.Enum.PaymentMethod;
import com.pos.app.Enum.PaymentStatus;
import lombok.Data;

import java.util.List;

@Data
public class PurchaseRequestDTO {
    private PaymentMethod payMethod;
    private PaymentStatus payStatus;
    private double discountValue;
    private String supplierBillNumber;
    private List<PurchaseItemRequestDTO> items;

    private Long supplierId;
    private String supplierName;
    private String supplierPhone;
    private String supplierAddress;

    /** If true, each item's unitCost also updates the product's stored buy price (default true). */
    private Boolean updateProductBuyPrice = true;
}
