package com.pos.app.common.service;

import com.pos.app.Entity.AuditLog;
import com.pos.app.Repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository auditLogRepository;

    public void log(String action, String entityType, String entityId, String details) {
        try {
            AuditLog entry = new AuditLog();
            entry.setAction(action);
            entry.setEntityType(entityType);
            entry.setEntityId(entityId);
            entry.setPerformedBy(currentActor());
            entry.setDetails(details);
            auditLogRepository.save(entry);
        } catch (Exception e) {
            // Audit logging must never break the primary operation it's attached to.
            log.warn("Failed to write audit log for action={} entity={}/{}: {}", action, entityType, entityId, e.getMessage());
        }
    }

    private String currentActor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return "SYSTEM";
        return auth.getName();
    }
}
