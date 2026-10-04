package com.pos.app.master.config;

import com.pos.app.master.entity.SuperAdmin;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.repository.SuperAdminRepository;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.master.service.TenantProvisioningService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StartupInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StartupInitializer.class);

    private final SuperAdminRepository superAdminRepository;
    private final TenantRepository tenantRepository;
    private final TenantProvisioningService tenantProvisioningService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.superadmin.email}")
    private String superAdminEmail;
    @Value("${app.superadmin.password}")
    private String superAdminPassword;

    @Override
    public void run(ApplicationArguments args) {
        seedSuperAdminIfMissing();
        reRegisterActiveTenants();
    }

    private void seedSuperAdminIfMissing() {
        if (superAdminRepository.count() == 0) {
            SuperAdmin sa = new SuperAdmin();
            sa.setFirstName("Super");
            sa.setLastName("Admin");
            sa.setEmail(superAdminEmail.trim().toLowerCase());
            sa.setPassword(passwordEncoder.encode(superAdminPassword));
            sa.setActive(true);
            superAdminRepository.save(sa);
            log.warn("==============================================================");
            log.warn("Seeded initial Super Admin: {} — CHANGE THIS PASSWORD IMMEDIATELY", superAdminEmail);
            log.warn("==============================================================");
        }
    }

    private void reRegisterActiveTenants() {
        for (Tenant tenant : tenantRepository.findAll()) {
            if (tenant.isActive()) {
                try {
                    tenantProvisioningService.registerExistingTenant(tenant);
                } catch (Exception e) {
                    log.error("Failed to register datasource for tenant {}: {}", tenant.getSlug(), e.getMessage());
                }
            }
        }
        log.info("Registered {} active tenant database(s) for routing", tenantRepository.count());
    }
}
