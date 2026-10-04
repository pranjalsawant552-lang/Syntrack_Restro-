package com.pos.app.DTO;

import com.pos.app.Entity.RestaurantOrder;

/**
 * What settling (fully or as a split bill) returns: the order in its new state plus the invoice that was
 * just generated, so the caller can open/print the final bill without a second lookup.
 */
public record SettleResultDTO(RestaurantOrder order, Long invoiceId, String invoiceNumber, boolean orderClosed) {
}
