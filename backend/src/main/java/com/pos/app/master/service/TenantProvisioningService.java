package com.pos.app.master.service;

import com.pos.app.Entity.Role;
import com.pos.app.Entity.SettingMaster;
import com.pos.app.Entity.User;
import com.pos.app.Enum.Permission;
import com.pos.app.Repository.RoleRepository;
import com.pos.app.Repository.SettingMasterRepository;
import com.pos.app.Repository.UserRepository;
import com.pos.app.master.entity.Tenant;
import com.pos.app.master.entity.TenantUserIndex;
import com.pos.app.master.repository.TenantRepository;
import com.pos.app.master.repository.TenantUserIndexRepository;
import com.pos.app.tenant.TenantContext;
import com.pos.app.tenant.TenantRoutingDataSource;
import com.zaxxer.hikari.HikariDataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import com.pos.app.common.config.SnakeCasePhysicalNamingStrategy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TenantProvisioningService {

    private final TenantRepository tenantRepository;
    private final TenantUserIndexRepository tenantUserIndexRepository;
    private final JdbcTemplate masterJdbcTemplate;
    private final TenantRoutingDataSource tenantRoutingDataSource;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final SettingMasterRepository settingMasterRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.tenant-db.host}")
    private String tenantDbHost;
    @Value("${app.tenant-db.port}")
    private String tenantDbPort;
    @Value("${app.tenant-db.username}")
    private String tenantDbUsername;
    @Value("${app.tenant-db.password}")
    private String tenantDbPassword;
    @Value("${app.tenant-db.url-params}")
    private String tenantDbUrlParams;
    @Value("${app.tenant-db.name-prefix}")
    private String tenantDbNamePrefix;

    // One pool per tenant: N tenants x max-size must stay below PostgreSQL's max_connections (default 100).
    // Small pools + minimum-idle 1 keep quiet tenants cheap while still letting a busy one burst.
    @Value("${app.tenant-db.pool.max-size:6}")
    private int tenantPoolMaxSize;
    @Value("${app.tenant-db.pool.min-idle:1}")
    private int tenantPoolMinIdle;
    @Value("${app.tenant-db.pool.idle-timeout-ms:300000}")
    private long tenantPoolIdleTimeoutMs;
    @Value("${app.tenant-db.pool.max-lifetime-ms:1500000}")
    private long tenantPoolMaxLifetimeMs;
    @Value("${app.tenant-db.pool.connection-timeout-ms:10000}")
    private long tenantPoolConnectionTimeoutMs;

    public static class TenantAdminSeed {
        public String firstName;
        public String lastName;
        public String email;
        public String password;
        public String phoneNumber;
    }

    /**
     * Full onboarding flow triggered by Super Admin: creates the physical database,
     * builds the schema, seeds default roles + the first tenant admin user + default
     * branding, registers the DB for live routing, and records the tenant + login index
     * in the master database.
     */
    public Tenant provisionTenant(String companyName, String slug, String contactEmail,
                                   String contactPhone, TenantAdminSeed admin) {

        if (tenantDbHost == null || tenantDbHost.isBlank()
                || tenantDbUsername == null || tenantDbUsername.isBlank()
                || tenantDbPassword == null || tenantDbPassword.isBlank()) {
            throw new IllegalStateException(
                    "Tenant database is not configured (app.tenant-db.host/username/password). " +
                    "Check application.properties — by default these reuse app.master-db.username/password, " +
                    "so if you overrode one independently, make sure both are set correctly.");
        }

        if (tenantRepository.existsBySlug(slug)) {
            throw new IllegalArgumentException("A tenant with this slug already exists");
        }
        if (tenantUserIndexRepository.existsByEmail(admin.email.trim().toLowerCase())) {
            throw new IllegalArgumentException("This admin email is already in use by another tenant");
        }

        String dbName = tenantDbNamePrefix + slug.trim().toLowerCase().replaceAll("[^a-z0-9_]", "_");
        if (dbName.length() > 63) { // PostgreSQL identifier limit
            throw new IllegalArgumentException("Company slug is too long: the database name would exceed 63 characters");
        }
        if (tenantRepository.existsByDbName(dbName)) {
            throw new IllegalArgumentException("Resolved database name already exists, pick a different company slug");
        }

        // 1) Create the physical database (PostgreSQL has no CREATE DATABASE IF NOT EXISTS;
        //    CREATE DATABASE also can't run inside a transaction, so this uses the JdbcTemplate's
        //    auto-commit connection. dbName is restricted to [a-z0-9_] above, so quoting is safe.)
        createDatabaseIfMissing(dbName);

        String jdbcUrl = jdbcUrlFor(dbName);

        // 2) Build the schema for the new (empty) tenant DB using Hibernate's own
        //    schema generation, guaranteeing it exactly matches the JPA entities.
        generateSchema(jdbcUrl);

        // 3) Create a long-lived pooled DataSource for this tenant and register it for routing
        DataSource pooledDs = buildPooledDataSource(jdbcUrl, dbName);
        tenantRoutingDataSource.registerDataSource(dbName, pooledDs);

        // 4) Seed default roles, the first tenant admin user, and default branding
        try {
            TenantContext.setCurrentTenant(dbName);
            seedDefaultRolesAndAdmin(companyName, admin);
        } finally {
            TenantContext.clear();
        }

        // 5) Persist tenant + login index in the master DB
        Tenant tenant = new Tenant();
        tenant.setName(companyName);
        tenant.setSlug(slug);
        tenant.setDbName(dbName);
        tenant.setContactEmail(contactEmail);
        tenant.setContactPhone(contactPhone);
        tenant.setActive(true);
        Tenant saved = tenantRepository.save(tenant);

        TenantUserIndex index = new TenantUserIndex();
        index.setEmail(admin.email.trim().toLowerCase());
        index.setTenantId(saved.getId());
        index.setTenantSlug(slug);
        tenantUserIndexRepository.save(index);

        return saved;
    }

    /** Re-registers a tenant's DataSource on application startup (see TenantStartupRunner). */
    public void registerExistingTenant(Tenant tenant) {
        String jdbcUrl = jdbcUrlFor(tenant.getDbName());
        DataSource pooledDs = buildPooledDataSource(jdbcUrl, tenant.getDbName());
        tenantRoutingDataSource.registerDataSource(tenant.getDbName(), pooledDs);
    }

    /**
     * Permanently removes a tenant: drops the physical database, un-registers its
     * DataSource from routing, and cleans up the master-DB records (login index +
     * tenant row). This is IRREVERSIBLE — all of that tenant's data is destroyed.
     */
    public void deprovisionTenant(Tenant tenant) {
        tenantRoutingDataSource.unregisterDataSource(tenant.getDbName());
        dropDatabaseIfExists(tenant.getDbName());
        tenantUserIndexRepository.findAll().stream()
                .filter(idx -> idx.getTenantId().equals(tenant.getId()))
                .forEach(tenantUserIndexRepository::delete);
        tenantRepository.delete(tenant);
    }

    /**
     * Re-applies schema generation (update mode, so it only ADDS missing tables/columns,
     * never drops or renames) against one existing tenant's own dedicated connection.
     * Safe to call on an already-up-to-date tenant (no-op). Use this after adding a new
     * entity/field so existing tenants pick it up, without ever touching other tenants
     * or the master DB — unlike a global schema-update on the routed EMF, this always
     * targets exactly the one tenant's real database.
     */
    public void repairTenantSchema(Tenant tenant) {
        String jdbcUrl = jdbcUrlFor(tenant.getDbName());
        generateSchema(jdbcUrl);
        topUpDefaultRoles(tenant);
    }

    /**
     * Adds permissions introduced after a tenant was created to that tenant's DEFAULT roles only
     * (MANAGER / CASHIER get the cash-drawer permissions). Additive and idempotent: it never removes a
     * permission and never touches a role the tenant created themselves or renamed. TENANT_ADMIN needs
     * nothing -- it always resolves to every permission at login.
     */
    private void topUpDefaultRoles(Tenant tenant) {
        try {
            TenantContext.setCurrentTenant(tenant.getDbName());
            for (String roleName : List.of("MANAGER", "CASHIER")) {
                roleRepository.findByName(roleName).ifPresent(role -> {
                    Set<String> perms = new java.util.HashSet<>(role.getPermissions());
                    boolean changed = perms.add(Permission.CASH_VIEW.name());
                    changed |= perms.add(Permission.CASH_MANAGE.name());
                    if (changed) {
                        role.setPermissions(perms);
                        roleRepository.save(role);
                    }
                });
            }
        } catch (Exception e) {
            // schema repair itself already succeeded; a role top-up problem must not make it look failed
            org.slf4j.LoggerFactory.getLogger(TenantProvisioningService.class)
                    .warn("Could not top up default roles for tenant {}: {}", tenant.getName(), e.getMessage());
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Runs {@link #repairTenantSchema(Tenant)} against every tenant, independently —
     * one tenant failing (e.g. temporarily unreachable) never stops the rest. Used by
     * the SuperAdmin "repair all" endpoint and, optionally, by the boot-time
     * auto-repair runner (see {@code app.schema.auto-repair-on-boot}).
     */
    public SchemaRepairResult repairAllTenantSchemas() {
        List<Tenant> tenants = tenantRepository.findAll();

        List<String> succeeded = new java.util.ArrayList<>();
        Map<String, String> failed = new java.util.LinkedHashMap<>();

        for (Tenant tenant : tenants) {
            try {
                repairTenantSchema(tenant);
                succeeded.add(tenant.getName());
            } catch (Exception e) {
                failed.put(tenant.getName(), e.getMessage());
            }
        }

        return new SchemaRepairResult(succeeded, failed);
    }

    /** Result of a bulk schema repair: which tenants succeeded, and which failed with why. */
    public record SchemaRepairResult(List<String> repaired, Map<String, String> failed) {
    }

    private String jdbcUrlFor(String dbName) {
        String params = tenantDbUrlParams == null ? "" : tenantDbUrlParams.trim();
        return "jdbc:postgresql://" + tenantDbHost + ":" + tenantDbPort + "/" + dbName + params;
    }

    private static void requireSafeDbName(String dbName) {
        if (dbName == null || !dbName.matches("[a-z0-9_]{1,63}")) {
            throw new IllegalArgumentException("Unsafe database name: " + dbName);
        }
    }

    private void createDatabaseIfMissing(String dbName) {
        requireSafeDbName(dbName);
        Integer n = masterJdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_database WHERE datname = ?", Integer.class, dbName);
        if (n == null || n == 0) {
            masterJdbcTemplate.execute("CREATE DATABASE \"" + dbName + "\" ENCODING 'UTF8'");
        }
    }

    private void dropDatabaseIfExists(String dbName) {
        requireSafeDbName(dbName);
        try {
            // WITH (FORCE) (PostgreSQL 13+) also kicks out any lingering connections.
            masterJdbcTemplate.execute("DROP DATABASE IF EXISTS \"" + dbName + "\" WITH (FORCE)");
        } catch (org.springframework.dao.DataAccessException e) {
            masterJdbcTemplate.execute("DROP DATABASE IF EXISTS \"" + dbName + "\"");
        }
    }

    private void generateSchema(String jdbcUrl) {
        HikariDataSource tempDs = new HikariDataSource();
        tempDs.setJdbcUrl(jdbcUrl);
        tempDs.setUsername(tenantDbUsername);
        tempDs.setPassword(tenantDbPassword);
        tempDs.setMaximumPoolSize(2);

        LocalContainerEntityManagerFactoryBean emf = new LocalContainerEntityManagerFactoryBean();
        try {
            Map<String, Object> props = new HashMap<>();
            props.put("hibernate.hbm2ddl.auto", "update");
            props.put("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");
            // MUST match TenantDataSourceConfig's runtime persistence unit and the naming
            // some native @Query SQL hardcodes (e.g. SalesInvoiceItemRepository's raw
            // profit queries assume snake_case table names like sales_invoice_item).
            props.put("hibernate.physical_naming_strategy", new SnakeCasePhysicalNamingStrategy());
            emf.setDataSource(tempDs);
            emf.setPackagesToScan("com.pos.app.Entity");
            emf.setPersistenceUnitName("tenant-provisioning-" + System.nanoTime());
            emf.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            emf.setJpaPropertyMap(props);
            emf.afterPropertiesSet(); // triggers schema creation
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (msg.contains("password authentication failed") || msg.contains("permission denied")) {
                throw new IllegalStateException(
                        "PostgreSQL rejected the tenant DB connection (auth/permission denied) using user '" + tenantDbUsername +
                        "'. Check app.tenant-db.username/password in application.properties — by default they " +
                        "reuse app.master-db.username/password, so if login works but tenant creation doesn't, " +
                        "those two got out of sync.", e);
            }
            throw e;
        } finally {
            emf.destroy();
            tempDs.close();
        }
    }

    private DataSource buildPooledDataSource(String jdbcUrl, String poolName) {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(jdbcUrl);
        ds.setUsername(tenantDbUsername);
        ds.setPassword(tenantDbPassword);
        ds.setPoolName("tenant-pool-" + poolName);
        ds.setMaximumPoolSize(Math.max(2, tenantPoolMaxSize));
        ds.setMinimumIdle(Math.max(0, Math.min(tenantPoolMinIdle, ds.getMaximumPoolSize())));
        ds.setIdleTimeout(tenantPoolIdleTimeoutMs);
        ds.setMaxLifetime(tenantPoolMaxLifetimeMs);
        // fail fast (10 s) instead of the 30 s default so a stuck tenant returns an error rather than piling up threads
        ds.setConnectionTimeout(tenantPoolConnectionTimeoutMs);
        return ds;
    }

    private void seedDefaultRolesAndAdmin(String companyName, TenantAdminSeed admin) {
        Role tenantAdminRole = new Role();
        tenantAdminRole.setName("TENANT_ADMIN");
        tenantAdminRole.setDescription("Full access within this company");
        tenantAdminRole.setSystemRole(true);
        tenantAdminRole.setPermissions(Set.of(Permission.ALL_CODES));
        tenantAdminRole = roleRepository.save(tenantAdminRole);

        Role manager = new Role();
        manager.setName("MANAGER");
        manager.setDescription("Manage catalog, stock, customers and view reports");
        manager.setPermissions(Set.of(
                Permission.PRODUCT_VIEW.name(), Permission.PRODUCT_CREATE.name(), Permission.PRODUCT_EDIT.name(),
                Permission.CATEGORY_VIEW.name(), Permission.CATEGORY_CREATE.name(), Permission.CATEGORY_EDIT.name(),
                Permission.CUSTOMER_VIEW.name(), Permission.CUSTOMER_CREATE.name(), Permission.CUSTOMER_EDIT.name(),
                Permission.SUPPLIER_VIEW.name(), Permission.SUPPLIER_CREATE.name(), Permission.SUPPLIER_EDIT.name(),
                Permission.STOCK_VIEW.name(), Permission.STOCK_ADJUST.name(),
                Permission.INVOICE_VIEW.name(), Permission.INVOICE_CREATE.name(),
                Permission.PURCHASE_VIEW.name(), Permission.PURCHASE_CREATE.name(), Permission.PURCHASE_EDIT.name(),
                Permission.DASHBOARD_VIEW.name(), Permission.REPORT_VIEW.name(), Permission.SETTINGS_VIEW.name(),
                Permission.RESTAURANT_VIEW.name(), Permission.RESTAURANT_MANAGE.name(), Permission.KITCHEN_VIEW.name(),
                Permission.RESTAURANT_ITEM_VOID.name(),
                Permission.INVENTORY_VIEW.name(), Permission.INVENTORY_MANAGE.name(), Permission.INVENTORY_ADJUST.name(),
                Permission.RECIPE_VIEW.name(), Permission.RECIPE_MANAGE.name(),
                Permission.CASH_VIEW.name(), Permission.CASH_MANAGE.name()
        ));
        roleRepository.save(manager);

        Role waiter = new Role();
        waiter.setName("WAITER");
        waiter.setDescription("Take orders, send KOTs and serve tables");
        waiter.setPermissions(Set.of(
                Permission.PRODUCT_VIEW.name(), Permission.CATEGORY_VIEW.name(), Permission.CUSTOMER_VIEW.name(),
                Permission.RESTAURANT_VIEW.name(), Permission.RESTAURANT_MANAGE.name(), Permission.KITCHEN_VIEW.name()
        ));
        roleRepository.save(waiter);

        Role kitchenRole = new Role();
        kitchenRole.setName("KITCHEN");
        kitchenRole.setDescription("Kitchen display: see and progress KOTs only");
        kitchenRole.setPermissions(Set.of(Permission.KITCHEN_VIEW.name()));
        roleRepository.save(kitchenRole);

        Role inventoryRole = new Role();
        inventoryRole.setName("INVENTORY");
        inventoryRole.setDescription("Receive stock, record wastage, manage ingredients and recipes");
        inventoryRole.setPermissions(Set.of(
                Permission.PRODUCT_VIEW.name(), Permission.SUPPLIER_VIEW.name(),
                Permission.PURCHASE_VIEW.name(), Permission.PURCHASE_CREATE.name(),
                Permission.INVENTORY_VIEW.name(), Permission.INVENTORY_MANAGE.name(), Permission.INVENTORY_ADJUST.name(),
                Permission.RECIPE_VIEW.name(), Permission.RECIPE_MANAGE.name()
        ));
        roleRepository.save(inventoryRole);

        Role cashier = new Role();
        cashier.setName("CASHIER");
        cashier.setDescription("Billing counter access only");
        cashier.setPermissions(Set.of(
                Permission.PRODUCT_VIEW.name(), Permission.CUSTOMER_VIEW.name(), Permission.CUSTOMER_CREATE.name(),
                Permission.INVOICE_VIEW.name(), Permission.INVOICE_CREATE.name(), Permission.STOCK_VIEW.name(),
                Permission.RESTAURANT_VIEW.name(), Permission.RESTAURANT_MANAGE.name(),
                Permission.CASH_VIEW.name(), Permission.CASH_MANAGE.name()
        ));
        roleRepository.save(cashier);

        // ✅ Kitchen staff: only the KDS queue + enough product visibility to
        // read dish names -- no billing, no catalog/price access.
        Role kitchen = new Role();
        kitchen.setName("KITCHEN_STAFF");
        kitchen.setDescription("Kitchen Display View only -- see and mark orders as served");
        kitchen.setPermissions(Set.of(
                Permission.KITCHEN_VIEW.name(), Permission.PRODUCT_VIEW.name()
        ));
        roleRepository.save(kitchen);

        User adminUser = new User();
        adminUser.setFirstName(admin.firstName);
        adminUser.setLastName(admin.lastName);
        adminUser.setEmail(admin.email.trim().toLowerCase());
        adminUser.setPhoneNumber(admin.phoneNumber);
        adminUser.setPassword(passwordEncoder.encode(admin.password));
        adminUser.setRole("TENANT_ADMIN");
        adminUser.setRoleRef(tenantAdminRole);
        adminUser.setActive(true);
        userRepository.save(adminUser);

        SettingMaster settings = new SettingMaster();
        settings.setCompanyName(companyName);
        settings.setAppName(companyName);
        userRepository.flush();
        settingMasterRepository.save(settings);
    }
}
