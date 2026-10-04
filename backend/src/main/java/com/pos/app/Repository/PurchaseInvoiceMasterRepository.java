package com.pos.app.Repository;

import com.pos.app.Entity.PurchaseInvoiceMaster;
import com.pos.app.Enum.PaymentMethod;
import com.pos.app.Enum.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PurchaseInvoiceMasterRepository extends JpaRepository<PurchaseInvoiceMaster, Long> {

    long countByPurchaseDate(LocalDate purchaseDate);

    /** Highest purchase number starting with the given prefix (e.g. "PUR-20260930-"), or null. */
    @Query("select max(p.purchaseNumber) from PurchaseInvoiceMaster p where p.purchaseNumber like concat(:prefix, '%')")
    String findMaxPurchaseNumberWithPrefix(@Param("prefix") String prefix);

    @Query("select p from PurchaseInvoiceMaster p left join fetch p.items where p.purchaseId = :id")
    Optional<PurchaseInvoiceMaster> findByIdWithItems(@Param("id") long id);

    @Query("""
      select p from PurchaseInvoiceMaster p
      where (:fromDate is null or p.purchaseDate >= :fromDate)
        and (:toDate is null or p.purchaseDate <= :toDate)
        and (cast(:search as string) is null or cast(:search as string) = '' or
             lower(p.purchaseNumber) like lower(concat('%', cast(:search as string), '%')) or
             lower(p.supplierName) like lower(concat('%', cast(:search as string), '%')) or
             lower(p.supplierBillNumber) like lower(concat('%', cast(:search as string), '%')))
        and (:payStatus is null or p.payStatus = :payStatus)
        and (:payMethod is null or p.payMethod = :payMethod)
    """)
    Page<PurchaseInvoiceMaster> search(@Param("fromDate") LocalDate fromDate,
                                        @Param("toDate") LocalDate toDate,
                                        @Param("search") String search,
                                        @Param("payStatus") PaymentStatus payStatus,
                                        @Param("payMethod") PaymentMethod payMethod,
                                        Pageable pageable);

    @Query("""
      select coalesce(sum(p.netTotal),0), coalesce(sum(p.gstTotal),0), count(p.purchaseId)
      from PurchaseInvoiceMaster p
      where p.purchaseDate >= :fromDate and p.purchaseDate <= :toDate
    """)
    List<Object[]> totalsForRange(@Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);
}
