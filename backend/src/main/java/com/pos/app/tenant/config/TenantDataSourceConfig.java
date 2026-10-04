package com.pos.app.tenant.config;

import com.pos.app.tenant.TenantRoutingDataSource;
import jakarta.persistence.EntityManagerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.PlatformTransactionManager;
import com.pos.app.common.config.SnakeCasePhysicalNamingStrategy;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

/**
 * TENANT persistence unit: routes every call to the correct physical tenant
 * database based on {@link com.pos.app.tenant.TenantContext}. This is the
 * PRIMARY / default persistence unit so all existing repositories in
 * com.pos.app.Repository keep working without any @Qualifier changes.
 */
@Configuration
@EnableJpaRepositories(
        basePackages = "com.pos.app.Repository",
        entityManagerFactoryRef = "tenantEntityManagerFactory",
        transactionManagerRef = "tenantTransactionManager"
)
public class TenantDataSourceConfig {

    @Bean
    @Primary
    public TenantRoutingDataSource tenantRoutingDataSource(
            @Qualifier("masterDataSource") DataSource masterDataSource) {
        // masterDataSource is used only as a harmless non-null default target;
        // it is never actually queried for tenant entities because every
        // authenticated request sets TenantContext before hitting a repository.
        return new TenantRoutingDataSource(masterDataSource);
    }

    @Bean
    @Primary
    public LocalContainerEntityManagerFactoryBean tenantEntityManagerFactory(
            @Qualifier("tenantRoutingDataSource") TenantRoutingDataSource tenantRoutingDataSource) {
        Map<String, Object> jpaProps = new HashMap<>();
        // Deliberately "none", NOT "update". This EMF is backed by a ROUTING datasource
        // with no tenant selected at app-startup time (no HTTP request in progress yet),
        // so an "update" schema check here would run against the DEFAULT fallback target
        // (the master DB) instead of any real tenant — silently creating tenant-shaped
        // tables inside pos_master. Tenant schemas are created/repaired only against a
        // single tenant's own dedicated connection — see TenantProvisioningService.
        jpaProps.put("hibernate.hbm2ddl.auto", "none");
        jpaProps.put("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");
        jpaProps.put("hibernate.show_sql", false);
        // Performance: one query loads up to 50 lazy children at once (kills N+1), and inserts/updates are sent in batches.
        jpaProps.put("hibernate.default_batch_fetch_size", 50);
        jpaProps.put("hibernate.jdbc.batch_size", 30);
        jpaProps.put("hibernate.order_inserts", true);
        jpaProps.put("hibernate.order_updates", true);
        jpaProps.put("hibernate.jdbc.batch_versioned_data", true);
        // MUST match the naming strategy used in TenantProvisioningService.generateSchema() —
        // otherwise the tables Hibernate created at provisioning time (and the ones some
        // native @Query SQL hardcodes, e.g. sales_invoice_item) won't match what this
        // runtime persistence unit expects to query against.
        jpaProps.put("hibernate.physical_naming_strategy", new SnakeCasePhysicalNamingStrategy());

        LocalContainerEntityManagerFactoryBean emf = new LocalContainerEntityManagerFactoryBean();
        emf.setDataSource(tenantRoutingDataSource);
        emf.setPackagesToScan("com.pos.app.Entity");
        emf.setPersistenceUnitName("tenant");
        emf.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        emf.setJpaPropertyMap(jpaProps);
        return emf;
    }

    @Bean
    @Primary
    public PlatformTransactionManager tenantTransactionManager(
            @Qualifier("tenantEntityManagerFactory") EntityManagerFactory tenantEntityManagerFactory) {
        return new JpaTransactionManager(tenantEntityManagerFactory);
    }
}
