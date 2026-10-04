package com.pos.app.Repository;

import com.pos.app.Entity.IngredientBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface IngredientBatchRepository extends JpaRepository<IngredientBatch, Long> {

    @Query("select b from IngredientBatch b where b.ingredient.ingredientId = :ingredientId and b.qtyRemaining > 0")
    List<IngredientBatch> findOpenByIngredient(@Param("ingredientId") Long ingredientId);

    @Query("select b from IngredientBatch b join fetch b.ingredient where b.qtyRemaining > 0 " +
           "and b.expiryDate is not null and b.expiryDate <= :cutoff order by b.expiryDate asc")
    List<IngredientBatch> findOpenExpiringOnOrBefore(@Param("cutoff") LocalDate cutoff);
}
