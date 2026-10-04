package com.pos.app.ServiceImpl;

import com.pos.app.Enum.Permission;
import com.pos.app.DTO.*;
import com.pos.app.Entity.DiningTable;
import com.pos.app.Entity.Product;
import com.pos.app.Entity.RestaurantOrder;
import com.pos.app.Entity.RestaurantOrderItem;
import com.pos.app.Enum.OrderItemStatus;
import com.pos.app.Enum.RestaurantOrderStatus;
import com.pos.app.Enum.TableStatus;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.DiningTableRepository;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Repository.RestaurantOrderItemRepository;
import com.pos.app.Repository.RestaurantOrderRepository;
import com.pos.app.Service.IRestaurantService;
import com.pos.app.Service.ISalesInvoiceMaster;
import com.pos.app.tenant.TenantContext;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class RestaurantServiceImpl implements IRestaurantService {

    @Autowired private DiningTableRepository tableRepo;
    @Autowired private RestaurantOrderRepository orderRepo;
    @Autowired private RestaurantOrderItemRepository orderItemRepo;
    @Autowired private ProductRepository productRepo;
    @Autowired private ISalesInvoiceMaster salesInvoiceService;
    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private com.pos.app.Service.InventoryService inventoryService;
    @Autowired private com.pos.app.Service.KotService kotService;
    @Autowired private com.pos.app.Service.RecipeService recipeService;
    @Autowired private com.pos.app.common.service.AuditService auditService;
    @Autowired private com.pos.app.Service.MenuOptionsService menuOptionsService;
    @Autowired private com.pos.app.Repository.StockRepository stockRepo;
    @Autowired private com.pos.app.Repository.UserRepository userRepo;
    @Autowired private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Autowired private com.pos.app.Repository.QrTableSessionRepository qrSessionRepo;
    @Autowired private com.pos.app.Repository.QrOrderRequestRepository qrRequestRepo;

    // an order "occupies" its table while it's in any of these statuses
    private static final List<RestaurantOrderStatus> ACTIVE_STATUSES =
            List.of(RestaurantOrderStatus.OPEN, RestaurantOrderStatus.KOT_SENT, RestaurantOrderStatus.SERVED);

    /* =========================
       LIVE PUSH (WebSocket)
       ✅ Broadcast-only: every mutating action below re-fetches the current
       tables/kitchen snapshot and pushes it to this tenant's topic. Restaurant
       scale (tens of tables, dozens of in-flight items) makes "just resend
       everything" simpler and more robust than diffing, and cheap enough not
       to matter. See WebSocketConfig / WebSocketAuthInterceptor for the
       tenant-scoped topic + JWT-on-CONNECT auth this relies on.
    ========================= */

    private void broadcastTables() {
        String tenant = TenantContext.getCurrentTenant();
        if (tenant == null) return; // e.g. called outside a tenant request context (shouldn't happen in practice)
        messagingTemplate.convertAndSend("/topic/restaurant/" + tenant + "/tables", buildTableBoard());
    }

    private void broadcastKitchen() {
        String tenant = TenantContext.getCurrentTenant();
        if (tenant == null) return;
        messagingTemplate.convertAndSend("/topic/restaurant/" + tenant + "/kitchen", buildKitchenQueue());
    }

    private void broadcastAll() {
        broadcastTables();
        broadcastKitchen();
    }

    /* =========================
       TABLES
    ========================= */

    private List<TableBoardRowDTO> buildTableBoard() {
        List<DiningTable> tables = tableRepo.findByActiveTrueOrderByTableNameAsc();

        // QR self-ordering overlay: two cheap queries for the whole floor, not one per table.
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        java.util.Map<Long, List<com.pos.app.Entity.QrTableSession>> liveQr = qrSessionRepo
                .findByStateInAndExpiresAtAfter(List.of(com.pos.app.Enum.QrSessionState.HOLD,
                        com.pos.app.Enum.QrSessionState.ACTIVE), now)
                .stream().collect(Collectors.groupingBy(com.pos.app.Entity.QrTableSession::getTableId));
        java.util.Map<Long, Long> pendingQr = qrRequestRepo
                .findByStatusAndCreatedAtAfter(com.pos.app.Enum.QrRequestStatus.PENDING,
                        now.minusMinutes(com.pos.app.Entity.QrOrderRequest.TTL_MINUTES))
                .stream().collect(Collectors.groupingBy(com.pos.app.Entity.QrOrderRequest::getTableId, Collectors.counting()));

        return tables.stream().map(t -> {
            TableBoardRowDTO row = buildRow(t);
            // An ACTIVE session only counts while it is still tied to this table's CURRENT order --
            // once the bill is settled/cancelled the customer's QR session is over, even if its timer isn't.
            List<com.pos.app.Entity.QrTableSession> live = liveQr.getOrDefault(t.getTableId(), List.of()).stream()
                    .filter(x -> x.getState() == com.pos.app.Enum.QrSessionState.HOLD
                            || (row.getOrderId() != null && row.getOrderId().equals(x.getOrderId())))
                    .collect(Collectors.toList());
            if (!live.isEmpty()) {
                boolean active = live.stream().anyMatch(x -> x.getState() == com.pos.app.Enum.QrSessionState.ACTIVE);
                row.setQrState(active ? "ACTIVE" : "HOLD");
                long secs = live.stream()
                        .mapToLong(x -> java.time.Duration.between(now, x.getExpiresAt()).getSeconds()).max().orElse(0);
                row.setQrSecondsLeft((int) Math.max(0, secs));
                row.setQrBillRequested(live.stream().anyMatch(x -> x.getBillRequestedAt() != null));
            }
            long pend = pendingQr.getOrDefault(t.getTableId(), 0L);
            if (pend > 0) row.setQrPendingRequests((int) pend);
            return row;
        }).collect(Collectors.toList());
    }

    private TableBoardRowDTO buildRow(DiningTable t) {
        RestaurantOrder activeOrder = orderRepo
                .findByTable_TableIdAndStatusIn(t.getTableId(), ACTIVE_STATUSES)
                .orElse(null);

        if (activeOrder == null) {
            return new TableBoardRowDTO(t.getTableId(), t.getTableName(), t.getCapacity(), t.getSection(),
                    t.getStatus(), null, null, null, null);
        }

        // ✅ only count not-yet-billed items -- a split bill can leave an order
        // "open" with some items already invoiced, and those shouldn't be
        // double-counted in what's still owed on the table.
        List<RestaurantOrderItem> unbilled = activeOrder.getItems().stream()
                .filter(i -> !i.isBilled()).collect(Collectors.toList());

        double runningTotal = unbilled.stream()
                .mapToDouble(i -> i.getUnitPrice() * i.getQuantity() * (1 + i.getGstPercent() / 100.0))
                .sum();

        return new TableBoardRowDTO(t.getTableId(), t.getTableName(), t.getCapacity(), t.getSection(),
                t.getStatus(), activeOrder.getOrderId(), unbilled.size(),
                Math.round(runningTotal * 100.0) / 100.0, activeOrder.getWaiterName());
    }

    @Override
    public ResponseEntity<?> listTables() {
        return ResponseEntity.ok(buildTableBoard());
    }

    @Override
    public ResponseEntity<?> createTable(String tableName, Integer capacity, String section) {
        if (tableName == null || tableName.isBlank()) {
            return new ResponseEntity<>("Table name is required", HttpStatus.BAD_REQUEST);
        }
        String cleanName = tableName.trim();
        // Two tables with the same name are indistinguishable for the waiter (and double-clicks used to create them)
        if (tableNameTaken(cleanName, null)) {
            return new ResponseEntity<>("Table '" + cleanName + "' already exists", HttpStatus.CONFLICT);
        }
        DiningTable t = new DiningTable();
        t.setTableName(cleanName);
        t.setCapacity(capacity);
        t.setSection(section);
        t.setStatus(TableStatus.AVAILABLE);
        t.setActive(true);
        DiningTable saved = tableRepo.save(t);
        broadcastTables();
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    /** true if another ACTIVE table already has this name (case-insensitive). */
    private boolean tableNameTaken(String name, Long ignoreTableId) {
        return tableRepo.findByActiveTrueOrderByTableNameAsc().stream()
                .anyMatch(x -> x.getTableName() != null
                        && x.getTableName().trim().equalsIgnoreCase(name)
                        && (ignoreTableId == null || !ignoreTableId.equals(x.getTableId())));
    }

    @Override
    public ResponseEntity<?> updateTable(Long tableId, String tableName, Integer capacity, String section, Boolean active) {
        DiningTable t = tableRepo.findById(tableId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Table not found"));
        if (tableName != null && !tableName.isBlank()) {
            if (tableNameTaken(tableName.trim(), tableId)) {
                return new ResponseEntity<>("Table '" + tableName.trim() + "' already exists", HttpStatus.CONFLICT);
            }
            t.setTableName(tableName.trim());
        }
        if (capacity != null) t.setCapacity(capacity);
        if (section != null) t.setSection(section);
        if (active != null) t.setActive(active);
        DiningTable saved = tableRepo.save(t);
        broadcastTables();
        return ResponseEntity.ok(saved);
    }

    /* =========================
       ORDERS
    ========================= */

    @Override
    public ResponseEntity<?> openOrder(Long tableId, String waiterName, Integer guestCount, String createdBy) {
        DiningTable table = tableRepo.findById(tableId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Table not found"));

        boolean alreadyActive = orderRepo.findByTable_TableIdAndStatusIn(tableId, ACTIVE_STATUSES).isPresent();
        if (alreadyActive) {
            return new ResponseEntity<>("This table already has an open order", HttpStatus.CONFLICT);
        }

        RestaurantOrder order = new RestaurantOrder();
        order.setTable(table);
        order.setOrderType(com.pos.app.Enum.OrderType.DINE_IN);
        order.setStatus(RestaurantOrderStatus.OPEN);
        order.setWaiterName(waiterName);
        order.setGuestCount(guestCount);
        order.setCreatedBy(createdBy);
        RestaurantOrder saved = orderRepo.save(order);

        table.setStatus(TableStatus.OCCUPIED);
        tableRepo.save(table);

        broadcastTables();
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @Override
    public ResponseEntity<?> openQuickOrder(com.pos.app.Enum.OrderType orderType, String customerName,
                                             String customerPhone, String orderSource, String externalOrderRef,
                                             String createdBy) {
        if (orderType == com.pos.app.Enum.OrderType.DINE_IN) {
            return new ResponseEntity<>("Dine-in orders need a table -- use openOrder instead", HttpStatus.BAD_REQUEST);
        }
        RestaurantOrder order = new RestaurantOrder();
        order.setTable(null);
        order.setOrderType(orderType);
        order.setStatus(RestaurantOrderStatus.OPEN);
        order.setCustomerName(customerName);
        order.setCustomerPhone(customerPhone);
        order.setOrderSource(orderSource);
        order.setExternalOrderRef(externalOrderRef);
        order.setCreatedBy(createdBy);
        RestaurantOrder saved = orderRepo.save(order);

        broadcastTables(); // counter orders ride the same "tables" push for simplicity -- see frontend hook usage
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @Override
    public ResponseEntity<?> listCounterOrders() {
        List<RestaurantOrder> orders = orderRepo.findByOrderTypeInAndStatusInOrderByOpenedAtAsc(
                List.of(com.pos.app.Enum.OrderType.PARCEL, com.pos.app.Enum.OrderType.ONLINE), ACTIVE_STATUSES);
        // items is LAZY -> would serialise as null (Hibernate6Module) and crash the Parcel/Online tab
        orders.forEach(o -> org.hibernate.Hibernate.initialize(o.getItems()));
        return ResponseEntity.ok(orders);
    }

    @Override
    public ResponseEntity<?> getOrder(Long orderId) {
        RestaurantOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Order not found"));
        // table and items are LAZY; JacksonConfig's Hibernate6Module writes uninitialised
        // ones as an id / null, which broke the order dialog (order.items was null).
        org.hibernate.Hibernate.initialize(order.getTable());
        org.hibernate.Hibernate.initialize(order.getItems());
        return ResponseEntity.ok(order);
    }

    @Override
    public ResponseEntity<?> addItem(Long orderId, RestaurantOrderItemRequestDTO req) {
        RestaurantOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Order not found"));

        if (order.getStatus() == RestaurantOrderStatus.SETTLED || order.getStatus() == RestaurantOrderStatus.CANCELLED) {
            return new ResponseEntity<>("This order is already closed", HttpStatus.BAD_REQUEST);
        }
        if (req.getQuantity() <= 0) {
            return new ResponseEntity<>("Quantity must be > 0", HttpStatus.BAD_REQUEST);
        }

        if (req.getProductId() == null) {
            return new ResponseEntity<>("Choose a menu item", HttpStatus.BAD_REQUEST);
        }
        Product product = productRepo.findById(req.getProductId())
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Menu item not found"));

        // ✅ can't add something the kitchen has already 86'd for today
        if (product.isTemporarilyUnavailable()) {
            return new ResponseEntity<>(product.getProductName() + " is marked out for today", HttpStatus.BAD_REQUEST);
        }

        // ✅ a recipe-based dish that's run out of ingredients can't be sold, even if the
        // waiter's screen hasn't refreshed the "N left" hint yet. This is a HINT-level check
        // only (block-on-insufficient governs the hard stock guarantee at KOT time), so it
        // still allows ordering right up to the last portion.
        var availability = recipeService.availability();
        if (product.isCombo()) {
            // a combo is only sellable while every component still is
            for (com.pos.app.Entity.ComboItem c : menuOptionsService.comboComponents(product.getProductId())) {
                Product comp = productRepo.findById(c.getComponentProductId()).orElse(null);
                if (comp == null) continue;
                String problem = unavailableReason(comp, availability, c.getQuantity() * req.getQuantity(), order);
                if (problem != null) {
                    return new ResponseEntity<>(product.getProductName() + " can't be made: " + problem, HttpStatus.BAD_REQUEST);
                }
            }
        } else {
            String problem = unavailableReason(product, availability, req.getQuantity(), order);
            if (problem != null) return new ResponseEntity<>(problem, HttpStatus.BAD_REQUEST);
        }

        // ✅ price + snapshot come from the SERVER (variant price + add-on prices), never from the client
        var sel = menuOptionsService.resolveSelection(product, req.getVariantId(), req.getModifierIds());

        RestaurantOrderItem item = new RestaurantOrderItem();
        item.setOrder(order);
        item.setProduct(product);
        item.setProductName(product.getProductName());
        item.setUnitPrice(sel.unitPrice());
        item.setGstPercent(product.getProdGST());
        item.setVariantId(sel.variantId());
        item.setVariantName(sel.variantName());
        item.setOptionsText(sel.optionsText());
        item.setPortionFactor(sel.portionFactor());
        item.setQuantity(req.getQuantity());
        item.setNotes(req.getNotes());
        item.setStatus(OrderItemStatus.PENDING);

        order.getItems().add(item);
        orderRepo.save(order);

        broadcastTables();
        return new ResponseEntity<>(order, HttpStatus.CREATED);
    }

    /** Lets other services (QR self-ordering) refresh every staff screen after they change table state. */
    @Override
    public void pushTablesUpdate() {
        broadcastTables();
    }

    /**
     * Pre-flight for QR orders: why this dish can't be sold right now (86'd, out of ingredients, out of
     * stock), or null if it's fine. Same rules addItem enforces, minus the "already on this order" count.
     */
    @Override
    public String checkSellable(Long productId, int quantity) {
        Product product = productRepo.findById(productId).orElse(null);
        if (product == null || !product.isActive()) return "That item is no longer on the menu";
        var availability = recipeService.availability();
        if (product.isCombo()) {
            for (com.pos.app.Entity.ComboItem c : menuOptionsService.comboComponents(productId)) {
                Product comp = productRepo.findById(c.getComponentProductId()).orElse(null);
                if (comp == null) continue;
                String problem = unavailableReason(comp, availability, c.getQuantity() * quantity, null);
                if (problem != null) return product.getProductName() + " can't be made: " + problem;
            }
            return null;
        }
        return unavailableReason(product, availability, quantity, null);
    }

    /**
     * Why this product can't be added right now, or null if it can: out of ingredients (recipe dish) or
     * not enough shelf stock (stock product; counts what's already unbilled on this same order).
     * Plain menu items with no recipe are never blocked.
     */
    private String unavailableReason(Product product, java.util.List<com.pos.app.DTO.inventory.InventoryDTO.AvailabilityRow> availability,
                                     int wantQty, RestaurantOrder order) {
        if (product.isTemporarilyUnavailable()) return product.getProductName() + " is marked out for today";
        if (recipeService.hasRecipe(product.getProductId())) {
            var avail = availability.stream().filter(a -> a.productId().equals(product.getProductId())).findFirst().orElse(null);
            if (avail != null && avail.outOfStock()) {
                return product.getProductName() + " is out of stock (no "
                        + (avail.limitingIngredient() == null ? "ingredients" : avail.limitingIngredient()) + " left)";
            }
            return null;
        }
        if (product.isTrackStock() && !product.isCombo()) {
            int onHand = stockRepo.getByProduct(product).map(com.pos.app.Entity.Stock::getQty).orElse(0);
            int alreadyOnOrder = order == null ? 0 : order.getItems().stream()
                    .filter(i -> !i.isBilled() && i.getProduct().getProductId().equals(product.getProductId()))
                    .mapToInt(RestaurantOrderItem::getQuantity).sum();
            if (onHand < alreadyOnOrder + wantQty) {
                return product.getProductName() + " - only " + Math.max(0, onHand - alreadyOnOrder) + " left in stock";
            }
        }
        return null;
    }

    /** True when the item goes to the kitchen; shelf products (bottled drinks etc.) are handed over directly. */
    private boolean needsKitchen(Product p) {
        if (p.isCombo()) return true;
        return !(p.isTrackStock() && !recipeService.hasRecipe(p.getProductId()));
    }

    /** Deducts ingredients for one order line (combo = each component; variant = scaled portion). Idempotent per line. */
    private void consumeIngredients(RestaurantOrderItem i) {
        Product p = i.getProduct();
        String ref = String.valueOf(i.getOrderItemId());
        if (p.isCombo()) {
            for (com.pos.app.Entity.ComboItem c : menuOptionsService.comboComponents(p.getProductId())) {
                inventoryService.consumeForRecipe(c.getComponentProductId(),
                        java.math.BigDecimal.valueOf((long) c.getQuantity() * i.getQuantity()),
                        "ORDER_ITEM", ref + ":" + c.getComponentProductId());
            }
        } else {
            inventoryService.consumeForRecipe(p.getProductId(),
                    java.math.BigDecimal.valueOf(i.getQuantity()).multiply(java.math.BigDecimal.valueOf(i.getPortionFactor())),
                    "ORDER_ITEM", ref);
        }
    }

    @Override
    public ResponseEntity<?> updateItem(Long orderId, Long itemId, RestaurantOrderItemRequestDTO req) {
        RestaurantOrderItem item = orderItemRepo.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Order item not found"));
        if (!item.getOrder().getOrderId().equals(orderId)) {
            return new ResponseEntity<>("Item does not belong to this order", HttpStatus.BAD_REQUEST);
        }
        // ✅ Once it's on a KOT the kitchen may already be cooking it -- changing qty/notes
        // silently at that point is how "I ordered 2, the bill says 4" complaints happen.
        // Remove it and add a fresh line instead if it genuinely needs to change.
        if (item.getStatus() != OrderItemStatus.PENDING) {
            return new ResponseEntity<>("Item already sent to the kitchen -- remove it and add a new line instead", HttpStatus.BAD_REQUEST);
        }
        if (req.getQuantity() > 0) item.setQuantity(req.getQuantity());
        if (req.getNotes() != null) item.setNotes(req.getNotes());
        orderItemRepo.save(item);
        broadcastTables();
        return ResponseEntity.ok(item);
    }

    /**
     * Deletes one order line. It MUST be taken out of the parent's `items` collection
     * (cascade = ALL + orphanRemoval) rather than deleted through the item repository:
     * broadcastTables() afterwards initialises that collection from the DB, the just-deleted
     * row is still in it (nothing has been flushed yet), and Hibernate cascades a re-persist
     * over the pending delete -- so the API said "Item removed" but the row survived.
     */
    private void removeLine(RestaurantOrderItem item) {
        RestaurantOrder order = item.getOrder();
        Long id = item.getOrderItemId();
        order.getItems().removeIf(i -> id.equals(i.getOrderItemId()));
        orderRepo.save(order);
        orderRepo.flush();
    }

    @Override
    public ResponseEntity<?> removeItem(Long orderId, Long itemId) {
        RestaurantOrderItem item = orderItemRepo.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Order item not found"));
        if (!item.getOrder().getOrderId().equals(orderId)) {
            return new ResponseEntity<>("Item does not belong to this order", HttpStatus.BAD_REQUEST);
        }
        if (item.getStatus() != OrderItemStatus.PENDING) {
            return new ResponseEntity<>("Item already sent to the kitchen and can't be removed here", HttpStatus.BAD_REQUEST);
        }
        removeLine(item);
        broadcastTables();
        return ResponseEntity.ok("Item removed");
    }

    /**
     * Voids an item already sent to the kitchen. Requires an active manager/admin's password
     * (checked here, never trusted from the client) and a reason. History is kept: the item
     * stays on the order marked VOID, is dropped from the bill, and any stock it consumed
     * is NOT reversed (the food was already cooked) -- consistent with the void-invoice rule.
     */
    @Override
    public ResponseEntity<?> voidItem(Long orderId, Long itemId, String reason, String approverEmail,
                                      String approverPassword, String requestedBy) {
        if (reason == null || reason.isBlank()) {
            throw new com.pos.app.Exception.InvalidRequestException("A reason is required to void an item");
        }
        if (approverEmail == null || approverEmail.isBlank() || approverPassword == null || approverPassword.isBlank()) {
            throw new com.pos.app.Exception.InvalidRequestException("Manager approval (email + password) is required to void an item");
        }
        com.pos.app.Entity.User approver = userRepo.findByEmail(approverEmail.trim())
                .orElseThrow(() -> new com.pos.app.Exception.InvalidRequestException("Approver not found"));
        boolean isManagerLike = "TENANT_ADMIN".equals(approver.getRole())
                || (approver.getRoleRef() != null && approver.getRoleRef().getPermissions() != null
                    && approver.getRoleRef().getPermissions().contains(Permission.RESTAURANT_ITEM_VOID.name()));
        if (!approver.isActive() || !isManagerLike || !passwordEncoder.matches(approverPassword, approver.getPassword())) {
            throw new com.pos.app.Exception.InvalidRequestException("Approval failed: invalid manager credentials or insufficient permission");
        }

        RestaurantOrderItem item = orderItemRepo.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Order item not found"));
        if (!item.getOrder().getOrderId().equals(orderId)) {
            return new ResponseEntity<>("Item does not belong to this order", HttpStatus.BAD_REQUEST);
        }
        if (item.isBilled()) {
            return new ResponseEntity<>("Item is already billed; void the invoice instead", HttpStatus.BAD_REQUEST);
        }
        if (item.getStatus() == OrderItemStatus.PENDING) {
            // never reached the kitchen -- plain remove covers this case already
            removeLine(item);
        } else {
            kotService.onOrderItemVoided(itemId);
            removeLine(item);
        }

        auditService.log("RESTAURANT_ITEM_VOIDED", "RestaurantOrderItem", String.valueOf(itemId),
                item.getProductName() + " x" + item.getQuantity() + " voided on order " + orderId
                        + " by " + requestedBy + ", approved by " + approver.getEmail() + ": " + reason.trim());

        RestaurantOrder order = item.getOrder();
        boolean anyLeft = order.getItems().stream().anyMatch(i -> i.getOrderItemId() != null && !i.getOrderItemId().equals(itemId));
        broadcastAll();
        return ResponseEntity.ok("Item voided");
    }

    @Override
    public ResponseEntity<?> sendKot(Long orderId) {
        RestaurantOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Order not found"));

        List<RestaurantOrderItem> pending = order.getItems().stream()
                .filter(i -> i.getStatus() == OrderItemStatus.PENDING)
                .collect(Collectors.toList());

        if (pending.isEmpty()) {
            return new ResponseEntity<>("Nothing new to send to the kitchen", HttpStatus.BAD_REQUEST);
        }

        // A dish can be switched off AFTER it was added to the tab (kitchen ran out meanwhile). Don't send the kitchen
        // something it can't make -- tell the waiter which lines to remove. Thrown (not returned) so it reads as a
        // normal error message on screen and nothing is half-sent.
        List<String> nowOff = pending.stream()
                .filter(i -> i.getProduct() != null && (i.getProduct().isTemporarilyUnavailable() || !i.getProduct().isActive()))
                .map(RestaurantOrderItem::getDisplayName).distinct().collect(Collectors.toList());
        if (!nowOff.isEmpty()) {
            throw new com.pos.app.Exception.InvalidRequestException("Can't send to the kitchen: "
                    + String.join(", ", nowOff) + (nowOff.size() == 1 ? " has" : " have")
                    + " just been marked unavailable. Remove it from the order (or ask the customer to choose something else) and send again.");
        }

        // Shelf/stock products (a bottled drink) don't need cooking: they are handed over straight away and
        // their stock is deducted when the bill is settled. Only real kitchen items go on a KOT.
        List<RestaurantOrderItem> kitchen = pending.stream().filter(i -> needsKitchen(i.getProduct())).collect(Collectors.toList());
        List<RestaurantOrderItem> direct = pending.stream().filter(i -> !needsKitchen(i.getProduct())).collect(Collectors.toList());
        direct.forEach(i -> i.setStatus(OrderItemStatus.SERVED));
        orderItemRepo.saveAll(direct);

        if (!kitchen.isEmpty()) {
            // Recipe-based stock deduction happens HERE, when the kitchen is told to cook.
            // Same transaction as the status change: if it fails, nothing is sent.
            for (RestaurantOrderItem i : kitchen) consumeIngredients(i);

            kitchen.forEach(i -> i.setStatus(OrderItemStatus.SENT_TO_KITCHEN));
            orderItemRepo.saveAll(kitchen);

            // One or more printed/displayed KOT tickets, split by kitchen station.
            kotService.createKots(order, kitchen, org.springframework.security.core.context.SecurityContextHolder
                    .getContext().getAuthentication() == null ? "SYSTEM"
                    : org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName());

            if (order.getStatus() == RestaurantOrderStatus.OPEN) {
                order.setStatus(RestaurantOrderStatus.KOT_SENT);
                orderRepo.save(order);
            }
        }

        broadcastAll(); // new items just landed in the kitchen queue too
        return ResponseEntity.ok(order);
    }

    /* =========================
       KITCHEN DISPLAY
    ========================= */

    private List<KitchenQueueItemDTO> buildKitchenQueue() {
        List<RestaurantOrderItem> items = orderItemRepo.findByStatusOrderByOrderItemIdAsc(OrderItemStatus.SENT_TO_KITCHEN);

        return items.stream()
                .map(i -> new KitchenQueueItemDTO(
                        i.getOrderItemId(),
                        i.getOrder().getOrderId(),
                        i.getOrder().getTable() != null ? i.getOrder().getTable().getTableName() : "-",
                        i.getDisplayName(),
                        i.getQuantity(),
                        joinNotes(i.getOptionsText(), i.getNotes())
                ))
                .collect(Collectors.toList());
    }

    private static String joinNotes(String a, String b) {
        boolean ha = a != null && !a.isBlank(), hb = b != null && !b.isBlank();
        if (ha && hb) return a.trim() + " | " + b.trim();
        return ha ? a.trim() : (hb ? b.trim() : null);
    }

    @Override
    public ResponseEntity<?> kitchenQueue() {
        return ResponseEntity.ok(buildKitchenQueue());
    }

    @Override
    public ResponseEntity<?> markItemServed(Long orderItemId) {
        RestaurantOrderItem item = orderItemRepo.findById(orderItemId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Order item not found"));
        item.setStatus(OrderItemStatus.SERVED);
        orderItemRepo.save(item);
        kotService.onOrderItemServed(orderItemId);

        RestaurantOrder order = item.getOrder();
        boolean anyoneLeft = order.getItems().stream()
                .anyMatch(i -> i.getStatus() != OrderItemStatus.SERVED);
        if (!anyoneLeft && order.getStatus() == RestaurantOrderStatus.KOT_SENT) {
            order.setStatus(RestaurantOrderStatus.SERVED);
            orderRepo.save(order);
        }

        broadcastAll();
        return ResponseEntity.ok(item);
    }

    /* =========================
       SETTLE (full or split) / CANCEL / MERGE
    ========================= */

    @Override
    public ResponseEntity<?> settleOrder(Long orderId, SettleOrderRequestDTO req, String createdBy) {
        RestaurantOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Order not found"));

        if (order.getStatus() == RestaurantOrderStatus.SETTLED) {
            return new ResponseEntity<>("Order already settled", HttpStatus.BAD_REQUEST);
        }
        if (order.getStatus() == RestaurantOrderStatus.CANCELLED) {
            return new ResponseEntity<>("Order was cancelled", HttpStatus.BAD_REQUEST);
        }

        // ✅ Split-bill support: if itemIds is given, bill ONLY those (not-yet-billed)
        // items and leave the rest open on the table. If omitted, bill everything
        // that isn't already billed -- the normal, whole-table case, and also what
        // a second/third split call naturally degrades to once nothing is left.
        List<RestaurantOrderItem> unbilled = order.getItems().stream()
                .filter(i -> !i.isBilled())
                .collect(Collectors.toList());

        List<RestaurantOrderItem> toBill;
        if (req.getItemIds() != null && !req.getItemIds().isEmpty()) {
            toBill = unbilled.stream().filter(i -> req.getItemIds().contains(i.getOrderItemId()))
                    .collect(Collectors.toList());
            if (toBill.size() != req.getItemIds().size()) {
                return new ResponseEntity<>("One or more selected items are invalid or already billed", HttpStatus.BAD_REQUEST);
            }
        } else {
            toBill = unbilled;
        }

        if (toBill.isEmpty()) {
            return new ResponseEntity<>("Nothing to bill -- add items first", HttpStatus.BAD_REQUEST);
        }

        // ✅ Build the invoice from the order's own items so the bill can never
        // diverge from what was actually ordered/served. Each line is billed at
        // its OWN snapshotted unitPrice/gstPercent (set when the item was added
        // to the order), via InvoiceItemRequestDTO's price-lock override -- so a
        // menu price change mid-service can no longer silently reprice a dish
        // that was already ordered at the old price.
        // Items billed without ever being sent to the kitchen (e.g. counter sales) have not had
        // their ingredients deducted yet. consumeForRecipe is idempotent per order item, so this
        // is a no-op for anything already deducted at KOT time.
        for (RestaurantOrderItem i : toBill) consumeIngredients(i);

        InvoiceRequestDTO invoiceReq = new InvoiceRequestDTO();
        invoiceReq.setInventoryHandled(true);
        invoiceReq.setPayMethod(req.getPayMethod() == null ? com.pos.app.Enum.PaymentMethod.CASH : req.getPayMethod());
        invoiceReq.setPayStatus(req.getPayStatus() == null ? com.pos.app.Enum.PaymentStatus.PAID : req.getPayStatus());
        invoiceReq.setDiscountValue(req.getDiscountValue());
        invoiceReq.setCashAmount(req.getCashAmount());
        invoiceReq.setOnlineAmount(req.getOnlineAmount());
        invoiceReq.setOnlinePayMethod(req.getOnlinePayMethod());
        invoiceReq.setCustomerId(req.getCustomerId());
        // parcel/online orders already know who the customer is -- use that unless the cashier typed something else
        invoiceReq.setCustomerName(req.getCustomerName() != null && !req.getCustomerName().isBlank()
                ? req.getCustomerName() : order.getCustomerName());
        invoiceReq.setCustomerPhone(req.getCustomerPhone() != null && !req.getCustomerPhone().isBlank()
                ? req.getCustomerPhone() : order.getCustomerPhone());
        invoiceReq.setCustomerEmail(req.getCustomerEmail());
        invoiceReq.setCustomerAddress(req.getCustomerAddress());
        invoiceReq.setItems(toBill.stream()
                .map(i -> {
                    InvoiceItemRequestDTO it = new InvoiceItemRequestDTO();
                    it.setProductId(i.getProduct().getProductId());
                    it.setQuantity(i.getQuantity());
                    it.setUnitPriceOverride(i.getUnitPrice());
                    it.setGstPercentOverride(i.getGstPercent());
                    it.setVariantName(i.getVariantName());
                    it.setOptionsText(i.getOptionsText());
                    return it;
                })
                .collect(Collectors.toList()));

        ResponseEntity<?> invoiceResponse = salesInvoiceService.createInvoice(invoiceReq, createdBy);
        if (invoiceResponse.getStatusCode() != HttpStatus.CREATED) {
            // bubble up whatever createInvoice rejected it for (e.g. a product deleted mid-service)
            return invoiceResponse;
        }

        InvoiceCreateResponseDTO created = (InvoiceCreateResponseDTO) invoiceResponse.getBody();
        toBill.forEach(i -> i.setBilled(true));
        orderItemRepo.saveAll(toBill);

        boolean everythingBilled = order.getItems().stream().allMatch(RestaurantOrderItem::isBilled);

        if (everythingBilled) {
            order.setStatus(RestaurantOrderStatus.SETTLED);
            order.setSettledAt(java.time.LocalDateTime.now());
            // last invoice reference wins when there were multiple split settles
            order.setInvoiceId(created.getInvoiceId());
            order.setInvoiceNumber(created.getInvoiceNumber());
            orderRepo.save(order);

            DiningTable table = order.getTable();
            if (table != null) {
                table.setStatus(TableStatus.AVAILABLE);
                tableRepo.save(table);
            }
        } else {
            // partial/split settle -- order stays open, table stays occupied, remaining
            // unbilled items are still there for the rest of the group.
            orderRepo.save(order);
        }

        broadcastTables();
        // The bill that was just produced comes back with the order, so the screen can show/print it
        // immediately -- for a full settle, a split settle, and for table / parcel / online alike.
        return ResponseEntity.ok(new SettleResultDTO(order, created.getInvoiceId(), created.getInvoiceNumber(),
                everythingBilled));
    }

    @Override
    public ResponseEntity<?> cancelOrder(Long orderId, String cancelledBy) {
        RestaurantOrder order = orderRepo.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Order not found"));

        if (order.getStatus() == RestaurantOrderStatus.SETTLED) {
            return new ResponseEntity<>("Cannot cancel a settled order", HttpStatus.BAD_REQUEST);
        }

        order.setStatus(RestaurantOrderStatus.CANCELLED);
        orderRepo.save(order);
        kotService.onOrderCancelled(orderId);

        DiningTable table = order.getTable();
        if (table != null) {
            table.setStatus(TableStatus.AVAILABLE);
            tableRepo.save(table);
        }

        broadcastAll();
        return ResponseEntity.ok("Order " + orderId + " cancelled by " + cancelledBy);
    }

    @Override
    public ResponseEntity<?> mergeOrders(Long sourceOrderId, Long targetOrderId) {
        if (sourceOrderId.equals(targetOrderId)) {
            return new ResponseEntity<>("Can't merge a table into itself", HttpStatus.BAD_REQUEST);
        }
        RestaurantOrder source = orderRepo.findById(sourceOrderId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Source order not found"));
        RestaurantOrder target = orderRepo.findById(targetOrderId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Target order not found"));

        if (!ACTIVE_STATUSES.contains(source.getStatus()) || !ACTIVE_STATUSES.contains(target.getStatus())) {
            return new ResponseEntity<>("Both orders must be active (open) to merge", HttpStatus.BAD_REQUEST);
        }

        // Move every not-yet-billed item across, via a direct repository query rather
        // than walking source.getItems() -- that collection has cascade/orphanRemoval
        // semantics (see the entity), and removing an item from it in memory would
        // get it DELETED at flush time instead of just re-parented.
        List<RestaurantOrderItem> movable = orderItemRepo.findByOrder_OrderIdAndBilledFalse(sourceOrderId);

        if (movable.isEmpty()) {
            return new ResponseEntity<>("Nothing to merge -- source table has no unbilled items", HttpStatus.BAD_REQUEST);
        }

        movable.forEach(i -> i.setOrder(target));
        orderItemRepo.saveAll(movable);

        // if everything on the source is now billed (or was already empty), close it out
        boolean sourceHasItemsLeft = orderItemRepo.existsByOrder_OrderIdAndBilledFalse(sourceOrderId);
        if (!sourceHasItemsLeft) {
            source.setStatus(RestaurantOrderStatus.CANCELLED);
            orderRepo.save(source);

            DiningTable sourceTable = source.getTable();
            if (sourceTable != null) {
                sourceTable.setStatus(TableStatus.AVAILABLE);
                tableRepo.save(sourceTable);
            }
        }

        broadcastAll();
        return ResponseEntity.ok(orderRepo.findById(targetOrderId).orElse(target));
    }
}
