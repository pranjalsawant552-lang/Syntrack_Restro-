package com.pos.app.master.repository;

import com.pos.app.master.entity.TenantUserIndex;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TenantUserIndexRepository extends JpaRepository<TenantUserIndex, Long> {
    Optional<TenantUserIndex> findByEmail(String email);
    boolean existsByEmail(String email);
    void deleteByEmail(String email);
}
