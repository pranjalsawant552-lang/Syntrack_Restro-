package com.pos.app.Repository;

import com.pos.app.Entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    @Query("""
      select a from AuditLog a
      where (cast(:search as string) is null or cast(:search as string) = '' or
             lower(a.action) like lower(concat('%', cast(:search as string), '%')) or
             lower(a.performedBy) like lower(concat('%', cast(:search as string), '%')) or
             lower(a.entityType) like lower(concat('%', cast(:search as string), '%')))
      order by a.createdAt desc
    """)
    Page<AuditLog> search(@Param("search") String search, Pageable pageable);
}
