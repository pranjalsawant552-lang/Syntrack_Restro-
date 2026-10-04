package com.pos.app.master.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Represents a company/tenant onboarded by the Super Admin.
 * Each tenant owns a dedicated PostgreSQL database (schema) named by {@link #dbName}.
 * This entity itself lives in the MASTER database only.
 */
@Entity
@Table(name = "tenants", uniqueConstraints = {
        @UniqueConstraint(columnNames = "slug"),
        @UniqueConstraint(columnNames = "dbName")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Human readable company name, also used as default branding appName */
    private String name;

    /** URL-safe unique identifier, e.g. "acme-traders" */
    private String slug;

    /** Physical PostgreSQL database name for this tenant, e.g. "tenant_acme_traders" */
    private String dbName;

    private String contactEmail;

    private String contactPhone;

    private String logoUrl;

    /** Whether the tenant can log in / operate. Super Admin can suspend a tenant. */
    private boolean active = true;

    /** Optional seat/resource caps set by Super Admin. Null = unlimited. */
    private Integer maxUsers;
    private Integer maxProducts;

    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt = LocalDateTime.now();
}
