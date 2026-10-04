package com.pos.app.Controller;

import com.pos.app.Entity.AuditLog;
import com.pos.app.Repository.AuditLogRepository;
import com.pos.app.config.ApiVersionConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/audit-logs")
@RequiredArgsConstructor
@CrossOrigin
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    @PreAuthorize("hasAuthority('PERM_AUDIT_VIEW')")
    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search
    ) {
        Page<AuditLog> result = auditLogRepository.search(search,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));

        return ResponseEntity.ok(Map.of(
                "content", result.getContent(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "page", page,
                "size", size
        ));
    }
}
