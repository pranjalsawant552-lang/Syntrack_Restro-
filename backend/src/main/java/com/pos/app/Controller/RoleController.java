package com.pos.app.Controller;

import com.pos.app.security.AuthUserCache;
import com.pos.app.DTO.CreateRoleDTO;
import com.pos.app.DTO.RoleDTO;
import com.pos.app.Entity.Role;
import com.pos.app.Enum.Permission;
import com.pos.app.Repository.RoleRepository;
import com.pos.app.Repository.UserRepository;
import com.pos.app.common.service.AuditService;
import com.pos.app.config.ApiVersionConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/roles")
@RequiredArgsConstructor
@CrossOrigin
public class RoleController {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final AuthUserCache authUserCache; // cleared whenever a role changes so permission edits apply at once

    private RoleDTO toDTO(Role r) {
        return RoleDTO.builder()
                .id(r.getId())
                .name(r.getName())
                .description(r.getDescription())
                .systemRole(r.isSystemRole())
                .permissions(r.getPermissions())
                .build();
    }

    @PreAuthorize("hasAuthority('PERM_ROLE_VIEW') or hasAuthority('PERM_USER_VIEW')")
    @GetMapping
    public ResponseEntity<?> listRoles() {
        return ResponseEntity.ok(roleRepository.findAll().stream().map(this::toDTO).toList());
    }

    /** All permission codes the UI can offer when building/editing a role. */
    @PreAuthorize("hasAuthority('PERM_ROLE_VIEW') or hasAuthority('PERM_ROLE_CREATE')")
    @GetMapping("/permissions")
    public ResponseEntity<?> listAllPermissions() {
        return ResponseEntity.ok(Permission.ALL_CODES);
    }

    @PreAuthorize("hasAuthority('PERM_ROLE_CREATE')")
    @PostMapping
    public ResponseEntity<?> createRole(@RequestBody CreateRoleDTO request) {
        if (request.getName() == null || request.getName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "name is required"));
        }
        if (roleRepository.existsByName(request.getName().trim())) {
            return ResponseEntity.status(409).body(Map.of("error", "A role with this name already exists"));
        }
        Role role = new Role();
        role.setName(request.getName().trim());
        role.setDescription(request.getDescription());
        role.setSystemRole(false);
        role.setPermissions(request.getPermissions() != null ? request.getPermissions() : java.util.Set.of());
        Role saved = roleRepository.save(role);
        authUserCache.clear();
        auditService.log("ROLE_CREATED", "Role", String.valueOf(saved.getId()), "Created role " + saved.getName());
        return ResponseEntity.ok(toDTO(saved));
    }

    @PreAuthorize("hasAuthority('PERM_ROLE_EDIT')")
    @PutMapping("/{id}")
    public ResponseEntity<?> updateRole(@PathVariable Long id, @RequestBody CreateRoleDTO request) {
        return roleRepository.findById(id).map(role -> {
            if (role.isSystemRole()) {
                return ResponseEntity.status(400).body(Map.of("error", "The TENANT_ADMIN system role cannot be edited"));
            }
            if (request.getDescription() != null) role.setDescription(request.getDescription());
            if (request.getPermissions() != null) role.setPermissions(request.getPermissions());
            Role saved = roleRepository.save(role);
            authUserCache.clear();
            auditService.log("ROLE_UPDATED", "Role", String.valueOf(saved.getId()), "Updated role " + saved.getName());
            return ResponseEntity.ok(toDTO(saved));
        }).orElse(ResponseEntity.status(404).body(Map.of("error", "Role not found")));
    }

    @PreAuthorize("hasAuthority('PERM_ROLE_DELETE')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRole(@PathVariable Long id) {
        return roleRepository.findById(id).map(role -> {
            if (role.isSystemRole()) {
                return ResponseEntity.status(400).body(Map.of("error", "The TENANT_ADMIN system role cannot be deleted"));
            }
            boolean inUse = userRepository.search(null, role.getName(), null,
                    org.springframework.data.domain.PageRequest.of(0, 1)).getTotalElements() > 0;
            if (inUse) {
                return ResponseEntity.status(400).body(Map.of("error", "Cannot delete a role that is assigned to users"));
            }
            auditService.log("ROLE_DELETED", "Role", String.valueOf(role.getId()), "Deleted role " + role.getName());
            roleRepository.delete(role);
            authUserCache.clear();
            return ResponseEntity.ok(Map.of("message", "Role deleted"));
        }).orElse(ResponseEntity.status(404).body(Map.of("error", "Role not found")));
    }
}
