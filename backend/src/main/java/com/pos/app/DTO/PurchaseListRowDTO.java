package com.pos.app.DTO;

import java.time.LocalDate;

import com.pos.app.Enum.PaymentMethod;
import com.pos.app.Enum.PaymentStatus;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseListRowDTO {
    private Long purchaseId;
    private String purchaseNumber;
    private String supplierBillNumber;
    private LocalDate purchaseDate;
    private double netTotal;
    private PaymentMethod payMethod;
    private PaymentStatus payStatus;
    private String supplierName;
    private String supplierPhone;
}
