package com.pos.app.Repository;

import com.pos.app.Entity.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    List<Supplier> findByIsActiveTrueOrderBySupplierNameAsc();

    @Query("""
      select s from Supplier s
      where (cast(:search as string) is null or cast(:search as string) = '' or
             lower(s.supplierName) like lower(concat('%', cast(:search as string), '%')) or
             s.phone like concat('%', cast(:search as string), '%') or
             lower(s.email) like lower(concat('%', cast(:search as string), '%')))
        and (:active is null or s.isActive = :active)
    """)
    Page<Supplier> search(@Param("search") String search, @Param("active") Boolean active, Pageable pageable);
}
