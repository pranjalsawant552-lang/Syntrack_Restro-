package com.pos.app.Repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.ProductVariant;

@Repository
public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {
    List<ProductVariant> findByProductIdOrderBySortOrderAscVariantIdAsc(Long productId);

    @Modifying
    @Query("delete from ProductVariant v where v.productId = :productId")
    void deleteAllByProductId(@Param("productId") Long productId);
}
