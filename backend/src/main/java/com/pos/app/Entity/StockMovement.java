package com.pos.app.Entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import com.pos.app.Enum.MovementType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long movementId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MovementType movType;

    @Column(nullable = false)
    private int stkMovmentQty;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product prodId;

    private String referneceId;

    // ✅ NEW FIELDS (backend changes)
    @Column(length = 255)
    private String reason;

    @Column(length = 255)
    private String invoiceNum;

    @Column(length = 255)
    private String actionUser;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public StockMovement(Product prodId, int stkMovmentQty) {
        this.prodId = prodId;
        this.stkMovmentQty = stkMovmentQty;
    }
}
