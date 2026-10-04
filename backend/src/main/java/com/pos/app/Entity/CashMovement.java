package com.pos.app.Entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.pos.app.Enum.CashMovementType;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Cash put into / taken out of the drawer during a shift, other than sales (petty cash, supplier payment, change top-up...). */
@Entity
@Table(name = "cash_movement", indexes = @Index(name = "idx_cash_movement_shift", columnList = "shift_id"))
@Data
@NoArgsConstructor
public class CashMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long movementId;

    @Column(name = "shift_id", nullable = false)
    private Long shiftId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    private CashMovementType type;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 255)
    private String reason;

    @Column(length = 255)
    private String createdBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
