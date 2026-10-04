package com.pos.app.common.util;

/**
 * Keeps paged list endpoints cheap. Without a cap a single request such as ?size=1000000 loads a tenant's
 * whole table into memory -- with many tenants sharing one server that is how one busy client slows down everybody.
 */
public final class PageGuard {

    /** Largest page any list endpoint will serve (the POS menu picker asks for 500 at a time). */
    public static final int MAX_PAGE_SIZE = 500;

    private PageGuard() {}

    public static int size(int requested) {
        if (requested < 1) return 10;
        return Math.min(requested, MAX_PAGE_SIZE);
    }

    public static int page(int requested) {
        return Math.max(0, requested);
    }
}
