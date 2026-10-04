package com.pos.app.Controller;

import com.pos.app.Entity.SettingMaster;
import com.pos.app.Repository.CustomerRepository;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Repository.SalesInvoiceMasterRepository;
import com.pos.app.Repository.SettingMasterRepository;
import com.pos.app.Repository.UserRepository;
import com.pos.app.common.service.AuditService;
import com.pos.app.common.util.PasswordPolicy;
import com.pos.app.config.ApiVersionConfig;
import com.pos.app.master.dto.CreateTenantDTO;
import com.pos.app.master.dto.TenantResponseDTO;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.master.service.TenantProvisioningService;
import com.pos.app.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * All endpoints here require ROLE_SUPER_ADMIN.
 *
 * Security for /v1/superadmin/** should be configured in SecurityConfig.
 */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/superadmin/tenants")
@RequiredArgsConstructor
@CrossOrigin
public class SuperAdminController {

    private final TenantRepository tenantRepository;
    private final TenantProvisioningService provisioningService;

    private final SettingMasterRepository settingMasterRepository;

    private final AuditService auditService;

    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final SalesInvoiceMasterRepository salesInvoiceMasterRepository;


    /**
     * Convert Tenant entity to response DTO.
     */
    private TenantResponseDTO toDTO(Tenant tenant) {
        return TenantResponseDTO.builder()
                .id(tenant.getId())
                .name(tenant.getName())
                .slug(tenant.getSlug())
                .contactEmail(tenant.getContactEmail())
                .contactPhone(tenant.getContactPhone())
                .logoUrl(tenant.getLogoUrl())
                .active(tenant.isActive())
                .maxUsers(tenant.getMaxUsers())
                .maxProducts(tenant.getMaxProducts())
                .createdAt(tenant.getCreatedAt())
                .build();
    }


