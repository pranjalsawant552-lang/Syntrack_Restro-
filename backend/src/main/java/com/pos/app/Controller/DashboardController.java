package com.pos.app.Controller;

import com.pos.app.DTO.dashboards.*;
import com.pos.app.Repository.SalesInvoiceMasterRepository;
import com.pos.app.Service.DashboardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/v1/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('PERM_DASHBOARD_VIEW')")
public class DashboardController {

    private final DashboardService dashboardService;
    private final SalesInvoiceMasterRepository masterRepo;

    private static Object[] unwrapRow(Object x) {
        if (x == null) return new Object[0];
        if (x instanceof Object[] arr) {
            if (arr.length == 1 && arr[0] instanceof Object[]) return (Object[]) arr[0];
            return arr;
        }
        return new Object[0];
    }

    private static double d(Object o) {
        if (o == null) return 0;
        if (o instanceof BigDecimal bd) return bd.doubleValue();
        if (o instanceof Number n) return n.doubleValue();
        if (o instanceof Object[] arr) return arr.length > 0 ? d(arr[0]) : 0;
        return 0;
    }

    private static long l(Object o) {
        if (o == null) return 0;
        if (o instanceof BigDecimal bd) return bd.longValue();
        if (o instanceof Number n) return n.longValue();
        if (o instanceof Object[] arr) return arr.length > 0 ? l(arr[0]) : 0;
        return 0;
    }

    @PostMapping("/kpis")
    public ResponseEntity<DashboardKpiRes> kpis(
            @Valid @RequestBody DashboardRangeReq req,
            @RequestParam(defaultValue = "5") int lowStockThreshold
    ) {
        LocalDate from = req.getFrom();
        LocalDate to = req.getTo();

        // 1) base from service (today + month + rangeSales+count + counts)
        DashboardKpiRes base = dashboardService.kpis(from, to, lowStockThreshold);

        // 2) exact totals for range
        Object[] totals = unwrapRow(masterRepo.rangeTotals(from, to));
        System.out.println(">>> rangeTotals=" + Arrays.toString(totals));

        // totals = [netTotal, subTotal, gstTotal, discountValue, count]
        double rangeSales    = d(totals.length > 0 ? totals[0] : null);
        double rangeTaxable  = d(totals.length > 1 ? totals[1] : null);
        double rangeGst      = d(totals.length > 2 ? totals[2] : null);
        double rangeDiscount = d(totals.length > 3 ? totals[3] : null);
        long rangeInvoices   = l(totals.length > 4 ? totals[4] : null);

        DashboardKpiRes merged = new DashboardKpiRes(
                base.getTodaySales(), base.getTodayTaxable(), base.getTodayGst(), base.getTodayDiscount(), base.getTodayInvoices(),
                base.getMonthSales(), base.getMonthInvoices(),
                rangeSales, rangeTaxable, rangeGst, rangeDiscount, rangeInvoices,
                base.getActiveProducts(), base.getInactiveProducts(),
                base.getActiveCustomers(), base.getInactiveCustomers(),
                base.getLowStockCount(),

                base.getTodayPendingAmount(), base.getRangePendingAmount(), base.getAllTimePendingAmount(),
                base.getTodayCash(), base.getTodayCard(), base.getTodayUpi(),
                base.getRangeCash(), base.getRangeCard(), base.getRangeUpi(),
                base.getAllTimeCash(), base.getAllTimeCard(), base.getAllTimeUpi(),
                base.getAllTimeSales(), base.getAllTimeTaxable(), base.getAllTimeGst(), base.getAllTimeDiscount(), base.getAllTimeInvoices(),

                base.getTodayProfit(), base.getRangeProfit(), base.getAllTimeProfit()
        );


        return ResponseEntity.ok(merged);
    }

    @PostMapping("/trend")
    public ResponseEntity<List<TrendPoint>> trend(@Valid @RequestBody DashboardRangeReq req) {
        return ResponseEntity.ok(dashboardService.trend(req.getFrom(), req.getTo()));
    }

    @PostMapping("/top-products/revenue")
    public ResponseEntity<List<TopProductRow>> topProductsRevenue(
            @Valid @RequestBody DashboardRangeReq req,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(dashboardService.topProductsByRevenue(req.getFrom(), req.getTo(), limit));
    }

    @PostMapping("/top-products/qty")
    public ResponseEntity<List<TopProductRow>> topProductsQty(
            @Valid @RequestBody DashboardRangeReq req,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(dashboardService.topProductsByQty(req.getFrom(), req.getTo(), limit));
    }

    @PostMapping("/top-products/profit")
    public ResponseEntity<List<ProductProfitRow>> topProductsProfit(
            @Valid @RequestBody DashboardRangeReq req,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(dashboardService.topProductsByProfit(req.getFrom(), req.getTo(), limit));
    }

    @PostMapping("/category-sales")
    public ResponseEntity<List<CategorySalesRow>> categorySales(@Valid @RequestBody DashboardRangeReq req) {
        return ResponseEntity.ok(dashboardService.categorySales(req.getFrom(), req.getTo()));
    }

    @GetMapping("/low-stock")
    public ResponseEntity<List<LowStockRow>> lowStock(
            @RequestParam(defaultValue = "5") int threshold,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return ResponseEntity.ok(dashboardService.lowStock(threshold, limit));
    }

    @GetMapping("/recent-invoices")
    public ResponseEntity<List<RecentInvoiceRow>> recentInvoices(
            @RequestParam(defaultValue = "12") int limit
    ) {
        return ResponseEntity.ok(dashboardService.recentInvoices(limit));
    }

    @GetMapping("/recent-stock-movements")
    public ResponseEntity<List<Object[]>> recentStockMovements(
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ResponseEntity.ok(dashboardService.recentStockMovements(limit));
    }
}
