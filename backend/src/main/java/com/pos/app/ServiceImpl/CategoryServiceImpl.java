package com.pos.app.ServiceImpl;

import com.pos.app.common.util.PageGuard;
import java.util.List;

import com.pos.app.Repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.pos.app.Entity.Category;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.CategoryRepository;
import com.pos.app.Service.ICategoryService;

import jakarta.transaction.Transactional;

@Service
@Transactional
public class CategoryServiceImpl implements ICategoryService {

    @Autowired
    private CategoryRepository cateRepo;

    @Autowired
    private ProductRepository prodRepo;

    @Autowired
    private com.pos.app.Repository.SalesInvoiceItemRepository salesInvoiceItemRepo;

    @Autowired
    private com.pos.app.Repository.PurchaseInvoiceItemRepository purchaseInvoiceItemRepo;

    @Override
    public ResponseEntity<?> insertNewCategory(String categoryName, Long parentCategoryId) {
        String name = categoryName == null ? "" : categoryName.trim();

        if (name.isEmpty()) {
            return ResponseEntity.badRequest().body("Category name is required");
        }

        Category parent = null;
        if (parentCategoryId != null) {
            parent = cateRepo.findById(parentCategoryId)
                    .orElse(null);
            if (parent == null) {
                return ResponseEntity.badRequest().body("Parent category not found: " + parentCategoryId);
            }
            // ✅ only 2 levels supported: parent itself must be top-level
            if (parent.getParentCategory() != null) {
                return ResponseEntity.badRequest().body(
                        "'" + parent.getCategoryName() + "' is already a sub-category, so it can't have sub-categories of its own.");
            }
        }

        // name-uniqueness scoped to the same level (siblings under the same parent,
        // or among top-level categories) -- for existing data (everything top-level)
        // this behaves exactly like the old global-uniqueness check did.
        boolean duplicate = (parent == null)
                ? cateRepo.existsByCategoryNameAndParentCategoryIsNull(name)
                : cateRepo.existsByCategoryNameAndParentCategory_CategoryId(name, parent.getCategoryId());
        if (duplicate) {
            return ResponseEntity.status(409).body("Category already exists: " + name
                    + (parent != null ? " (under '" + parent.getCategoryName() + "')" : ""));
        }

        Category cate = new Category(name, parent);
        cateRepo.save(cate);

        return ResponseEntity.ok((parent != null ? "New sub-category: " : "New Category: ") + name
                + (parent != null ? " added under '" + parent.getCategoryName() + "'." : " added."));
    }

    @Override
    public ResponseEntity<?> forceDeleteCategory(Long categoryId) {
        Category cate = cateRepo.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Category Not found"));

        // ✅ include sub-categories: deleting a parent category also removes (or,
        // if referenced by invoices, deactivates) everything underneath it.
        List<Category> subCategories = cateRepo.findByParentCategory_CategoryId(categoryId);

        java.util.List<Long> allCategoryIds = new java.util.ArrayList<>();
        allCategoryIds.add(categoryId);
        subCategories.forEach(sc -> allCategoryIds.add(sc.getCategoryId()));

        // Check up-front whether any product in this category (or its sub-categories)
        // is referenced by sales or purchase history. Attempting the delete anyway
        // would fail with a raw DB foreign-key error (and expose SQL details to the
        // client), so instead we deactivate everything as a safe fallback -- exactly
        // what the confirmation dialog tells the user will happen.
        boolean anyReferenced = false;
        for (Long id : allCategoryIds) {
            if (salesInvoiceItemRepo.existsByProduct_CategoryID_CategoryId(id)
                    || purchaseInvoiceItemRepo.existsByProduct_CategoryID_CategoryId(id)) {
                anyReferenced = true;
                break;
            }
        }

        if (anyReferenced) {
            for (Long id : allCategoryIds) {
                prodRepo.deactivateAllByCategoryId(id);
            }
            subCategories.forEach(sc -> sc.setActive(false));
            cateRepo.saveAll(subCategories);
            cate.setActive(false);
            cateRepo.save(cate);

            String suffix = subCategories.isEmpty() ? "" : " (and its " + subCategories.size() + " sub-categor"
                    + (subCategories.size() == 1 ? "y" : "ies") + ")";
            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                    "Some products in this category" + suffix + " are linked to existing invoices, so they can't be " +
                    "permanently deleted. The category" + suffix + " and its products have been deactivated instead."
            );
        }

        // No invoice history references these products: safe to hard-delete.
        // Delete children first (products, then the sub-category rows), then the
        // parent's own products, then the parent itself.
        for (Category sc : subCategories) {
            prodRepo.deleteAllByCategoryId(sc.getCategoryId());
        }
        cateRepo.deleteAll(subCategories);

