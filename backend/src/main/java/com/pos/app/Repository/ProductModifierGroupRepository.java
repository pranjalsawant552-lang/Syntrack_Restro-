package com.pos.app.Repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.ProductModifierGroup;

@Repository
public interface ProductModifierGroupRepository extends JpaRepository<ProductModifierGroup, Long> {
    List<ProductModifierGroup> findByProductIdOrderBySortOrderAscIdAsc(Long productId);

    @Modifying
    @Query("delete from ProductModifierGroup l where l.productId = :productId")
    void deleteAllByProductId(@Param("productId") Long productId);

    @Modifying
    @Query("delete from ProductModifierGroup l where l.groupId = :groupId")
    void deleteAllByGroupId(@Param("groupId") Long groupId);
}
