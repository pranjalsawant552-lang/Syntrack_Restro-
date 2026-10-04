package com.pos.app.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory token-bucket limiter for the public (no-login) QR endpoints, so nobody can flood a
 * restaurant with scans or orders. Buckets are keyed by an arbitrary string ("scan|1.2.3.4").
 *
 * Limits are deliberately generous per IP: on a restaurant's own Wi-Fi every guest shares one public
 * IP, so tight per-IP limits would lock out real customers. The per-DEVICE strike rules in
 * QrDiningService are what actually stop repeat fake scans.
 */
@Component
public class QrRateLimiter {

    private static final int MAX_BUCKETS = 20_000;

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    /** @return true if the call is allowed, false if the caller exceeded {@code perMinute}. */
    public boolean tryConsume(String key, int perMinute) {
        if (buckets.size() > MAX_BUCKETS) buckets.clear(); // crude memory guard against spoofed keys
        Bucket b = buckets.computeIfAbsent(key + "#" + perMinute, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(perMinute,
                        io.github.bucket4j.Refill.greedy(perMinute, Duration.ofMinutes(1))))
                .build());
        return b.tryConsume(1);
    }

    public static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
