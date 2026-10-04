package com.pos.app.Repository;

import com.pos.app.Entity.KotItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface KotItemRepository extends JpaRepository<KotItem, Long> {

    @Query("select ki from KotItem ki join fetch ki.kot k left join fetch k.items where ki.orderItemId = :orderItemId")
    Optional<KotItem> findByOrderItemIdWithKot(@Param("orderItemId") Long orderItemId);

    @Query("select ki from KotItem ki join fetch ki.kot k left join fetch k.items where ki.kotItemId = :id")
    Optional<KotItem> findByIdWithKot(@Param("id") Long id);
}
