package com.pos.app.DTO;

import com.pos.app.Enum.TableStatus;
import lombok.AllArgsConstructor;
import lombok.Data;

/** One tile on the floor/tables board -- table info plus a summary of its live order, if any. */
@Data
@AllArgsConstructor
public class TableBoardRowDTO {
    private Long tableId;
    private String tableName;
    private Integer capacity;
    private String section;
    private TableStatus status;

    // null when the table has no active order
    private Long orderId;
    private Integer itemCount;
    private Double runningTotal;
    private String waiterName;

    // ---- QR self-ordering (null when no customer has scanned this table) ----
    private String qrState;            // "HOLD" (scanned, waiting) | "ACTIVE" (customer ordering)
    private Integer qrSecondsLeft;     // countdown to hold/session expiry, as of this snapshot
    private Integer qrPendingRequests; // customer orders waiting for a waiter to accept
    private Boolean qrBillRequested;   // customer tapped "Request bill"

    /** Original 9-field constructor, so existing call sites don't change. */
    public TableBoardRowDTO(Long tableId, String tableName, Integer capacity, String section, TableStatus status,
                            Long orderId, Integer itemCount, Double runningTotal, String waiterName) {
        this.tableId = tableId;
        this.tableName = tableName;
        this.capacity = capacity;
        this.section = section;
        this.status = status;
        this.orderId = orderId;
        this.itemCount = itemCount;
        this.runningTotal = runningTotal;
        this.waiterName = waiterName;
    }
}
