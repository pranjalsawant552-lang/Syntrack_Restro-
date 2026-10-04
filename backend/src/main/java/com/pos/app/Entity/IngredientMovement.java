package com.pos.app.Entity;

import com.pos.app.Enum.IngredientMovementType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Append-only ledger of every ingredient stock change. Never updated or deleted
 * (@Immutable): corrections are made by adding a new, opposite movement.
 * {@code qty} is SIGNED, in the ingredient's base unit.
 */
@Entity
@Immutable
@Table(name = "ingredient_movement", indexes = {
        @Index(name = "idx_ingmov_ingredient_date", columnList = "ingredient_id, created_at"),
        @Index(name = "idx_ingmov_ref", columnList = "ref_type, ref_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class IngredientMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long movementId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private IngredientMovementType type;

    @Column(nullable = false, precision = 16, scale = 4)
    private BigDecimal qty;

    /** Cost per base unit at the time of the movement (for food-cost / wastage value). */
    @Column(nullable = false, precision = 16, scale = 6)
    private BigDecimal unitCost = BigDecimal.ZERO;

    /** Ingredient balance right after this movement. */
    @Column(nullable = false, precision = 16, scale = 4)
    private BigDecimal balanceAfter;

    /** e.g. ORDER_ITEM / INVOICE / RECEIPT -- what caused it. */
    @Column(length = 30)
    private String refType;

    @Column(length = 80)
    private String refId;

    /** Human-readable reason (required for wastage and adjustments). */
    @Column(length = 255)
    private String reason;

    /** Menu item that caused a CONSUMPTION (for food-cost reports); null otherwise. */
    private Long productId;

    @Column(length = 255)
    private String actionUser;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
