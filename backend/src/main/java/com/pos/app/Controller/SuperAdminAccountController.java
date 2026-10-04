package com.pos.app.Controller;

import com.pos.app.DTO.ChangePasswordDTO;
import com.pos.app.common.util.PasswordPolicy;
import com.pos.app.config.ApiVersionConfig;
import com.pos.app.master.entity.SuperAdmin;
import com.pos.app.master.repository.SuperAdminRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Super Admin's own account management — separate from tenant CRUD for clarity. */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/superadmin/account")
@RequiredArgsConstructor
@CrossOrigin
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminAccountController {

    private final SuperAdminRepository superAdminRepository;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordDTO request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        SuperAdmin admin = superAdminRepository.findByEmail(email).orElse(null);
        if (admin == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Account not found"));
        }
        if (request.getCurrentPassword() == null || !passwordEncoder.matches(request.getCurrentPassword(), admin.getPassword())) {
            return ResponseEntity.status(400).body(Map.of("error", "Current password is incorrect"));
        }
        String policyError = PasswordPolicy.validate(request.getNewPassword());
        if (policyError != null) {
            return ResponseEntity.status(400).body(Map.of("error", policyError));
        }
        admin.setPassword(passwordEncoder.encode(request.getNewPassword()));
        admin.setTokenVersion(admin.getTokenVersion() + 1);
        superAdminRepository.save(admin);
        return ResponseEntity.ok(Map.of("message", "Password changed. Please login again."));
    }
}
