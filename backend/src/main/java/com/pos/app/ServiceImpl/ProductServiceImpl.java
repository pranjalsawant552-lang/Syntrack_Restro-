// src/main/java/com/pos/app/ServiceImpl/ProductServiceImpl.java
package com.pos.app.ServiceImpl;

import com.pos.app.common.util.PageGuard;
import java.security.SecureRandom;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.pos.app.DTO.ProductDTO;
import com.pos.app.Entity.Category;
import com.pos.app.Entity.Product;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.CategoryRepository;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Service.IProductService;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.tenant.TenantContext;

import jakarta.transaction.Transactional;

@Service
@Transactional
public class ProductServiceImpl implements IProductService {

    @Autowired private ProductRepository prodRepo;
    @Autowired private CategoryRepository cateRepo;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private com.pos.app.Service.MenuAvailabilityService menuAvailabilityService;

    @Override
    public ResponseEntity<?> addNewProductByCateID(long cateId, ProductDTO dto) {
        Category cate = cateRepo.findById(cateId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Category Not found"));

        // ✅ enforce Super Admin-set product limit, if any
        var tenantOpt = tenantRepository.findByDbName(TenantContext.getCurrentTenant());
        if (tenantOpt.isPresent() && tenantOpt.get().getMaxProducts() != null) {
            long currentCount = prodRepo.count();
            if (currentCount >= tenantOpt.get().getMaxProducts()) {
                return ResponseEntity.status(403).body(
                        "Product limit reached (" + tenantOpt.get().getMaxProducts() + "). Contact your platform admin to increase it.");
            }
        }

        // ✅ validate name
        String name = dto.getProductName() == null ? "" : dto.getProductName().trim();
        if (name.isEmpty()) return ResponseEntity.badRequest().body("Product name required");
        if (name.length() < 2) return ResponseEntity.badRequest().body("Min 2 characters");
        if (name.length() > 80) return ResponseEntity.badRequest().body("Max 80 characters");

        // ✅ validate numbers
        double price = dto.getProdPrice();
        if (Double.isNaN(price) || Double.isInfinite(price) || price < 0)
            return ResponseEntity.badRequest().body("Price must be 0 or greater");

        double gst = dto.getProdGST();
        if (Double.isNaN(gst) || Double.isInfinite(gst) || gst < 0 || gst > 100)
            return ResponseEntity.badRequest().body("GST must be between 0 to 100");

        double buyPrice = dto.getProdBuyPrice();
        if (Double.isNaN(buyPrice) || buyPrice < 0) buyPrice = 0;

        Product p = new Product();
        p.setProductId(null);
        p.setCategoryID(cate);

        p.setProductName(name);
        p.setProdPrice(price);
        p.setProdGST(gst);
        p.setProdBuyPrice(buyPrice);

        // ✅ UI -> entity mapping (isActive -> active)
        p.setActive(dto.isActive());
        p.setIsVeg(dto.getIsVeg());

        // menu item (no stock) vs stock product; a combo never has its own stock (its components do)
        p.setCombo(dto.getCombo() != null && dto.getCombo());
        p.setTrackStock(!p.isCombo() && (dto.getTrackStock() == null || dto.getTrackStock()));

        // ✅ barcode: if client sent barcode, use it; else auto-generate unique
        String incomingBarcode = dto.getBarcode() == null ? "" : dto.getBarcode().trim();
        if (!incomingBarcode.isEmpty()) {
            // optional: enforce max length
            if (incomingBarcode.length() > 32) return ResponseEntity.badRequest().body("Barcode max length = 32");
            if (prodRepo.existsByBarcode(incomingBarcode)) return ResponseEntity.badRequest().body("Barcode already exists");
            p.setBarcode(incomingBarcode);
        } else {
            p.setBarcode(generateUniqueBarcode());
        }

        prodRepo.save(p);

        // ✅ return created product DTO (frontend easily refresh / show barcode)
        ProductDTO out = toDto(p);
        out.setCategoryId(cate.getCategoryId());
        out.setCategoryName(cate.getCategoryName());

        return ResponseEntity.status(201).body(out);
    }

    @Override
    public ResponseEntity<?> productsByCategoryId(long cateId) {
        cateRepo.findById(cateId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Category Not found"));
        return ResponseEntity.ok(prodRepo.findDtosByCategoryId(cateId));
    }

    @Override
    public ResponseEntity<?> allProducts(Boolean activeOnly) {
        List<ProductDTO> list = (activeOnly != null && activeOnly)
                ? prodRepo.findAllActiveDtos()
                : prodRepo.findAllDtos();
        return ResponseEntity.ok(list);
    }

    @Override
    public ResponseEntity<?> updateProduct(long cateId, long prodId, ProductDTO dto) {
        Category cate = cateRepo.findById(cateId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Category Not found"));

        Product prod = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));

        if (prod.getCategoryID() == null || !prod.getCategoryID().getCategoryId().equals(cate.getCategoryId())) {
            return ResponseEntity.badRequest().body("Product does not belong to this category");
        }

        String name = dto.getProductName() == null ? "" : dto.getProductName().trim();
        if (name.isEmpty()) return ResponseEntity.badRequest().body("Product name required");
        if (name.length() < 2) return ResponseEntity.badRequest().body("Min 2 characters");
        if (name.length() > 80) return ResponseEntity.badRequest().body("Max 80 characters");

        double price = dto.getProdPrice();
        if (Double.isNaN(price) || Double.isInfinite(price) || price < 0)
            return ResponseEntity.badRequest().body("Price must be 0 or greater");

        double gst = dto.getProdGST();
        if (Double.isNaN(gst) || Double.isInfinite(gst) || gst < 0 || gst > 100)
            return ResponseEntity.badRequest().body("GST must be between 0 to 100");

        double buyPrice = dto.getProdBuyPrice();
        if (Double.isNaN(buyPrice) || buyPrice < 0) buyPrice = 0;

        prod.setProductName(name);
        prod.setProdPrice(price);
        prod.setProdGST(gst);
        prod.setProdBuyPrice(buyPrice);

        // ✅ DTO isActive -> entity active
        prod.setActive(dto.isActive());
        prod.setIsVeg(dto.getIsVeg());
        if (dto.getCombo() != null) prod.setCombo(dto.getCombo());
        if (dto.getTrackStock() != null) prod.setTrackStock(dto.getTrackStock());
        if (prod.isCombo()) prod.setTrackStock(false);

        // ✅ optional barcode update (only if provided)
        if (dto.getBarcode() != null) {
            String bc = dto.getBarcode().trim();
            if (!bc.isEmpty()) {
                if (bc.length() > 32) return ResponseEntity.badRequest().body("Barcode max length = 32");
                // If changing barcode, ensure uniqueness
                if (!bc.equals(prod.getBarcode()) && prodRepo.existsByBarcode(bc))
                    return ResponseEntity.badRequest().body("Barcode already exists");
                prod.setBarcode(bc);
            }
        }

        prodRepo.save(prod);

        ProductDTO out = toDto(prod);
        out.setCategoryId(cate.getCategoryId());
        out.setCategoryName(cate.getCategoryName());

        return ResponseEntity.ok(out);
    }

    @Override
    public ResponseEntity<?> toggleProductStatus(long cateId, long prodId, boolean isActive) {
        Product prod = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));

