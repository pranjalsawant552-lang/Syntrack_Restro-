package com.pos.app.common.util;

import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Tiny per-tenant "compute once, reuse for a few seconds" cache for read-heavy, identical-for-everyone responses
 * (e.g. the customer QR menu that dozens of phones re-request). Values are computed by the supplier on a miss;
 * {@link #invalidate(String)} drops a tenant's entry the moment its data changes.
 */
public class TenantTtlCache<T> {

    private record Entry<T>(T value, long expiresAtNanos) {}

    private final ConcurrentHashMap<String, Entry<T>> map = new ConcurrentHashMap<>();
    private final long ttlNanos;

    public TenantTtlCache(long ttlSeconds) {
        this.ttlNanos = Math.max(0, ttlSeconds) * 1_000_000_000L;
    }

    public T get(String tenantKey, Supplier<T> loader) {
        if (ttlNanos == 0 || tenantKey == null) return loader.get();
        long now = System.nanoTime();
        Entry<T> e = map.get(tenantKey);
        if (e != null && now - e.expiresAtNanos() < 0) return e.value();
        T fresh = loader.get();
        map.put(tenantKey, new Entry<>(fresh, now + ttlNanos));
        return fresh;
    }

    public void invalidate(String tenantKey) {
        if (tenantKey != null) map.remove(tenantKey);
    }
}
