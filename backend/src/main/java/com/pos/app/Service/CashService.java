package com.pos.app.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.pos.app.Entity.CashMovement;
import com.pos.app.Entity.CashShift;
import com.pos.app.Enum.CashMovementType;
import com.pos.app.Enum.CashShiftStatus;
import com.pos.app.Enum.PaymentMethod;
import com.pos.app.Enum.RestaurantOrderStatus;
import com.pos.app.Exception.InvalidRequestException;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.CashMovementRepository;
import com.pos.app.Repository.CashShiftRepository;
import com.pos.app.Repository.RestaurantOrderRepository;
import com.pos.app.Repository.SalesInvoiceMasterRepository;
import com.pos.app.common.service.AuditService;

import jakarta.transaction.Transactional;

/**
 * Cash reconciliation. A shift is opened with a float; while it is open, every PAID cash sale (and the
 * cash part of split bills) that gets invoiced counts towards the drawer. Staff can record petty-cash
 * IN / OUT. Closing compares the counted cash with the expected cash and stores the variance.
 *
 * Sales are attributed to a shift by TIME (invoice created between open and close), so nothing in the
 * billing flow has to know about shifts and no bill can be blocked by one.
 */
@Service
@Transactional
public class CashService {

    @Autowired private CashShiftRepository shiftRepo;
    @Autowired private CashMovementRepository movementRepo;
    @Autowired private SalesInvoiceMasterRepository invoiceRepo;
    @Autowired private RestaurantOrderRepository orderRepo;
    @Autowired private AuditService auditService;

    private static final List<RestaurantOrderStatus> RUNNING = List.of(
            RestaurantOrderStatus.OPEN, RestaurantOrderStatus.KOT_SENT, RestaurantOrderStatus.SERVED);

    /* ===================== views ===================== */

    public record MovementView(Long movementId, String type, BigDecimal amount, String reason,
                               String createdBy, LocalDateTime createdAt) {}

    public record ShiftView(Long shiftId, String status, LocalDateTime openedAt, String openedBy,
                            LocalDateTime closedAt, String closedBy,
                            BigDecimal openingFloat, BigDecimal cashSales, BigDecimal cardSales, BigDecimal upiSales,
                            BigDecimal pendingSales, int invoiceCount, BigDecimal cashIn, BigDecimal cashOut,
                            BigDecimal expectedCash, BigDecimal countedCash, BigDecimal variance,
                            String openNotes, String closeNotes, String denominationsJson,
                            long runningOrders, List<MovementView> movements) {}

    public record OpenRequest(Double openingFloat, String notes) {}
    public record MovementRequest(String type, Double amount, String reason) {}
    public record CloseRequest(Double countedCash, String denominationsJson, String notes) {}

    /* ===================== queries ===================== */

    public ShiftView current() {
        return shiftRepo.findFirstByStatusOrderByOpenedAtDesc(CashShiftStatus.OPEN).map(this::view).orElse(null);
    }

    public ShiftView get(Long shiftId) {
        return view(load(shiftId));
    }

    public List<ShiftView> history(LocalDate from, LocalDate to) {
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();
        return shiftRepo.findByOpenedAtBetweenOrderByOpenedAtDesc(start, end).stream()
                .map(this::view).collect(Collectors.toList());
    }

    /* ===================== commands ===================== */

    public ShiftView open(OpenRequest req, String user) {
        if (shiftRepo.findFirstByStatusOrderByOpenedAtDesc(CashShiftStatus.OPEN).isPresent()) {
            throw new InvalidRequestException("A cash shift is already open. Close it before opening a new one.");
        }
        double f = req.openingFloat() == null ? 0 : req.openingFloat();
        if (Double.isNaN(f) || Double.isInfinite(f) || f < 0) throw new InvalidRequestException("Opening float cannot be negative");

        CashShift s = new CashShift();
        s.setStatus(CashShiftStatus.OPEN);
        s.setOpenedAt(LocalDateTime.now());
        s.setOpenedBy(user);
        s.setOpeningFloat(money(f));
        s.setOpenNotes(trim(req.notes(), 500));
        s = shiftRepo.save(s);
        auditService.log("CASH_SHIFT_OPENED", "CashShift", String.valueOf(s.getShiftId()),
                "Shift opened by " + user + " with float " + s.getOpeningFloat());
        return view(s);
    }

