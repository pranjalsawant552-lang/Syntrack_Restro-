package com.pos.app.Service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pos.app.DTO.ProductDTO;
import com.pos.app.DTO.RestaurantOrderItemRequestDTO;
import com.pos.app.Entity.*;
import com.pos.app.Enum.QrRequestStatus;
import com.pos.app.Enum.QrSessionState;
import com.pos.app.Enum.RestaurantOrderStatus;
import com.pos.app.Enum.TableStatus;
import com.pos.app.Exception.InvalidRequestException;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.*;
import com.pos.app.common.service.AuditService;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.tenant.TenantContext;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * QR table self-ordering.
 *
 * Every table has a secret QR token. A customer scans it, presses "Start ordering", and gets a
 * time-boxed session. What protects the restaurant from FAKE table occupancy:
 *
 *  1. The QR token is unguessable and can be rotated if a photo of it leaks.
 *  2. Scanning only starts a short HOLD (default 5 min). The table is not really occupied and nothing
 *     reaches the kitchen. If no order follows, the hold silently lapses.
 *  3. The first order needs a waiter's Accept (default mode FIRST_ORDER). Only then is the real order
 *     opened, the table marked OCCUPIED and the KOT sent. Fake scans never get that far.
 *  4. A session is bound to ONE order and lasts a fixed window (default 120 min, staff can extend or
 *     end it). When the bill is settled or the order cancelled the session dies with it.
 *  5. A device that keeps making scans that never turn into orders is blocked for a while (strikes),
 *     and there are caps on concurrent holds per IP / devices per table plus request rate limits.
 *
 * Bill settlement is NOT handled here: customers can only ask for the bill, staff settle it through
 * the normal flow.
 */
@Service
@Transactional
public class QrDiningService {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final List<QrSessionState> LIVE = List.of(QrSessionState.HOLD, QrSessionState.ACTIVE);
    private static final List<RestaurantOrderStatus> ACTIVE_ORDER = List.of(
            RestaurantOrderStatus.OPEN, RestaurantOrderStatus.KOT_SENT, RestaurantOrderStatus.SERVED);

    private static final int MAX_LINES_PER_ORDER = 30;
    private static final int MAX_QTY_PER_LINE = 20;
    private static final int MAX_PENDING_PER_SESSION = 3;
    private static final int MAX_DEVICES_PER_TABLE = 8;
    private static final int STRIKE_WINDOW_MINUTES = 60;

    @Value("${app.qr.max-holds-per-ip:10}")
    private int maxHoldsPerIp;
    @Value("${app.qr.max-strikes-per-device:3}")
    private int maxStrikesPerDevice;
    @Value("${app.qr.max-strikes-per-ip-without-device:6}")
    private int maxStrikesPerIpNoDevice;

    @Autowired private DiningTableRepository tableRepo;
    @Autowired private RestaurantOrderRepository orderRepo;
    @Autowired private QrTableSessionRepository sessionRepo;
    @Autowired private QrOrderRequestRepository requestRepo;
    @Autowired private SettingMasterRepository settingRepo;
    @Autowired private ProductRepository productRepo;
    @Autowired private ProductVariantRepository variantRepo;
    @Autowired private ProductModifierGroupRepository modifierLinkRepo;
    @Autowired private TenantRepository tenantRepo;
    @Autowired private IRestaurantService restaurantService;
    @Autowired private MenuOptionsService menuOptionsService;
    @Autowired private MenuAvailabilityService menuAvailability;
    @Autowired private AuditService auditService;
    @Autowired private com.pos.app.common.util.QrMenuCache qrMenuCache;

    /* =====================================================================
       Settings
    ===================================================================== */

    public record Settings(boolean enabled, int holdMinutes, int sessionMinutes, String approvalMode) {}

    public record SettingsRequest(Boolean enabled, Integer holdMinutes, Integer sessionMinutes, String approvalMode) {}

    public Settings settings() {
        List<SettingMaster> rows = settingRepo.findAllOrdered();
        SettingMaster s = rows.isEmpty() ? null : rows.get(0);
        boolean enabled = s == null || s.getQrOrderingEnabled() == null || s.getQrOrderingEnabled();
        int hold = clamp(s == null ? null : s.getQrHoldMinutes(), 1, 30, 5);
        int session = clamp(s == null ? null : s.getQrSessionMinutes(), 15, 480, 120);
        return new Settings(enabled, hold, session, normalizeMode(s == null ? null : s.getQrApprovalMode()));
    }

