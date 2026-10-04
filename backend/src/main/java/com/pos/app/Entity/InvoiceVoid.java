package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Permanent record of why/when/by whom an invoice was voided. Append-only. */
@Entity
@Immutable
@Table(name = "invoice_void", indexes = @Index(name = "idx_invoice_void_invoice", columnList = "invoice_id"))
@Data
@NoArgsConstructor
public class InvoiceVoid {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long voidId;

    @Column(nullable = false)
    private Long invoiceId;

    @Column(length = 60)
    private String invoiceNumber;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(length = 20)
    private String payMethod;

    @Column(nullable = false, length = 255)
    private String reason;

    @Column(length = 255)
    private String voidedBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime voidedAt = LocalDateTime.now();
}