        if (prod.getCategoryID() == null || !prod.getCategoryID().getCategoryId().equals(cateId)) {
            return ResponseEntity.badRequest().body("Product does not belong to this category");
        }

        prod.setActive(isActive);
        prodRepo.save(prod);

        return ResponseEntity.ok(isActive ? "Product activated" : "Product deactivated");
    }

    @Override
    public ResponseEntity<?> deleteProduct(long cateId, long prodId) {
        Product prod = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));

        if (prod.getCategoryID() == null || !prod.getCategoryID().getCategoryId().equals(cateId)) {
            return ResponseEntity.badRequest().body("Product does not belong to this category");
        }

        // ✅ soft delete
        prod.setActive(false);
        prodRepo.save(prod);

        return ResponseEntity.ok("Product deactivated (soft delete).");
    }

    @Override
    public ResponseEntity<?> searchProducts(int page, int size, String search, Long categoryId, Boolean active, String sort) {
        String[] sortParts = sort.split(",");
        String sortField = sortParts.length > 0 && !sortParts[0].isBlank() ? sortParts[0] : "productName";
        org.springframework.data.domain.Sort.Direction dir =
                sortParts.length > 1 && sortParts[1].equalsIgnoreCase("desc")
                        ? org.springframework.data.domain.Sort.Direction.DESC
                        : org.springframework.data.domain.Sort.Direction.ASC;

        org.springframework.data.domain.Page<ProductDTO> result = prodRepo.search(
                search, categoryId, active,
                org.springframework.data.domain.PageRequest.of(PageGuard.page(page), PageGuard.size(size),
                        org.springframework.data.domain.Sort.by(dir, sortField)));

        return ResponseEntity.ok(java.util.Map.of(
                "content", result.getContent(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "page", page,
                "size", size
        ));
    }

    /* ---------------- mapping helpers ---------------- */
    private ProductDTO toDto(Product p) {
        ProductDTO dto = new ProductDTO();
        dto.setProductId(p.getProductId());
        dto.setProductName(p.getProductName());
        dto.setProdPrice(p.getProdPrice());
        dto.setProdGST(p.getProdGST());
        dto.setProdBuyPrice(p.getProdBuyPrice());
        dto.setBarcode(p.getBarcode());
        dto.setActive(p.isActive()); // IMPORTANT: ProductDTO must have setIsActive / isActive
        dto.setIsVeg(p.getIsVeg());
        dto.setTemporarilyUnavailable(p.isTemporarilyUnavailable());
        dto.setTrackStock(p.isTrackStock());
        dto.setCombo(p.isCombo());
        return dto;
    }

    /* ---------------- barcode helpers ---------------- */
    private static final SecureRandom RNG = new SecureRandom();

    private String generateUniqueBarcode() {
        for (int i = 0; i < 10; i++) {
            String candidate = "BC-" + randomAlphaNum(10); // manual-friendly
            if (!prodRepo.existsByBarcode(candidate)) return candidate;
        }
        throw new RuntimeException("Unable to generate unique barcode");
    }

    private String randomAlphaNum(int len) {
        final String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) sb.append(chars.charAt(RNG.nextInt(chars.length())));
        return sb.toString();
    }

    /* ---------------- "86" board ---------------- */

    @Override
    public ResponseEntity<?> toggle86(long prodId, boolean temporarilyUnavailable) {
        Product p = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));
        // same rules, audit trail and live push as the Availability screen
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        menuAvailabilityService.setOne(prodId, !temporarilyUnavailable, auth == null ? "SYSTEM" : auth.getName());
        return ResponseEntity.ok(toDto(prodRepo.findById(prodId).orElse(p)));
    }

    @Override
    public ResponseEntity<?> list86() {
        var list = prodRepo.findByTemporarilyUnavailableTrueOrderByProductNameAsc()
                .stream().map(this::toDto).collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @Override
    public ResponseEntity<?> clearAll86s() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        int count = menuAvailabilityService.clearAllOff(auth == null ? "SYSTEM" : auth.getName());
        return ResponseEntity.ok("Cleared " + count + " item(s) from the 86 list");
    }
}
