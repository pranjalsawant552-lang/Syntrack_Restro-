package com.pos.app.Enum;

/** How a restaurant order was placed -- drives whether a table is required. */
public enum OrderType {
    DINE_IN,  // requires a table
    PARCEL,   // walk-in takeaway/pickup, no table
    ONLINE    // placed through a delivery platform (Zomato/Swiggy/own website), no table
}
