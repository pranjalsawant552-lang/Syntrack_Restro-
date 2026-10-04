package com.pos.app.Controller;

import com.pos.app.security.AuthUserCache;
import com.pos.app.DTO.ChangePasswordDTO;
import com.pos.app.DTO.CreateUserDTO;
import com.pos.app.DTO.UpdateUserDTO;
import com.pos.app.DTO.UserResponseDTO;
import com.pos.app.Entity.Role;
import com.pos.app.Entity.User;
import com.pos.app.Repository.RoleRepository;
import com.pos.app.Repository.UserRepository;
import com.pos.app.common.service.AuditService;
import com.pos.app.common.service.EmailService;
import com.pos.app.common.util.PasswordPolicy;
import com.pos.app.config.ApiVersionConfig;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.entity.TenantUserIndex;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.master.repository.TenantUserIndexRepository;
import com.pos.app.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/users")
@RequiredArgsConstructor
@CrossOrigin
public class UserManagementController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final TenantRepository tenantRepository;
    private final TenantUserIndexRepository tenantUserIndexRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final AuditService auditService;
    private final AuthUserCache authUserCache; // cleared whenever a user changes (deactivate, role change, ...)


    /**
     * Convert User entity to response DTO.
     */
    private UserResponseDTO toDTO(User user) {

        return UserResponseDTO.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .role(user.getRole())
                .phoneNumber(user.getPhoneNumber())
                .active(user.isActive())
                .superAdmin(false)
                .permissions(
                        user.getRoleRef() != null
                                && user.getRoleRef().getPermissions() != null
                                ? List.copyOf(user.getRoleRef().getPermissions())
                                : List.of()
                )
                .build();
    }


    /**
     * List users with pagination, search, role, active status and sorting.
     */
    @PreAuthorize("hasAuthority('PERM_USER_VIEW')")
    @GetMapping
    public ResponseEntity<?> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {

        if (page < 0) {
            page = 0;
        }

        if (size <= 0) {
            size = 10;
        }

        /*
         * Parse sort safely.
         */
        String[] sortParts = sort.split(",");

        String sortField =
                sortParts.length > 0 && !sortParts[0].isBlank()
                        ? sortParts[0]
                        : "createdAt";

        Sort.Direction direction =
                sortParts.length > 1
                        && sortParts[1].equalsIgnoreCase("asc")
                        ? Sort.Direction.ASC
                        : Sort.Direction.DESC;

        /*
         * Prevent arbitrary/invalid properties from reaching Spring Data.
         *
         * Add more fields here if your frontend needs them.
         */
        List<String> allowedSortFields = List.of(
                "createdAt",
                "firstName",
                "lastName",
                "email",
                "role",
                "active"
        );

        if (!allowedSortFields.contains(sortField)) {
            sortField = "createdAt";
        }

        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(direction, sortField)
        );

        Page<User> result = userRepository.search(
                search,
                role,
                active,
                pageRequest
        );

        Map<String, Object> response = Map.of(
                "content",
                result.getContent()
                        .stream()
                        .map(this::toDTO)
                        .toList(),

                "totalElements",
                result.getTotalElements(),

                "totalPages",
                result.getTotalPages(),

                "page",
                page,

                "size",
                size
        );

        return ResponseEntity.ok(response);
    }


    /**
     * Get a single user.
     */
    @PreAuthorize("hasAuthority('PERM_USER_VIEW')")
    @GetMapping("/{id}")
    public ResponseEntity<?> getUser(
            @PathVariable Long id
    ) {

        User user = userRepository.findById(id).orElse(null);

        if (user == null) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "User not found"));
        }

        return ResponseEntity.ok(toDTO(user));
    }


    /**
     * Create a new tenant user.
     */
    @PreAuthorize("hasAuthority('PERM_USER_CREATE')")
    @PostMapping
    public ResponseEntity<?> createUser(
            @RequestBody CreateUserDTO request
    ) {

        try {

            if (request == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Request body is required"));
            }

            if (isBlank(request.getEmail())
                    || isBlank(request.getPassword())
                    || isBlank(request.getRoleName())) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error",
                                "email, password and roleName are required"
                        ));
            }

            /*
             * Validate password policy.
             */
            String policyError =
                    PasswordPolicy.validate(request.getPassword());

            if (policyError != null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", policyError));
            }

            String email =
                    request.getEmail()
                            .trim()
                            .toLowerCase();

            /*
             * Check tenant-local user.
             */
            if (userRepository.existsByEmail(email)) {

                return ResponseEntity.status(409)
                        .body(Map.of(
                                "error",
                                "A user with this email already exists in this company"
                        ));
            }

            /*
             * Check master login index.
             *
             * This prevents the same email from being registered
             * against another tenant.
             */
            if (tenantUserIndexRepository.existsByEmail(email)) {

                return ResponseEntity.status(409)
                        .body(Map.of(
                                "error",
                                "This email is already registered to another company"
                        ));
            }

            /*
             * Resolve current tenant.
             */
            String currentTenant =
                    TenantContext.getCurrentTenant();

            if (isBlank(currentTenant)) {
                return ResponseEntity.status(400)
                        .body(Map.of(
                                "error",
                                "Tenant context is not available"
                        ));
            }

            Tenant tenant =
                    tenantRepository
                            .findByDbName(currentTenant)
                            .orElse(null);

            if (tenant == null) {
                return ResponseEntity.status(400)
                        .body(Map.of(
                                "error",
                                "Tenant not resolved"
                        ));
            }

            /*
             * Enforce maximum user/seat limit.
             */
            if (tenant.getMaxUsers() != null) {

                long currentCount =
                        userRepository.count();

                if (currentCount >= tenant.getMaxUsers()) {

                    return ResponseEntity.status(403)
                            .body(Map.of(
                                    "error",
                                    "User limit reached ("
                                            + tenant.getMaxUsers()
                                            + "). Contact your platform admin to increase it."
                            ));
                }
            }

            /*
             * Resolve role.
             */
            Role role =
                    roleRepository
                            .findByName(request.getRoleName())
                            .orElse(null);

            if (role == null) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error",
                                "Unknown role: "
                                        + request.getRoleName()
                        ));
            }

            /*
             * Create user.
             */
            User user = new User();

            user.setFirstName(request.getFirstName());
            user.setLastName(request.getLastName());
            user.setEmail(email);
            user.setPhoneNumber(request.getPhoneNumber());

            user.setPassword(
                    passwordEncoder.encode(
                            request.getPassword()
                    )
            );

            user.setRole(role.getName());
            user.setRoleRef(role);
            user.setActive(true);

            User saved =
                    userRepository.save(user);
                    authUserCache.clear();

            /*
             * Keep master login index synchronized.
             */
            TenantUserIndex index =
                    new TenantUserIndex();

            index.setEmail(email);
            index.setTenantId(tenant.getId());
            index.setTenantSlug(tenant.getSlug());

            tenantUserIndexRepository.save(index);

            /*
             * Send welcome email.
             *
             * Do not include the actual password in the email.
             */
            emailService.sendUserWelcomeEmail(
                    email,
                    "Your login email is "
                            + email
                            + ". Use the password provided by your administrator to sign in, "
                            + "or use 'Forgot password' to set your own."
            );

            /*
             * Audit.
             */
            auditService.log(
                    "USER_CREATED",
                    "User",
                    String.valueOf(saved.getId()),
                    "Created user "
                            + email
                            + " with role "
                            + role.getName()
            );

            return ResponseEntity.ok(toDTO(saved));

        } catch (IllegalArgumentException | IllegalStateException e) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            e.getMessage() != null
                                    ? e.getMessage()
                                    : "Invalid request"
                    ));

        } catch (Exception e) {

            return ResponseEntity.status(500)
                    .body(Map.of(
                            "error",
                            "Failed to create user"
                    ));
        }
    }


    /**
     * Update an existing user.
     */
    @PreAuthorize("hasAuthority('PERM_USER_EDIT')")
    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(
            @PathVariable Long id,
            @RequestBody UpdateUserDTO request
    ) {

        User user =
                userRepository.findById(id).orElse(null);

        if (user == null) {

            return ResponseEntity.status(404)
                    .body(Map.of("error", "User not found"));
        }

        if (request == null) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "Request body is required"
                    ));
        }

        if (request.getFirstName() != null) {
            user.setFirstName(
                    request.getFirstName()
            );
        }

        if (request.getLastName() != null) {
            user.setLastName(
                    request.getLastName()
            );
        }

        if (request.getPhoneNumber() != null) {
            user.setPhoneNumber(
                    request.getPhoneNumber()
            );
        }

        /*
         * Update role if supplied.
         */
        if (request.getRoleName() != null
                && !request.getRoleName().isBlank()) {

            Role role =
                    roleRepository
                            .findByName(
                                    request.getRoleName()
                            )
                            .orElse(null);

            if (role == null) {

                return ResponseEntity.badRequest()
                        .body(Map.of(
                                "error",
                                "Unknown role: "
                                        + request.getRoleName()
                        ));
            }

            user.setRole(role.getName());
            user.setRoleRef(role);
        }

        User saved =
                userRepository.save(user);
                authUserCache.clear();

        auditService.log(
                "USER_UPDATED",
                "User",
                String.valueOf(id),
                "Updated user " + user.getEmail()
        );

        return ResponseEntity.ok(
                toDTO(saved)
        );
    }


    /**
     * Activate user.
     */
    @PreAuthorize("hasAuthority('PERM_USER_DEACTIVATE')")
    @PutMapping("/{id}/activate")
    public ResponseEntity<?> activateUser(
            @PathVariable Long id
    ) {

        ResponseEntity<?> response =
                setActive(id, true);

        if (response.getStatusCode().is2xxSuccessful()) {

            auditService.log(
                    "USER_ACTIVATED",
                    "User",
                    String.valueOf(id),
                    null
            );
        }

        return response;
    }


    /**
     * Deactivate user.
     *
     * Users cannot deactivate themselves.
     */
    @PreAuthorize("hasAuthority('PERM_USER_DEACTIVATE')")
    @PutMapping("/{id}/deactivate")
    public ResponseEntity<?> deactivateUser(
            @PathVariable Long id
    ) {

        String currentEmail =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication()
                        .getName();

        User user =
                userRepository.findById(id).orElse(null);

        if (user == null) {

            return ResponseEntity.status(404)
                    .body(Map.of(
                            "error",
                            "User not found"
                    ));
        }

        if (user.getEmail() != null
                && user.getEmail()
                .equalsIgnoreCase(currentEmail)) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "You cannot deactivate your own account"
                    ));
        }

        ResponseEntity<?> response =
                setActive(id, false);

        if (response.getStatusCode().is2xxSuccessful()) {

            auditService.log(
                    "USER_DEACTIVATED",
                    "User",
                    String.valueOf(id),
                    null
            );
        }

        return response;
    }


    /**
     * Bulk activate users.
     */
    @PreAuthorize("hasAuthority('PERM_USER_DEACTIVATE')")
    @PutMapping("/bulk-activate")
    public ResponseEntity<?> bulkActivate(
            @RequestBody List<Long> ids
    ) {

        return bulkSetActive(ids, true);
    }


    /**
     * Bulk deactivate users.
     *
     * The currently logged-in user is automatically excluded.
     */
    @PreAuthorize("hasAuthority('PERM_USER_DEACTIVATE')")
    @PutMapping("/bulk-deactivate")
    public ResponseEntity<?> bulkDeactivate(
            @RequestBody List<Long> ids
    ) {

        if (ids == null || ids.isEmpty()) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "No user ids provided"
                    ));
        }

        String currentEmail =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication()
                        .getName();

        List<Long> filteredIds =
                ids.stream()
                        .filter(id -> {

                            User user =
                                    userRepository
                                            .findById(id)
                                            .orElse(null);

                            return user != null
                                    && user.getEmail() != null
                                    && !user.getEmail()
                                    .equalsIgnoreCase(
                                            currentEmail
                                    );
                        })
                        .toList();

        if (filteredIds.isEmpty()) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "No eligible users to deactivate"
                    ));
        }

        return bulkSetActive(
                filteredIds,
                false
        );
    }


    /**
     * Bulk update active status.
     */
    private ResponseEntity<?> bulkSetActive(
            List<Long> ids,
            boolean active
    ) {

        if (ids == null || ids.isEmpty()) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "No user ids provided"
                    ));
        }

        int updated = 0;

        for (Long id : ids) {

            if (id == null) {
                continue;
            }

            User user =
                    userRepository
                            .findById(id)
                            .orElse(null);

            if (user == null) {
                continue;
            }

            user.setActive(active);

            userRepository.save(user);

            authUserCache.clear();

            updated++;
        }

        auditService.log(
                active
                        ? "USER_BULK_ACTIVATED"
                        : "USER_BULK_DEACTIVATED",
                "User",
                ids.toString(),
                updated + " user(s) updated"
        );

        return ResponseEntity.ok(
                Map.of(
                        "updated",
                        updated
                )
        );
    }


    /**
     * Set user active/inactive.
     *
     * This deliberately avoids Optional.map().orElse()
     * because the success and error responses have different
     * generic body types.
     */
    private ResponseEntity<?> setActive(
            Long id,
            boolean active
    ) {

        User user =
                userRepository.findById(id).orElse(null);

        if (user == null) {

            return ResponseEntity.status(404)
                    .body(Map.of(
                            "error",
                            "User not found"
                    ));
        }

        user.setActive(active);

        User saved =
                userRepository.save(user);
                authUserCache.clear();

        return ResponseEntity.ok(
                toDTO(saved)
        );
    }


    /**
     * Self-service password change for currently
     * authenticated tenant user.
     */
    @PostMapping("/me/change-password")
    public ResponseEntity<?> changeMyPassword(
            @RequestBody ChangePasswordDTO request
    ) {

        if (request == null) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "Request body is required"
                    ));
        }

        String currentEmail =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication()
                        .getName();

        User user =
                userRepository
                        .findByEmail(currentEmail)
                        .orElse(null);

        if (user == null) {

            return ResponseEntity.status(404)
                    .body(Map.of(
                            "error",
                            "User not found"
                    ));
        }

        /*
         * Validate current password.
         */
        if (isBlank(request.getCurrentPassword())
                || !passwordEncoder.matches(
                request.getCurrentPassword(),
                user.getPassword()
        )) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "Current password is incorrect"
                    ));
        }

        /*
         * Validate new password.
         */
        if (isBlank(request.getNewPassword())) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "New password is required"
                    ));
        }

        String policyError =
                PasswordPolicy.validate(
                        request.getNewPassword()
                );

        if (policyError != null) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            policyError
                    ));
        }

        /*
         * Do not allow the same password.
         */
        if (passwordEncoder.matches(
                request.getNewPassword(),
                user.getPassword()
        )) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "New password must be different from the current password"
                    ));
        }

        user.setPassword(
                passwordEncoder.encode(
                        request.getNewPassword()
                )
        );

        user.setTokenVersion(
                user.getTokenVersion() + 1
        );

        userRepository.save(user);

        authUserCache.clear();

        auditService.log(
                "PASSWORD_CHANGED",
                "User",
                String.valueOf(user.getId()),
                "User changed their password"
        );

        return ResponseEntity.ok(
                Map.of(
                        "message",
                        "Password changed. Please login again."
                )
        );
    }


    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}

