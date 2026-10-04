package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashSet;
import java.util.Set;

/**
 * A role within a tenant. TENANT_ADMIN is seeded automatically for every tenant
 * and cannot be deleted. Tenant Admins can create additional custom roles
 * (Manager, Cashier, etc.) with their own permission sets.
 */
@Entity
@Table(name = "roles", uniqueConstraints = @UniqueConstraint(columnNames = "name"))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** e.g. TENANT_ADMIN, MANAGER, CASHIER, or any custom name the tenant defines */
    private String name;

    private String description;

    /** System roles (TENANT_ADMIN) cannot be edited or deleted */
    private boolean systemRole = false;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "role_permissions", joinColumns = @JoinColumn(name = "role_id"))
    @Column(name = "permission_code")
    private Set<String> permissions = new HashSet<>();
}
