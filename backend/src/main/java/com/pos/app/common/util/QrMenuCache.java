package com.pos.app.common.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/**
 * Shared, per-tenant, few-second cache of the customer-facing QR menu. Every customer phone re-requests the same
 * menu every ~45 s and each request rebuilds it (all variants, all add-on links, availability of every dish).
 * Keeping one copy per tenant for a few seconds removes that load; a menu/availability change clears it at once,
 * and an order is always re-validated against live stock when it is submitted, so customers never over-order.
 */
@Component
public class QrMenuCache {

    private final TenantTtlCache<Object> cache;

    public QrMenuCache(@Value("${app.qr.menu-cache-ttl-seconds:15}") long ttlSeconds) {
        this.cache = new TenantTtlCache<>(ttlSeconds);
    }

    public Object get(String tenantKey, Supplier<Object> loader) {
        return cache.get(tenantKey, loader);
    }

    public void invalidate(String tenantKey) {
        cache.invalidate(tenantKey);
    }
}
