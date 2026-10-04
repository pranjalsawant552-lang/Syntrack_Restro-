package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A size/portion of a menu item (e.g. Half / Full, Small / Large). The variant carries its OWN full
 * selling price. {@code recipeFactor} scales the recipe's ingredient consumption (Half = 0.5) so
 * stock stays honest; for a product without a recipe it has no effect.
 */
@Entity
@Table(name = "product_variant", indexes = @Index(name = "idx_product_variant_product", columnList = "product_id"))
@Data
@NoArgsConstructor
public class ProductVariant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long variantId;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(nullable = false, length = 60)
    private String name;

    private double price;

    /** Multiplier applied to recipe ingredient quantities for this variant. 1 = full recipe. */
    @Column(columnDefinition = "DOUBLE PRECISION DEFAULT 1")
    private double recipeFactor = 1.0;

    @Column(columnDefinition = "BOOLEAN DEFAULT TRUE")
    private boolean active = true;

    private int sortOrder;
}
