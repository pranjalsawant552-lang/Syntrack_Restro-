package com.pos.app.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import com.pos.app.DTO.CreateCustomerDTO;
import com.pos.app.Repository.CustomerRepository;
import com.pos.app.Service.ICustomerService;
import com.pos.app.common.util.CsvExportUtil;
import com.pos.app.config.ApiVersionConfig;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiVersionConfig.API_VERSION + "/customer")
public class CustomerController {

    private final ICustomerService service;
    private final CustomerRepository customerRepository;

    // ✅ CSV export
    @PreAuthorize("hasAuthority('PERM_CUSTOMER_VIEW')")
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active
    ) {
        var page = customerRepository.search(search, active,
                org.springframework.data.domain.PageRequest.of(0, 100000,
                        org.springframework.data.domain.Sort.by("customerName")));
        try {
            byte[] csv = CsvExportUtil.toCsv(
                    java.util.List.of("Customer ID", "Name", "Phone", "Email", "Address", "Active"),
                    page.getContent(),
                    c -> java.util.List.of(
                            String.valueOf(c.getCustomerId()),
                            nullSafe(c.getCustomerName()),
                            nullSafe(c.getPhone()),
                            nullSafe(c.getEmail()),
                            nullSafe(c.getAddress()),
                            String.valueOf(Boolean.TRUE.equals(c.getIsActive()))
                    )
            );
            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"customers.csv\"")
                    .contentType(org.springframework.http.MediaType.parseMediaType("text/csv"))
                    .body(csv);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }

    private String nullSafe(String s) {
        return s == null ? "" : s;
    }

    @PreAuthorize("hasAuthority('PERM_CUSTOMER_VIEW')")
    @GetMapping("/list")
    public ResponseEntity<?> listAll() {
        return service.listAll();
    }

    @PreAuthorize("hasAuthority('PERM_CUSTOMER_VIEW')")
    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam(required = false, defaultValue = "") String q) {
        return service.search(q);
    }

    // paginated / filterable customer list (distinct from the quick-search-for-billing endpoint above)
    @PreAuthorize("hasAuthority('PERM_CUSTOMER_VIEW')")
    @GetMapping("/search-paged")
    public ResponseEntity<?> searchPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "customerName,asc") String sort
    ) {
        return service.searchPaged(page, size, search, active, sort);
    }

    @PreAuthorize("hasAuthority('PERM_CUSTOMER_CREATE')")
    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody CreateCustomerDTO dto) {
        return service.create(dto);
    }

    @PreAuthorize("hasAuthority('PERM_CUSTOMER_EDIT')")
    @PutMapping("/{customerId}/update")
    public ResponseEntity<?> update(@PathVariable Long customerId, @RequestBody CreateCustomerDTO dto) {
        return service.update(customerId, dto);
    }

    @PreAuthorize("hasAuthority('PERM_CUSTOMER_EDIT')")
    @PatchMapping("/{customerId}/status")
    public ResponseEntity<?> status(@PathVariable Long customerId, @RequestParam Boolean isActive) {
        return service.toggleActive(customerId, isActive);
    }
}
