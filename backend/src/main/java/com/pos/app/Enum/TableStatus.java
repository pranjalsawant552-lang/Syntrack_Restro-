package com.pos.app.Enum;

/** Status of a physical dining table. */
public enum TableStatus {
    AVAILABLE,   // free, can seat a new order
    OCCUPIED,    // has an OPEN/KOT_SENT/SERVED order running
    RESERVED,    // held for a booking, not walk-in-able
    CLEANING     // just vacated, being reset before it goes AVAILABLE again
}
