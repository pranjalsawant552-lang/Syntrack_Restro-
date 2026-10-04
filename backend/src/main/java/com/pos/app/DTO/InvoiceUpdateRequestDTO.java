package com.pos.app.DTO;


import java.util.List;
import com.pos.app.Enum.PaymentMethod;
import com.pos.app.Enum.PaymentStatus;
import lombok.Data;

@Data
public class InvoiceUpdateRequestDTO {
    private PaymentMethod payMethod;
    private PaymentStatus payStatus;
    private double discountValue;
    private List<InvoiceItemRequestDTO> items;

    // ✅ customer (optional)
    private Long customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private String customerAddress;
}
