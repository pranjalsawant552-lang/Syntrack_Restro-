package com.pos.app.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.CashShift;
import com.pos.app.Enum.CashShiftStatus;

@Repository
public interface CashShiftRepository extends JpaRepository<CashShift, Long> {

    Optional<CashShift> findFirstByStatusOrderByOpenedAtDesc(CashShiftStatus status);

    List<CashShift> findByOpenedAtBetweenOrderByOpenedAtDesc(LocalDateTime from, LocalDateTime to);
}
