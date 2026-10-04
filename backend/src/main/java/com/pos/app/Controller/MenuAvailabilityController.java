package com.pos.app.Controller;

import com.pos.app.Service.MenuAvailabilityService;
import com.pos.app.config.ApiVersionConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Owner's "which dishes can customers order today" screen.
 *
 * Who may do what:
 *  - See the board: anyone who works the floor, kitchen or menu.
 *  - Turn dishes OFF: also the kitchen (they are the first to know "we're out of X").
 *  - Turn dishes back ON / reset: restaurant managers and menu editors only.
 */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/menu-availability")
public class MenuAvailabilityController {

    @Autowired
    private MenuAvailabilityService service;

    private static boolean has(Authentication a, String authority) {
        return a != null && a.getAuthorities().stream().anyMatch(g -> g.getAuthority().equals(authority));
    }

    private static boolean canFullyManage(Authentication a) {
        return has(a, "PERM_RESTAURANT_MANAGE") || has(a, "PERM_PRODUCT_EDIT");
    }

    private static String who(Authentication a) {
        return a == null || a.getName() == null ? "SYSTEM" : a.getName();
    }

    @PreAuthorize("hasAnyAuthority('PERM_RESTAURANT_VIEW','PERM_RESTAURANT_MANAGE','PERM_PRODUCT_VIEW','PERM_PRODUCT_EDIT','PERM_KITCHEN_VIEW')")
    @GetMapping
    public ResponseEntity<?> board() {
        return ResponseEntity.ok(service.board());
    }

    @PreAuthorize("hasAnyAuthority('PERM_RESTAURANT_MANAGE','PERM_PRODUCT_EDIT','PERM_KITCHEN_VIEW')")
    @PostMapping("/set")
    public ResponseEntity<?> set(@RequestBody MenuAvailabilityService.SetRequest req, Authentication auth) {
        if (!canFullyManage(auth) && !Boolean.FALSE.equals(req.available())) {
            throw new AccessDeniedException("Kitchen staff can mark dishes as out, but only a manager can turn them back on");
        }
        return ResponseEntity.ok(service.set(req, who(auth)));
    }

    /** Everything back on in one go (e.g. start of a new day). */
    @PreAuthorize("hasAnyAuthority('PERM_RESTAURANT_MANAGE','PERM_PRODUCT_EDIT')")
    @PostMapping("/reset")
    public ResponseEntity<?> reset(Authentication auth) {
        int n = service.clearAllOff(who(auth));
        return ResponseEntity.ok(Map.of("restored", n, "board", service.board()));
    }
}
