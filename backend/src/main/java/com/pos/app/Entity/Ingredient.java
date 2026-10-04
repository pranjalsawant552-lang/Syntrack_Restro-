package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A raw ingredient (flour, paneer, cooking oil...). Kept SEPARATE from menu items
 * (Product): a dish is linked to ingredients only through a {@link Recipe}.
 * {@code currentQty} is a cached balance in the ingredient's BASE unit and must
 * only be changed by InventoryService via an {@link IngredientMovement}.
 */
@Entity
@Table(name = "ingredient", indexes = {
        @Index(name = "idx_ingredient_name", columnList = "name")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Ingredient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long ingredientId;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    /** G, ML or PCS -- all stock, recipes and costs are expressed in this unit. */
    @Column(nullable = false, length = 8)
    private String baseUnit;

    @Column(nullable = false, precision = 16, scale = 4)
    private BigDecimal currentQty = BigDecimal.ZERO;

    /** Alert when currentQty <= reorderLevel (0 = no alert). */
    @Column(nullable = false, precision = 16, scale = 4)
    private BigDecimal reorderLevel = BigDecimal.ZERO;

    /** Weighted-average cost per ONE base unit (e.g. per gram). */
    @Column(nullable = false, precision = 16, scale = 6)
    private BigDecimal avgCost = BigDecimal.ZERO;

    @Column(nullable = false)
    private boolean active = true;

    /** Optimistic lock: two concurrent writers can never silently overwrite each other. */
    @Version
    private Long version;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
