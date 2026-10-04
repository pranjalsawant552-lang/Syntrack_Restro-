package com.pos.app.Entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

@Entity
// ✅ CategoryPage's /category/search filters by categoryName on every keystroke
@Table(name = "category", indexes = {
        @Index(name = "idx_category_name", columnList = "category_name")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long categoryId;

    private String categoryName;

    // ✅ NEW: active flag
    @Column(columnDefinition = "BOOLEAN DEFAULT TRUE")
    @JsonProperty("isActive")
    private boolean isActive = true;

    /* =========================
       ✅ SUB-CATEGORIES (NEW)
       Self-referencing, nullable FK -> existing categories are unaffected
       (they simply have parentCategory = null, i.e. top-level, same as before).
       Only 2 levels are supported by design (enforced in the service layer):
       a category that is itself a sub-category cannot have sub-categories of
       its own, and a category that already has sub-categories cannot become
       one. parentCategory is intentionally NOT serialized directly (JsonIgnore)
       to avoid exposing/lazy-loading the whole parent object and to keep the
       JSON shape flat -- callers get parentCategoryId / parentCategoryName
       instead, via the transient getters below.
    ========================= */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_category_id")
    @JsonIgnore
    @ToString.Exclude
    private Category parentCategory;

    public Category(String categoryName) {
        this.categoryName = categoryName;
        this.isActive = true;
    }

    public Category(String categoryName, Category parentCategory) {
        this.categoryName = categoryName;
        this.isActive = true;
        this.parentCategory = parentCategory;
    }

    @Transient
    @JsonProperty("parentCategoryId")
    public Long getParentCategoryId() {
        return parentCategory != null ? parentCategory.getCategoryId() : null;
    }

    @Transient
    @JsonProperty("parentCategoryName")
    public String getParentCategoryName() {
        return parentCategory != null ? parentCategory.getCategoryName() : null;
    }

    @Transient
    @JsonProperty("isSubCategory")
    public boolean isSubCategory() {
        return parentCategory != null;
    }
}
