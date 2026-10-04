package com.pos.app.Controller;

import com.pos.app.Repository.PurchaseInvoiceMasterRepository;
import com.pos.app.Repository.SalesInvoiceMasterRepository;
import com.pos.app.Repository.StockRepository;
import com.pos.app.common.util.CsvExportUtil;
import com.pos.app.config.ApiVersionConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Combined Sales/GST + Inventory reports. Read-only aggregations over data that
 * already exists elsewhere (invoices, purchases, stock) — this controller doesn't
 * introduce new source-of-truth data, just useful rollups for accounting/filing and
 * stock decisions.
 */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/reports")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('PERM_REPORT_VIEW')")
public class ReportController {

    private final SalesInvoiceMasterRepository salesInvoiceRepo;
    private final PurchaseInvoiceMasterRepository purchaseRepo;
    private final StockRepository stockRepo;

    /**
     * GST liability summary for a date range: GST collected on sales, GST paid on
     * purchases (input tax), and the net payable/refundable figure — the core number
     * needed for periodic GST filing.
     */
    @GetMapping("/gst-summary")
    public ResponseEntity<?> gstSummary(@RequestParam String fromDate, @RequestParam String toDate) {
        LocalDate from = LocalDate.parse(fromDate);
        LocalDate to = LocalDate.parse(toDate);

        List<com.pos.app.Entity.SalesInvoiceMaster> salesInRange =
                salesInvoiceRepo.findByInvoiceDateBetweenOrderByInvoiceIdDesc(from, to);
        double salesGst = salesInRange.stream().mapToDouble(com.pos.app.Entity.SalesInvoiceMaster::getGstTotal).sum();
        double salesNet = salesInRange.stream().mapToDouble(com.pos.app.Entity.SalesInvoiceMaster::getNetTotal).sum();
        int salesCount = salesInRange.size();

        List<Object[]> purchaseTotalsRows = purchaseRepo.totalsForRange(from, to);
        Object[] purchaseTotals = purchaseTotalsRows.isEmpty() ? new Object[]{0, 0, 0L} : purchaseTotalsRows.get(0);
        double purchaseNet = purchaseTotals[0] != null ? ((Number) purchaseTotals[0]).doubleValue() : 0;
        double purchaseGst = purchaseTotals[1] != null ? ((Number) purchaseTotals[1]).doubleValue() : 0;
        long purchaseCount = purchaseTotals[2] != null ? ((Number) purchaseTotals[2]).longValue() : 0;

        Map<String, Object> result = new HashMap<>();
        result.put("fromDate", from);
        result.put("toDate", to);
        result.put("salesGstCollected", salesGst);
        result.put("salesNetTotal", salesNet);
        result.put("salesInvoiceCount", salesCount);
        result.put("purchaseGstPaid", purchaseGst);
        result.put("purchaseNetTotal", purchaseNet);
        result.put("purchaseCount", purchaseCount);
        result.put("netGstPayable", salesGst - purchaseGst);
        return ResponseEntity.ok(result);
    }

    /** CSV export of the GST summary above, for filing/record-keeping. */
    @GetMapping("/gst-summary/export")
    public ResponseEntity<byte[]> exportGstSummary(@RequestParam String fromDate, @RequestParam String toDate) {
        LocalDate from = LocalDate.parse(fromDate);
        LocalDate to = LocalDate.parse(toDate);

        List<com.pos.app.Entity.SalesInvoiceMaster> salesInRange =
                salesInvoiceRepo.findByInvoiceDateBetweenOrderByInvoiceIdDesc(from, to);
        double salesGst = salesInRange.stream().mapToDouble(com.pos.app.Entity.SalesInvoiceMaster::getGstTotal).sum();
        double salesNet = salesInRange.stream().mapToDouble(com.pos.app.Entity.SalesInvoiceMaster::getNetTotal).sum();

        List<Object[]> purchaseTotalsRows = purchaseRepo.totalsForRange(from, to);
        Object[] purchaseTotals = purchaseTotalsRows.isEmpty() ? new Object[]{0, 0, 0L} : purchaseTotalsRows.get(0);
        double purchaseNet = purchaseTotals[0] != null ? ((Number) purchaseTotals[0]).doubleValue() : 0;
        double purchaseGst = purchaseTotals[1] != null ? ((Number) purchaseTotals[1]).doubleValue() : 0;

        try {
            byte[] csv = CsvExportUtil.toCsv(
                    List.of("Metric", "Amount"),
                    List.of(
                            new String[]{"Period", from + " to " + to},
                            new String[]{"Sales Net Total", String.valueOf(salesNet)},
                            new String[]{"Sales GST Collected", String.valueOf(salesGst)},
                            new String[]{"Purchase Net Total", String.valueOf(purchaseNet)},
                            new String[]{"Purchase GST Paid (Input Tax)", String.valueOf(purchaseGst)},
                            new String[]{"Net GST Payable", String.valueOf(salesGst - purchaseGst)}
                    ),
                    row -> List.of(row[0], row[1])
            );
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"gst-summary.csv\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(csv);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }

    /**
     * Inventory snapshot: total value of stock on hand, and slow-moving items (in
     * stock, but no sales within the given window — default 30 days) so a Tenant Admin
     * can spot dead stock.
     */
    @GetMapping("/inventory")
    public ResponseEntity<?> inventoryReport(@RequestParam(defaultValue = "30") int slowMovingDays) {
        Double totalValue = stockRepo.totalInventoryValue();
        LocalDate cutoff = LocalDate.now().minusDays(slowMovingDays);
        List<Object[]> slowMoving = stockRepo.slowMovingSince(cutoff);

        List<Map<String, Object>> slowMovingRows = slowMoving.stream().map(row -> {
            Map<String, Object> m = new HashMap<>();
            m.put("productId", row[0]);
            m.put("productName", row[1]);
            m.put("barcode", row[2]);
            m.put("qty", row[3]);
            m.put("stockValue", row[4]);
            return m;
        }).toList();

        Map<String, Object> result = new HashMap<>();
        result.put("totalInventoryValue", totalValue != null ? totalValue : 0);
        result.put("slowMovingDays", slowMovingDays);
        result.put("slowMovingCount", slowMovingRows.size());
        result.put("slowMovingItems", slowMovingRows);
        return ResponseEntity.ok(result);
    }

    /** CSV export of the slow-moving inventory list. */
    @GetMapping("/inventory/export")
    public ResponseEntity<byte[]> exportInventory(@RequestParam(defaultValue = "30") int slowMovingDays) {
        LocalDate cutoff = LocalDate.now().minusDays(slowMovingDays);
        List<Object[]> slowMoving = stockRepo.slowMovingSince(cutoff);
        try {
            byte[] csv = CsvExportUtil.toCsv(
                    List.of("Product ID", "Name", "Barcode", "Qty on Hand", "Stock Value"),
                    slowMoving,
                    row -> List.of(
                            String.valueOf(row[0]), String.valueOf(row[1]),
                            row[2] == null ? "" : String.valueOf(row[2]),
                            String.valueOf(row[3]), String.valueOf(row[4])
                    )
            );
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"slow-moving-inventory.csv\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(csv);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }
}
