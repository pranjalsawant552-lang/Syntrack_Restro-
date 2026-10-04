package com.pos.app.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.Category;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    Category findByCategoryName(String categoryName);

    boolean existsByCategoryName(String categoryName);

    // ✅ only active categories
    List<Category> findByIsActiveTrue();

    // ✅ active + inactive both
    List<Category> findByIsActive(boolean active);

    /* =========================
       ✅ SUB-CATEGORIES (NEW)
    ========================= */

    // top-level categories only (no parent)
    List<Category> findByParentCategoryIsNull();
    List<Category> findByParentCategoryIsNullAndIsActive(boolean active);

    // sub-categories of a given parent
    List<Category> findByParentCategory_CategoryId(Long parentCategoryId);
    List<Category> findByParentCategory_CategoryIdAndIsActive(Long parentCategoryId, boolean active);

    // name-uniqueness scoped to the same level (top-level names unique among
    // top-level categories; sub-category names unique among siblings under the
    // same parent) -- this is what keeps existing top-level uniqueness identical
    // to the old global-uniqueness behaviour, since every pre-existing category
    // is top-level (parentCategory = null) already.
    boolean existsByCategoryNameAndParentCategoryIsNull(String categoryName);
    boolean existsByCategoryNameAndParentCategory_CategoryId(String categoryName, Long parentCategoryId);

    // same as above but returns the row (so an update can tell "duplicate is
    // actually myself" from "duplicate is a different category") -- at most one
    // row can match, since the exists* checks above enforce that uniqueness
    Category findByCategoryNameAndParentCategoryIsNull(String categoryName);
    Category findByCategoryNameAndParentCategory_CategoryId(String categoryName, Long parentCategoryId);

    // does this category currently have any sub-categories? used to block a
    // category with children from itself becoming a sub-category (2-level limit)
    boolean existsByParentCategory_CategoryId(Long parentCategoryId);

    // ✅ Pagination / search / filter (Phase 2)
    @Query("select c from Category c where (cast(:search as string) is null or cast(:search as string) = '' or lower(c.categoryName) like lower(concat('%', cast(:search as string), '%'))) and (:active is null or c.isActive = :active)")
    Page<Category> search(@Param("search") String search, @Param("active") Boolean active, Pageable pageable);
}
