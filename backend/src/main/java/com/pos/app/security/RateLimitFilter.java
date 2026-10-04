package com.pos.app.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Simple in-memory token-bucket rate limiter for the auth endpoints most attractive to
 * brute-force / enumeration attacks: login, forgot-password, and reset-password.
 * Keyed by (client IP + email if present) so one abusive IP can't lock out everyone
 * behind a shared NAT, while still capping attempts against any single account.
 *
 * In-memory is fine for a single instance; if this app is horizontally scaled behind a
 * load balancer, swap the bucket store for a shared one (e.g. Redis-backed Bucket4j).
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"");

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        boolean limited = path.equals("/v1/auth/login")
                || path.equals("/v1/auth/forgot-password")
                || path.equals("/v1/auth/reset-password");

        if (!limited) {
            filterChain.doFilter(request, response);
            return;
        }

        // Wrap so the body can be inspected here AND still be read in full by the
        // actual controller afterwards (see CachedBodyHttpServletRequest for why
        // Spring's own ContentCachingRequestWrapper doesn't support this).
        CachedBodyHttpServletRequest wrapped = new CachedBodyHttpServletRequest(request);
        String body = wrapped.getBodyAsString();

        String key = clientKey(request, body);
        Bucket bucket = buckets.computeIfAbsent(key, k -> newBucket());

        if (!bucket.tryConsume(1)) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Too many attempts. Please wait a minute and try again.\"}");
            return;
        }

        filterChain.doFilter(wrapped, response);
    }

    private Bucket newBucket() {
        // 8 attempts per minute, refilling gradually — generous enough for a real user
        // fumbling a password, restrictive enough to blunt brute-force/enumeration.
        Bandwidth limit = Bandwidth.classic(8, io.github.bucket4j.Refill.greedy(8, Duration.ofMinutes(1)));
        return Bucket.builder().addLimit(limit).build();
    }

    private String clientKey(HttpServletRequest request, String body) {
        String ip = clientIp(request);
        Matcher m = EMAIL_PATTERN.matcher(body);
        String email = m.find() ? m.group(1).toLowerCase().trim() : "";
        return ip + "|" + email;
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
