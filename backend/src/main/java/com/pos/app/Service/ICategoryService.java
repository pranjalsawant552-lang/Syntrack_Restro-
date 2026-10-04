package com.pos.app.Service;

import org.springframework.http.ResponseEntity;

public interface ICategoryService {
    ResponseEntity<?> insertNewCategory(String categoryName, Long parentCategoryId);
    ResponseEntity<?> allCategories(Boolean includeInactive);
    ResponseEntity<?> updateCategory(Long categoryId, String categoryName, Long parentCategoryId);
    ResponseEntity<?> toggleCategoryStatus(Long categoryId, boolean active);
    ResponseEntity<?> forceDeleteCategory(Long categoryId);

    ResponseEntity<?> searchCategories(int page, int size, String search, Boolean active, String sort);

    // ✅ NEW: sub-categories
    ResponseEntity<?> subCategoriesOf(Long parentCategoryId, Boolean includeInactive);
}
