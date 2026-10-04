package com.pos.app.tenant;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Routes every JPA/JDBC call made through the tenant EntityManagerFactory to the
 * correct physical PostgreSQL database, based on {@link TenantContext#getCurrentTenant()}.
 *
 * New tenant databases are registered at runtime (when Super Admin provisions a
 * new tenant) via {@link #registerDataSource(String, DataSource)} without requiring
 * an application restart.
 */
public class TenantRoutingDataSource extends AbstractRoutingDataSource {

    private final Map<Object, Object> registry = new ConcurrentHashMap<>();

    public TenantRoutingDataSource(DataSource defaultDataSource) {
        setDefaultTargetDataSource(defaultDataSource);
        setTargetDataSources(new HashMap<>(registry));
        afterPropertiesSet();
    }

    @Override
    protected Object determineCurrentLookupKey() {
        return TenantContext.getCurrentTenant();
    }

    /**
     * Adds (or replaces) a tenant's DataSource and makes it immediately routable.
     */
    public synchronized void registerDataSource(String tenantDbKey, DataSource dataSource) {
        registry.put(tenantDbKey, dataSource);
        setTargetDataSources(new HashMap<>(registry));
        afterPropertiesSet();
    }

    public boolean isRegistered(String tenantDbKey) {
        return registry.containsKey(tenantDbKey);
    }

    /** Removes a tenant's DataSource from routing (used on tenant deletion). Closes the pool. */
    public synchronized void unregisterDataSource(String tenantDbKey) {
        Object removed = registry.remove(tenantDbKey);
        setTargetDataSources(new HashMap<>(registry));
        afterPropertiesSet();
        if (removed instanceof com.zaxxer.hikari.HikariDataSource hikariDs) {
            hikariDs.close();
        }
    }
}
