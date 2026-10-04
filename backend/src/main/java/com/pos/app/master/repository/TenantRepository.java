package com.pos.app.master.repository;

import com.pos.app.master.entity.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TenantRepository extends JpaRepository<Tenant, Long> {
    Optional<Tenant> findBySlug(String slug);
    Optional<Tenant> findByDbName(String dbName);
    boolean existsBySlug(String slug);
    boolean existsByDbName(String dbName);
    Page<Tenant> findByNameContainingIgnoreCaseOrSlugContainingIgnoreCase(String name, String slug, Pageable pageable);
}
