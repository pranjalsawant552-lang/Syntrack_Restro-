package com.pos.app.Entity;

import com.pos.app.Enum.TableStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A physical table/seating area in the restaurant. One table has at most one
 * active (non-SETTLED, non-CANCELLED) {@link RestaurantOrder} at a time --
 * enforced in RestaurantServiceImpl, not at the DB level, since "active" spans
 * several statuses.
 */
@Entity
@Table(name = "dining_table", indexes = {
        // ✅ TablesBoard polls this list constantly (every table's live status)
        @Index(name = "idx_dining_table_status", columnList = "status")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DiningTable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long tableId;

    /** Display label, e.g. "T1", "Patio 3", "VIP 2" -- free text, not necessarily numeric. */
    private String tableName;

    private Integer capacity;

    /** Optional grouping for larger venues, e.g. "Main Hall", "Rooftop", "Patio". */
    private String section;

    @Enumerated(EnumType.STRING)
    private TableStatus status = TableStatus.AVAILABLE;

    /** Deactivated tables (e.g. removed/merged) are hidden but never physically deleted. */
    private boolean active = true;

    /**
     * Secret in this table's printed QR code (/t/{company}/{qrToken}). Unguessable and rotatable, so a
     * photo of the QR that leaks can be invalidated. Never sent in order/table payloads.
     */
    @JsonIgnore
    @Column(length = 64, unique = true)
    private String qrToken;
}
