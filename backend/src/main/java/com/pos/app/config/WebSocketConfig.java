package com.pos.app.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Powers real-time push for the restaurant module (tables board + kitchen
 * display). Everything is broadcast-only from the server's side -- clients
 * never publish to /app/** here, they just subscribe and receive full,
 * already-tenant-scoped snapshots pushed by RestaurantServiceImpl whenever
 * something changes (an item added, a KOT sent, a table settled, etc).
 *
 * Topics: /topic/restaurant/{tenantDbKey}/tables and .../kitchen
 * SockJS fallback is enabled so this also works through proxies/older
 * in-app tablet browsers that don't support native WebSocket.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthInterceptor authInterceptor;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authInterceptor);
    }
}
