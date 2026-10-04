package com.pos.app.DTO.dashboards;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class CategorySalesRow {
    private Long categoryId;
    private String categoryName;
    private double revenue;
    private long qty;
}
