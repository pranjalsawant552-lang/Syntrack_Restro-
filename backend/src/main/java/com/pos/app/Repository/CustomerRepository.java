package com.pos.app.Repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.pos.app.Entity.Customer;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findByIsActiveTrueOrderByCustomerNameAsc();

    // Search by name contains OR phone contains OR email contains
    List<Customer> findTop50ByCustomerNameContainingIgnoreCaseOrPhoneContainingOrEmailContainingIgnoreCase(
            String name, String phone, String email
    );



    @Query("select count(c) from Customer c where c.isActive = true")
    long countActive();

    @Query("select count(c) from Customer c where c.isActive = false")
    long countInactive();

    // ✅ Pagination / search / filter (Phase 2)
    @Query("""
      select c from Customer c
      where (cast(:search as string) is null or cast(:search as string) = '' or
             lower(c.customerName) like lower(concat('%', cast(:search as string), '%')) or
             c.phone like concat('%', cast(:search as string), '%') or
             lower(c.email) like lower(concat('%', cast(:search as string), '%')))
        and (:active is null or c.isActive = :active)
    """)
    Page<Customer> search(@Param("search") String search, @Param("active") Boolean active, Pageable pageable);
}