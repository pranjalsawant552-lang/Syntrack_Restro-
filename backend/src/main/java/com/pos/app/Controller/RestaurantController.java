package com.pos.app.Controller;

import com.pos.app.DTO.RestaurantOrderItemRequestDTO;
import com.pos.app.DTO.SettleOrderRequestDTO;
import com.pos.app.Service.IRestaurantService;
import com.pos.app.config.ApiVersionConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/**
 * Restaurant floor + kitchen module: tables -> orders -> Kitchen Order Tickets
 * -> settle to invoice. Reuses the existing Product catalog as the menu and
 * SalesInvoiceMaster as the bill, so reporting/invoices/payments work exactly
 * as they already do for retail sales -- only the order-taking flow is new.
 */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/restaurant")
public class RestaurantController {

    @Autowired
    private IRestaurantService restaurantService;

    private String username(Principal principal) {
        return (principal != null && principal.getName() != null) ? principal.getName() : "SYSTEM";
    }

    /* ===== Tables / floor board ===== */

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_VIEW')")
    @GetMapping("/tables")
    public ResponseEntity<?> listTables() {
        return restaurantService.listTables();
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/tables")
    public ResponseEntity<?> createTable(@RequestParam String tableName,
                                          @RequestParam(required = false) Integer capacity,
                                          @RequestParam(required = false) String section) {
        return restaurantService.createTable(tableName, capacity, section);
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PutMapping("/tables/{tableId}")
    public ResponseEntity<?> updateTable(@PathVariable Long tableId,
                                          @RequestParam(required = false) String tableName,
                                          @RequestParam(required = false) Integer capacity,
                                          @RequestParam(required = false) String section,
                                          @RequestParam(required = false) Boolean active) {
        return restaurantService.updateTable(tableId, tableName, capacity, section, active);
    }

    /* ===== Orders ===== */

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/tables/{tableId}/open-order")
    public ResponseEntity<?> openOrder(@PathVariable Long tableId,
                                        @RequestParam(required = false) String waiterName,
                                        @RequestParam(required = false) Integer guestCount,
                                        Principal principal) {
        return restaurantService.openOrder(tableId, waiterName, guestCount, username(principal));
    }

    // ✅ Parcel (walk-in takeaway) or Online (delivery platform) order -- no table involved.
    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/orders/quick")
    public ResponseEntity<?> openQuickOrder(@RequestParam com.pos.app.Enum.OrderType orderType,
                                             @RequestParam(required = false) String customerName,
                                             @RequestParam(required = false) String customerPhone,
                                             @RequestParam(required = false) String orderSource,
                                             @RequestParam(required = false) String externalOrderRef,
                                             Principal principal) {
        return restaurantService.openQuickOrder(orderType, customerName, customerPhone, orderSource, externalOrderRef,
                username(principal));
    }

    // ✅ The counter-orders board -- every active Parcel/Online order.
    @PreAuthorize("hasAuthority('PERM_RESTAURANT_VIEW')")
    @GetMapping("/orders/counter")
    public ResponseEntity<?> listCounterOrders() {
        return restaurantService.listCounterOrders();
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_VIEW')")
    @GetMapping("/orders/{orderId}")
    public ResponseEntity<?> getOrder(@PathVariable Long orderId) {
        return restaurantService.getOrder(orderId);
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/orders/{orderId}/items")
    public ResponseEntity<?> addItem(@PathVariable Long orderId, @RequestBody RestaurantOrderItemRequestDTO req) {
        return restaurantService.addItem(orderId, req);
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PutMapping("/orders/{orderId}/items/{itemId}")
    public ResponseEntity<?> updateItem(@PathVariable Long orderId, @PathVariable Long itemId,
                                         @RequestBody RestaurantOrderItemRequestDTO req) {
        return restaurantService.updateItem(orderId, itemId, req);
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @DeleteMapping("/orders/{orderId}/items/{itemId}")
    public ResponseEntity<?> removeItem(@PathVariable Long orderId, @PathVariable Long itemId) {
        return restaurantService.removeItem(orderId, itemId);
    }

    /**
     * Voids ONE order item that has already been sent to the kitchen (or served).
     * Any staff member can call this, but it always requires a manager's email + password
     * as an approval step, recorded in the audit log -- the "void with approval" the spec asks for.
     */
    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE') or hasAuthority('PERM_RESTAURANT_ITEM_VOID')")
    @PostMapping("/orders/{orderId}/items/{itemId}/void")
    public ResponseEntity<?> voidItem(@PathVariable Long orderId, @PathVariable Long itemId,
                                      @RequestBody com.pos.app.DTO.inventory.KotDTO.VoidItemRequest req,
                                      java.security.Principal principal) {
        String username = (principal != null && principal.getName() != null) ? principal.getName() : "SYSTEM";
        return restaurantService.voidItem(orderId, itemId, req.reason(), req.approverEmail(), req.approverPassword(), username);
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/orders/{orderId}/send-kot")
    public ResponseEntity<?> sendKot(@PathVariable Long orderId) {
        return restaurantService.sendKot(orderId);
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/orders/{orderId}/settle")
    public ResponseEntity<?> settleOrder(@PathVariable Long orderId, @RequestBody SettleOrderRequestDTO req,
                                          Principal principal) {
        return restaurantService.settleOrder(orderId, req, username(principal));
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/orders/{orderId}/cancel")
    public ResponseEntity<?> cancelOrder(@PathVariable Long orderId, Principal principal) {
        return restaurantService.cancelOrder(orderId, username(principal));
    }

    // ✅ Push two tables' tabs together (e.g. a group that started at separate
    // tables asks to sit together) -- merges sourceOrderId's unbilled items into
    // targetOrderId and frees the source table.
    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/orders/{sourceOrderId}/merge-into/{targetOrderId}")
    public ResponseEntity<?> mergeOrders(@PathVariable Long sourceOrderId, @PathVariable Long targetOrderId) {
        return restaurantService.mergeOrders(sourceOrderId, targetOrderId);
    }

    /* ===== Kitchen Display View ===== */

    @PreAuthorize("hasAuthority('PERM_KITCHEN_VIEW')")
    @GetMapping("/kitchen/queue")
    public ResponseEntity<?> kitchenQueue() {
        return restaurantService.kitchenQueue();
    }

    // Counter staff (RESTAURANT_MANAGE) may also mark items served: hotels with a single device and no kitchen screen
    // have nobody with KITCHEN_VIEW tapping "served" on the order screen.
    @PreAuthorize("hasAuthority('PERM_KITCHEN_VIEW') or hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/kitchen/items/{orderItemId}/serve")
    public ResponseEntity<?> markServed(@PathVariable Long orderItemId) {
        return restaurantService.markItemServed(orderItemId);
    }
}
