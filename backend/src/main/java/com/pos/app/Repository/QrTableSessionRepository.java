package com.pos.app.Repository;

import com.pos.app.Entity.QrTableSession;
import com.pos.app.Enum.QrSessionState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface QrTableSessionRepository extends JpaRepository<QrTableSession, Long> {

    Optional<QrTableSession> findByTokenHash(String tokenHash);

    List<QrTableSession> findByTableIdAndStateIn(Long tableId, Collection<QrSessionState> states);

    /** Live sessions across the whole floor -- one query feeds the tables board. */
    List<QrTableSession> findByStateInAndExpiresAtAfter(Collection<QrSessionState> states, LocalDateTime now);

    long countByTableIdAndStateInAndExpiresAtAfter(Long tableId, Collection<QrSessionState> states, LocalDateTime now);

    long countByClientIpAndStateAndExpiresAtAfter(String clientIp, QrSessionState state, LocalDateTime now);

    /** "Strikes": scans that never turned into an order (hold lapsed, or staff rejected it). */
    long countByDeviceIdAndOrderIdIsNullAndStateInAndCreatedAtAfter(String deviceId, Collection<QrSessionState> states,
                                                                     LocalDateTime since);

    long countByClientIpAndOrderIdIsNullAndStateInAndCreatedAtAfter(String clientIp, Collection<QrSessionState> states,
                                                                     LocalDateTime since);

    /** Lazy expiry: flips anything past its time to EXPIRED so strike counting sees it. */
    @Modifying
    @Query("update QrTableSession s set s.state = com.pos.app.Enum.QrSessionState.EXPIRED, s.closeReason = 'TIME_UP' "
            + "where s.state in (com.pos.app.Enum.QrSessionState.HOLD, com.pos.app.Enum.QrSessionState.ACTIVE) "
            + "and s.expiresAt < :now")
    int expireStale(@Param("now") LocalDateTime now);
}
