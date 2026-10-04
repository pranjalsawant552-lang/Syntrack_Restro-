package com.pos.app.Repository;

import com.pos.app.Entity.Ingredient;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface IngredientRepository extends JpaRepository<Ingredient, Long> {

    Optional<Ingredient> findByNameIgnoreCase(String name);

    @Query("select i from Ingredient i where (:active is null or i.active = :active) " +
           "and (cast(:q as string) is null or lower(i.name) like lower(concat('%', cast(:q as string), '%'))) order by i.name asc")
    List<Ingredient> search(@Param("q") String q, @Param("active") Boolean active);

    /** Row-locks the ingredients in a fixed (id) order so concurrent KOTs cannot deadlock or oversell. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Ingredient i where i.ingredientId in :ids order by i.ingredientId asc")
    List<Ingredient> lockAllByIds(@Param("ids") Collection<Long> ids);
}