        prodRepo.deleteAllByCategoryId(categoryId);
        cateRepo.delete(cate);

        String suffix = subCategories.isEmpty() ? "" : " and its sub-categories";
        return ResponseEntity.ok("Category" + suffix + " and all related products deleted successfully.");
    }

    // ✅ default: show active only. Flat list -- each row carries parentCategoryId /
    // parentCategoryName (null for top-level categories), so callers that don't
    // care about the hierarchy keep working exactly as before.
    @Override
    public ResponseEntity<?> allCategories(Boolean includeInactive) {
        List<Category> cateList;

        if (includeInactive != null && includeInactive) {
            cateList = cateRepo.findAll();
        } else {
            cateList = cateRepo.findByIsActiveTrue();
        }

        return ResponseEntity.ok(cateList);
    }

    // ✅ NEW: sub-categories of a given parent
    @Override
    public ResponseEntity<?> subCategoriesOf(Long parentCategoryId, Boolean includeInactive) {
        if (parentCategoryId == null) {
            return ResponseEntity.badRequest().body("parentCategoryId is required");
        }
        if (!cateRepo.existsById(parentCategoryId)) {
            return ResponseEntity.status(404).body("Category not found: " + parentCategoryId);
        }

        List<Category> subs = (includeInactive != null && includeInactive)
                ? cateRepo.findByParentCategory_CategoryId(parentCategoryId)
                : cateRepo.findByParentCategory_CategoryIdAndIsActive(parentCategoryId, true);

        return ResponseEntity.ok(subs);
    }

    @Override
    public ResponseEntity<?> updateCategory(Long categoryId, String categoryName, Long parentCategoryId) {
        if (categoryId == null) {
            return ResponseEntity.badRequest().body("Category ID is required");
        }

        String name = categoryName == null ? "" : categoryName.trim();
        if (name.isEmpty()) {
            return ResponseEntity.badRequest().body("Category name is required");
        }

        Category cate = cateRepo.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Category Not found"));

        Category newParent = null;
        if (parentCategoryId != null) {
            if (parentCategoryId.equals(categoryId)) {
                return ResponseEntity.badRequest().body("A category can't be its own parent");
            }

            newParent = cateRepo.findById(parentCategoryId).orElse(null);
            if (newParent == null) {
                return ResponseEntity.badRequest().body("Parent category not found: " + parentCategoryId);
            }
            // ✅ only 2 levels: the new parent must itself be top-level
            if (newParent.getParentCategory() != null) {
                return ResponseEntity.badRequest().body(
                        "'" + newParent.getCategoryName() + "' is already a sub-category, so it can't have sub-categories of its own.");
            }
            // ✅ a category that already has sub-categories of its own can't become one
            if (cateRepo.existsByParentCategory_CategoryId(categoryId)) {
                return ResponseEntity.badRequest().body(
                        "'" + cate.getCategoryName() + "' already has sub-categories, so it can't become a sub-category itself.");
            }
        }

        // name-uniqueness scoped to the (possibly new) level, excluding itself
        Category conflict = (newParent == null)
                ? cateRepo.findByCategoryNameAndParentCategoryIsNull(name)
                : cateRepo.findByCategoryNameAndParentCategory_CategoryId(name, newParent.getCategoryId());
        if (conflict != null && !conflict.getCategoryId().equals(categoryId)) {
            return ResponseEntity.status(409).body("Category name already used: " + name
                    + (newParent != null ? " (under '" + newParent.getCategoryName() + "')" : ""));
        }

        cate.setCategoryName(name);
        cate.setParentCategory(newParent);
        cateRepo.save(cate);

        return ResponseEntity.ok("Category updated successfully.");
    }

    // ✅ soft delete: active/inactive
    @Override
    public ResponseEntity<?> toggleCategoryStatus(Long categoryId, boolean active) {
        Category cate = cateRepo.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Category Not found"));

        cate.setActive(active);
        cateRepo.save(cate);

        return ResponseEntity.ok(active ? "Category activated" : "Category deactivated");
    }

    @Override
    public ResponseEntity<?> searchCategories(int page, int size, String search, Boolean active, String sort) {
        String[] sortParts = sort.split(",");
        String sortField = sortParts.length > 0 && !sortParts[0].isBlank() ? sortParts[0] : "categoryName";
        org.springframework.data.domain.Sort.Direction dir =
                sortParts.length > 1 && sortParts[1].equalsIgnoreCase("desc")
                        ? org.springframework.data.domain.Sort.Direction.DESC
                        : org.springframework.data.domain.Sort.Direction.ASC;

        org.springframework.data.domain.Page<Category> result = cateRepo.search(
                search, active,
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
}
