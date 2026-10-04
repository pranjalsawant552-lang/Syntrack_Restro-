package com.pos.app.Controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import com.pos.app.DTO.CreateSupplierDTO;
import com.pos.app.Repository.SupplierRepository;
import com.pos.app.Service.ISupplierService;
import com.pos.app.common.util.CsvExportUtil;
import com.pos.app.config.ApiVersionConfig;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiVersionConfig.API_VERSION + "/supplier")
public class SupplierController {

    private final ISupplierService service;
    private final SupplierRepository supplierRepository;

    @PreAuthorize("hasAuthority('PERM_SUPPLIER_VIEW')")
    @GetMapping("/list")
    public ResponseEntity<?> listAll() {
        return service.listAll();
    }

    @PreAuthorize("hasAuthority('PERM_SUPPLIER_VIEW')")
    @GetMapping("/search-paged")
    public ResponseEntity<?> searchPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "supplierName,asc") String sort
    ) {
        return service.searchPaged(page, size, search, active, sort);
    }

    @PreAuthorize("hasAuthority('PERM_SUPPLIER_CREATE')")
    @PostMapping("/create")
    public ResponseEntity<?> create(@RequestBody CreateSupplierDTO dto) {
        return service.create(dto);
    }

    @PreAuthorize("hasAuthority('PERM_SUPPLIER_EDIT')")
    @PutMapping("/{supplierId}/update")
    public ResponseEntity<?> update(@PathVariable Long supplierId, @RequestBody CreateSupplierDTO dto) {
        return service.update(supplierId, dto);
    }

    @PreAuthorize("hasAuthority('PERM_SUPPLIER_EDIT')")
    @PatchMapping("/{supplierId}/status")
    public ResponseEntity<?> status(@PathVariable Long supplierId, @RequestParam Boolean isActive) {
        return service.toggleActive(supplierId, isActive);
    }

    @PreAuthorize("hasAuthority('PERM_SUPPLIER_VIEW')")
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active
    ) {
        var page = supplierRepository.search(search, active,
                org.springframework.data.domain.PageRequest.of(0, 100000,
                        org.springframework.data.domain.Sort.by("supplierName")));
        try {
            byte[] csv = CsvExportUtil.toCsv(
                    java.util.List.of("Supplier ID", "Name", "Phone", "Email", "Address", "GST Number", "Active"),
                    page.getContent(),
                    s -> java.util.List.of(
                            String.valueOf(s.getSupplierId()),
                            nullSafe(s.getSupplierName()),
                            nullSafe(s.getPhone()),
                            nullSafe(s.getEmail()),
                            nullSafe(s.getAddress()),
                            nullSafe(s.getGstNumber()),
                            String.valueOf(Boolean.TRUE.equals(s.getIsActive()))
                    )
            );
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"suppliers.csv\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(csv);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }

    private String nullSafe(String s) {
        return s == null ? "" : s;
    }
}