    public ShiftView addMovement(Long shiftId, MovementRequest req, String user) {
        CashShift s = load(shiftId);
        requireOpen(s);
        CashMovementType type;
        try {
            type = CashMovementType.valueOf(req.type() == null ? "" : req.type().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException("Type must be IN or OUT");
        }
        double a = req.amount() == null ? 0 : req.amount();
        if (Double.isNaN(a) || Double.isInfinite(a) || a <= 0) throw new InvalidRequestException("Amount must be greater than 0");
        String reason = trim(req.reason(), 255);
        if (reason == null || reason.isBlank()) throw new InvalidRequestException("A reason is required (e.g. \"milk purchase\", \"change top-up\")");

        if (type == CashMovementType.OUT) {
            BigDecimal expected = view(s).expectedCash();
            if (money(a).compareTo(expected) > 0) {
                throw new InvalidRequestException("Only " + expected.toPlainString() + " should be in the drawer; you can't take out " + money(a).toPlainString());
            }
        }

        CashMovement m = new CashMovement();
        m.setShiftId(shiftId);
        m.setType(type);
        m.setAmount(money(a));
        m.setReason(reason);
        m.setCreatedBy(user);
        movementRepo.save(m);
        auditService.log("CASH_" + type.name(), "CashShift", String.valueOf(shiftId),
                type + " " + m.getAmount() + " by " + user + ": " + reason);
        return view(s);
    }

    public ShiftView close(Long shiftId, CloseRequest req, String user) {
        CashShift s = load(shiftId);
        requireOpen(s);
        if (req.countedCash() == null) throw new InvalidRequestException("Enter the cash you counted in the drawer");
        double counted = req.countedCash();
        if (Double.isNaN(counted) || Double.isInfinite(counted) || counted < 0) throw new InvalidRequestException("Counted cash cannot be negative");

        LocalDateTime now = LocalDateTime.now();
        Totals t = totals(s, now);
        BigDecimal expected = expected(s, t);
        BigDecimal countedM = money(counted);
        BigDecimal variance = countedM.subtract(expected);

        String notes = trim(req.notes(), 500);
        if (variance.signum() != 0 && (notes == null || notes.isBlank())) {
            throw new InvalidRequestException("The drawer is " + (variance.signum() < 0 ? "short" : "over") + " by "
                    + variance.abs().toPlainString() + ". Add a note explaining the difference to close the shift.");
        }

        s.setStatus(CashShiftStatus.CLOSED);
        s.setClosedAt(now);
        s.setClosedBy(user);
        s.setCashSales(t.cashSales);
        s.setCardSales(t.cardSales);
        s.setUpiSales(t.upiSales);
        s.setPendingSales(t.pendingSales);
        s.setInvoiceCount(t.invoiceCount);
        s.setCashIn(t.cashIn);
        s.setCashOut(t.cashOut);
        s.setExpectedCash(expected);
        s.setCountedCash(countedM);
        s.setVariance(variance);
        s.setDenominationsJson(trim(req.denominationsJson(), 1000));
        s.setCloseNotes(notes);
        shiftRepo.save(s);

        auditService.log("CASH_SHIFT_CLOSED", "CashShift", String.valueOf(shiftId),
                "Closed by " + user + ": expected " + expected + ", counted " + countedM + ", variance " + variance);
        return view(s);
    }

    /* ===================== maths ===================== */

    private record Totals(BigDecimal cashSales, BigDecimal cardSales, BigDecimal upiSales, BigDecimal pendingSales,
                          int invoiceCount, BigDecimal cashIn, BigDecimal cashOut) {}

    private Totals totals(CashShift s, LocalDateTime to) {
        LocalDateTime from = s.getOpenedAt();
        BigDecimal cash = money(nz(invoiceRepo.sumPaidByMethod(from, to, PaymentMethod.CASH))
                + nz(invoiceRepo.sumSplitCash(from, to)));
        BigDecimal card = money(nz(invoiceRepo.sumPaidByMethod(from, to, PaymentMethod.CARD))
                + nz(invoiceRepo.sumSplitOnline(from, to, PaymentMethod.CARD)));
        BigDecimal upi = money(nz(invoiceRepo.sumPaidByMethod(from, to, PaymentMethod.UPI))
                + nz(invoiceRepo.sumSplitOnline(from, to, PaymentMethod.UPI)));
        BigDecimal pending = money(nz(invoiceRepo.sumPending(from, to)));
        int count = (int) invoiceRepo.countLive(from, to);
        BigDecimal in = BigDecimal.ZERO;
        BigDecimal out = BigDecimal.ZERO;
        for (CashMovement m : movementRepo.findByShiftIdOrderByCreatedAtAsc(s.getShiftId())) {
            if (m.getType() == CashMovementType.IN) in = in.add(m.getAmount());
            else out = out.add(m.getAmount());
        }
        return new Totals(cash, card, upi, pending, count, scale(in), scale(out));
    }

    private BigDecimal expected(CashShift s, Totals t) {
        return s.getOpeningFloat().add(t.cashSales).add(t.cashIn).subtract(t.cashOut).setScale(2, RoundingMode.HALF_UP);
    }

    private ShiftView view(CashShift s) {
        List<MovementView> moves = movementRepo.findByShiftIdOrderByCreatedAtAsc(s.getShiftId()).stream()
                .map(m -> new MovementView(m.getMovementId(), m.getType().name(), m.getAmount(), m.getReason(), m.getCreatedBy(), m.getCreatedAt()))
                .collect(Collectors.toList());

        if (s.getStatus() == CashShiftStatus.CLOSED) {
            // history is a frozen snapshot -- later voids/edits must not rewrite a closed shift
            return new ShiftView(s.getShiftId(), s.getStatus().name(), s.getOpenedAt(), s.getOpenedBy(),
                    s.getClosedAt(), s.getClosedBy(), s.getOpeningFloat(), s.getCashSales(), s.getCardSales(),
                    s.getUpiSales(), s.getPendingSales(), s.getInvoiceCount() == null ? 0 : s.getInvoiceCount(),
                    s.getCashIn(), s.getCashOut(), s.getExpectedCash(), s.getCountedCash(), s.getVariance(),
                    s.getOpenNotes(), s.getCloseNotes(), s.getDenominationsJson(), 0, moves);
        }
        Totals t = totals(s, LocalDateTime.now());
        long running = orderRepo.countByStatusIn(RUNNING);
        return new ShiftView(s.getShiftId(), s.getStatus().name(), s.getOpenedAt(), s.getOpenedBy(), null, null,
                s.getOpeningFloat(), t.cashSales, t.cardSales, t.upiSales, t.pendingSales, t.invoiceCount,
                t.cashIn, t.cashOut, expected(s, t), null, null, s.getOpenNotes(), null, null, running, moves);
    }

    /* ===================== helpers ===================== */

    private CashShift load(Long id) {
        return shiftRepo.findById(id).orElseThrow(() -> new ResourceNotFoundExceptionHandling("Cash shift not found"));
    }

    private void requireOpen(CashShift s) {
        if (s.getStatus() != CashShiftStatus.OPEN) throw new InvalidRequestException("This shift is already closed");
    }

    private static double nz(Double d) { return d == null ? 0 : d; }

    private static BigDecimal money(double v) { return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP); }

    private static BigDecimal scale(BigDecimal v) { return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP); }

    private static String trim(String v, int max) {
        if (v == null) return null;
        String t = v.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
