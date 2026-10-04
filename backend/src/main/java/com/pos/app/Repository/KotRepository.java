package com.pos.app.Repository;

import com.pos.app.Entity.Kot;
import com.pos.app.Enum.KotStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface KotRepository extends JpaRepository<Kot, Long> {

    @Query("select distinct k from Kot k left join fetch k.items where k.status in :statuses " +
           "and (:stationId is null or k.stationId = :stationId) order by k.createdAt asc, k.kotId asc")
    List<Kot> findActive(@Param("statuses") Collection<KotStatus> statuses, @Param("stationId") Long stationId);

    @Query("select distinct k from Kot k left join fetch k.items where k.kotId = :id")
    Optional<Kot> findByIdWithItems(@Param("id") Long id);

    @Query("select distinct k from Kot k left join fetch k.items where k.orderId = :orderId order by k.createdAt asc")
    List<Kot> findByOrderIdWithItems(@Param("orderId") Long orderId);
}
