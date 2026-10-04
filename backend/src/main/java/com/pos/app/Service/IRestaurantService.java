package com.pos.app.Service;

import com.pos.app.DTO.RestaurantOrderItemRequestDTO;
import com.pos.app.DTO.SettleOrderRequestDTO;
import org.springframework.http.ResponseEntity;

public interface IRestaurantService {

    ResponseEntity<?> listTables();

    ResponseEntity<?> createTable(String tableName, Integer capacity, String section);

    ResponseEntity<?> updateTable(Long tableId, String tableName, Integer capacity, String section, Boolean active);

    /** Opens a new order on a table (fails if the table already has one open). */
    ResponseEntity<?> openOrder(Long tableId, String waiterName, Integer guestCount, String createdBy);

    /**
     * Opens a PARCEL or ONLINE order -- no table involved. For ONLINE, pass the
     * platform name (orderSource) and, if the platform gave one, its own order
     * reference (externalOrderRef).
     */
    ResponseEntity<?> openQuickOrder(com.pos.app.Enum.OrderType orderType, String customerName, String customerPhone,
                                      String orderSource, String externalOrderRef, String createdBy);

    /** Every active PARCEL/ONLINE order -- the counter-orders board. */
    ResponseEntity<?> listCounterOrders();

    ResponseEntity<?> getOrder(Long orderId);

    ResponseEntity<?> addItem(Long orderId, RestaurantOrderItemRequestDTO req);

    ResponseEntity<?> updateItem(Long orderId, Long itemId, RestaurantOrderItemRequestDTO req);

    ResponseEntity<?> removeItem(Long orderId, Long itemId);
    ResponseEntity<?> voidItem(Long orderId, Long itemId, String reason, String approverEmail, String approverPassword, String requestedBy);

    /** Marks every PENDING item as SENT_TO_KITCHEN -- this IS the Kitchen Order Ticket. */
    ResponseEntity<?> sendKot(Long orderId);

    /** Everything currently sitting in the kitchen queue, across all tables. */
    ResponseEntity<?> kitchenQueue();

    ResponseEntity<?> markItemServed(Long orderItemId);

    /** Bills the order out: creates a SalesInvoiceMaster from its items, frees the table. */
    ResponseEntity<?> settleOrder(Long orderId, SettleOrderRequestDTO req, String createdBy);

    ResponseEntity<?> cancelOrder(Long orderId, String cancelledBy);

    /**
     * Moves every not-yet-billed item from {@code sourceOrderId} onto
     * {@code targetOrderId} (e.g. two tables pushed together for one group),
     * then cancels the now-empty source order and frees its table.
     */
    ResponseEntity<?> mergeOrders(Long sourceOrderId, Long targetOrderId);

    /** Pushes a fresh tables-board snapshot to every staff screen of the current tenant. */
    void pushTablesUpdate();

    /** Null if the dish can be ordered right now, otherwise a customer-friendly reason why not. */
    String checkSellable(Long productId, int quantity);
}
