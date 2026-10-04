package com.pos.app.Entity;

import com.pos.app.Enum.QrRequestStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * A batch of dishes a customer submitted from their phone. It only becomes real
 * {@link RestaurantOrderItem}s (and reaches the kitchen) once accepted -- by a waiter, or
 * automatically when the restaurant's approval mode allows it. Keeping it separate means
 * an unconfirmed/fake scan can never touch the table's real order, stock or bill.
 */
@Entity
@Table(name = "qr_order_request", indexes = {
        @Index(name = "idx_qr_request_status", columnList = "status, created_at"),
        @Index(name = "idx_qr_request_session", columnList = "session_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QrOrderRequest {

    /** How long a request may wait for a waiter before it is treated as stale. */
    public static final int TTL_MINUTES = 10;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long sessionId;
    private Long tableId;

    @Enumerated(EnumType.STRING)
    private QrRequestStatus status = QrRequestStatus.PENDING;

    /** JSON array of the validated lines (names + prices snapshot at submit time). */
    @Column(columnDefinition = "TEXT")
    private String linesJson;

    @Column(length = 300)
    private String customerNote;

    /** Client-generated id so a double-tap / retry doesn't create the order twice. */
    @Column(length = 64)
    private String clientRequestId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime decidedAt;
    private String decidedBy;

    @Column(length = 300)
    private String rejectReason;

    private boolean autoApproved;
}
