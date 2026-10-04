package com.pos.app.Enum;

/** A batch of items a customer submitted from their phone, before it becomes real order lines. */
public enum QrRequestStatus {
    PENDING,   // waiting for a waiter to accept
    APPROVED,  // added to the table's order and sent to the kitchen
    REJECTED   // declined by staff
}
