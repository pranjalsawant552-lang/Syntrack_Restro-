package com.pos.app.master.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Optional, OFF-BY-DEFAULT convenience: when enabled, repairs every tenant's schema
 * once at application startup (additive-only Hibernate "update" DDL, same as the
 * SuperAdmin "repair schema" endpoints — never drops or renames anything, and only
 * ever touches a tenant's own dedicated connection).
 *
 * Why this exists: {@code TenantDataSourceConfig}'s runtime persistence unit deliberately
 * runs with {@code hibernate.hbm2ddl.auto=none} (see the comment there) — so when a
 * deploy adds a new entity field, EXISTING tenants' databases are NOT auto-migrated.
 * Without running a repair, the first request that touches the new column fails with
 * something like "Unknown column 'x' in 'field list'".
 *
 * This is disabled by default on purpose — schema changes on every restart are not
 * something you want happening silently in production. Enable it only when you
 * specifically want "restart the app and it self-heals every tenant's schema" instead
 * of calling the SuperAdmin repair endpoint(s) yourself after a deploy:
 *
 *   app.schema.auto-repair-on-boot=true
 *
 * Either approach is safe (they call the exact same additive-only repair path) — this
 * is purely about whether you want it automatic on every restart or explicitly
 * triggered by a super admin when you choose to.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.schema.auto-repair-on-boot", havingValue = "true")
public class SchemaAutoRepairRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaAutoRepairRunner.class);

    private final TenantProvisioningService provisioningService;

    @Override
    public void run(ApplicationArguments args) {
        log.info("app.schema.auto-repair-on-boot=true — repairing schema for all tenants...");

        TenantProvisioningService.SchemaRepairResult result = provisioningService.repairAllTenantSchemas();

        log.info("Tenant schema repair complete: {} succeeded, {} failed",
                result.repaired().size(), result.failed().size());

        if (!result.failed().isEmpty()) {
            result.failed().forEach((tenantName, error) ->
                    log.warn("Schema repair FAILED for tenant '{}': {}", tenantName, error));
        }
    }
}
