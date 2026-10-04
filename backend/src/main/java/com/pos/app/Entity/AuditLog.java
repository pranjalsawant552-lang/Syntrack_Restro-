package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Records who did what, when, within a tenant. Not exhaustive request logging —
 * targeted at sensitive/administrative actions (user/role changes, invoice
 * cancellations, settings/branding changes) so a Tenant Admin can answer
 * "who changed this and when".
 */
@Entity
@Table(name = "audit_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** e.g. USER_CREATED, USER_DEACTIVATED, ROLE_DELETED, INVOICE_CANCELLED, BRANDING_UPDATED */
    private String action;

    /** e.g. "User", "Role", "Invoice" */
    private String entityType;

    private String entityId;

    /** Email of whoever performed the action ("SYSTEM" for scheduled jobs) */
    private String performedBy;

    @Column(length = 1000)
    private String details;

    private LocalDateTime createdAt = LocalDateTime.now();
}
