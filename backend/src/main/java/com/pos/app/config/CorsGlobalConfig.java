package com.pos.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsGlobalConfig {

    /**
     * Comma-separated list of allowed frontend origins. Configure via the
     * APP_CORS_ALLOWED_ORIGINS environment variable in production (set it to
     * your deployed frontend's URL(s)) — the defaults here are dev-only
     * convenience values and will NOT include your production domain.
     */
    @Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
    private String[] allowedOrigins;

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/v1/**") // API path to allow CORS
                        .allowedOrigins(allowedOrigins)
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true)  // allow cookies/token
                        .maxAge(3600);  // 1 hour pre-flight cache
            }
        };
    }
}
