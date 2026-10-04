package com.pos.app.common.service;

import com.pos.app.Entity.User;
import com.pos.app.Repository.StockRepository;
import com.pos.app.Repository.UserRepository;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LowStockAlertScheduler {

    private static final Logger log = LoggerFactory.getLogger(LowStockAlertScheduler.class);

    private final TenantRepository tenantRepository;
    private final StockRepository stockRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    @Value("${app.low-stock.threshold:10}")
    private int lowStockThreshold;

    /** Runs once a day at 8 AM server time. Iterates every active tenant. */
    @Scheduled(cron = "${app.low-stock.cron:0 0 8 * * *}")
    public void checkLowStockAcrossTenants() {
        for (Tenant tenant : tenantRepository.findAll()) {
            if (!tenant.isActive()) continue;
            try {
                TenantContext.setCurrentTenant(tenant.getDbName());
                checkTenant(tenant);
            } catch (Exception e) {
                log.warn("Low-stock check failed for tenant {}: {}", tenant.getSlug(), e.getMessage());
            } finally {
                TenantContext.clear();
            }
        }
    }

    private void checkTenant(Tenant tenant) {
        long lowStockCount = stockRepository.lowStockCount(lowStockThreshold);
        if (lowStockCount == 0) return;

        List<Object[]> lowStockItems = stockRepository.lowStock(lowStockThreshold);
        List<User> admins = userRepository.findByRoleAndActiveTrue("TENANT_ADMIN");
        if (admins.isEmpty()) return;

        StringBuilder body = new StringBuilder();
        body.append(lowStockCount).append(" product(s) are at or below your low-stock threshold (")
                .append(lowStockThreshold).append(" units):\n\n");
        int shown = 0;
        for (Object[] row : lowStockItems) {
            if (shown++ >= 25) {
                body.append("...and ").append(lowStockCount - 25).append(" more.\n");
                break;
            }
            // row = [productId, productName, barcode, qty]
            body.append("- ").append(row[1]).append(" (qty: ").append(row[3]).append(")\n");
        }

        for (User admin : admins) {
            emailService.sendLowStockAlert(admin.getEmail(), tenant.getName(), body.toString());
        }
    }
}
