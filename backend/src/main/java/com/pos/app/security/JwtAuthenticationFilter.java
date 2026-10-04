package com.pos.app.security;

import com.pos.app.master.repository.SuperAdminRepository;
import com.pos.app.tenant.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Authenticates every request via JWT AND, for tenant users, sets {@link TenantContext}
 * so the routing datasource sends all JPA queries for this request to the correct
 * tenant database. TenantContext is always cleared in a finally block.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserDetailsServiceImpl userDetailsService;

    @Autowired
    private AuthUserCache authUserCache;

    @Autowired
    private SuperAdminRepository superAdminRepository;

    /**
     * SockJS does a plain HTTP GET /ws/info (and /ws/{server}/{session}/... polling
     * fallbacks) BEFORE any STOMP frame exists, so there is no Authorization header
     * on those requests. SecurityConfig permits /ws/**, but this filter runs before
     * the authorization step and used to reject them with 401. The real auth for the
     * socket happens on the STOMP CONNECT frame in WebSocketAuthInterceptor.
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.equals("/ws") || path.startsWith("/ws/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String requestPath = request.getRequestURI();
        if (requestPath.startsWith("/v1/auth/") || requestPath.startsWith("/v1/branding/public")
                || requestPath.startsWith("/v1/public/qr/")) {
            filterChain.doFilter(request, response);
            return;
        }

        String jwt = null;
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            jwt = authHeader.substring(7);
        }

        if (jwt == null || jwt.isBlank()) {
            sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "JWT token is missing, please login");
            return;
        }

        try {
            String email = jwtService.extractUsername(jwt);
            if (email == null || !jwtService.isTokenStructurallyValid(jwt)) {
                sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired JWT token");
                return;
            }

            if (SecurityContextHolder.getContext().getAuthentication() == null) {

                if (jwtService.extractIsSuperAdmin(jwt)) {
                    // Super Admin: no tenant DB involved at all. Still enforce token
                    // revocation via tokenVersion (e.g. after a password change).
                    var superAdminOpt = superAdminRepository.findByEmail(email);
                    if (superAdminOpt.isEmpty() || !superAdminOpt.get().isActive()) {
                        sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired JWT token");
                        return;
                    }
                    int currentVersion = superAdminOpt.get().getTokenVersion();
                    if (jwtService.extractTokenVersion(jwt) != currentVersion) {
                        sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "Session expired, please login again");
                        return;
                    }

                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            email, null, List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    filterChain.doFilter(request, response);
                    return;
                }

                String tenantDbKey = jwtService.extractTenantDbKey(jwt);
                if (tenantDbKey == null || tenantDbKey.isBlank()) {
                    sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "Token missing tenant context");
                    return;
                }

                try {
                    TenantContext.setCurrentTenant(tenantDbKey);

                    UserDetails userDetails = authUserCache.load(tenantDbKey, email, userDetailsService);

                    if (!jwtService.isTokenValid(jwt, userDetails)) {
                        sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid JWT token");
                        return;
                    }
                    if (!userDetails.isEnabled()) {
                        // Use 401 (not 403): this ends the whole session, unlike an
                        // ordinary @PreAuthorize permission denial (403), which should
                        // NOT log the user out -- see axiosClient.ts's interceptor.
                        sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "Account is deactivated");
                        return;
                    }
                    if (userDetails instanceof AppUserDetails appDetails) {
                        Integer tokenVer = jwtService.extractTokenVersion(jwt);
                        if (tokenVer == null || tokenVer != appDetails.getTokenVersion()) {
                            sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "Session expired, please login again");
                            return;
                        }
                    }

                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);

                    filterChain.doFilter(request, response);
                    return;
                } finally {
                    TenantContext.clear();
                }
            }

        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "JWT token has expired");
            return;
        } catch (org.springframework.security.authentication.DisabledException e) {
            sendErrorResponse(response, HttpServletResponse.SC_FORBIDDEN, "Account is deactivated");
            return;
        } catch (org.springframework.security.core.userdetails.UsernameNotFoundException e) {
            sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid JWT token");
            return;
        } catch (io.jsonwebtoken.JwtException e) {
            sendErrorResponse(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid JWT token");
            return;
        } catch (Exception e) {
            sendErrorResponse(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Authentication error");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void sendErrorResponse(HttpServletResponse response, int statusCode, String message) throws IOException {
        response.setStatus(statusCode);
        response.setContentType("application/json");
        // Include both "message" and "error" keys: this filter runs before Spring
        // MVC, so @RestControllerAdvice never sees these responses, and different
        // frontend pages historically check different keys for the failure reason.
        // Escape quotes/backslashes since we're hand-building JSON here.
        String escaped = message == null ? "" : message.replace("\\", "\\\\").replace("\"", "\\\"");
        response.getWriter().write("{\"message\": \"" + escaped + "\", \"error\": \"" + escaped + "\"}");
        response.getWriter().flush();
    }
}
