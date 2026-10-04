package com.pos.app.Repository;

import com.pos.app.Entity.IngredientMovement;
import com.pos.app.Enum.IngredientMovementType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface IngredientMovementRepository extends JpaRepository<IngredientMovement, Long> {

    boolean existsByRefTypeAndRefIdAndType(String refType, String refId, IngredientMovementType type);

    boolean existsByIngredient_IngredientId(Long ingredientId);

    @Query("select m from IngredientMovement m join fetch m.ingredient i where " +
           "(:ingredientId is null or i.ingredientId = :ingredientId) " +
           "and (:type is null or m.type = :type) " +
           "and m.createdAt >= :from and m.createdAt < :to order by m.createdAt desc, m.movementId desc")
    List<IngredientMovement> search(@Param("ingredientId") Long ingredientId,
                                    @Param("type") IngredientMovementType type,
                                    @Param("from") LocalDateTime from,
                                    @Param("to") LocalDateTime to,
                                    Pageable pageable);
}
