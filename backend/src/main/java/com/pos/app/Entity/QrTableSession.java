package com.pos.app.Entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.pos.app.Enum.QrSessionState;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * One customer device's time-boxed session at a table, created when they scan the table's QR
 * and press "Start ordering". The raw session token lives only on the customer's phone; we keep
 * a SHA-256 hash, so a database leak can't be replayed.
 */
@Entity
@Table(name = "qr_table_session", indexes = {
        @Index(name = "idx_qr_session_table_state", columnList = "table_id, state"),
        @Index(name = "idx_qr_session_device", columnList = "device_id, created_at"),
        @Index(name = "idx_qr_session_ip", columnList = "client_ip, created_at")
}, uniqueConstraints = @UniqueConstraint(name = "uk_qr_session_token", columnNames = "token_hash"))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QrTableSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long tableId;

    @JsonIgnore
    @Column(length = 64)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    private QrSessionState state = QrSessionState.HOLD;

    /** Set once the first order is accepted: the session is bound to THIS order only. */
    private Long orderId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime activatedAt;

    /** HOLD: when the hold lapses. ACTIVE: when the dining window ends. */
    private LocalDateTime expiresAt;

    @Column(length = 40)
    private String closeReason;

    @Column(length = 64)
    private String clientIp;

    /** Random id kept in the customer's browser; used to spot one device repeatedly making fake scans. */
    @Column(length = 64)
    private String deviceId;

    @Column(length = 255)
    private String userAgent;

    /** Customer tapped "Request bill" -- staff still do the actual settlement. */
    private LocalDateTime billRequestedAt;

    private String approvedBy;
}
