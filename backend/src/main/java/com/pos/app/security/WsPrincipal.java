package com.pos.app.security;

import java.security.Principal;

/**
 * Minimal Principal for a STOMP session, carrying the tenant db key resolved
 * from the JWT at CONNECT time (see WebSocketAuthInterceptor). Used to check
 * that a client only ever subscribes to ITS OWN tenant's topics.
 */
public class WsPrincipal implements Principal {
    private final String name;
    private final String tenantDbKey;

    public WsPrincipal(String name, String tenantDbKey) {
        this.name = name;
        this.tenantDbKey = tenantDbKey;
    }

    @Override
    public String getName() {
        return name;
    }

    public String getTenantDbKey() {
        return tenantDbKey;
    }
}
