package com.pos.app.security;

import com.pos.app.Entity.Role;
import com.pos.app.Entity.User;
import com.pos.app.master.entity.SuperAdmin;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        // In production this comes from app.jwt.secret; a fixed 32+ byte test secret is fine here.
        ReflectionTestUtils.setField(jwtService, "secretKey", "test-secret-key-for-unit-tests-only-0123456789");
    }

    private User buildUser() {
        Role role = new Role();
        role.setId(1L);
        role.setName("TENANT_ADMIN");
        role.setPermissions(Set.of("USER_VIEW", "PRODUCT_VIEW"));

        User user = new User();
        user.setId(42L);
        user.setEmail("admin@acme.test");
        user.setRole("TENANT_ADMIN");
        user.setRoleRef(role);
        user.setActive(true);
        user.setTokenVersion(0);
        return user;
    }

    @Test
    void generatedTokenRoundTripsClaims() {
        User user = buildUser();
        String token = jwtService.generateToken(user, "tenant_acme", "acme");

        assertEquals("admin@acme.test", jwtService.extractUsername(token));
        assertEquals("TENANT_ADMIN", jwtService.extractUserRole(token));
        assertEquals("tenant_acme", jwtService.extractTenantDbKey(token));
        assertEquals("acme", jwtService.extractTenantSlug(token));
        assertFalse(jwtService.extractIsSuperAdmin(token));
        assertEquals(0, jwtService.extractTokenVersion(token));
        assertTrue(jwtService.extractPermissions(token).containsAll(List.of("USER_VIEW", "PRODUCT_VIEW")));
    }

    @Test
    void tokenVersionChangeInvalidatesOldToken() {
        User user = buildUser();
        String oldToken = jwtService.generateToken(user, "tenant_acme", "acme");

        // Simulate a password change bumping the version.
        user.setTokenVersion(1);
        String newToken = jwtService.generateToken(user, "tenant_acme", "acme");

        assertEquals(0, jwtService.extractTokenVersion(oldToken));
        assertEquals(1, jwtService.extractTokenVersion(newToken));
        assertNotEquals(jwtService.extractTokenVersion(oldToken), jwtService.extractTokenVersion(newToken));
    }

    @Test
    void superAdminTokenIsFlaggedCorrectly() {
        SuperAdmin admin = new SuperAdmin();
        admin.setId(1L);
        admin.setEmail("super@pos-app.local");
        admin.setTokenVersion(0);

        String token = jwtService.generateSuperAdminToken(admin);

        assertTrue(jwtService.extractIsSuperAdmin(token));
        assertEquals("SUPER_ADMIN", jwtService.extractUserRole(token));
        assertEquals("super@pos-app.local", jwtService.extractUsername(token));
    }

    @Test
    void isTokenValidChecksUsernameMatch() {
        User user = buildUser();
        String token = jwtService.generateToken(user, "tenant_acme", "acme");

        AppUserDetails matching = new AppUserDetails(
                "admin@acme.test", "hash", true,
                List.of(new SimpleGrantedAuthority("ROLE_TENANT_ADMIN")), 0, 42L);
        assertTrue(jwtService.isTokenValid(token, matching));

        AppUserDetails mismatched = new AppUserDetails(
                "someone-else@acme.test", "hash", true,
                List.of(new SimpleGrantedAuthority("ROLE_TENANT_ADMIN")), 0, 99L);
        assertFalse(jwtService.isTokenValid(token, mismatched));
    }
}
