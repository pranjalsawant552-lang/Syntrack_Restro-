package com.pos.app.Controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.pos.app.Service.MenuOptionsService;
import com.pos.app.Service.MenuOptionsService.*;
import com.pos.app.config.ApiVersionConfig;

/** Variants (Half/Full), modifier groups (add-ons) and combos for menu items. */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/menu-options")
public class MenuOptionsController {

    @Autowired private MenuOptionsService service;

    /** What a waiter can choose on one item (active options only) -- used by the order screen. */
    @PreAuthorize("hasAnyAuthority('PERM_PRODUCT_VIEW','PERM_RESTAURANT_VIEW','PERM_RESTAURANT_MANAGE')")
    @GetMapping("/products/{productId}")
    public ResponseEntity<?> forProduct(@PathVariable Long productId,
                                        @RequestParam(defaultValue = "false") boolean includeInactive) {
        return ResponseEntity.ok(service.getForProduct(productId, !includeInactive));
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_EDIT')")
    @PutMapping("/products/{productId}/variants")
    public ResponseEntity<?> setVariants(@PathVariable Long productId, @RequestBody List<VariantRequest> body) {
        return ResponseEntity.ok(service.setVariants(productId, body));
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_EDIT')")
    @PutMapping("/products/{productId}/modifier-groups")
    public ResponseEntity<?> setGroups(@PathVariable Long productId, @RequestBody List<Long> groupIds) {
        return ResponseEntity.ok(service.setModifierGroups(productId, groupIds));
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_EDIT')")
    @PutMapping("/products/{productId}/combo")
    public ResponseEntity<?> setCombo(@PathVariable Long productId, @RequestBody List<ComboRequest> body) {
        return ResponseEntity.ok(service.setCombo(productId, body));
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_VIEW')")
    @GetMapping("/groups")
    public ResponseEntity<?> listGroups() {
        return ResponseEntity.ok(service.listGroups());
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_CREATE')")
    @PostMapping("/groups")
    public ResponseEntity<?> createGroup(@RequestBody GroupRequest body) {
        return ResponseEntity.status(201).body(service.createGroup(body));
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_EDIT')")
    @PutMapping("/groups/{groupId}")
    public ResponseEntity<?> updateGroup(@PathVariable Long groupId, @RequestBody GroupRequest body) {
        return ResponseEntity.ok(service.updateGroup(groupId, body));
    }

    @PreAuthorize("hasAuthority('PERM_PRODUCT_EDIT')")
    @DeleteMapping("/groups/{groupId}")
    public ResponseEntity<?> deleteGroup(@PathVariable Long groupId) {
        service.deleteGroup(groupId);
        return ResponseEntity.ok("Modifier group deleted");
    }
}
