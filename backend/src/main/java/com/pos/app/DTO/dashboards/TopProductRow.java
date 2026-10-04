package com.pos.app.DTO.dashboards;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class TopProductRow {
    private Long productId;
    private String productName;
    private long qty;
    private double revenue;
}
