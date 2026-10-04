package com.pos.app.Controller;

import java.security.Principal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.pos.app.DTO.InvoiceRequestDTO;
import com.pos.app.Entity.SalesInvoiceMaster;
import com.pos.app.Entity.SettingMaster;
import com.pos.app.Repository.SalesInvoiceMasterRepository;
import com.pos.app.Repository.SettingMasterRepository;
import com.pos.app.Service.ISalesInvoiceMaster;
import com.pos.app.common.service.InvoicePdfService;
import com.pos.app.config.ApiVersionConfig;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/sales-invoice")
public class SalesInvoiceMasterController {

    @Autowired
    private ISalesInvoiceMaster salesInvService;

    @Autowired
    private SalesInvoiceMasterRepository salesInvoiceMasterRepository;

    @Autowired
    private SettingMasterRepository settingMasterRepository;

    @Autowired
    private InvoicePdfService invoicePdfService;

    @PreAuthorize("hasAuthority('PERM_INVOICE_VIEW')")
    @GetMapping("/invoice/{invoiceId}")
    ResponseEntity<?> getInvoiceDetails(@PathVariable long invoiceId) {
        return salesInvService.fetchSingleInvoiceById(invoiceId);
    }

    /** Downloadable PDF for a single invoice — receipts, sharing with customers, records. */
    @PreAuthorize("hasAuthority('PERM_INVOICE_VIEW')")
    @GetMapping("/{invoiceId}/pdf")
    public ResponseEntity<byte[]> downloadInvoicePdf(@PathVariable long invoiceId) {
        SalesInvoiceMaster invoice = salesInvoiceMasterRepository.findByIdWithItems(invoiceId)
                .orElseThrow(() -> new com.pos.app.Exception.ResourceNotFoundExceptionHandling("Invoice not found"));
        List<SettingMaster> settingRows = settingMasterRepository.findAllOrdered();
        SettingMaster settings = settingRows.isEmpty() ? null : settingRows.get(0);

        byte[] pdfBytes = invoicePdfService.generate(invoice, settings);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"invoice-" + invoice.getInvoiceNumber() + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    // track createdBy
    @PreAuthorize("hasAuthority('PERM_INVOICE_CREATE')")
    @PostMapping("/create")
    ResponseEntity<?> createInvoice(@RequestBody InvoiceRequestDTO request, Principal principal) {
        String username = (principal != null && principal.getName() != null) ? principal.getName() : "SYSTEM";
        return salesInvService.createInvoice(request, username);
    }

    @PreAuthorize("hasAuthority('PERM_INVOICE_VIEW')")
    @GetMapping("/list")
    public ResponseEntity<?> list(
            @RequestParam String fromDate,
            @RequestParam String toDate
    ) {
        return salesInvService.listInvoices(LocalDate.parse(fromDate), LocalDate.parse(toDate));
    }

    // ✅ paginated / searchable / filterable invoice list
    @PreAuthorize("hasAuthority('PERM_INVOICE_VIEW')")
    @GetMapping("/search")
    public ResponseEntity<?> searchInvoices(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) com.pos.app.Enum.PaymentStatus payStatus,
            @RequestParam(required = false) com.pos.app.Enum.PaymentMethod payMethod,
            @RequestParam(defaultValue = "invoiceDate,desc") String sort
    ) {
        LocalDate from = (fromDate != null && !fromDate.isBlank()) ? LocalDate.parse(fromDate) : null;
        LocalDate to = (toDate != null && !toDate.isBlank()) ? LocalDate.parse(toDate) : null;
        return salesInvService.searchInvoices(page, size, from, to, search, payStatus, payMethod, sort);
    }

    // ✅ CSV export (same filters as /search)
    @PreAuthorize("hasAuthority('PERM_INVOICE_VIEW')")
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

        var page = salesInvoiceMasterRepository.search(from, to, search, payStatus, payMethod,
                org.springframework.data.domain.PageRequest.of(0, 100000,
                        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "invoiceDate")));
        try {
            byte[] csv = com.pos.app.common.util.CsvExportUtil.toCsv(
                    java.util.List.of("Invoice #", "Date", "Customer", "Phone", "Net Total", "Payment Method", "Status"),
                    page.getContent(),
                    i -> java.util.List.of(
                            i.getInvoiceNumber() == null ? "" : i.getInvoiceNumber(),
                            i.getInvoiceDate() == null ? "" : i.getInvoiceDate().toString(),
                            i.getCustomerName() == null ? "" : i.getCustomerName(),
                            i.getCustomerPhone() == null ? "" : i.getCustomerPhone(),
                            String.valueOf(i.getNetTotal()),
                            i.getPayMethod() == null ? "" : i.getPayMethod().name(),
                            i.getPayStatus() == null ? "" : i.getPayStatus().name()
                    )
            );
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"invoices.csv\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(csv);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }

    // track updatedBy
    @PreAuthorize("hasAuthority('PERM_INVOICE_EDIT')")
    @PutMapping("/update/{invoiceId}")
    public ResponseEntity<?> updateInvoice(
            @PathVariable long invoiceId,
            @RequestBody InvoiceRequestDTO request,
            Principal principal
    ) {
        String username = (principal != null && principal.getName() != null) ? principal.getName() : "SYSTEM";
        return salesInvService.updateInvoice(invoiceId, request, username);
    }

    // track deletedBy (optional)
    @PreAuthorize("hasAuthority('PERM_INVOICE_CANCEL')")
    @DeleteMapping("/delete/{invoiceId}")
    public ResponseEntity<?> voidInvoice(@PathVariable long invoiceId,
                                         @RequestParam(required = false) String reason,
                                         Principal principal) {
        String username = (principal != null && principal.getName() != null) ? principal.getName() : "SYSTEM";
        return salesInvService.voidInvoice(invoiceId, reason, username);
    }
}
