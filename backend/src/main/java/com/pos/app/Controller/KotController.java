package com.pos.app.Controller;

import com.pos.app.DTO.inventory.KotDTO.*;
import com.pos.app.Service.KotService;
import com.pos.app.config.ApiVersionConfig;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Kitchen stations and live KOT tickets (New -> Preparing -> Ready -> Served). */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/kot")
public class KotController {

    @Autowired private KotService kotService;

    @PreAuthorize("hasAuthority('PERM_KITCHEN_VIEW')")
    @GetMapping("/stations")
    public List<StationView> stations() { return kotService.listStations(); }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PostMapping("/stations")
    public StationView createStation(@Valid @RequestBody StationRequest req) { return kotService.saveStation(null, req); }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PutMapping("/stations/{id}")
    public StationView updateStation(@PathVariable Long id, @Valid @RequestBody StationRequest req) { return kotService.saveStation(id, req); }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @GetMapping("/product-stations")
    public List<MappingView> mappings() { return kotService.listMappings(); }

    @PreAuthorize("hasAuthority('PERM_RESTAURANT_MANAGE')")
    @PutMapping("/product-stations/{productId}")
    public void assign(@PathVariable Long productId, @RequestBody ProductStationRequest req) {
        kotService.assignProduct(productId, req.stationId());
    }

    @PreAuthorize("hasAuthority('PERM_KITCHEN_VIEW')")
    @GetMapping("/active")
    public List<KotView> active(@RequestParam(required = false) Long stationId) { return kotService.listActive(stationId); }

    // waiters on the tables screen read this to show Preparing / Ready next to each item
    @PreAuthorize("hasAuthority('PERM_KITCHEN_VIEW') or hasAuthority('PERM_RESTAURANT_VIEW') or hasAuthority('PERM_RESTAURANT_MANAGE')")
    @GetMapping("/order/{orderId}")
    public List<KotView> forOrder(@PathVariable Long orderId) { return kotService.forOrder(orderId); }

    @PreAuthorize("hasAuthority('PERM_KITCHEN_VIEW')")
    @PostMapping("/{kotId}/start")
    public KotView start(@PathVariable Long kotId) { return kotService.start(kotId); }

    @PreAuthorize("hasAuthority('PERM_KITCHEN_VIEW')")
    @PostMapping("/{kotId}/ready")
    public KotView ready(@PathVariable Long kotId) { return kotService.ready(kotId); }

    @PreAuthorize("hasAuthority('PERM_KITCHEN_VIEW')")
    @PostMapping("/items/{kotItemId}/status")
    public KotView setItemStatus(@PathVariable Long kotItemId, @RequestParam String status) {
        return kotService.setItemStatus(kotItemId, status);
    }
}
