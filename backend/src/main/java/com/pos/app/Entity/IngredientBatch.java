package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** One received lot of an ingredient, with optional expiry. Consumed first-expiry-first-out. */
@Entity
@Table(name = "ingredient_batch", indexes = {
        @Index(name = "idx_batch_ingredient", columnList = "ingredient_id"),
        @Index(name = "idx_batch_expiry", columnList = "expiry_date")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class IngredientBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long batchId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Column(length = 60)
    private String batchNo;

    private LocalDate expiryDate;

    @Column(nullable = false, precision = 16, scale = 4)
    private BigDecimal qtyReceived;

    @Column(nullable = false, precision = 16, scale = 4)
    private BigDecimal qtyRemaining;

    /** Cost per base unit for this lot. */
    @Column(nullable = false, precision = 16, scale = 6)
    private BigDecimal unitCost = BigDecimal.ZERO;

    private Long supplierId;

    @Column(length = 60)
    private String invoiceRef;

    @Column(nullable = false)
    private LocalDateTime receivedAt = LocalDateTime.now();
}
