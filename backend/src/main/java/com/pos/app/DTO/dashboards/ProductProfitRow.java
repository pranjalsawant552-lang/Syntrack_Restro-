package com.pos.app.DTO.dashboards;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ProductProfitRow {
    private Long productId;
    private String productName;
    private double profit;
}
