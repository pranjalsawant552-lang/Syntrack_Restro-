package com.pos.app.ServiceImpl;

import com.pos.app.security.AuthUserCache;
import com.pos.app.DTO.*;
import com.pos.app.Entity.PasswordResetToken;
import com.pos.app.Entity.User;
import com.pos.app.Repository.PasswordResetTokenRepository;
import com.pos.app.Repository.UserRepository;
import com.pos.app.Service.IAuthService;
import com.pos.app.common.service.EmailService;
import com.pos.app.master.entity.SuperAdmin;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.entity.TenantUserIndex;
import com.pos.app.master.repository.SuperAdminRepository;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.master.repository.TenantUserIndexRepository;
import com.pos.app.security.JwtService;
import com.pos.app.tenant.TenantContext;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService implements IAuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    private final SuperAdminRepository superAdminRepository;
    private final TenantRepository tenantRepository;
    private final TenantUserIndexRepository tenantUserIndexRepository;
    private final EmailService emailService;
    private final AuthUserCache authUserCache;

    @org.springframework.beans.factory.annotation.Value("${app.frontend.base-url}")
    private String frontendBaseUrl;

    private UserResponseDTO toUserResponse(User u, Tenant tenant) {
        return UserResponseDTO.builder()
                .id(u.getId())
                .firstName(u.getFirstName())
                .lastName(u.getLastName())
                .email(u.getEmail())
                .role(u.getRole())
                .phoneNumber(u.getPhoneNumber())
                .active(u.isActive())
                .superAdmin(false)
                .tenantName(tenant != null ? tenant.getName() : null)
                .tenantSlug(tenant != null ? tenant.getSlug() : null)
                .permissions(u.getRoleRef() != null ? List.copyOf(u.getRoleRef().getPermissions()) : List.of())
                .build();
    }

    private UserResponseDTO toSuperAdminResponse(SuperAdmin sa) {
        return UserResponseDTO.builder()
                .id(sa.getId())
                .firstName(sa.getFirstName())
                .lastName(sa.getLastName())
                .email(sa.getEmail())
                .role("SUPER_ADMIN")
                .active(sa.isActive())
                .superAdmin(true)
                .permissions(List.of())
                .build();
    }

    @Override
    public ResponseEntity<?> loginUser(LoginRequestDTO request, HttpServletResponse response) {
        try {
            if (request.getEmail() == null || request.getPassword() == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "email and password required"));
            }
            String email = request.getEmail().trim().toLowerCase();

            // 1) Try Super Admin first (master DB, no tenant context needed)
            Optional<SuperAdmin> superAdminOpt = superAdminRepository.findByEmail(email);
            if (superAdminOpt.isPresent()) {
                SuperAdmin sa = superAdminOpt.get();
                if (!sa.isActive()) {
                    return ResponseEntity.status(403).body(Map.of("error", "Super admin account is deactivated"));
                }
                if (!passwordEncoder.matches(request.getPassword(), sa.getPassword())) {
                    return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
                }
                String token = jwtService.generateSuperAdminToken(sa);
                return ResponseEntity.ok(new AuthResponseDTO(token, toSuperAdminResponse(sa)));
            }

            // 2) Resolve tenant for a regular user
            Tenant tenant = resolveTenant(email, request.getCompanySlug());
            if (tenant == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
            }
            if (!tenant.isActive()) {
                return ResponseEntity.status(403).body(Map.of("error", "Your company's account has been suspended"));
            }

            try {
                TenantContext.setCurrentTenant(tenant.getDbName());

                User user = userRepository.findByEmail(email).orElse(null);
                if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                    return ResponseEntity.status(401).body(Map.of("error", "Invalid email or password"));
                }
                if (!user.isActive()) {
                    return ResponseEntity.status(403).body(Map.of("error", "Your account has been deactivated. Contact your admin."));
                }

                String token = jwtService.generateToken(user, tenant.getDbName(), tenant.getSlug());
                return ResponseEntity.ok(new AuthResponseDTO(token, toUserResponse(user, tenant)));
            } finally {
                TenantContext.clear();
            }

        } catch (Exception e) {
            log.error("Login failed for email={}", request.getEmail(), e);
            return ResponseEntity.status(500).body(Map.of("error", "Login failed"));
        }
    }

    /** Self-service signup is disabled — tenants are onboarded by Super Admin, users are created by Tenant Admin. */
    @Override
    public ResponseEntity<?> signupUser(SignupRequestDTO request) {
        return ResponseEntity.status(403).body(Map.of("error",
                "Self-service signup is disabled. Ask your company administrator to create your account."));
    }

    @Override
    public ResponseEntity<?> refreshToken(String authorizationHeader) {
        try {
            if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
                return ResponseEntity.status(401).body(Map.of("error", "Authorization Bearer token missing"));
            }
            String oldToken = authorizationHeader.substring(7).trim();
            if (oldToken.isBlank()) {
                return ResponseEntity.status(401).body(Map.of("error", "Token is blank"));
            }

            String email = jwtService.extractUsername(oldToken);

            if (jwtService.extractIsSuperAdmin(oldToken)) {
                SuperAdmin sa = superAdminRepository.findByEmail(email)
                        .orElseThrow(() -> new RuntimeException("Super admin not found"));
                String newToken = jwtService.generateSuperAdminToken(sa);
                return ResponseEntity.ok(new AuthResponseDTO(newToken, toSuperAdminResponse(sa)));
            }

            String tenantDbKey = jwtService.extractTenantDbKey(oldToken);
            if (tenantDbKey == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
            }
            Tenant tenant = tenantRepository.findAll().stream()
                    .filter(t -> t.getDbName().equals(tenantDbKey)).findFirst()
                    .orElseThrow(() -> new RuntimeException("Tenant not found"));

            try {
                TenantContext.setCurrentTenant(tenantDbKey);
                User user = userRepository.findByEmail(email)
                        .orElseThrow(() -> new RuntimeException("User not found"));
                if (!user.isActive()) {
                    return ResponseEntity.status(403).body(Map.of("error", "Account is deactivated"));
                }
                String newToken = jwtService.generateToken(user, tenant.getDbName(), tenant.getSlug());
                return ResponseEntity.ok(new AuthResponseDTO(newToken, toUserResponse(user, tenant)));
            } finally {
                TenantContext.clear();
            }

        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Token expired, please login again"));
        } catch (io.jsonwebtoken.JwtException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid token"));
        } catch (Exception e) {
            log.error("Token refresh failed", e);
            return ResponseEntity.status(500).body(Map.of("error", "Refresh failed"));
        }
    }

    @Override
    public ResponseEntity<?> forgotPassword(ForgotPasswordDTO request) {
        // Always return a generic success message regardless of whether the email exists,
        // to avoid leaking which emails are registered.
        Map<String, String> genericResponse = Map.of("message",
                "If an account exists for that email, a password reset link has been sent.");
        try {
            if (request.getEmail() == null || request.getEmail().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "email is required"));
            }
            String email = request.getEmail().trim().toLowerCase();

            Optional<SuperAdmin> superAdminOpt = superAdminRepository.findByEmail(email);
            if (superAdminOpt.isPresent()) {
                // Super admin reset flow reuses the same token table but in master DB context
                // is out of scope for MVP; direct super admins to change password via env var / DB.
                return ResponseEntity.ok(genericResponse);
            }

            Tenant tenant = resolveTenant(email, request.getCompanySlug());
            if (tenant == null || !tenant.isActive()) {
                return ResponseEntity.ok(genericResponse);
            }

            try {
                TenantContext.setCurrentTenant(tenant.getDbName());
                User user = userRepository.findByEmail(email).orElse(null);
                if (user == null || !user.isActive()) {
                    return ResponseEntity.ok(genericResponse);
                }

                String token = UUID.randomUUID().toString();
                PasswordResetToken resetToken = new PasswordResetToken();
                resetToken.setEmail(email);
                resetToken.setToken(token);
                resetToken.setExpiresAt(LocalDateTime.now().plusMinutes(30));
                resetToken.setUsed(false);
                passwordResetTokenRepository.save(resetToken);

                String resetLink = frontendBaseUrl + "/reset-password?token=" + token;
                emailService.sendPasswordResetEmail(email, resetLink);

                return ResponseEntity.ok(genericResponse);
            } finally {
                TenantContext.clear();
            }
        } catch (Exception e) {
            log.error("Forgot-password flow failed for email={}", request.getEmail(), e);
            return ResponseEntity.ok(genericResponse);
        }
    }

    @Override
    public ResponseEntity<?> resetPassword(ResetPasswordDTO request) {
        try {
            if (request.getToken() == null || request.getNewPassword() == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "A valid token and new password are required"));
            }
            String policyError = com.pos.app.common.util.PasswordPolicy.validate(request.getNewPassword());
            if (policyError != null) {
                return ResponseEntity.badRequest().body(Map.of("error", policyError));
            }

            // The reset token was created inside a specific tenant DB, but we don't know
            // which tenant it belongs to just from the token, so we must check every
            // active tenant's token table. In practice this is fast (few tenants, indexed token column).
            for (Tenant tenant : tenantRepository.findAll()) {
                if (!tenant.isActive()) continue;
                try {
                    TenantContext.setCurrentTenant(tenant.getDbName());
                    Optional<PasswordResetToken> tokenOpt = passwordResetTokenRepository.findByToken(request.getToken());
                    if (tokenOpt.isEmpty()) continue;

                    PasswordResetToken resetToken = tokenOpt.get();
                    if (resetToken.isUsed() || resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
                        return ResponseEntity.status(400).body(Map.of("error", "This reset link has expired or already been used"));
                    }

                    User user = userRepository.findByEmail(resetToken.getEmail()).orElse(null);
                    if (user == null) {
                        return ResponseEntity.status(400).body(Map.of("error", "Invalid reset link"));
                    }

                    user.setPassword(passwordEncoder.encode(request.getNewPassword()));
                    user.setTokenVersion(user.getTokenVersion() + 1); // revoke any existing sessions
                    userRepository.save(user);
                    authUserCache.clear();

                    resetToken.setUsed(true);
                    passwordResetTokenRepository.save(resetToken);

                    return ResponseEntity.ok(Map.of("message", "Password has been reset successfully. You can now log in."));
                } finally {
                    TenantContext.clear();
                }
            }

            return ResponseEntity.status(400).body(Map.of("error", "Invalid or expired reset link"));
        } catch (Exception e) {
            log.error("Password reset failed", e);
            return ResponseEntity.status(500).body(Map.of("error", "Password reset failed"));
        }
    }

    private Tenant resolveTenant(String email, String companySlug) {
        if (companySlug != null && !companySlug.isBlank()) {
            return tenantRepository.findBySlug(companySlug.trim().toLowerCase()).orElse(null);
        }
        Optional<TenantUserIndex> indexOpt = tenantUserIndexRepository.findByEmail(email);
        if (indexOpt.isEmpty()) return null;
        return tenantRepository.findById(indexOpt.get().getTenantId()).orElse(null);
    }
}
