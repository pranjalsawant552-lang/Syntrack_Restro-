package com.pos.app.common.service;

import com.pos.app.Service.MenuAvailabilityService;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Switches menu items back on when their "off until" time has passed (e.g. "out for today" -> back on at 4 AM).
 * One cheap UPDATE per active tenant per minute.
 */
@Service
@RequiredArgsConstructor
public class MenuAvailabilityScheduler {

    private static final Logger log = LoggerFactory.getLogger(MenuAvailabilityScheduler.class);

    private final TenantRepository tenantRepository;
    private final MenuAvailabilityService availabilityService;

    /** Tenants already warned about (usually: schema not repaired yet) so we don't log the same problem every minute. */
    private final Set<String> warned = ConcurrentHashMap.newKeySet();

    @Scheduled(cron = "${app.menu.restore-cron:0 * * * * *}")
    public void restoreExpiredAcrossTenants() {
        for (Tenant tenant : tenantRepository.findAll()) {
            if (!tenant.isActive()) continue;
            try {
                TenantContext.setCurrentTenant(tenant.getDbName());
                availabilityService.restoreExpired();
                warned.remove(tenant.getSlug());
            } catch (Exception e) {
                if (warned.add(tenant.getSlug())) {
                    log.warn("Menu auto-restore failed for tenant {} (run the schema repair if this is a new column): {}",
                            tenant.getSlug(), e.getMessage());
                }
            } finally {
                TenantContext.clear();
            }
        }
    }
}
