package com.pos.app.tenant;

/**
 * Holds the current request's tenant database key (matches Tenant.dbName / the key
 * under which the tenant's DataSource is registered in {@link TenantRoutingDataSource}).
 * Set by TenantFilter after JWT authentication, cleared at the end of the request.
 */
public final class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setCurrentTenant(String tenantDbKey) {
        CURRENT_TENANT.set(tenantDbKey);
    }

    public static String getCurrentTenant() {
        return CURRENT_TENANT.get();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
