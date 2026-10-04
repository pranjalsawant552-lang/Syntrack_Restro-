package com.pos.app.Repository;

import com.pos.app.Entity.DiningTable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DiningTableRepository extends JpaRepository<DiningTable, Long> {
    List<DiningTable> findByActiveTrueOrderByTableNameAsc();

    Optional<DiningTable> findByQrToken(String qrToken);
}
