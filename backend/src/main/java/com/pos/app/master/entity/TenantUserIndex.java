package com.pos.app.master.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight email -> tenant lookup so a user can log in with just email+password
 * without knowing which tenant database they belong to. Kept in sync whenever a
 * tenant user is created / deleted / email changed. Lives in the MASTER database.
 */
@Entity
@Table(name = "tenant_user_index", uniqueConstraints = @UniqueConstraint(columnNames = "email"))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TenantUserIndex {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String email;

    /** FK to Tenant.id */
    private Long tenantId;

    /** Denormalized for convenience/debugging */
    private String tenantSlug;
}