    public Settings updateSettings(SettingsRequest req) {
        List<SettingMaster> rows = settingRepo.findAllOrdered();
        SettingMaster s = rows.isEmpty() ? new SettingMaster() : rows.get(0);
        if (req.enabled() != null) s.setQrOrderingEnabled(req.enabled());
        if (req.holdMinutes() != null) s.setQrHoldMinutes(clamp(req.holdMinutes(), 1, 30, 5));
        if (req.sessionMinutes() != null) s.setQrSessionMinutes(clamp(req.sessionMinutes(), 15, 480, 120));
        if (req.approvalMode() != null) s.setQrApprovalMode(normalizeMode(req.approvalMode()));
        settingRepo.save(s);
        Settings out = settings();
        auditService.log("QR_SETTINGS_UPDATED", "SettingMaster", String.valueOf(s.getSettingId()),
                "QR ordering: enabled=" + out.enabled() + ", hold=" + out.holdMinutes() + "m, session="
                        + out.sessionMinutes() + "m, approval=" + out.approvalMode());
        return out;
    }

    private static int clamp(Integer v, int min, int max, int def) {
        if (v == null) return def;
        return Math.max(min, Math.min(max, v));
    }

    private static String normalizeMode(String m) {
        if (m == null) return "FIRST_ORDER";
        String u = m.trim().toUpperCase();
        return (u.equals("NONE") || u.equals("EVERY_ORDER") || u.equals("FIRST_ORDER")) ? u : "FIRST_ORDER";
    }

    /* =====================================================================
       Staff side: QR codes, approvals, session control
    ===================================================================== */

    public record QrTableInfo(Long tableId, String tableName, String section, String path,
                              String liveState, int pendingRequests, boolean billRequested) {}

    /** Every active table with its QR path. Tables created before this feature get their token here. */
    public List<QrTableInfo> listQrTables() {
        String slug = currentSlug();
        LocalDateTime now = LocalDateTime.now();
        Map<Long, List<QrTableSession>> live = sessionRepo.findByStateInAndExpiresAtAfter(LIVE, now).stream()
                .collect(Collectors.groupingBy(QrTableSession::getTableId));
        Map<Long, Long> pending = requestRepo.findByStatusAndCreatedAtAfter(QrRequestStatus.PENDING,
                        now.minusMinutes(QrOrderRequest.TTL_MINUTES)).stream()
                .collect(Collectors.groupingBy(QrOrderRequest::getTableId, Collectors.counting()));

        List<QrTableInfo> out = new ArrayList<>();
        for (DiningTable t : tableRepo.findByActiveTrueOrderByTableNameAsc()) {
            if (t.getQrToken() == null || t.getQrToken().isBlank()) {
                t.setQrToken(newToken(24));
                tableRepo.save(t);
            }
            List<QrTableSession> ls = live.getOrDefault(t.getTableId(), List.of());
            String state = ls.isEmpty() ? null
                    : (ls.stream().anyMatch(x -> x.getState() == QrSessionState.ACTIVE) ? "ACTIVE" : "HOLD");
            out.add(new QrTableInfo(t.getTableId(), t.getTableName(), t.getSection(),
                    "/t/" + slug + "/" + t.getQrToken(), state,
                    pending.getOrDefault(t.getTableId(), 0L).intValue(),
                    ls.stream().anyMatch(x -> x.getBillRequestedAt() != null)));
        }
        return out;
    }

