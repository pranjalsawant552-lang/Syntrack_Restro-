package com.pos.app.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.pos.app.Entity.SettingMaster;
import com.pos.app.Service.ISettingMasterService;
import com.pos.app.config.ApiVersionConfig;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiVersionConfig.API_VERSION + "/setting")
public class SettingMasterController {

    private final ISettingMasterService settingService;

    // ✅ SINGLE SETTING FETCH
    @PreAuthorize("hasAuthority('PERM_SETTINGS_VIEW') or hasAuthority('PERM_SETTINGS_EDIT')")
    @GetMapping("/current")
    public ResponseEntity<?> getCurrent() {
        return settingService.getCurrentSetting();
    }

    // ✅ SINGLE SETTING UPSERT
    @PreAuthorize("hasAuthority('PERM_SETTINGS_EDIT')")
    @PutMapping("/current")
    public ResponseEntity<?> updateSetting(@RequestBody SettingMaster settingMaster) {
        try {
            SettingMaster saved = settingService.updateSetting(settingMaster);
            return ResponseEntity.ok(saved); // return object (better)
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Failed to update setting");
        }
    }
}
