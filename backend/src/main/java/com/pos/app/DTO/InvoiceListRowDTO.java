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
public class InvoiceListRowDTO {
    private Long invoiceId;
    private String invoiceNumber;
    private LocalDate invoiceDate;
    private double netTotal;
    private PaymentMethod payMethod;
    private PaymentStatus payStatus;

    // ✅ show in list
    private String customerName;
    private String customerPhone;
}
