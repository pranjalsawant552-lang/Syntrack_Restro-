package com.pos.app.common.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.Map;

/**
 * Pure unit conversion for recipe/ingredient quantities (no Spring/JPA deps).
 *
 * Every ingredient has ONE base unit (G, ML or PCS) that stock is kept in.
 * Recipes and purchases may be entered in a larger/smaller unit of the SAME
 * family (KG->G, L->ML, DOZEN->PCS ...) and are converted to base units here.
 * Converting across families (e.g. KG -> ML) is rejected on purpose.
 */
public final class UnitConverter {

    private UnitConverter() {}

    public enum Family { WEIGHT, VOLUME, COUNT }

    /** unit code -> family */
    private static final Map<String, Family> FAMILY = Map.of(
            "G", Family.WEIGHT, "KG", Family.WEIGHT, "MG", Family.WEIGHT,
            "ML", Family.VOLUME, "L", Family.VOLUME,
            "PCS", Family.COUNT, "DOZEN", Family.COUNT
    );

    /** unit code -> multiplier to that family's base unit (G / ML / PCS) */
    private static final Map<String, BigDecimal> TO_BASE = Map.of(
            "G", BigDecimal.ONE, "KG", new BigDecimal("1000"), "MG", new BigDecimal("0.001"),
            "ML", BigDecimal.ONE, "L", new BigDecimal("1000"),
            "PCS", BigDecimal.ONE, "DOZEN", new BigDecimal("12")
    );

    public static String norm(String unit) {
        return unit == null ? null : unit.trim().toUpperCase(Locale.ROOT);
    }

    public static boolean isSupported(String unit) {
        return unit != null && FAMILY.containsKey(norm(unit));
    }

    /** Base unit code for a family of the given unit, e.g. KG -> G. */
    public static String baseUnitOf(String unit) {
        Family f = familyOf(unit);
        return switch (f) {
            case WEIGHT -> "G";
            case VOLUME -> "ML";
            case COUNT -> "PCS";
        };
    }

    public static Family familyOf(String unit) {
        Family f = unit == null ? null : FAMILY.get(norm(unit));
        if (f == null) throw new IllegalArgumentException("Unsupported unit: " + unit);
        return f;
    }

    /**
     * Convert {@code qty} expressed in {@code fromUnit} into {@code toUnit}
     * (same family only). Result is rounded to 4 decimals.
     */
    public static BigDecimal convert(BigDecimal qty, String fromUnit, String toUnit) {
        if (qty == null) throw new IllegalArgumentException("Quantity is required");
        if (familyOf(fromUnit) != familyOf(toUnit)) {
            throw new IllegalArgumentException(
                    "Cannot convert " + norm(fromUnit) + " to " + norm(toUnit) + " (different unit types)");
        }
        BigDecimal inBase = qty.multiply(TO_BASE.get(norm(fromUnit)));
        return inBase.divide(TO_BASE.get(norm(toUnit)), 4, RoundingMode.HALF_UP);
    }
}
