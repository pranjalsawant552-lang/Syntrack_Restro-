package com.pos.app.Repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.pos.app.DTO.ProductDTO;
import com.pos.app.Entity.Product;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    @Query("""
        select new com.pos.app.DTO.ProductDTO(
            p.productId,
            p.productName,
            p.prodPrice,
            p.prodGST,
            p.prodBuyPrice,
            p.active,
            p.barcode,
            p.categoryID.categoryId,
            p.categoryID.categoryName,
            p.isVeg,
            p.temporarilyUnavailable,
            p.trackStock,
            p.combo
        )
        from Product p
        where p.categoryID.categoryId = :cateId
    """)
    List<ProductDTO> findDtosByCategoryId(@Param("cateId") Long cateId);

    @Query("""
        select new com.pos.app.DTO.ProductDTO(
            p.productId,
            p.productName,
            p.prodPrice,
            p.prodGST,
            p.prodBuyPrice,
            p.active,
            p.barcode,
            p.categoryID.categoryId,
            p.categoryID.categoryName,
            p.isVeg,
            p.temporarilyUnavailable,
            p.trackStock,
            p.combo
        )
        from Product p
    """)
    List<ProductDTO> findAllDtos();

    // ✅ NEW: same as findAllDtos(), but active products only -- used by screens
    // (like POS billing) that only ever need sellable products, so they don't
    // download+parse inactive ones just to filter them out client-side.
    @Query("""
        select new com.pos.app.DTO.ProductDTO(
            p.productId,
            p.productName,
            p.prodPrice,
            p.prodGST,
            p.prodBuyPrice,
            p.active,
            p.barcode,
            p.categoryID.categoryId,
            p.categoryID.categoryName,
            p.isVeg,
            p.temporarilyUnavailable,
            p.trackStock,
            p.combo
        )
        from Product p
        where p.active = true
    """)
    List<ProductDTO> findAllActiveDtos();

    boolean existsByBarcode(String barcode);

    // ✅ "86 list" -- what's currently marked unavailable for today, and a one-tap
    // bulk clear for the start of a new shift/day.
    List<Product> findByTemporarilyUnavailableTrueOrderByProductNameAsc();

    @Modifying
    @Query("update Product p set p.temporarilyUnavailable = false, p.unavailableUntil = null where p.temporarilyUnavailable = true")
    int clearAll86s();

    /** Items whose "off until" time has passed -- switched back on by the scheduler. */
    @Modifying
    @Query("update Product p set p.temporarilyUnavailable = false, p.unavailableUntil = null "
            + "where p.temporarilyUnavailable = true and p.unavailableUntil is not null and p.unavailableUntil <= :now")
    int restoreExpired(@Param("now") java.time.LocalDateTime now);

    /** Whole menu with its category in ONE query (the availability screen shows every item). */
    @Query("select p from Product p left join fetch p.categoryID order by p.productName asc")
    List<Product> findAllWithCategory();

    @Query("select p from Product p where p.categoryID.categoryId in :categoryIds and p.active = true")
    List<Product> findActiveByCategoryIds(@Param("categoryIds") java.util.Collection<Long> categoryIds);

    @Modifying
    @Query("delete from Product p where p.categoryID.categoryId = :cateId")
    void deleteAllByCategoryId(@Param("cateId") Long cateId);

    @Modifying
    @Query("update Product p set p.active = false where p.categoryID.categoryId = :cateId")
    void deactivateAllByCategoryId(@Param("cateId") Long cateId);


    @Query("select count(p) from Product p where p.active = true")
    long countActive();

    @Query("select count(p) from Product p where p.active = false")
    long countInactive();

    /* =========================================================
       ✅ Pagination / search / filter (Phase 2)
    ========================================================= */
    @Query(value = """
        select new com.pos.app.DTO.ProductDTO(
            p.productId,
            p.productName,
            p.prodPrice,
            p.prodGST,
            p.prodBuyPrice,
            p.active,
            p.barcode,
            p.categoryID.categoryId,
            p.categoryID.categoryName,
            p.isVeg,
            p.temporarilyUnavailable,
            p.trackStock,
            p.combo
        )
        from Product p
        where (cast(:search as string) is null or cast(:search as string) = '' or
               lower(p.productName) like lower(concat('%', cast(:search as string), '%')) or
               lower(p.barcode) like lower(concat('%', cast(:search as string), '%')))
          and (:categoryId is null or p.categoryID.categoryId = :categoryId)
          and (:active is null or p.active = :active)
        """,
        countQuery = """
        select count(p)
        from Product p
        where (cast(:search as string) is null or cast(:search as string) = '' or
               lower(p.productName) like lower(concat('%', cast(:search as string), '%')) or
               lower(p.barcode) like lower(concat('%', cast(:search as string), '%')))
          and (:categoryId is null or p.categoryID.categoryId = :categoryId)
          and (:active is null or p.active = :active)
        """)
    Page<ProductDTO> search(@Param("search") String search,
                             @Param("categoryId") Long categoryId,
                             @Param("active") Boolean active,
                             Pageable pageable);
}
