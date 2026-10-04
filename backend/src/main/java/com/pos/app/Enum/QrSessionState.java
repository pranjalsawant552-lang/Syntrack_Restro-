package com.pos.app.Enum;

/** Lifecycle of one customer's QR-scan session at a table. */
public enum QrSessionState {
    HOLD,      // scanned, nothing ordered yet -- a short, auto-expiring hold (table is NOT really occupied yet)
    ACTIVE,    // first order accepted -- table occupied, customer may keep ordering until expiresAt
    CLOSED,    // bill settled / order cancelled / staff ended it / QR rotated
    EXPIRED,   // time ran out (hold never used, or the dining window ended)
    REJECTED   // staff rejected the first order (e.g. nobody is actually sitting there)
}
