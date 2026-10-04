package com.pos.app.DTO.dashboards;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LowStockRow {
    private Long productId;
    private String productName;
    private String barcode;
    private int qty;
}