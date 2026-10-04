package com.pos.app.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.Collection;

public class AppUserDetails extends User {

    private final int tokenVersion;
    private final Long userId;

    public AppUserDetails(String username, String password, boolean enabled,
                           Collection<? extends GrantedAuthority> authorities,
                           int tokenVersion, Long userId) {
        super(username, password, enabled, true, true, true, authorities);
        this.tokenVersion = tokenVersion;
        this.userId = userId;
    }

    public int getTokenVersion() {
        return tokenVersion;
    }

    public Long getUserId() {
        return userId;
    }
}
