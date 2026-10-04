package com.pos.app.security;

import com.pos.app.Entity.User;
import com.pos.app.master.entity.SuperAdmin;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.List;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String secretKey;

    private static final long TOKEN_VALIDITY_MS = 1000L * 60 * 60 * 10; // 10 hours
    private static final long REFRESH_VALIDITY_MS = 1000L * 60 * 60 * 24 * 5; // 5 days

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject); // subject = email
    }

    public String extractUserRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }

    public Long extractUserId(String token) {
        return extractClaim(token, claims -> claims.get("userId", Long.class));
    }

    /** Tenant database key (Tenant.dbName). Null for Super Admin tokens. */
    public String extractTenantDbKey(String token) {
        return extractClaim(token, claims -> claims.get("tenantDbKey", String.class));
    }

    public String extractTenantSlug(String token) {
        return extractClaim(token, claims -> claims.get("tenantSlug", String.class));
    }

    public boolean extractIsSuperAdmin(String token) {
        Boolean val = extractClaim(token, claims -> claims.get("superAdmin", Boolean.class));
        return val != null && val;
    }

    @SuppressWarnings("unchecked")
    public List<String> extractPermissions(String token) {
        return extractClaim(token, claims -> claims.get("permissions", List.class));
    }

    public Integer extractTokenVersion(String token) {
        Integer v = extractClaim(token, claims -> claims.get("tokenVersion", Integer.class));
        return v != null ? v : 0;
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /** Token for a tenant user (regular login). */
    public String generateToken(User user, String tenantDbKey, String tenantSlug) {
        List<String> permissions = user.getRoleRef() != null
                ? List.copyOf(user.getRoleRef().getPermissions())
                : List.of();

        return Jwts.builder()
                .setSubject(user.getEmail())
                .claim("userId", user.getId())
                .claim("role", user.getRole())
                .claim("tenantDbKey", tenantDbKey)
                .claim("tenantSlug", tenantSlug)
                .claim("permissions", permissions)
                .claim("tokenVersion", user.getTokenVersion())
                .claim("superAdmin", false)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + TOKEN_VALIDITY_MS))
                .signWith(getSignKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /** Token for the platform Super Admin. */
    public String generateSuperAdminToken(SuperAdmin admin) {
        return Jwts.builder()
                .setSubject(admin.getEmail())
                .claim("userId", admin.getId())
                .claim("role", "SUPER_ADMIN")
                .claim("superAdmin", true)
                .claim("tokenVersion", admin.getTokenVersion())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + TOKEN_VALIDITY_MS))
                .signWith(getSignKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String email = extractUsername(token);
        return email != null
                && email.equals(userDetails.getUsername())
                && !isTokenExpired(token);
    }

    public boolean isTokenStructurallyValid(String token) {
        try {
            extractAllClaims(token);
            return !isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Key getSignKey() {
        byte[] keyBytes = secretKey.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
