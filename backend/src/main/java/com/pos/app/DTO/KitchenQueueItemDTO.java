package com.pos.app.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;

/** One line on the Kitchen Display View -- flattened so the KDS doesn't need to
 *  walk order -> table relations itself. */
@Data
@AllArgsConstructor
public class KitchenQueueItemDTO {
    private Long orderItemId;
    private Long orderId;
    private String tableName;
    private String productName;
    private int quantity;
    private String notes;
}
