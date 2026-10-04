package com.pos.app.DTO.dashboards;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class RecentInvoiceRow {
    private Long invoiceId;
    private String invoiceNumber;
    private String invoiceDate;
    private double netTotal;
    private String payMethod;
    private String payStatus;
    private String customerName;
}
