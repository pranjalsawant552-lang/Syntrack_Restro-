package com.pos.app.Service;

import org.springframework.http.ResponseEntity;
import com.pos.app.DTO.ProductDTO;

public interface IProductService {
    ResponseEntity<?> addNewProductByCateID(long cateId, ProductDTO prodtInfo);
    ResponseEntity<?> productsByCategoryId(long cateId);
    ResponseEntity<?> allProducts(Boolean activeOnly);

    ResponseEntity<?> updateProduct(long cateId, long prodId, ProductDTO dto);
    ResponseEntity<?> deleteProduct(long cateId, long prodId);
    ResponseEntity<?> toggleProductStatus(long cateId, long prodId, boolean isActive);

    ResponseEntity<?> searchProducts(int page, int size, String search, Long categoryId, Boolean active, String sort);

    // ✅ "86" board -- toggle a single item's today-only availability, list what's
    // currently 86'd, and bulk-clear the list (start of a new day/shift).
    ResponseEntity<?> toggle86(long prodId, boolean temporarilyUnavailable);
    ResponseEntity<?> list86();
    ResponseEntity<?> clearAll86s();
}
