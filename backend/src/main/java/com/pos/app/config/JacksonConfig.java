package com.pos.app.config;

import com.fasterxml.jackson.datatype.hibernate6.Hibernate6Module;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers Hibernate6Module so that any JPA entity returned directly from a
 * controller (instead of a DTO) serializes safely: uninitialized lazy
 * associations are written out as null rather than throwing
 * LazyInitializationException ("could not initialize proxy - no Session").
 *
 * This is a safety net for legacy endpoints that still return entities
 * directly. New endpoints should prefer returning purpose-built DTOs.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer hibernateLazyProxyJacksonCustomizer() {
        Hibernate6Module module = new Hibernate6Module();
        // Do NOT force-initialize lazy associations during serialization
        // (would trigger extra queries / can still fail outside a session).
        module.disable(Hibernate6Module.Feature.FORCE_LAZY_LOADING);
        // Write uninitialized lazy proxies as null instead of throwing.
        module.enable(Hibernate6Module.Feature.SERIALIZE_IDENTIFIER_FOR_LAZY_NOT_LOADED_OBJECTS);
        return builder -> builder.modulesToInstall(module);
    }
}
