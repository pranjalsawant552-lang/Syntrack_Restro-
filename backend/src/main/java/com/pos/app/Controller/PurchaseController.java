package com.pos.app.Controller;

import java.security.Principal;
import java.time.LocalDate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.pos.app.DTO.PurchaseRequestDTO;
import com.pos.app.Repository.PurchaseInvoiceMasterRepository;
import com.pos.app.Service.IPurchaseService;
import com.pos.app.common.util.CsvExportUtil;
import com.pos.app.config.ApiVersionConfig;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/purchase")
public class PurchaseController {

    @Autowired
    private IPurchaseService purchaseService;

    @Autowired
    private PurchaseInvoiceMasterRepository purchaseRepository;

    @PreAuthorize("hasAuthority('PERM_PURCHASE_CREATE')")
    @PostMapping("/create")
    public ResponseEntity<?> createPurchase(@RequestBody PurchaseRequestDTO request, Principal principal) {
        String username = (principal != null && principal.getName() != null) ? principal.getName() : "SYSTEM";
        return purchaseService.createPurchase(request, username);
    }

    @PreAuthorize("hasAuthority('PERM_PURCHASE_VIEW')")
    @GetMapping("/{purchaseId}")
    public ResponseEntity<?> getPurchase(@PathVariable long purchaseId) {
        return purchaseService.getPurchaseById(purchaseId);
    }

    @PreAuthorize("hasAuthority('PERM_PURCHASE_CANCEL')")
    @DeleteMapping("/{purchaseId}")
    public ResponseEntity<?> cancelPurchase(@PathVariable long purchaseId, Principal principal) {
        String username = (principal != null && principal.getName() != null) ? principal.getName() : "SYSTEM";
        return purchaseService.cancelPurchase(purchaseId, username);
    }

    @PreAuthorize("hasAuthority('PERM_PURCHASE_VIEW')")
    @GetMapping("/search")
    public ResponseEntity<?> searchPurchases(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) com.pos.app.Enum.PaymentStatus payStatus,
            @RequestParam(required = false) com.pos.app.Enum.PaymentMethod payMethod,
            @RequestParam(defaultValue = "purchaseDate,desc") String sort
    ) {
        LocalDate from = (fromDate != null && !fromDate.isBlank()) ? LocalDate.parse(fromDate) : null;
        LocalDate to = (toDate != null && !toDate.isBlank()) ? LocalDate.parse(toDate) : null;
        return purchaseService.searchPurchases(page, size, from, to, search, payStatus, payMethod, sort);
    }

    @PreAuthorize("hasAuthority('PERM_PURCHASE_VIEW')")
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv(
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) com.pos.app.Enum.PaymentStatus payStatus,
            @RequestParam(required = false) com.pos.app.Enum.PaymentMethod payMethod
    ) {
        LocalDate from = (fromDate != null && !fromDate.isBlank()) ? LocalDate.parse(fromDate) : null;
        LocalDate to = (toDate != null && !toDate.isBlank()) ? LocalDate.parse(toDate) : null;

        var page = purchaseRepository.search(from, to, search, payStatus, payMethod,
                org.springframework.data.domain.PageRequest.of(0, 100000,
                        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "purchaseDate")));
        try {
            byte[] csv = CsvExportUtil.toCsv(
                    java.util.List.of("Purchase #", "Bill #", "Date", "Supplier", "Phone", "Net Total", "Payment Method", "Status"),
                    page.getContent(),
                    p -> java.util.List.of(
                            p.getPurchaseNumber() == null ? "" : p.getPurchaseNumber(),
                            p.getSupplierBillNumber() == null ? "" : p.getSupplierBillNumber(),
                            p.getPurchaseDate() == null ? "" : p.getPurchaseDate().toString(),
                            p.getSupplierName() == null ? "" : p.getSupplierName(),
                            p.getSupplierPhone() == null ? "" : p.getSupplierPhone(),
                            String.valueOf(p.getNetTotal()),
                            p.getPayMethod() == null ? "" : p.getPayMethod().name(),
                            p.getPayStatus() == null ? "" : p.getPayStatus().name()
                    )
            );
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"purchases.csv\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(csv);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }
}
