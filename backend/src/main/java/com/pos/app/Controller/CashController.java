package com.pos.app.Controller;

import java.security.Principal;
import java.time.LocalDate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.pos.app.Service.CashService;
import com.pos.app.Service.CashService.*;
import com.pos.app.config.ApiVersionConfig;

/** Cash drawer shifts: open with a float, record petty cash, close with a count and see the variance. */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/cash")
public class CashController {

    @Autowired private CashService cashService;

    private String username(Principal p) {
        return (p != null && p.getName() != null) ? p.getName() : "SYSTEM";
    }

    /** The open shift with live totals, or an empty body (HTTP 204) when the till is closed. */
    @PreAuthorize("hasAuthority('PERM_CASH_VIEW')")
    @GetMapping("/shifts/current")
    public ResponseEntity<?> current() {
        ShiftView v = cashService.current();
        return v == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(v);
    }

    @PreAuthorize("hasAuthority('PERM_CASH_VIEW')")
    @GetMapping("/shifts")
    public ResponseEntity<?> history(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                     @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(cashService.history(from, to));
    }

    @PreAuthorize("hasAuthority('PERM_CASH_VIEW')")
    @GetMapping("/shifts/{shiftId}")
    public ResponseEntity<?> get(@PathVariable Long shiftId) {
        return ResponseEntity.ok(cashService.get(shiftId));
    }

    @PreAuthorize("hasAuthority('PERM_CASH_MANAGE')")
    @PostMapping("/shifts/open")
    public ResponseEntity<?> open(@RequestBody OpenRequest body, Principal principal) {
        return ResponseEntity.status(201).body(cashService.open(body, username(principal)));
    }

    @PreAuthorize("hasAuthority('PERM_CASH_MANAGE')")
    @PostMapping("/shifts/{shiftId}/movements")
    public ResponseEntity<?> movement(@PathVariable Long shiftId, @RequestBody MovementRequest body, Principal principal) {
        return ResponseEntity.ok(cashService.addMovement(shiftId, body, username(principal)));
    }

    @PreAuthorize("hasAuthority('PERM_CASH_MANAGE')")
    @PostMapping("/shifts/{shiftId}/close")
    public ResponseEntity<?> close(@PathVariable Long shiftId, @RequestBody CloseRequest body, Principal principal) {
        return ResponseEntity.ok(cashService.close(shiftId, body, username(principal)));
    }
}
