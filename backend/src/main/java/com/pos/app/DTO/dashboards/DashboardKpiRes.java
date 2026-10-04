package com.pos.app.DTO.dashboards;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class DashboardKpiRes {

    private double todaySales;
    private double todayTaxable;
    private double todayGst;
    private double todayDiscount;
    private long todayInvoices;

    private double monthSales;
    private long monthInvoices;

    private double rangeSales;
    private double rangeTaxable;
    private double rangeGst;
    private double rangeDiscount;
    private long rangeInvoices;

    private long activeProducts;
    private long inactiveProducts;

    private long activeCustomers;
    private long inactiveCustomers;

    private long lowStockCount;

    // ✅ Pending amounts
    private double todayPendingAmount;
    private double rangePendingAmount;
    private double allTimePendingAmount;

    // ✅ Payment method totals - TODAY
    private double todayCash;
    private double todayCard;
    private double todayUpi;

    // ✅ Payment method totals - RANGE
    private double rangeCash;
    private double rangeCard;
    private double rangeUpi;

    // ✅ Payment method totals - ALL TIME
    private double allTimeCash;
    private double allTimeCard;
    private double allTimeUpi;

    // ✅ All time totals (since start)
    private double allTimeSales;
    private double allTimeTaxable;
    private double allTimeGst;
    private double allTimeDiscount;
    private long allTimeInvoices;

    // ✅ Profit (revenue after discount − cost)
    private double todayProfit;
    private double rangeProfit;
    private double allTimeProfit;
}
