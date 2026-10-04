package com.pos.app.Controller;

import com.pos.app.DTO.CreateRoleDTO;
import com.pos.app.DTO.RoleDTO;
import com.pos.app.Entity.Role;
import com.pos.app.Enum.Permission;
import com.pos.app.Repository.RoleRepository;
import com.pos.app.common.service.AuditService;
import com.pos.app.config.ApiVersionConfig;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Lets a Super Admin view and adjust RBAC (roles & their permissions) inside
 * any single tenant. This is a support/troubleshooting capability -- normal
 * day-to-day role management stays with each tenant's own TENANT_ADMIN via
 * /v1/roles. It matters here because a tenant admin can otherwise lock
 * themselves (or their whole team) out of a needed permission with no one
 * else able to fix it from inside that tenant.
 *
 * All endpoints require ROLE_SUPER_ADMIN, enforced at the path level in
 * SecurityConfig for /v1/superadmin/**.
 */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/superadmin")
@RequiredArgsConstructor
@CrossOrigin
public class SuperAdminRoleController {

    private final TenantRepository tenantRepository;
    private final RoleRepository roleRepository;
    private final AuditService auditService;

    private RoleDTO toDTO(Role r) {
        return RoleDTO.builder()
                .id(r.getId())
                .name(r.getName())
                .description(r.getDescription())
                .systemRole(r.isSystemRole())
                .permissions(r.getPermissions())
                .build();
    }

    /** All permission codes the UI can offer -- same list regardless of tenant. */
    @GetMapping("/permissions")
    public ResponseEntity<?> listAllPermissions() {
        return ResponseEntity.ok(Permission.ALL_CODES);
    }

    @GetMapping("/tenants/{tenantId}/roles")
    public ResponseEntity<?> listRoles(@PathVariable Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Tenant not found"));
        }

        try {
            TenantContext.setCurrentTenant(tenant.getDbName());
            return ResponseEntity.ok(roleRepository.findAll().stream().map(this::toDTO).toList());
        } finally {
            TenantContext.clear();
        }
    }

    @PutMapping("/tenants/{tenantId}/roles/{roleId}")
    public ResponseEntity<?> updateRolePermissions(
            @PathVariable Long tenantId,
            @PathVariable Long roleId,
            @RequestBody CreateRoleDTO request
    ) {
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Tenant not found"));
        }

        try {
            TenantContext.setCurrentTenant(tenant.getDbName());

            return roleRepository.findById(roleId).<ResponseEntity<?>>map(role -> {
                if (request.getPermissions() != null) {
                    role.setPermissions(request.getPermissions());
                }
                if (request.getDescription() != null) {
                    role.setDescription(request.getDescription());
                }
                Role saved = roleRepository.save(role);
                auditService.log("SUPERADMIN_ROLE_UPDATED", "Role", String.valueOf(saved.getId()),
                        "Super Admin updated permissions for role " + saved.getName() +
                        " in tenant " + tenant.getName());
                return ResponseEntity.ok(toDTO(saved));
            }).orElse(ResponseEntity.status(404).body(Map.of("message", "Role not found")));
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Grants one additional permission to a role without needing to send the
     * whole permission set -- convenient for the common "just unblock this one
     * action" support case shown in the UI.
     */
    @PostMapping("/tenants/{tenantId}/roles/{roleId}/grant")
    public ResponseEntity<?> grantPermission(
            @PathVariable Long tenantId,
            @PathVariable Long roleId,
            @RequestParam String permission
    ) {
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Tenant not found"));
        }
        if (!Arrays.asList(Permission.ALL_CODES).contains(permission)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Unknown permission code: " + permission));
        }

        try {
            TenantContext.setCurrentTenant(tenant.getDbName());

            return roleRepository.findById(roleId).<ResponseEntity<?>>map(role -> {
                Set<String> perms = new HashSet<>(
                        role.getPermissions() != null ? role.getPermissions() : Set.of());
                perms.add(permission);
                role.setPermissions(perms);
                Role saved = roleRepository.save(role);
                auditService.log("SUPERADMIN_ROLE_GRANT", "Role", String.valueOf(saved.getId()),
                        "Super Admin granted " + permission + " to role " + saved.getName() +
                        " in tenant " + tenant.getName());
                return ResponseEntity.ok(toDTO(saved));
            }).orElse(ResponseEntity.status(404).body(Map.of("message", "Role not found")));
        } finally {
            TenantContext.clear();
        }
    }
}
