package com.pos.app.Repository;

import com.pos.app.Entity.MenuItemStation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MenuItemStationRepository extends JpaRepository<MenuItemStation, Long> {
    List<MenuItemStation> findByProductIdIn(Collection<Long> productIds);
    Optional<MenuItemStation> findByProductId(Long productId);
    boolean existsByStationId(Long stationId);
}
