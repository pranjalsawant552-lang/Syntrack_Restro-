package com.pos.app.Repository;

import com.pos.app.Entity.QrOrderRequest;
import com.pos.app.Enum.QrRequestStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface QrOrderRequestRepository extends JpaRepository<QrOrderRequest, Long> {

    List<QrOrderRequest> findByStatusAndCreatedAtAfterOrderByCreatedAtAsc(QrRequestStatus status, LocalDateTime after);

    List<QrOrderRequest> findByStatusAndCreatedAtAfter(QrRequestStatus status, LocalDateTime after);

    List<QrOrderRequest> findBySessionIdOrderByCreatedAtDesc(Long sessionId);

    List<QrOrderRequest> findBySessionIdAndStatus(Long sessionId, QrRequestStatus status);

    List<QrOrderRequest> findByTableIdAndStatus(Long tableId, QrRequestStatus status);

    Optional<QrOrderRequest> findBySessionIdAndClientRequestId(Long sessionId, String clientRequestId);

    /** Row lock so two waiters tapping Accept at once can't both apply the same request. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from QrOrderRequest r where r.id = :id")
    Optional<QrOrderRequest> lockById(@Param("id") Long id);
}
