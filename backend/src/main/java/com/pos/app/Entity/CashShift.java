package com.pos.app.Entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.pos.app.Enum.CashShiftStatus;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One cash-drawer session: opened with a float, closed with a physical count. On close the expected
 * cash (float + cash sales + cash in - cash out) is compared with the counted cash and the variance is
 * stored permanently, along with a snapshot of the sales totals, so history never changes afterwards.
 */
@Entity
@Table(name = "cash_shift", indexes = {
        @Index(name = "idx_cash_shift_status", columnList = "status"),
        @Index(name = "idx_cash_shift_opened", columnList = "opened_at")
})
@Data
@NoArgsConstructor
public class CashShift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long shiftId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private CashShiftStatus status = CashShiftStatus.OPEN;

    @Column(nullable = false)
    private LocalDateTime openedAt;

    @Column(length = 255)
    private String openedBy;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal openingFloat = BigDecimal.ZERO;

    @Column(length = 500)
    private String openNotes;

    private LocalDateTime closedAt;

    @Column(length = 255)
    private String closedBy;

    /* ---- snapshot written at close (null while the shift is open) ---- */
    @Column(precision = 14, scale = 2) private BigDecimal cashSales;
    @Column(precision = 14, scale = 2) private BigDecimal cardSales;
    @Column(precision = 14, scale = 2) private BigDecimal upiSales;
    @Column(precision = 14, scale = 2) private BigDecimal pendingSales;
    @Column(precision = 14, scale = 2) private BigDecimal cashIn;
    @Column(precision = 14, scale = 2) private BigDecimal cashOut;
    private Integer invoiceCount;

    @Column(precision = 14, scale = 2) private BigDecimal expectedCash;
    @Column(precision = 14, scale = 2) private BigDecimal countedCash;
    /** counted - expected: negative = short, positive = over. */
    @Column(precision = 14, scale = 2) private BigDecimal variance;

    /** Optional note-by-note count, e.g. {"500":4,"200":10,"10":7}. Stored as given for audit. */
    @Column(length = 1000)
    private String denominationsJson;

    @Column(length = 500)
    private String closeNotes;
}
