package com.pos.app.Repository;

import com.pos.app.Entity.KitchenStation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KitchenStationRepository extends JpaRepository<KitchenStation, Long> {
    Optional<KitchenStation> findFirstByIsDefaultTrue();
    Optional<KitchenStation> findByNameIgnoreCase(String name);
    List<KitchenStation> findByActiveTrueOrderByNameAsc();
    List<KitchenStation> findAllByOrderByNameAsc();
}
