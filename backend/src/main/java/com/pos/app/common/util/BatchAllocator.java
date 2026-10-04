package com.pos.app.common.util;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Pure First-Expiry-First-Out allocation across stock batches (no Spring/JPA deps).
 * Batches with an expiry date are consumed earliest-expiry first; batches with no
 * expiry date come after all dated batches (oldest received first). Expired
 * batches are still allocatable (food gets used/wasted, the alert layer flags them)
 * so a stale expiry date can never block service.
 */
public final class BatchAllocator {

    private BatchAllocator() {}

    public interface Slot {
        Object id();
        BigDecimal remaining();
        LocalDate expiry();
        java.time.LocalDateTime receivedAt();
    }

    public record Take(Object batchId, BigDecimal qty) {}

    public record Result(List<Take> takes, BigDecimal shortfall) {}

    public static Result allocate(List<? extends Slot> slots, BigDecimal needed) {
        List<Slot> ordered = new ArrayList<>(slots);
        ordered.sort(Comparator
                .comparing((Slot s) -> s.expiry() == null ? LocalDate.MAX : s.expiry())
                .thenComparing(Slot::receivedAt, Comparator.nullsLast(Comparator.naturalOrder())));

        List<Take> takes = new ArrayList<>();
        BigDecimal left = needed;
        for (Slot s : ordered) {
            if (left.signum() <= 0) break;
            BigDecimal avail = s.remaining();
            if (avail == null || avail.signum() <= 0) continue;
            BigDecimal take = avail.min(left);
            takes.add(new Take(s.id(), take));
            left = left.subtract(take);
        }
        return new Result(takes, left.signum() > 0 ? left : BigDecimal.ZERO);
    }
}
