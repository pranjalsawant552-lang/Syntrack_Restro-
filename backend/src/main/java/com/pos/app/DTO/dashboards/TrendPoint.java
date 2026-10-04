package com.pos.app.DTO.dashboards;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class TrendPoint {
    private String date;
    private double netTotal;
    private long invoices;
}