    /** New secret for a table's QR: the old printed code stops working and live sessions end. */
    public QrTableInfo rotateToken(Long tableId, String staff) {
        DiningTable t = tableRepo.findById(tableId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Table not found"));
        t.setQrToken(newToken(24));
        tableRepo.save(t);
        closeLiveSessions(tableId, "QR_ROTATED", "The table's QR code was replaced");
        auditService.log("QR_TOKEN_ROTATED", "DiningTable", String.valueOf(tableId),
                "QR code regenerated for " + t.getTableName() + " by " + staff);
        restaurantService.pushTablesUpdate();
        return listQrTables().stream().filter(x -> x.tableId().equals(tableId)).findFirst().orElseThrow();
    }

    public record RequestLineView(String name, int quantity, String variantName, String optionsText, String notes,
                                  double lineTotal) {}

    public record PendingRequestView(Long requestId, Long tableId, String tableName, long ageSeconds,
                                     String sessionState, boolean tableAlreadyOrdering,
                                     List<RequestLineView> lines, double total, String customerNote) {}

    public List<PendingRequestView> pendingRequests() {
        LocalDateTime now = LocalDateTime.now();
        List<QrOrderRequest> reqs = requestRepo.findByStatusAndCreatedAtAfterOrderByCreatedAtAsc(
                QrRequestStatus.PENDING, now.minusMinutes(QrOrderRequest.TTL_MINUTES));
        Map<Long, DiningTable> tables = tableRepo.findAllById(
                        reqs.stream().map(QrOrderRequest::getTableId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(DiningTable::getTableId, x -> x));
        List<PendingRequestView> out = new ArrayList<>();
        for (QrOrderRequest r : reqs) {
            DiningTable t = tables.get(r.getTableId());
            QrTableSession s = sessionRepo.findById(r.getSessionId()).orElse(null);
            List<StoredLine> lines = readLines(r.getLinesJson());
            boolean ordering = orderRepo.findByTable_TableIdAndStatusIn(r.getTableId(), ACTIVE_ORDER).isPresent();
            out.add(new PendingRequestView(r.getId(), r.getTableId(), t == null ? "?" : t.getTableName(),
                    Duration.between(r.getCreatedAt(), now).getSeconds(),
                    s == null ? null : s.getState().name(), ordering,
                    lines.stream().map(QrDiningService::toLineView).collect(Collectors.toList()),
                    total(lines), r.getCustomerNote()));
        }
        return out;
    }

    /** Waiter accepts a customer's order: opens the table's order if needed, adds the items, sends the KOT. */
    public Map<String, Object> approve(Long requestId, String staff) {
        QrOrderRequest r = requestRepo.lockById(requestId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Request not found"));
        if (r.getStatus() != QrRequestStatus.PENDING) {
            throw new InvalidRequestException("This request was already handled");
        }
        if (r.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(QrOrderRequest.TTL_MINUTES))) {
            throw new InvalidRequestException("This request is too old -- ask the customer to place it again");
        }
        applyRequest(r, staff, false);
        return Map.of("requestId", r.getId(), "status", r.getStatus().name());
    }

    public Map<String, Object> reject(Long requestId, String reason, String staff) {
        QrOrderRequest r = requestRepo.lockById(requestId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Request not found"));
        if (r.getStatus() != QrRequestStatus.PENDING) {
            throw new InvalidRequestException("This request was already handled");
        }
        r.setStatus(QrRequestStatus.REJECTED);
        r.setDecidedAt(LocalDateTime.now());
        r.setDecidedBy(staff);
        r.setRejectReason(trim(reason, 300));
        requestRepo.save(r);

        // Nothing was ever accepted for this scan and nothing else is waiting: release the hold.
        QrTableSession s = sessionRepo.findById(r.getSessionId()).orElse(null);
        if (s != null && s.getState() == QrSessionState.HOLD && s.getOrderId() == null
                && requestRepo.findBySessionIdAndStatus(s.getId(), QrRequestStatus.PENDING).isEmpty()) {
            s.setState(QrSessionState.REJECTED);
            s.setCloseReason("REJECTED");
            sessionRepo.save(s);
        }
        auditService.log("QR_ORDER_REJECTED", "QrOrderRequest", String.valueOf(r.getId()),
                "Rejected by " + staff + (r.getRejectReason() == null ? "" : ": " + r.getRejectReason()));
        restaurantService.pushTablesUpdate();
        return Map.of("requestId", r.getId(), "status", r.getStatus().name());
    }

    /** Give the customers at a table more time (staff decision, e.g. a long celebration dinner). */
    public Map<String, Object> extend(Long tableId, int minutes, String staff) {
        int add = Math.max(5, Math.min(180, minutes));
        LocalDateTime now = LocalDateTime.now();
        List<QrTableSession> live = liveSessions(tableId, now);
        if (live.isEmpty()) throw new InvalidRequestException("No active QR session on this table");
        for (QrTableSession s : live) {
            LocalDateTime base = s.getExpiresAt().isAfter(now) ? s.getExpiresAt() : now;
            s.setExpiresAt(base.plusMinutes(add));
            sessionRepo.save(s);
        }
        auditService.log("QR_SESSION_EXTENDED", "DiningTable", String.valueOf(tableId),
                "Extended by " + add + " min by " + staff);
        restaurantService.pushTablesUpdate();
        return Map.of("extendedByMinutes", add);
    }

    /** Staff cuts off QR ordering at a table (customers keep their order; they just can't add more). */
    public Map<String, Object> endSessions(Long tableId, String staff) {
        int n = closeLiveSessions(tableId, "ENDED_BY_STAFF", "Ended by staff");
        auditService.log("QR_SESSION_ENDED", "DiningTable", String.valueOf(tableId),
                n + " QR session(s) ended by " + staff);
        restaurantService.pushTablesUpdate();
        return Map.of("closed", n);
    }

    public Map<String, Object> dismissBillRequest(Long tableId) {
        for (QrTableSession s : liveSessions(tableId, LocalDateTime.now())) {
            s.setBillRequestedAt(null);
            sessionRepo.save(s);
        }
        restaurantService.pushTablesUpdate();
        return Map.of("ok", true);
    }

    /* =====================================================================
       Customer side (public, no login) -- TenantContext is already set by the controller
    ===================================================================== */

    public record TableLanding(String restaurantName, String logoUrl, String tableName, boolean enabled,
                               int sessionMinutes) {}

    public TableLanding landing(String qrToken) {
        DiningTable t = tableByToken(qrToken);
        Settings st = settings();
        return new TableLanding(restaurantName(), logoUrl(), t.getTableName(), st.enabled(), st.sessionMinutes());
    }

    public record StartedSession(String sessionToken, SessionView session) {}

    /**
     * "Start ordering". Creates a HOLD (or resumes this device's live session for the same table).
     * Deliberately a separate POST from viewing the page, so link-preview bots and curious page loads
     * can never create holds.
     */
    public StartedSession start(String qrToken, String existingSessionToken, String deviceId, String ip, String userAgent) {
        Settings st = settings();
        if (!st.enabled()) throw new InvalidRequestException("QR ordering is switched off right now -- please ask our staff");
        DiningTable table = tableByToken(qrToken);
        LocalDateTime now = LocalDateTime.now();
        sessionRepo.expireStale(now);

        // Resume: same phone re-opening the page (or refreshing) keeps its session.
        if (existingSessionToken != null && !existingSessionToken.isBlank()) {
            QrTableSession existing = sessionRepo.findByTokenHash(sha256(existingSessionToken)).orElse(null);
            if (existing != null && existing.getTableId().equals(table.getTableId())) {
                refresh(existing);
                if (existing.getState() == QrSessionState.HOLD || existing.getState() == QrSessionState.ACTIVE) {
                    return new StartedSession(existingSessionToken, view(existing, table, st));
                }
            }
        }

        // ---- abuse guards (all cheap DB counts; see class comment) ----
        String dev = blankToNull(deviceId);
        LocalDateTime since = now.minusMinutes(STRIKE_WINDOW_MINUTES);
        List<QrSessionState> strikeStates = List.of(QrSessionState.EXPIRED, QrSessionState.REJECTED);
        long strikes = dev != null
                ? sessionRepo.countByDeviceIdAndOrderIdIsNullAndStateInAndCreatedAtAfter(dev, strikeStates, since)
                : sessionRepo.countByClientIpAndOrderIdIsNullAndStateInAndCreatedAtAfter(ip, strikeStates, since);
        int limit = dev != null ? maxStrikesPerDevice : maxStrikesPerIpNoDevice;
        if (strikes >= limit) {
            throw new InvalidRequestException("We couldn't confirm your recent scans. Please ask a staff member to seat you.");
        }
        if (sessionRepo.countByClientIpAndStateAndExpiresAtAfter(ip, QrSessionState.HOLD, now) >= maxHoldsPerIp) {
            throw new InvalidRequestException("Too many tables are being started from this network. Please ask our staff.");
        }
        if (sessionRepo.countByTableIdAndStateInAndExpiresAtAfter(table.getTableId(), LIVE, now) >= MAX_DEVICES_PER_TABLE) {
            throw new InvalidRequestException("This table already has the maximum number of phones connected. Please ask our staff.");
        }

        String raw = newToken(32);
        QrTableSession s = new QrTableSession();
        s.setTableId(table.getTableId());
        s.setTokenHash(sha256(raw));
        s.setState(QrSessionState.HOLD);
        s.setExpiresAt(now.plusMinutes(st.holdMinutes()));
        s.setClientIp(trim(ip, 64));
        s.setDeviceId(trim(dev, 64));
        s.setUserAgent(trim(userAgent, 255));
        sessionRepo.save(s);

        restaurantService.pushTablesUpdate(); // staff see "scanned - waiting" on the board
        return new StartedSession(raw, view(s, table, st));
    }

    public record OrderLineView(String name, int quantity, String status, double lineTotal) {}
    public record MyRequestView(Long requestId, String status, String rejectReason, List<RequestLineView> lines, double total) {}
    public record SessionView(String state, String tableName, String restaurantName, int secondsLeft,
                              String approvalMode, boolean orderAccepted, List<OrderLineView> items, double total,
                              List<MyRequestView> requests, boolean billRequested, String closeReason,
                              String invoiceNumber) {}

    public SessionView session(String rawToken) {
        QrTableSession s = find(rawToken);
        refresh(s);
        DiningTable table = tableRepo.findById(s.getTableId())
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Table not found"));
        return view(s, table, settings());
    }

    public record MenuItemView(Long productId, String name, double price, Boolean veg, boolean combo, boolean customisable) {}
    public record MenuCategoryView(String category, List<MenuItemView> items) {}

    @SuppressWarnings("unchecked")
    public List<MenuCategoryView> menu(String rawToken) {
        requireLive(rawToken); // the session check runs on every request; only the (identical-for-everyone) menu is shared
        return (List<MenuCategoryView>) qrMenuCache.get(TenantContext.getCurrentTenant(), this::buildMenu);
    }

    private List<MenuCategoryView> buildMenu() {

        // Which dishes need the chooser (a size/portion or an add-on group)? Two bulk queries, not one per dish.
        Set<Long> customisable = new HashSet<>();
        variantRepo.findAll().forEach(v -> { if (v.isActive()) customisable.add(v.getProductId()); });
        modifierLinkRepo.findAll().forEach(l -> customisable.add(l.getProductId()));

        // Same rules the owner's Availability screen shows: off / out of stock / combo part missing are all hidden.
        Map<String, List<MenuItemView>> byCat = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        for (MenuAvailabilityService.Row r : menuAvailability.rows()) {
            if (!r.sellable()) continue;
            byCat.computeIfAbsent(r.categoryName() == null ? "Other" : r.categoryName(), k -> new ArrayList<>())
                    .add(new MenuItemView(r.productId(), r.name(), r.price(), r.veg(), r.combo(),
                            customisable.contains(r.productId())));
        }
        List<MenuCategoryView> out = new ArrayList<>();
        byCat.forEach((cat, items) -> {
            items.sort(Comparator.comparing(MenuItemView::name, String.CASE_INSENSITIVE_ORDER));
            out.add(new MenuCategoryView(cat, items));
        });
        return out;
    }

    public MenuOptionsService.ProductOptions options(String rawToken, Long productId) {
        requireLive(rawToken);
        return menuOptionsService.getForProduct(productId, true);
    }

    public record SubmitLine(Long productId, Integer quantity, String notes, Long variantId, List<Long> modifierIds) {}
    public record SubmitRequest(List<SubmitLine> items, String note, String clientRequestId) {}
    public record SubmitResult(Long requestId, String status, String message) {}

    public SubmitResult submit(String rawToken, SubmitRequest req) {
        QrTableSession s = requireLive(rawToken);
        Settings st = settings();
        if (!st.enabled()) throw new InvalidRequestException("QR ordering is switched off right now -- please ask our staff");
        if (req == null || req.items() == null || req.items().isEmpty()) throw new InvalidRequestException("Your cart is empty");
        if (req.items().size() > MAX_LINES_PER_ORDER) throw new InvalidRequestException("Too many different items in one order");

        // Idempotency: a retry / double-tap of the same submit returns the original result.
        String crid = trim(blankToNull(req.clientRequestId()), 64);
        if (crid != null) {
            var prior = requestRepo.findBySessionIdAndClientRequestId(s.getId(), crid);
            if (prior.isPresent()) return resultOf(prior.get());
        }
        if (requestRepo.findBySessionIdAndStatus(s.getId(), QrRequestStatus.PENDING).size() >= MAX_PENDING_PER_SESSION) {
            throw new InvalidRequestException("Please wait for our staff to confirm your earlier order first");
        }

        // Validate + snapshot every line NOW, so the customer hears "sold out" immediately, not the waiter later.
        List<StoredLine> lines = new ArrayList<>();
        for (SubmitLine l : req.items()) {
            if (l == null || l.productId() == null) throw new InvalidRequestException("Choose a menu item");
            int qty = l.quantity() == null ? 0 : l.quantity();
            if (qty < 1 || qty > MAX_QTY_PER_LINE) throw new InvalidRequestException("Quantity must be between 1 and " + MAX_QTY_PER_LINE);
            Product p = productRepo.findById(l.productId())
                    .orElseThrow(() -> new InvalidRequestException("An item in your cart is no longer available"));
            String problem = restaurantService.checkSellable(p.getProductId(), qty);
            if (problem != null) throw new InvalidRequestException(problem);
            var sel = menuOptionsService.resolveSelection(p, l.variantId(), l.modifierIds()); // validates required choices
            lines.add(new StoredLine(p.getProductId(), p.getProductName(), qty, trim(blankToNull(l.notes()), 200),
                    sel.variantId(), l.modifierIds() == null ? List.of() : l.modifierIds(), sel.variantName(),
                    sel.optionsText(), sel.unitPrice(), p.getProdGST()));
        }

        QrOrderRequest r = new QrOrderRequest();
        r.setSessionId(s.getId());
        r.setTableId(s.getTableId());
        r.setStatus(QrRequestStatus.PENDING);
        r.setLinesJson(writeLines(lines));
        r.setCustomerNote(trim(blankToNull(req.note()), 300));
        r.setClientRequestId(crid);
        requestRepo.save(r);

        boolean needsApproval = switch (st.approvalMode()) {
            case "NONE" -> false;
            case "EVERY_ORDER" -> true;
            default -> s.getState() == QrSessionState.HOLD; // FIRST_ORDER: only until a waiter has vouched for the table
        };

        if (needsApproval) {
            // Give the waiter time to get there, without letting the hold silently lapse mid-wait.
            LocalDateTime needed = LocalDateTime.now().plusMinutes(QrOrderRequest.TTL_MINUTES);
            if (s.getExpiresAt().isBefore(needed) && s.getState() == QrSessionState.HOLD) {
                s.setExpiresAt(needed);
                sessionRepo.save(s);
            }
            restaurantService.pushTablesUpdate();
            return new SubmitResult(r.getId(), "PENDING", "Sent to our staff -- they'll confirm it in a moment.");
        }
        applyRequest(r, "QR-AUTO", true);
        return new SubmitResult(r.getId(), "APPROVED", "Your order has been sent to the kitchen.");
    }

    private SubmitResult resultOf(QrOrderRequest r) {
        return switch (r.getStatus()) {
            case APPROVED -> new SubmitResult(r.getId(), "APPROVED", "Your order has been sent to the kitchen.");
            case REJECTED -> new SubmitResult(r.getId(), "REJECTED", "Our staff couldn't accept this order.");
            default -> new SubmitResult(r.getId(), "PENDING", "Sent to our staff -- they'll confirm it in a moment.");
        };
    }

    public Map<String, Object> requestBill(String rawToken) {
        QrTableSession s = requireLive(rawToken);
        if (s.getState() != QrSessionState.ACTIVE) {
            throw new InvalidRequestException("Place an order first, then you can ask for the bill");
        }
        if (s.getBillRequestedAt() == null
                || s.getBillRequestedAt().isBefore(LocalDateTime.now().minusSeconds(60))) {
            s.setBillRequestedAt(LocalDateTime.now());
            sessionRepo.save(s);
            restaurantService.pushTablesUpdate();
        }
        return Map.of("ok", true, "message", "Our staff will bring your bill. Payment is settled at the table/counter.");
    }

    /* =====================================================================
       Shared: turn a request into a real order
    ===================================================================== */

    /**
     * The one place a customer's request touches the real order. Runs in the caller's transaction: if any
     * item can't be added (ran out meanwhile) or the KOT fails, EVERYTHING here rolls back -- no half order,
     * no orphaned open table.
     */
    private void applyRequest(QrOrderRequest r, String decidedBy, boolean auto) {
        QrTableSession s = sessionRepo.findById(r.getSessionId())
                .orElseThrow(() -> new InvalidRequestException("Session not found"));
        refresh(s);
        if (s.getState() != QrSessionState.HOLD && s.getState() != QrSessionState.ACTIVE) {
            throw new InvalidRequestException("The customer's session has ended -- ask them to scan again");
        }
        DiningTable table = tableRepo.findById(r.getTableId())
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Table not found"));

        RestaurantOrder order = orderRepo.findByTable_TableIdAndStatusIn(table.getTableId(), ACTIVE_ORDER).orElse(null);
        if (s.getOrderId() != null && (order == null || !order.getOrderId().equals(s.getOrderId()))) {
            throw new InvalidRequestException("This table's bill was already closed -- ask the customer to scan again");
        }
        if (order == null) {
            restaurantService.openOrder(table.getTableId(), null, null, "QR");
            order = orderRepo.findByTable_TableIdAndStatusIn(table.getTableId(), ACTIVE_ORDER)
                    .orElseThrow(() -> new InvalidRequestException("Could not open the table's order"));
            order.setOrderSource("QR");
            orderRepo.save(order);
        }
        // Occupied for real, from this moment (openOrder does this for new orders; make sure for staff-seated ones too).
        if (table.getStatus() != TableStatus.OCCUPIED) {
            table.setStatus(TableStatus.OCCUPIED);
            tableRepo.save(table);
        }

        for (StoredLine l : readLines(r.getLinesJson())) {
            RestaurantOrderItemRequestDTO dto = new RestaurantOrderItemRequestDTO();
            dto.setProductId(l.productId());
            dto.setQuantity(l.quantity());
            dto.setNotes(l.notes());
            dto.setVariantId(l.variantId());
            dto.setModifierIds(l.modifierIds());
            ResponseEntity<?> res = restaurantService.addItem(order.getOrderId(), dto);
            if (!res.getStatusCode().is2xxSuccessful()) {
                throw new InvalidRequestException(String.valueOf(res.getBody()));
            }
        }
        ResponseEntity<?> kot = restaurantService.sendKot(order.getOrderId());
        if (!kot.getStatusCode().is2xxSuccessful()) {
            throw new InvalidRequestException(String.valueOf(kot.getBody()));
        }

        LocalDateTime now = LocalDateTime.now();
        if (s.getState() == QrSessionState.HOLD) {
            // The dining window starts now, when a real order exists.
            s.setState(QrSessionState.ACTIVE);
            s.setOrderId(order.getOrderId());
            s.setActivatedAt(now);
            s.setExpiresAt(now.plusMinutes(settings().sessionMinutes()));
            s.setApprovedBy(decidedBy);
            sessionRepo.save(s);
        }
        r.setStatus(QrRequestStatus.APPROVED);
        r.setDecidedAt(now);
        r.setDecidedBy(decidedBy);
        r.setAutoApproved(auto);
        requestRepo.save(r);

        auditService.log(auto ? "QR_ORDER_AUTO_ACCEPTED" : "QR_ORDER_APPROVED", "QrOrderRequest", String.valueOf(r.getId()),
                table.getTableName() + ": " + readLines(r.getLinesJson()).size() + " line(s) on order "
                        + order.getOrderId() + " (" + decidedBy + ")");
        restaurantService.pushTablesUpdate();
    }

    /* =====================================================================
       Helpers
    ===================================================================== */

    /** Loads a session and applies time/order-based state changes (lazy expiry -- no scheduler needed). */
    private void refresh(QrTableSession s) {
        LocalDateTime now = LocalDateTime.now();
        if (s.getState() != QrSessionState.HOLD && s.getState() != QrSessionState.ACTIVE) return;
        if (s.getExpiresAt() != null && s.getExpiresAt().isBefore(now)) {
            s.setState(QrSessionState.EXPIRED);
            s.setCloseReason("TIME_UP");
            sessionRepo.save(s);
            return;
        }
        if (s.getState() == QrSessionState.ACTIVE && s.getOrderId() != null) {
            RestaurantOrder o = orderRepo.findById(s.getOrderId()).orElse(null);
            if (o == null || !ACTIVE_ORDER.contains(o.getStatus())) {
                s.setState(QrSessionState.CLOSED);
                s.setCloseReason(o == null ? "CANCELLED" : o.getStatus().name()); // SETTLED / CANCELLED
                sessionRepo.save(s);
            }
        }
    }

    private QrTableSession find(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new ResourceNotFoundExceptionHandling("Session not found -- please scan the table's QR code again");
        }
        return sessionRepo.findByTokenHash(sha256(rawToken))
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Session not found -- please scan the table's QR code again"));
    }

    private QrTableSession requireLive(String rawToken) {
        QrTableSession s = find(rawToken);
        refresh(s);
        if (s.getState() == QrSessionState.HOLD || s.getState() == QrSessionState.ACTIVE) return s;
        throw new InvalidRequestException(switch (s.getState()) {
            case EXPIRED -> "Your session has timed out. Please scan the table's QR code again.";
            case REJECTED -> "Our staff couldn't confirm this table. Please ask a team member.";
            default -> "This table's session has ended. Please scan the QR code again or ask our staff.";
        });
    }

    private SessionView view(QrTableSession s, DiningTable table, Settings st) {
        LocalDateTime now = LocalDateTime.now();
        boolean live = s.getState() == QrSessionState.HOLD || s.getState() == QrSessionState.ACTIVE;
        int secs = live && s.getExpiresAt() != null
                ? (int) Math.max(0, Duration.between(now, s.getExpiresAt()).getSeconds()) : 0;

        List<OrderLineView> items = new ArrayList<>();
        double total = 0;
        String invoiceNumber = null;
        if (s.getOrderId() != null) {
            RestaurantOrder o = orderRepo.findById(s.getOrderId()).orElse(null);
            if (o != null) {
                if (o.getStatus() == RestaurantOrderStatus.SETTLED) invoiceNumber = o.getInvoiceNumber();
                if (live) {
                    for (RestaurantOrderItem i : o.getItems()) {
                        if (i.isBilled()) continue;
                        double lt = round2(i.getUnitPrice() * i.getQuantity() * (1 + i.getGstPercent() / 100.0));
                        total += lt;
                        items.add(new OrderLineView(i.getDisplayName()
                                + (i.getOptionsText() == null || i.getOptionsText().isBlank() ? "" : " - " + i.getOptionsText()),
                                i.getQuantity(), i.getStatus().name(), lt));
                    }
                }
            }
        }

        List<MyRequestView> reqs = new ArrayList<>();
        for (QrOrderRequest r : requestRepo.findBySessionIdOrderByCreatedAtDesc(s.getId())) {
            if (r.getStatus() == QrRequestStatus.APPROVED) continue; // already shown as real order lines
            if (reqs.size() >= 5) break;
            List<StoredLine> ls = readLines(r.getLinesJson());
            reqs.add(new MyRequestView(r.getId(), r.getStatus().name(), r.getRejectReason(),
                    ls.stream().map(QrDiningService::toLineView).collect(Collectors.toList()), total(ls)));
        }

        return new SessionView(s.getState().name(), table.getTableName(), restaurantName(), secs, st.approvalMode(),
                s.getOrderId() != null, items, round2(total), reqs, s.getBillRequestedAt() != null,
                s.getCloseReason(), invoiceNumber);
    }

    private List<QrTableSession> liveSessions(Long tableId, LocalDateTime now) {
        return sessionRepo.findByTableIdAndStateIn(tableId, LIVE).stream()
                .filter(x -> x.getExpiresAt() != null && x.getExpiresAt().isAfter(now))
                .collect(Collectors.toList());
    }

    private int closeLiveSessions(Long tableId, String reason, String rejectMessage) {
        List<QrTableSession> live = sessionRepo.findByTableIdAndStateIn(tableId, LIVE);
        for (QrTableSession s : live) {
            s.setState(QrSessionState.CLOSED);
            s.setCloseReason(reason);
            sessionRepo.save(s);
        }
        for (QrOrderRequest r : requestRepo.findByTableIdAndStatus(tableId, QrRequestStatus.PENDING)) {
            r.setStatus(QrRequestStatus.REJECTED);
            r.setDecidedAt(LocalDateTime.now());
            r.setDecidedBy("SYSTEM");
            r.setRejectReason(rejectMessage);
            requestRepo.save(r);
        }
        return live.size();
    }

    private DiningTable tableByToken(String qrToken) {
        if (qrToken == null || qrToken.isBlank() || qrToken.length() > 64) {
            throw new ResourceNotFoundExceptionHandling("This QR code isn't valid any more");
        }
        DiningTable t = tableRepo.findByQrToken(qrToken.trim())
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("This QR code isn't valid any more"));
        if (!t.isActive()) throw new ResourceNotFoundExceptionHandling("This table isn't available");
        return t;
    }

    private String currentSlug() {
        String key = TenantContext.getCurrentTenant();
        return tenantRepo.findByDbName(key).map(Tenant::getSlug).orElse("");
    }

    private String restaurantName() {
        List<SettingMaster> rows = settingRepo.findAllOrdered();
        SettingMaster s = rows.isEmpty() ? null : rows.get(0);
        if (s != null && s.getAppName() != null && !s.getAppName().isBlank()) return s.getAppName();
        if (s != null && s.getCompanyName() != null && !s.getCompanyName().isBlank()) return s.getCompanyName();
        return tenantRepo.findByDbName(TenantContext.getCurrentTenant()).map(Tenant::getName).orElse("Restaurant");
    }

    private String logoUrl() {
        List<SettingMaster> rows = settingRepo.findAllOrdered();
        SettingMaster s = rows.isEmpty() ? null : rows.get(0);
        return s != null && s.getLogoUrl() != null ? s.getLogoUrl() : "";
    }

    /* ---- stored line snapshot (JSON in qr_order_request.lines_json) ---- */

    public record StoredLine(Long productId, String name, int quantity, String notes, Long variantId,
                              List<Long> modifierIds, String variantName, String optionsText,
                              double unitPrice, double gstPercent) {}

    private static String writeLines(List<StoredLine> lines) {
        try {
            return JSON.writeValueAsString(lines);
        } catch (Exception e) {
            throw new InvalidRequestException("Could not save your order, please try again");
        }
    }

    private static List<StoredLine> readLines(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return JSON.readValue(json, new TypeReference<List<StoredLine>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static RequestLineView toLineView(StoredLine l) {
        return new RequestLineView(l.name(), l.quantity(), l.variantName(), l.optionsText(), l.notes(),
                round2(l.unitPrice() * l.quantity() * (1 + l.gstPercent() / 100.0)));
    }

    private static double total(List<StoredLine> lines) {
        return round2(lines.stream().mapToDouble(l -> l.unitPrice() * l.quantity() * (1 + l.gstPercent() / 100.0)).sum());
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static String trim(String v, int max) {
        if (v == null) return null;
        String t = v.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static String newToken(int bytes) {
        byte[] b = new byte[bytes];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static String sha256(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(d.length * 2);
            for (byte x : d) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
