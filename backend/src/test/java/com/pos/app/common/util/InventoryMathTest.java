package com.pos.app.common.util;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class InventoryMathTest {

    private record S(Object id, BigDecimal remaining, LocalDate expiry, LocalDateTime receivedAt) implements BatchAllocator.Slot {}

    private static BigDecimal d(String v) { return new BigDecimal(v); }

    @Test
    void convertsWithinAFamily() {
        assertEquals(0, d("250").compareTo(UnitConverter.convert(d("0.25"), "kg", "g")));
        assertEquals(0, d("0.5").compareTo(UnitConverter.convert(d("500"), "ML", "L")));
        assertEquals(0, d("24").compareTo(UnitConverter.convert(d("2"), "DOZEN", "PCS")));
        assertEquals("G", UnitConverter.baseUnitOf("kg"));
    }

    @Test
    void rejectsCrossFamilyAndUnknownUnits() {
        assertThrows(IllegalArgumentException.class, () -> UnitConverter.convert(BigDecimal.ONE, "KG", "ML"));
        assertThrows(IllegalArgumentException.class, () -> UnitConverter.familyOf("bag"));
    }

    @Test
    void allocatesEarliestExpiryFirstAndUndatedLast() {
        LocalDateTime t = LocalDateTime.of(2026, 9, 1, 10, 0);
        List<S> slots = List.of(
                new S(1L, d("100"), null, t),
                new S(2L, d("50"), LocalDate.of(2026, 10, 5), t.plusDays(1)),
                new S(3L, d("80"), LocalDate.of(2026, 10, 1), t.plusDays(2)),
                new S(4L, BigDecimal.ZERO, LocalDate.of(2026, 9, 30), t));

        BatchAllocator.Result r = BatchAllocator.allocate(slots, d("120"));
        assertEquals(2, r.takes().size());
        assertEquals(3L, r.takes().get(0).batchId());
        assertEquals(0, d("80").compareTo(r.takes().get(0).qty()));
        assertEquals(2L, r.takes().get(1).batchId());
        assertEquals(0, d("40").compareTo(r.takes().get(1).qty()));
        assertEquals(0, r.shortfall().signum());

        BatchAllocator.Result r2 = BatchAllocator.allocate(slots, d("300"));
        assertEquals(1L, r2.takes().get(2).batchId());
        assertEquals(0, d("70").compareTo(r2.shortfall()));
    }
}
