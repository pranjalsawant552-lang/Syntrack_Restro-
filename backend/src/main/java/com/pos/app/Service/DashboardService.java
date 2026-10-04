package com.pos.app.Service;

import com.pos.app.DTO.dashboards.*;
import com.pos.app.Repository.*;
import java.util.ArrayList;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final SalesInvoiceMasterRepository masterRepo;
    private final SalesInvoiceItemRepository itemRepo;
    private final ProductRepository productRepo;
    private final CustomerRepository customerRepo;
    private final StockRepository stockRepo;
    private final StockMovementRepository stockMovementRepo;

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

    // helper: map method rows -> cash/card/upi
    private static double[] method3(List<Object[]> rows) {
        double cash = 0, card = 0, upi = 0;
        if (rows == null) return new double[]{0,0,0};
        for (Object[] r : rows) {
            if (r == null || r.length < 2) continue;
            String method = String.valueOf(r[0]);
            double amt = d(r[1]);
            if ("CASH".equalsIgnoreCase(method)) cash = amt;
            else if ("CARD".equalsIgnoreCase(method)) card = amt;
            else if ("UPI".equalsIgnoreCase(method)) upi = amt;
        }
        return new double[]{cash, card, upi};
    }

    public DashboardKpiRes kpis(LocalDate from, LocalDate to, int lowStockThreshold) {
        LocalDate today = LocalDate.now();

        // ✅ today totals
        Object[] day = unwrapRow(masterRepo.dayTotals(today));
        double todaySales    = d(day.length > 0 ? day[0] : null);
        double todayTaxable  = d(day.length > 1 ? day[1] : null);
        double todayGst      = d(day.length > 2 ? day[2] : null);
        double todayDiscount = d(day.length > 3 ? day[3] : null);
        long todayInvoices   = l(day.length > 4 ? day[4] : null);

        // ✅ month totals
        YearMonth ym = YearMonth.from(today);
        LocalDate mFrom = ym.atDay(1);
        LocalDate mTo = ym.atEndOfMonth();
        Object[] month = unwrapRow(masterRepo.rangeSalesAndCount(mFrom, mTo));
        double monthSales  = d(month.length > 0 ? month[0] : null);
        long monthInvoices = l(month.length > 1 ? month[1] : null);

        // ✅ range sales + count (controller exact totals rangeTotals se overwrite karega)
        Object[] range = unwrapRow(masterRepo.rangeSalesAndCount(from, to));
        double rangeSales  = d(range.length > 0 ? range[0] : null);
        long rangeInvoices = l(range.length > 1 ? range[1] : null);

        double rangeTaxable = 0, rangeGst = 0, rangeDiscount = 0;

        // ✅ counts
        long activeProducts = productRepo.countActive();
        long inactiveProducts = productRepo.countInactive();
        long activeCustomers = customerRepo.countActive();
        long inactiveCustomers = customerRepo.countInactive();
        long lowStockCount = stockRepo.lowStockCount(lowStockThreshold);

        // ✅ pending amounts
        double todayPendingAmount = d(masterRepo.todayPendingAmount(today));
        double rangePendingAmount = d(masterRepo.rangePendingAmount(from, to));
        double allTimePendingAmount = d(masterRepo.allTimePendingAmount());

        // ✅ payment method totals
        double[] t = method3(masterRepo.dayMethodTotals(today));
        double todayCash = t[0], todayCard = t[1], todayUpi = t[2];

        double[] r = method3(masterRepo.rangeMethodTotals(from, to));
        double rangeCash = r[0], rangeCard = r[1], rangeUpi = r[2];

        double[] a = method3(masterRepo.allTimeMethodTotals());
        double allTimeCash = a[0], allTimeCard = a[1], allTimeUpi = a[2];

        // ✅ all time totals (net, taxable, gst, discount, count)
        Object[] all = unwrapRow(masterRepo.allTimeTotals());
        double allTimeSales    = d(all.length > 0 ? all[0] : null);
        double allTimeTaxable  = d(all.length > 1 ? all[1] : null);
        double allTimeGst     = d(all.length > 2 ? all[2] : null);
        double allTimeDiscount = d(all.length > 3 ? all[3] : null);
        long allTimeInvoices   = l(all.length > 4 ? all[4] : null);

        // ✅ profit (revenue after discount − cost)
        double todayProfit = d(itemRepo.todayProfit(today));
        double rangeProfit = d(itemRepo.rangeProfit(from, to));
        double allTimeProfit = d(itemRepo.allTimeProfit());

        return new DashboardKpiRes(
                todaySales, todayTaxable, todayGst, todayDiscount, todayInvoices,
                monthSales, monthInvoices,
                rangeSales, rangeTaxable, rangeGst, rangeDiscount, rangeInvoices,
                activeProducts, inactiveProducts,
                activeCustomers, inactiveCustomers,
                lowStockCount,

                todayPendingAmount, rangePendingAmount, allTimePendingAmount,
                todayCash, todayCard, todayUpi,
                rangeCash, rangeCard, rangeUpi,
                allTimeCash, allTimeCard, allTimeUpi,
                allTimeSales, allTimeTaxable, allTimeGst, allTimeDiscount, allTimeInvoices,

                todayProfit, rangeProfit, allTimeProfit
        );
    }

    public List<TrendPoint> trend(LocalDate from, LocalDate to) {
        return masterRepo.trend(from, to).stream()
                .map(r -> new TrendPoint(String.valueOf(r[0]), d(r[1]), l(r[2])))
                .collect(Collectors.toList());
    }

    public List<TopProductRow> topProductsByRevenue(LocalDate from, LocalDate to, int limit) {
        return itemRepo.topProductsByRevenue(from, to, PageRequest.of(0, limit)).stream()
                .map(r -> new TopProductRow((Long) r[0], (String) r[1], l(r[2]), d(r[3])))
                .collect(Collectors.toList());
    }

    public List<TopProductRow> topProductsByQty(LocalDate from, LocalDate to, int limit) {
        return itemRepo.topProductsByQty(from, to, PageRequest.of(0, limit)).stream()
                .map(r -> new TopProductRow((Long) r[0], (String) r[1], l(r[2]), d(r[3])))
                .collect(Collectors.toList());
    }

    public List<CategorySalesRow> categorySales(LocalDate from, LocalDate to) {
        return itemRepo.categorySales(from, to).stream()
                .map(r -> new CategorySalesRow((Long) r[0], (String) r[1], d(r[2]), l(r[3])))
                .collect(Collectors.toList());
    }

    public List<LowStockRow> lowStock(int threshold, int limit) {
        return stockRepo.lowStock(threshold).stream()
                .limit(limit)
                .map(r -> new LowStockRow(
                        (Long) r[0],
                        (String) r[1],
                        (String) r[2],
                        ((Number) r[3]).intValue()
                ))
                .collect(Collectors.toList());
    }

    public List<RecentInvoiceRow> recentInvoices(int limit) {
        return masterRepo.recentInvoices(PageRequest.of(0, limit)).stream()
                .map(r -> new RecentInvoiceRow(
                        (Long) r[0],
                        (String) r[1],
                        String.valueOf(r[2]),
                        d(r[3]),
                        String.valueOf(r[4]),
                        String.valueOf(r[5]),
                        (String) r[6]
                ))
                .collect(Collectors.toList());
    }

    public List<Object[]> recentStockMovements(int limit) {
        return stockMovementRepo.recent(PageRequest.of(0, limit));
    }

    /** Product-wise profit (revenue after discount − cost), ordered by profit desc; limit applied in memory. */
    public List<ProductProfitRow> topProductsByProfit(LocalDate from, LocalDate to, int limit) {
        List<Object[]> raw = itemRepo.topProductsByProfit(from, to);
        List<ProductProfitRow> out = new ArrayList<>();
        if (raw == null) return out;
        for (int i = 0; i < raw.size() && out.size() < limit; i++) {
            Object[] r = raw.get(i);
            if (r == null || r.length < 3) continue;
            Long productId = r[0] != null ? ((Number) r[0]).longValue() : null;
            String productName = r[1] != null ? String.valueOf(r[1]) : "";
            double profit = d(r[2]);
            if (productId != null) {
                out.add(new ProductProfitRow(productId, productName, profit));
            }
        }
        return out;
    }
}
