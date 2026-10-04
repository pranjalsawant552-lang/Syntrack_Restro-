package com.pos.app.Repository;

import com.pos.app.Entity.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    @Query("select distinct r from Recipe r left join fetch r.items it left join fetch it.ingredient " +
           "where r.product.productId = :productId")
    Optional<Recipe> findByProductIdWithItems(@Param("productId") Long productId);

    boolean existsByProduct_ProductId(Long productId);

    @Query("select distinct r from Recipe r join fetch r.product left join fetch r.items it left join fetch it.ingredient")
    List<Recipe> findAllWithItems();
}