    /**
     * Create a new tenant and provision its admin user/database.
     */
    @PostMapping
    public ResponseEntity<?> createTenant(
            @RequestBody CreateTenantDTO request
    ) {

        try {

            if (request == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Request body is required"));
            }

            if (isBlank(request.getCompanyName())
                    || isBlank(request.getSlug())
                    || isBlank(request.getAdminEmail())
                    || isBlank(request.getAdminPassword())) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error",
                                "companyName, slug, adminEmail and adminPassword are required"
                        ));
            }

            String policyError =
                    PasswordPolicy.validate(request.getAdminPassword());

            if (policyError != null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", policyError));
            }

            TenantProvisioningService.TenantAdminSeed seed =
                    new TenantProvisioningService.TenantAdminSeed();

            seed.firstName = request.getAdminFirstName();
            seed.lastName = request.getAdminLastName();
            seed.email = request.getAdminEmail().trim();
            seed.password = request.getAdminPassword();
            seed.phoneNumber = request.getAdminPhoneNumber();

            String companyName = request.getCompanyName().trim();

            String slug = request.getSlug()
                    .trim()
                    .toLowerCase();

            Tenant tenant = provisioningService.provisionTenant(
                    companyName,
                    slug,
                    request.getContactEmail(),
                    request.getContactPhone(),
                    seed
            );

            auditService.log(
                    "TENANT_CREATED",
                    "Tenant",
                    String.valueOf(tenant.getId()),
                    "Onboarded company "
                            + tenant.getName()
                            + " ("
                            + tenant.getSlug()
                            + ")"
            );

            return ResponseEntity.ok(toDTO(tenant));

        } catch (IllegalArgumentException e) {

            return ResponseEntity.status(409)
                    .body(Map.of("error", e.getMessage()));

        } catch (Exception e) {

            return ResponseEntity.status(500)
                    .body(Map.of(
                            "error",
                            "Failed to create tenant: " + e.getMessage()
                    ));
        }
    }


    /**
     * List tenants with pagination, optional search and active filter.
     */
    @GetMapping
    public ResponseEntity<?> listTenants(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active
    ) {

        if (page < 0) {
            page = 0;
        }

        if (size <= 0) {
            size = 10;
        }

        Page<Tenant> tenants = tenantRepository.findAll(
                PageRequest.of(
                        page,
                        size,
                        Sort.by("createdAt").descending()
                )
        );

        String searchValue =
                search == null ? "" : search.trim().toLowerCase();

        List<TenantResponseDTO> filtered = tenants.getContent()
                .stream()
                .filter(t -> {

                    if (searchValue.isBlank()) {
                        return true;
                    }

                    String name =
                            t.getName() == null
                                    ? ""
                                    : t.getName().toLowerCase();

                    String slug =
                            t.getSlug() == null
                                    ? ""
                                    : t.getSlug().toLowerCase();

                    return name.contains(searchValue)
                            || slug.contains(searchValue);
                })
                .filter(t ->
                        active == null
                                || t.isActive() == active
                )
                .map(this::toDTO)
                .toList();

        Map<String, Object> response = new HashMap<>();

        response.put("content", filtered);
        response.put("totalElements", tenants.getTotalElements());
        response.put("totalPages", tenants.getTotalPages());
        response.put("page", page);
        response.put("size", size);

        return ResponseEntity.ok(response);
    }


    /**
     * Get one tenant.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getTenant(
            @PathVariable Long id
    ) {

        Tenant tenant = tenantRepository.findById(id).orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "Tenant not found"));
        }

        return ResponseEntity.ok(toDTO(tenant));
    }


    /**
     * Repairs ONE tenant's schema so it matches the current entity model — e.g. after
     * a deploy adds a new column/table to an entity. This runs Hibernate's additive-only
     * "update" DDL (never drops or renames anything) against that single tenant's own
     * dedicated database connection, so it can never touch any other tenant or the
     * master DB. Safe to call on an already-up-to-date tenant — it's a no-op.
     *
     * Use this instead of hand-writing ALTER TABLE statements after shipping an entity
     * change: call it once per tenant (or use /repair-schema-all below) right after
     * deploying the new backend build.
     */
    @PutMapping("/{id}/repair-schema")
    public ResponseEntity<?> repairTenantSchema(
            @PathVariable Long id
    ) {

        Tenant tenant = tenantRepository.findById(id).orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "Tenant not found"));
        }

        try {

            provisioningService.repairTenantSchema(tenant);

            auditService.log(
                    "TENANT_SCHEMA_REPAIRED",
                    "Tenant",
                    String.valueOf(id),
                    "Schema repaired for " + tenant.getName()
            );

            return ResponseEntity.ok(
                    Map.of("message", "Schema for '" + tenant.getName() + "' is up to date")
            );

        } catch (Exception e) {

            return ResponseEntity.status(500)
                    .body(Map.of(
                            "error",
                            "Failed to repair schema for '" + tenant.getName() + "': " + e.getMessage()
                    ));
        }
    }


    /**
     * Repairs EVERY tenant's schema in one call — the one-click step to run once,
     * right after deploying a backend build that added new entity fields/tables, so
     * every existing tenant's database picks up the change without any manual SQL.
     * Each tenant is repaired independently; if one fails (e.g. temporarily
     * unreachable), the rest still proceed and the failure is reported back.
     */
    @PutMapping("/repair-schema-all")
    public ResponseEntity<?> repairAllTenantSchemas() {

        TenantProvisioningService.SchemaRepairResult result = provisioningService.repairAllTenantSchemas();

        auditService.log(
                "TENANT_SCHEMA_REPAIRED_ALL",
                "Tenant",
                "ALL",
                result.repaired().size() + " tenant(s) repaired, " + result.failed().size() + " failed"
        );

        Map<String, Object> body = new HashMap<>();
        body.put("repaired", result.repaired());
        body.put("failed", result.failed());
        body.put("message", result.repaired().size() + " tenant(s) repaired"
                + (result.failed().isEmpty() ? "" : ", " + result.failed().size() + " failed — see 'failed'"));

        return result.failed().isEmpty() ? ResponseEntity.ok(body) : ResponseEntity.status(207).body(body);
    }


    /**
     * Activate tenant.
     */
    @PutMapping("/{id}/activate")
    public ResponseEntity<?> activateTenant(
            @PathVariable Long id
    ) {

        return setTenantActive(id, true);
    }


    /**
     * Deactivate tenant.
     */
    @PutMapping("/{id}/deactivate")
    public ResponseEntity<?> deactivateTenant(
            @PathVariable Long id
    ) {

        return setTenantActive(id, false);
    }


    /**
     * Set tenant active/inactive.
     */
    private ResponseEntity<?> setTenantActive(
            Long id,
            boolean active
    ) {

        Tenant tenant = tenantRepository.findById(id).orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "Tenant not found"));
        }

        tenant.setActive(active);

        tenantRepository.save(tenant);

        auditService.log(
                active
                        ? "TENANT_ACTIVATED"
                        : "TENANT_DEACTIVATED",
                "Tenant",
                String.valueOf(id),
                tenant.getName()
        );

        return ResponseEntity.ok(toDTO(tenant));
    }


    /**
     * Update tenant limits.
     *
     * Null can be used to clear the limit and make it unlimited.
     *
     * Example:
     *
     * {
     *   "maxUsers": 50,
     *   "maxProducts": 1000
     * }
     */
    @PutMapping("/{id}/limits")
    public ResponseEntity<?> updateLimits(
            @PathVariable Long id,
            @RequestBody Map<String, Integer> body
    ) {

        Tenant tenant = tenantRepository.findById(id).orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "Tenant not found"));
        }

        if (body == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Request body is required"));
        }

        if (body.containsKey("maxUsers")) {
            tenant.setMaxUsers(body.get("maxUsers"));
        }

        if (body.containsKey("maxProducts")) {
            tenant.setMaxProducts(body.get("maxProducts"));
        }

        tenantRepository.save(tenant);

        auditService.log(
                "TENANT_LIMITS_UPDATED",
                "Tenant",
                String.valueOf(id),
                "maxUsers="
                        + tenant.getMaxUsers()
                        + ", maxProducts="
                        + tenant.getMaxProducts()
        );

        return ResponseEntity.ok(toDTO(tenant));
    }


    /**
     * Get usage snapshot for a tenant.
     */
    @GetMapping("/{id}/usage")
    public ResponseEntity<?> getUsage(
            @PathVariable Long id
    ) {

        Tenant tenant = tenantRepository.findById(id).orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "Tenant not found"));
        }

        try {

            TenantContext.setCurrentTenant(
                    tenant.getDbName()
            );

            long userCount =
                    userRepository.count();

            long productCount =
                    productRepository.count();

            long customerCount =
                    customerRepository.count();

            long invoiceCount =
                    salesInvoiceMasterRepository.count();

            Map<String, Object> usage =
                    new HashMap<>();

            usage.put("userCount", userCount);
            usage.put("maxUsers", tenant.getMaxUsers());

            usage.put("productCount", productCount);
            usage.put("maxProducts", tenant.getMaxProducts());

            usage.put("customerCount", customerCount);
            usage.put("invoiceCount", invoiceCount);

            return ResponseEntity.ok(usage);

        } finally {

            TenantContext.clear();
        }
    }


    /**
     * Permanently delete a tenant.
     *
     * This operation is irreversible.
     *
     * confirm=true is required.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTenant(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean confirm
    ) {

        if (!confirm) {
            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "This permanently deletes all of the tenant's data. "
                                    + "Pass confirm=true to proceed."
                    ));
        }

        Tenant tenant = tenantRepository.findById(id).orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "Tenant not found"));
        }

        String name = tenant.getName();

        try {

            provisioningService.deprovisionTenant(tenant);

            auditService.log(
                    "TENANT_DELETED",
                    "Tenant",
                    String.valueOf(id),
                    "Permanently deleted " + name
            );

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            "Tenant '" + name + "' permanently deleted"
                    )
            );

        } catch (Exception e) {

            return ResponseEntity.status(500)
                    .body(Map.of(
                            "error",
                            "Failed to delete tenant: "
                                    + e.getMessage()
                    ));
        }
    }


    /**
     * Update tenant branding.
     *
     * Updates both:
     * 1. Master Tenant record
     * 2. Tenant's SettingMaster record
     */
    @PutMapping("/{id}/branding")
    public ResponseEntity<?> updateTenantBranding(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {

        Tenant tenant = tenantRepository.findById(id).orElse(null);

        if (tenant == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "Tenant not found"));
        }

        if (body == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Request body is required"));
        }

        /*
         * Update master Tenant record.
         */
        if (body.containsKey("name")) {

            String name = body.get("name");

            if (name != null && !name.isBlank()) {
                tenant.setName(name.trim());
            }
        }

        if (body.containsKey("logoUrl")) {

            String logoUrl = body.get("logoUrl");

            tenant.setLogoUrl(
                    logoUrl == null || logoUrl.isBlank()
                            ? null
                            : logoUrl.trim()
            );
        }

        tenantRepository.save(tenant);


        /*
         * Update tenant database SettingMaster.
         */
        try {

            TenantContext.setCurrentTenant(
                    tenant.getDbName()
            );

            List<SettingMaster> rows =
                    settingMasterRepository.findAllOrdered();

            SettingMaster settings;

            if (rows.isEmpty()) {
                settings = new SettingMaster();
            } else {
                settings = rows.get(0);
            }

            if (body.containsKey("name")) {

                String name = body.get("name");

                if (name != null && !name.isBlank()) {

                    settings.setAppName(name.trim());

                    if (settings.getCompanyName() == null
                            || settings.getCompanyName().isBlank()) {

                        settings.setCompanyName(name.trim());
                    }
                }
            }

            if (body.containsKey("logoUrl")) {

                String logoUrl = body.get("logoUrl");

                settings.setLogoUrl(
                        logoUrl == null || logoUrl.isBlank()
                                ? null
                                : logoUrl.trim()
                );
            }

            settingMasterRepository.save(settings);

        } finally {

            TenantContext.clear();
        }

        return ResponseEntity.ok(toDTO(tenant));
    }


    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}