package com.pos.app.Controller;

import com.pos.app.DTO.inventory.InventoryDTO.*;
import com.pos.app.Service.InventoryService;
import com.pos.app.config.ApiVersionConfig;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Ingredient inventory: master data, goods receipt, wastage, stock count, ledger and alerts. */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/inventory")
public class InventoryController {

    @Autowired private InventoryService inventoryService;

    @PreAuthorize("hasAuthority('PERM_INVENTORY_VIEW')")
    @GetMapping("/ingredients")
    public List<IngredientView> list(@RequestParam(required = false) String search,
                                     @RequestParam(required = false) Boolean active) {
        return inventoryService.listIngredients(search, active);
    }

    @PreAuthorize("hasAuthority('PERM_INVENTORY_MANAGE')")
    @PostMapping("/ingredients")
    public ResponseEntity<IngredientView> create(@Valid @RequestBody IngredientRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.createIngredient(req));
    }

    @PreAuthorize("hasAuthority('PERM_INVENTORY_MANAGE')")
    @PutMapping("/ingredients/{id}")
    public IngredientView update(@PathVariable Long id, @Valid @RequestBody IngredientRequest req) {
        return inventoryService.updateIngredient(id, req);
    }

    @PreAuthorize("hasAuthority('PERM_INVENTORY_VIEW')")
    @GetMapping("/ingredients/{id}/batches")
    public List<BatchView> batches(@PathVariable Long id) {
        return inventoryService.listOpenBatches(id);
    }

    @PreAuthorize("hasAuthority('PERM_INVENTORY_MANAGE')")
    @PostMapping("/receive")
    public IngredientView receive(@Valid @RequestBody ReceiveRequest req) {
        return inventoryService.receive(req);
    }

    @PreAuthorize("hasAuthority('PERM_INVENTORY_ADJUST')")
    @PostMapping("/wastage")
    public IngredientView wastage(@Valid @RequestBody WastageRequest req) {
        return inventoryService.recordWastage(req);
    }

    @PreAuthorize("hasAuthority('PERM_INVENTORY_ADJUST')")
    @PostMapping("/adjust")
    public IngredientView adjust(@Valid @RequestBody AdjustRequest req) {
        return inventoryService.adjust(req);
    }

    @PreAuthorize("hasAuthority('PERM_INVENTORY_VIEW')")
    @GetMapping("/movements")
    public List<MovementView> movements(@RequestParam(required = false) Long ingredientId,
                                        @RequestParam(required = false) String type,
                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                        @RequestParam(defaultValue = "300") int limit) {
        return inventoryService.listMovements(ingredientId, type, from, to, limit);
    }

    @PreAuthorize("hasAuthority('PERM_INVENTORY_VIEW')")
    @GetMapping("/alerts")
    public AlertsView alerts(@RequestParam(defaultValue = "7") int days) {
        return inventoryService.alerts(days);
    }
}
