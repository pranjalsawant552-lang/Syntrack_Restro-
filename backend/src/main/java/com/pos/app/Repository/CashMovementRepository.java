package com.pos.app.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.CashMovement;

@Repository
public interface CashMovementRepository extends JpaRepository<CashMovement, Long> {

    List<CashMovement> findByShiftIdOrderByCreatedAtAsc(Long shiftId);
}
