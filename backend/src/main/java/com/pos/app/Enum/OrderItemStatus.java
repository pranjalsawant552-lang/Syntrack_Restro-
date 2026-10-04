package com.pos.app.Enum;

/** Per-item kitchen status, independent of the parent order's overall status. */
public enum OrderItemStatus {
    PENDING,          // added to the tab, not yet sent to the kitchen
    SENT_TO_KITCHEN,  // on a KOT -- kitchen display should show it
    SERVED            // delivered to the table
}
