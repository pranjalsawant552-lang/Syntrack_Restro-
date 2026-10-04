package com.pos.app.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Remembers a logged-in tenant user's account + permissions for a few seconds.
 *
 * Why: the JWT filter used to load the user (and their role's permissions) from the tenant database on EVERY API
 * call. A POS screen polls and pushes constantly, so that was 2 extra queries per request, multiplied by every
 * device of every tenant.
 *
 * Safety: only successful loads are cached (a deactivated / unknown user is never cached); the entry lives for
 * app.auth.user-cache-ttl-seconds (default 10, 0 = off); and it is cleared immediately whenever a user or role is
 * saved or a password is reset. Worst case a change made on another server instance is seen within the TTL.
 */
@Component
public class AuthUserCache {

    private record Entry(UserDetails details, long expiresAtNanos) {}

    private static final int MAX_ENTRIES = 5_000;

    private final ConcurrentHashMap<String, Entry> cache = new ConcurrentHashMap<>();
    private final long ttlNanos;

    public AuthUserCache(@Value("${app.auth.user-cache-ttl-seconds:10}") long ttlSeconds) {
        this.ttlNanos = Math.max(0, ttlSeconds) * 1_000_000_000L;
    }

    /** Returns the cached user or loads (and caches) it. Exceptions from the loader propagate untouched. */
    public UserDetails load(String tenantKey, String email, UserDetailsServiceImpl loader) {
        if (ttlNanos == 0) return loader.loadUserByUsername(email);

        String key = tenantKey + "|" + email.toLowerCase(Locale.ROOT);
        long now = System.nanoTime();
        Entry e = cache.get(key);
        if (e != null && now - e.expiresAtNanos() < 0) return e.details();

        UserDetails fresh = loader.loadUserByUsername(email);
        if (cache.size() >= MAX_ENTRIES) cache.clear(); // crude size bound: refilled within seconds
        cache.put(key, new Entry(fresh, now + ttlNanos));
        return fresh;
    }

    /** Call after any change to a user, a role or a password. */
    public void clear() {
        cache.clear();
    }
}
