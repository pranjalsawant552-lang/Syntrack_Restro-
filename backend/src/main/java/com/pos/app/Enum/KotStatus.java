package com.pos.app.Enum;

/** Kitchen Order Ticket lifecycle: New -> Preparing -> Ready -> Served (or Cancelled if every line was voided). */
public enum KotStatus { NEW, PREPARING, READY, SERVED, CANCELLED }
