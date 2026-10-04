package com.pos.app.Controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import com.pos.app.DTO.ProductDTO;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Service.IProductService;
import com.pos.app.common.util.CsvExportUtil;
import com.pos.app.config.ApiVersionConfig;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/product")
public class ProductController {

    @Autowired
    private IProductService prodService;

    @Autowired
    private ProductRepository productRepository;

    // ✅ CSV export of all products (respects the same search/category/active filters as /search)
    @PreAuthorize("hasAuthority('PERM_PRODUCT_VIEW')")
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Boolean active
    ) {
        var page = productRepository.search(search, categoryId, active,
                org.springframework.data.domain.PageRequest.of(0, 100000,
                        org.springframework.data.domain.Sort.by("productName")));

        try {
            byte[] csv = CsvExportUtil.toCsv(
                    java.util.List.of("Product ID", "Name", "Category", "Price", "GST %", "Buy Price", "Barcode", "Active"),
                    page.getContent(),
                    p -> java.util.List.of(
                            String.valueOf(p.getProductId()),
                            nullSafe(p.getProductName()),
                            nullSafe(p.getCategoryName()),
                            String.valueOf(p.getProdPrice()),
                            String.valueOf(p.getProdGST()),
                            String.valueOf(p.getProdBuyPrice()),
                            nullSafe(p.getBarcode()),
                            String.valueOf(p.isActive())
                    )
            );
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"products.csv\"")
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .body(csv);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(null);
        }
    }

    private String nullSafe(String s) {
        return s == null ? "" : s;
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_CREATE')")
    @PostMapping("/{cateId}/add_product")
    public ResponseEntity<?> addNewProductUnderCategory(
            @PathVariable long cateId,
            @RequestBody ProductDTO prodtInfo
    ) {
        return prodService.addNewProductByCateID(cateId, prodtInfo);
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_VIEW')")
    @GetMapping("/{cateId}/product_list")
    public ResponseEntity<?> productListByCategoryId(@PathVariable long cateId) {
        return prodService.productsByCategoryId(cateId);
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_VIEW')")
    @GetMapping("/all_prodcut_list")
    public ResponseEntity<?> allProductsList(
            @RequestParam(required = false, defaultValue = "false") Boolean activeOnly
    ) {
        return prodService.allProducts(activeOnly);
    }

    // ✅ paginated / searchable / filterable product list
    @PreAuthorize("hasAuthority('PERM_PRODUCT_VIEW')")
    @GetMapping("/search")
    public ResponseEntity<?> searchProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "productName,asc") String sort
    ) {
        return prodService.searchProducts(page, size, search, categoryId, active, sort);
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_EDIT')")
    @PutMapping("/{cateId}/product/{prodId}")
    public ResponseEntity<?> updateProduct(
            @PathVariable long cateId,
            @PathVariable long prodId,
            @RequestBody ProductDTO dto
    ) {
        return prodService.updateProduct(cateId, prodId, dto);
    }

    // ✅ soft delete
    @PreAuthorize("hasAuthority('PERM_PRODUCT_DELETE')")
    @DeleteMapping("/{cateId}/product/{prodId}")
    public ResponseEntity<?> deleteProduct(
            @PathVariable long cateId,
            @PathVariable long prodId
    ) {
        return prodService.deleteProduct(cateId, prodId);
    }

    // ✅ toggle active/inactive
    @PreAuthorize("hasAuthority('PERM_PRODUCT_EDIT')")
    @PatchMapping("/{cateId}/product/{prodId}/status")
    public ResponseEntity<?> toggleStatus(
            @PathVariable long cateId,
            @PathVariable long prodId,
            @RequestParam boolean isActive
    ) {
        return prodService.toggleProductStatus(cateId, prodId, isActive);
    }

    // ✅ "86" board -- fast, one-tap "out of X today" toggle for waitstaff/kitchen,
    // separate from the full edit form and from the permanent active/inactive flag.
    // Gated on RESTAURANT_MANAGE (not PRODUCT_EDIT) since this is a floor-staff action,
    // not a catalog-management one -- a waiter shouldn't need product-edit rights just
    // to mark a dish out for the night.
    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE') or hasAuthority('PERM_PRODUCT_EDIT')")
    @PatchMapping("/{prodId}/86")
    public ResponseEntity<?> toggle86(@PathVariable long prodId, @RequestParam boolean unavailable) {
        return prodService.toggle86(prodId, unavailable);
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE') or hasAuthority('PERM_PRODUCT_EDIT') or hasAuthority('PERM_KITCHEN_VIEW')")
    @GetMapping("/86-list")
    public ResponseEntity<?> list86() {
        return prodService.list86();
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE') or hasAuthority('PERM_PRODUCT_EDIT')")
    @PostMapping("/86-list/clear")
    public ResponseEntity<?> clearAll86s() {
        return prodService.clearAll86s();
    }
}
