package com.pos.app.config;

import com.pos.app.security.JwtService;
import com.pos.app.security.WsPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * STOMP frames don't go through the normal HTTP security filter chain, so
 * authentication has to happen here instead, on the CONNECT frame:
 *
 *   CONNECT
 *   Authorization: Bearer <the same JWT the REST API uses>
 *
 * We resolve the token to a {@link WsPrincipal} carrying the caller's tenant
 * db key, then on every SUBSCRIBE we check the destination actually belongs
 * to that tenant -- otherwise tenant A's tablet could subscribe to tenant B's
 * kitchen/tables topic just by guessing the URL pattern.
 */
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String auth = firstHeader(accessor, "Authorization");
            String token = (auth != null && auth.startsWith("Bearer ")) ? auth.substring(7) : auth;

            if (token == null || token.isBlank()) {
                throw new IllegalArgumentException("Missing auth token on WebSocket CONNECT");
            }
            try {
                String username = jwtService.extractUsername(token);
                String tenantDbKey = jwtService.extractTenantDbKey(token);
                boolean superAdmin = jwtService.extractIsSuperAdmin(token);
                // Super admin tokens have no tenantDbKey -- they don't use these topics today.
                accessor.setUser(new WsPrincipal(username, superAdmin ? "SUPERADMIN" : tenantDbKey));
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid or expired WebSocket auth token", e);
            }
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();
            Object userObj = accessor.getUser();
            if (destination != null && destination.startsWith("/topic/restaurant/")) {
                if (!(userObj instanceof WsPrincipal wp) || wp.getTenantDbKey() == null
                        || !destination.startsWith("/topic/restaurant/" + wp.getTenantDbKey() + "/")) {
                    throw new IllegalArgumentException("Not authorized to subscribe to this topic");
                }
            }
        }

        return message;
    }

    private String firstHeader(StompHeaderAccessor accessor, String name) {
        var values = accessor.getNativeHeader(name);
        return (values != null && !values.isEmpty()) ? values.get(0) : null;
    }
}
