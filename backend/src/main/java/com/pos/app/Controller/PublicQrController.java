package com.pos.app.Controller;

import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Service.QrDiningService;
import com.pos.app.config.ApiVersionConfig;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.security.QrRateLimiter;
import com.pos.app.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.function.Supplier;

/**
 * Customer-facing QR ordering. NO LOGIN: the customer's only credentials are the table's QR token
 * (in the URL) and, after "Start ordering", their private session token (header X-QR-Session).
 *
 * There is intentionally no endpoint here for paying or settling a bill -- customers can only ask for
 * it; staff settle it in the normal POS flow.
 *
 * Because there's no JWT, this controller is what selects the tenant database: it resolves the company
 * slug from the URL and sets TenantContext around each call (same pattern as BrandingController's
 * public endpoint).
 */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/public/qr/{slug}")
public class PublicQrController {

    @Autowired private TenantRepository tenantRepository;
    @Autowired private QrDiningService qrService;
    @Autowired private QrRateLimiter limiter;

    private <T> T inTenant(String slug, Supplier<T> action) {
        Tenant tenant = tenantRepository.findBySlug(slug == null ? "" : slug.trim().toLowerCase())
                .filter(Tenant::isActive)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("This QR code isn't valid any more"));
        try {
            TenantContext.setCurrentTenant(tenant.getDbName());
            return action.get();
        } finally {
            TenantContext.clear();
        }
    }

    private static ResponseEntity<?> tooMany() {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("message", "Too many requests -- please wait a moment and try again.",
                        "error", "Too many requests -- please wait a moment and try again."));
    }

    /** Page load: just says which restaurant/table this QR is for. Creates nothing. */
    @GetMapping("/table/{qrToken}")
    public ResponseEntity<?> landing(@PathVariable String slug, @PathVariable String qrToken, HttpServletRequest http) {
        if (!limiter.tryConsume("landing|" + QrRateLimiter.clientIp(http), 60)) return tooMany();
        return ResponseEntity.ok(inTenant(slug, () -> qrService.landing(qrToken)));
    }

    /** "Start ordering": opens a short hold on the table and returns this phone's private session token. */
    @PostMapping("/table/{qrToken}/session")
    public ResponseEntity<?> start(@PathVariable String slug, @PathVariable String qrToken,
                                   @RequestHeader(value = "X-QR-Session", required = false) String existing,
                                   @RequestHeader(value = "X-QR-Device", required = false) String deviceId,
                                   HttpServletRequest http) {
        String ip = QrRateLimiter.clientIp(http);
        if (!limiter.tryConsume("scan|" + ip, 30)) return tooMany();
        return ResponseEntity.ok(inTenant(slug, () ->
                qrService.start(qrToken, existing, deviceId, ip, http.getHeader("User-Agent"))));
    }

    @GetMapping("/session")
    public ResponseEntity<?> session(@PathVariable String slug, @RequestHeader("X-QR-Session") String token,
                                     HttpServletRequest http) {
        if (!limiter.tryConsume("status|" + QrRateLimiter.clientIp(http), 120)) return tooMany();
        return ResponseEntity.ok(inTenant(slug, () -> qrService.session(token)));
    }

    @GetMapping("/menu")
    public ResponseEntity<?> menu(@PathVariable String slug, @RequestHeader("X-QR-Session") String token,
                                  HttpServletRequest http) {
        if (!limiter.tryConsume("menu|" + QrRateLimiter.clientIp(http), 60)) return tooMany();
        return ResponseEntity.ok(inTenant(slug, () -> qrService.menu(token)));
    }

    @GetMapping("/menu/{productId}/options")
    public ResponseEntity<?> options(@PathVariable String slug, @PathVariable Long productId,
                                     @RequestHeader("X-QR-Session") String token, HttpServletRequest http) {
        if (!limiter.tryConsume("options|" + QrRateLimiter.clientIp(http), 120)) return tooMany();
        return ResponseEntity.ok(inTenant(slug, () -> qrService.options(token, productId)));
    }

    @PostMapping("/orders")
    public ResponseEntity<?> submit(@PathVariable String slug, @RequestHeader("X-QR-Session") String token,
                                    @RequestBody QrDiningService.SubmitRequest req, HttpServletRequest http) {
        // per phone (session) AND per network, so one device can't spam and a shared Wi-Fi isn't starved
        if (!limiter.tryConsume("order-s|" + token, 12) || !limiter.tryConsume("order-ip|" + QrRateLimiter.clientIp(http), 120)) {
            return tooMany();
        }
        return ResponseEntity.ok(inTenant(slug, () -> qrService.submit(token, req)));
    }

    @PostMapping("/bill-request")
    public ResponseEntity<?> billRequest(@PathVariable String slug, @RequestHeader("X-QR-Session") String token,
                                         HttpServletRequest http) {
        if (!limiter.tryConsume("bill|" + token, 6)) return tooMany();
        return ResponseEntity.ok(inTenant(slug, () -> qrService.requestBill(token)));
    }
}
