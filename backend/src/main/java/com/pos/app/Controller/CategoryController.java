package com.pos.app.Controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import com.pos.app.Service.ICategoryService;
import com.pos.app.config.ApiVersionConfig;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/category")
public class CategoryController {

    @Autowired
    private ICategoryService cateService;

    @PreAuthorize("hasAuthority('PERM_CATEGORY_CREATE')")
    @PostMapping("/add_category")
    public ResponseEntity<?> addNewCategory(
            @RequestParam String categoryName,
            @RequestParam(required = false) Long parentCategoryId
    ) {
        return cateService.insertNewCategory(categoryName, parentCategoryId);
    }

    // ✅ includeInactive optional param
    @PreAuthorize("hasAuthority('PERM_CATEGORY_VIEW')")
    @GetMapping("/category_list")
    public ResponseEntity<?> showCategoryList(
            @RequestParam(required = false, defaultValue = "false") Boolean includeInactive
    ) {
        return cateService.allCategories(includeInactive);
    }

    // ✅ NEW: sub-categories of a given parent
    @PreAuthorize("hasAuthority('PERM_CATEGORY_VIEW')")
    @GetMapping("/subcategories")
    public ResponseEntity<?> showSubCategories(
            @RequestParam Long parentCategoryId,
            @RequestParam(required = false, defaultValue = "false") Boolean includeInactive
    ) {
        return cateService.subCategoriesOf(parentCategoryId, includeInactive);
    }

    // ✅ paginated / searchable / filterable category list
    @PreAuthorize("hasAuthority('PERM_CATEGORY_VIEW')")
    @GetMapping("/search")
    public ResponseEntity<?> searchCategories(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "categoryName,asc") String sort
    ) {
        return cateService.searchCategories(page, size, search, active, sort);
    }

    @PreAuthorize("hasAuthority('PERM_CATEGORY_EDIT')")
    @PutMapping("/update_category")
    public ResponseEntity<?> updateCategory(
            @RequestParam Long categoryId,
            @RequestParam String categoryName,
            @RequestParam(required = false) Long parentCategoryId
    ) {
        return cateService.updateCategory(categoryId, categoryName, parentCategoryId);
    }

    @PreAuthorize("hasAuthority('PERM_CATEGORY_DELETE')")
    @DeleteMapping("/force_delete_category")
    public ResponseEntity<?> forceDeleteCategory(@RequestParam Long categoryId) {
        return cateService.forceDeleteCategory(categoryId);
    }


    // ✅ activate/deactivate
    @PreAuthorize("hasAuthority('PERM_CATEGORY_EDIT')")
    @PutMapping("/toggle_status")
    public ResponseEntity<?> toggleStatus(
            @RequestParam Long categoryId,
            @RequestParam boolean active
    ) {
        return cateService.toggleCategoryStatus(categoryId, active);
    }
}
