package com.pos.app.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class InvoiceCreateResponseDTO {
    private Long invoiceId;
    private String invoiceNumber;
    private String message;
}
