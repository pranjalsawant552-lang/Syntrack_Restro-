package com.pos.app.Controller;

import com.pos.app.Service.QrDiningService;
import com.pos.app.config.ApiVersionConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

/**
 * Staff side of QR self-ordering: print/rotate table QR codes, accept or reject customer orders,
 * control session time, and switch the feature's settings. Customers never touch these -- they use
 * {@link PublicQrController}.
 */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/restaurant/qr")
public class QrAdminController {

    @Autowired
    private QrDiningService qrService;

    private static String who(Principal p) {
        return (p != null && p.getName() != null) ? p.getName() : "SYSTEM";
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_VIEW')")
    @GetMapping("/tables")
    public ResponseEntity<?> tables() {
        return ResponseEntity.ok(qrService.listQrTables());
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/tables/{tableId}/rotate")
    public ResponseEntity<?> rotate(@PathVariable Long tableId, Principal principal) {
        return ResponseEntity.ok(qrService.rotateToken(tableId, who(principal)));
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_VIEW')")
    @GetMapping("/settings")
    public ResponseEntity<?> settings() {
        return ResponseEntity.ok(qrService.settings());
    }

    @PreAuthorize("hasAuthority('PERM_SETTINGS_EDIT')")
    @PutMapping("/settings")
    public ResponseEntity<?> updateSettings(@RequestBody QrDiningService.SettingsRequest req) {
        return ResponseEntity.ok(qrService.updateSettings(req));
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_VIEW')")
    @GetMapping("/requests")
    public ResponseEntity<?> pending() {
        return ResponseEntity.ok(qrService.pendingRequests());
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/requests/{requestId}/approve")
    public ResponseEntity<?> approve(@PathVariable Long requestId, Principal principal) {
        return ResponseEntity.ok(qrService.approve(requestId, who(principal)));
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<?> reject(@PathVariable Long requestId, @RequestBody(required = false) Map<String, String> body,
                                    Principal principal) {
        String reason = body == null ? null : body.get("reason");
        return ResponseEntity.ok(qrService.reject(requestId, reason, who(principal)));
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/tables/{tableId}/extend")
    public ResponseEntity<?> extend(@PathVariable Long tableId, @RequestParam(defaultValue = "30") int minutes,
                                    Principal principal) {
        return ResponseEntity.ok(qrService.extend(tableId, minutes, who(principal)));
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/tables/{tableId}/end")
    public ResponseEntity<?> end(@PathVariable Long tableId, Principal principal) {
        return ResponseEntity.ok(qrService.endSessions(tableId, who(principal)));
    }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/tables/{tableId}/dismiss-bill-request")
    public ResponseEntity<?> dismissBill(@PathVariable Long tableId) {
        return ResponseEntity.ok(qrService.dismissBillRequest(tableId));
    }
}
