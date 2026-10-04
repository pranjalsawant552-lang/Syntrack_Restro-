package com.pos.app.Controller;

import com.pos.app.Entity.SettingMaster;
import com.pos.app.Repository.SettingMasterRepository;
import com.pos.app.common.service.FileStorageService;
import com.pos.app.config.ApiVersionConfig;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/branding")
@RequiredArgsConstructor
@CrossOrigin
public class BrandingController {

    private final SettingMasterRepository settingMasterRepository;
    private final TenantRepository tenantRepository;
    private final FileStorageService fileStorageService;
    private final com.pos.app.common.service.AuditService auditService;

    /** For the already-logged-in tenant user: their own company's branding. */
    @GetMapping
    public ResponseEntity<?> getMyBranding() {
        List<SettingMaster> rows = settingMasterRepository.findAllOrdered();
        SettingMaster s = rows.isEmpty() ? new SettingMaster() : rows.get(0);
        return ResponseEntity.ok(Map.of(
                "appName", s.getAppName() != null ? s.getAppName() : (s.getCompanyName() != null ? s.getCompanyName() : "Syntrack Restro"),
                "logoUrl", s.getLogoUrl() != null ? s.getLogoUrl() : ""
        ));
    }

    /** For the login page, BEFORE authentication — resolves branding by company slug. */
    @GetMapping("/public")
    public ResponseEntity<?> getPublicBranding(@RequestParam(required = false) String slug) {
        if (slug == null || slug.isBlank()) {
            return ResponseEntity.ok(Map.of("appName", "Syntrack Restro", "logoUrl", ""));
        }
        try {
            Tenant tenant = tenantRepository.findBySlug(slug.trim().toLowerCase()).orElse(null);
            if (tenant == null || !tenant.isActive()) {
                return ResponseEntity.ok(Map.of("appName", "Syntrack Restro", "logoUrl", ""));
            }
            try {
                TenantContext.setCurrentTenant(tenant.getDbName());
                List<SettingMaster> rows = settingMasterRepository.findAllOrdered();
                SettingMaster s = rows.isEmpty() ? null : rows.get(0);
                String appName = (s != null && s.getAppName() != null) ? s.getAppName() : tenant.getName();
                String logoUrl = (s != null && s.getLogoUrl() != null) ? s.getLogoUrl() : (tenant.getLogoUrl() != null ? tenant.getLogoUrl() : "");
                return ResponseEntity.ok(Map.of("appName", appName, "logoUrl", logoUrl));
            } finally {
                TenantContext.clear();
            }
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("appName", "Syntrack Restro", "logoUrl", ""));
        }
    }

    @PreAuthorize("hasAuthority('PERM_SETTINGS_EDIT') or hasRole('SUPER_ADMIN')")
    @PutMapping
    public ResponseEntity<?> updateBranding(@RequestBody Map<String, String> body) {
        List<SettingMaster> rows = settingMasterRepository.findAllOrdered();
        SettingMaster s = rows.isEmpty() ? new SettingMaster() : rows.get(0);
        if (body.containsKey("appName")) s.setAppName(body.get("appName"));
        if (body.containsKey("logoUrl")) s.setLogoUrl(body.get("logoUrl"));
        SettingMaster saved = settingMasterRepository.save(s);
        auditService.log("BRANDING_UPDATED", "SettingMaster", String.valueOf(saved.getSettingId()),
                "Updated appName/logoUrl");
        return ResponseEntity.ok(Map.of(
                "appName", saved.getAppName() == null ? "" : saved.getAppName(),
                "logoUrl", saved.getLogoUrl() == null ? "" : saved.getLogoUrl()));
    }

    @PreAuthorize("hasAuthority('PERM_SETTINGS_EDIT') or hasRole('SUPER_ADMIN')")
    @PostMapping(value = "/logo", consumes = "multipart/form-data")
    public ResponseEntity<?> uploadLogo(@RequestParam("file") MultipartFile file) {
        try {
            List<SettingMaster> rows = settingMasterRepository.findAllOrdered();
            SettingMaster s = rows.isEmpty() ? new SettingMaster() : rows.get(0);
            String tenantKey = TenantContext.getCurrentTenant() != null ? TenantContext.getCurrentTenant() : "tenant";
            String url = fileStorageService.saveLogo(tenantKey, file);
            s.setLogoUrl(url);
            settingMasterRepository.save(s);
            return ResponseEntity.ok(Map.of("logoUrl", url));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to upload logo"));
        }
    }
}
