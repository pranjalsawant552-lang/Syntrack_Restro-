package com.pos.app.master.config;

import com.zaxxer.hikari.HikariDataSource;
import jakarta.persistence.EntityManagerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.jdbc.core.JdbcTemplate;
import com.pos.app.common.config.SnakeCasePhysicalNamingStrategy;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

/**
 * MASTER persistence unit: the control-plane database holding tenants, super admins
 * and the email->tenant login index. Fixed single database, never routed.
 */
@Configuration
@EnableJpaRepositories(
        basePackages = "com.pos.app.master.repository",
        entityManagerFactoryRef = "masterEntityManagerFactory",
        transactionManagerRef = "masterTransactionManager"
)
public class MasterDataSourceConfig {

    @Value("${app.master-db.url}")
    private String url;

    @Value("${app.master-db.username}")
    private String username;

    @Value("${app.master-db.password}")
    private String password;

    @Value("${app.master-db.driver-class-name:org.postgresql.Driver}")
    private String driverClassName;

    @Bean
    public DataSource masterDataSource() {
        // PostgreSQL has no "createDatabaseIfNotExist" JDBC flag (that was MySQL-only), so make
        // sure the master database exists BEFORE the pool / Hibernate try to connect to it.
        ensureDatabaseExists();
        return DataSourceBuilder.create()
                .type(HikariDataSource.class)
                .url(url)
                .username(username)
                .password(password)
                .driverClassName(driverClassName)
                .build();
    }

    /**
     * Connects to the always-present "postgres" maintenance database and creates the master
     * database if it is missing. Requires the configured DB user to have CREATEDB (or the
     * database to already exist, in which case this is a harmless no-op).
     */
    private void ensureDatabaseExists() {
        String prefix = url.substring(0, url.lastIndexOf('/') + 1);
        String rest = url.substring(url.lastIndexOf('/') + 1);
        int q = rest.indexOf('?');
        String dbName = q >= 0 ? rest.substring(0, q) : rest;
        String params = q >= 0 ? rest.substring(q) : "";
        if (!dbName.matches("[A-Za-z0-9_]+")) {
            throw new IllegalStateException("Invalid master database name in app.master-db.url: " + dbName);
        }
        try (java.sql.Connection c = java.sql.DriverManager.getConnection(prefix + "postgres" + params, username, password)) {
            boolean exists;
            try (java.sql.PreparedStatement ps = c.prepareStatement("SELECT 1 FROM pg_database WHERE datname = ?")) {
                ps.setString(1, dbName);
                try (java.sql.ResultSet rs = ps.executeQuery()) { exists = rs.next(); }
            }
            if (!exists) {
                try (java.sql.Statement st = c.createStatement()) {
                    st.execute("CREATE DATABASE \"" + dbName + "\" ENCODING 'UTF8'");
                }
            }
        } catch (java.sql.SQLException e) {
            // Not fatal by itself: if the database already exists and this user just cannot
            // reach the "postgres" database, the normal connection below will still work.
            org.slf4j.LoggerFactory.getLogger(MasterDataSourceConfig.class)
                    .warn("Could not verify/create master database '{}': {}", dbName, e.getMessage());
        }
    }

    @Bean
    public LocalContainerEntityManagerFactoryBean masterEntityManagerFactory() {
        Map<String, Object> jpaProps = new HashMap<>();
        jpaProps.put("hibernate.hbm2ddl.auto", "update");
        jpaProps.put("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");
        jpaProps.put("hibernate.show_sql", false);
        // Match Spring Boot's normal camelCase -> snake_case table/column naming.
        // Required here because HibernateJpaAutoConfiguration is disabled (we build
        // persistence units manually for multi-tenancy), so this isn't applied by default.
        jpaProps.put("hibernate.physical_naming_strategy", new SnakeCasePhysicalNamingStrategy());

        LocalContainerEntityManagerFactoryBean emf = new LocalContainerEntityManagerFactoryBean();
        emf.setDataSource(masterDataSource());
        emf.setPackagesToScan("com.pos.app.master.entity");
        emf.setPersistenceUnitName("master");
        emf.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        emf.setJpaPropertyMap(jpaProps);
        return emf;
    }

    @Bean
    public JdbcTemplate masterJdbcTemplate(@Qualifier("masterDataSource") DataSource masterDataSource) {
        return new JdbcTemplate(masterDataSource);
    }

    @Bean
    public PlatformTransactionManager masterTransactionManager(
            @Qualifier("masterEntityManagerFactory") EntityManagerFactory masterEntityManagerFactory) {
        return new JpaTransactionManager(masterEntityManagerFactory);
    }
}
