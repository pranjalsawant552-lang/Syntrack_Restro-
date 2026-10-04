package com.pos.app.Enum;

/** Lifecycle of one dining-table order, from opening a tab to billing it out. */
public enum RestaurantOrderStatus {
    OPEN,       // tab is open, items can still be added/edited freely
    KOT_SENT,   // at least one Kitchen Order Ticket has gone out
    SERVED,     // every item on the order has been marked served
    SETTLED,    // billed -- converted into a SalesInvoiceMaster, table freed
    CANCELLED   // voided without billing (table freed, nothing invoiced)
}
