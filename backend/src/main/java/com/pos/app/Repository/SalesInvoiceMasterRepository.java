package com.pos.app.Repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.SalesInvoiceMaster;
import com.pos.app.Enum.PaymentMethod;
import com.pos.app.Enum.PaymentStatus;

@Repository
public interface SalesInvoiceMasterRepository extends JpaRepository<SalesInvoiceMaster, Long>{

    long countByInvoiceDate(LocalDate invoiceDate);

    /* ===== cash reconciliation: what was actually collected between two moments ===== */

    /** Paid invoices settled entirely with one method (CASH / CARD / UPI). */
    @Query("select coalesce(sum(m.netTotal), 0) from SalesInvoiceMaster m " +
           "where m.createdAt >= :from and m.createdAt < :to " +
           "and m.payStatus = com.pos.app.Enum.PaymentStatus.PAID and m.payMethod = :method")
    Double sumPaidByMethod(@Param("from") java.time.LocalDateTime from,
                           @Param("to") java.time.LocalDateTime to,
                           @Param("method") PaymentMethod method);

    /** Cash portion of paid SPLIT invoices. */
    @Query("select coalesce(sum(m.cashAmount), 0) from SalesInvoiceMaster m " +
           "where m.createdAt >= :from and m.createdAt < :to " +
           "and m.payStatus = com.pos.app.Enum.PaymentStatus.PAID " +
           "and m.payMethod = com.pos.app.Enum.PaymentMethod.SPLIT")
    Double sumSplitCash(@Param("from") java.time.LocalDateTime from, @Param("to") java.time.LocalDateTime to);

    /** Online (card/UPI) portion of paid SPLIT invoices for the given online method. */
    @Query("select coalesce(sum(m.onlineAmount), 0) from SalesInvoiceMaster m " +
           "where m.createdAt >= :from and m.createdAt < :to " +
           "and m.payStatus = com.pos.app.Enum.PaymentStatus.PAID " +
           "and m.payMethod = com.pos.app.Enum.PaymentMethod.SPLIT and m.onlinePayMethod = :method")
    Double sumSplitOnline(@Param("from") java.time.LocalDateTime from,
                          @Param("to") java.time.LocalDateTime to,
                          @Param("method") PaymentMethod method);

    /** Billed but not yet paid (PENDING) -- shown so it isn't mistaken for missing cash. */
    @Query("select coalesce(sum(m.netTotal), 0) from SalesInvoiceMaster m " +
           "where m.createdAt >= :from and m.createdAt < :to " +
           "and m.payStatus = com.pos.app.Enum.PaymentStatus.PENDING")
    Double sumPending(@Param("from") java.time.LocalDateTime from, @Param("to") java.time.LocalDateTime to);

    @Query("select count(m) from SalesInvoiceMaster m " +
           "where m.createdAt >= :from and m.createdAt < :to " +
           "and m.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED")
    long countLive(@Param("from") java.time.LocalDateTime from, @Param("to") java.time.LocalDateTime to);

    List<SalesInvoiceMaster> findByInvoiceDateBetweenOrderByInvoiceIdDesc(LocalDate from, LocalDate to);

    // Eagerly loads items in the same query — avoids LazyInitializationException for
    // callers (like PDF export) that read invoice.getItems() outside of a @Transactional
    // service method, where the Hibernate session would otherwise already be closed.
    @org.springframework.data.jpa.repository.Query(
            "select i from SalesInvoiceMaster i left join fetch i.items where i.invoiceId = :id")
    java.util.Optional<SalesInvoiceMaster> findByIdWithItems(@org.springframework.data.repository.query.Param("id") long id);

    @Query("""
      select
        coalesce(sum(sim.netTotal),0),
        coalesce(sum(sim.subTotal),0),
        coalesce(sum(sim.gstTotal),0),
        coalesce(sum(sim.discountValue),0),
        count(sim.invoiceId)
      from SalesInvoiceMaster sim
      where sim.invoiceDate = :date
        and sim.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
    """)
    Object[] dayTotals(@Param("date") LocalDate date);

    @Query("""
      select 
        coalesce(sum(m.netTotal),0),
        coalesce(sum(m.subTotal),0),
        coalesce(sum(m.gstTotal),0),
        coalesce(sum(m.discountValue),0),
        count(m)
      from SalesInvoiceMaster m
      where m.invoiceDate >= :from and m.invoiceDate <= :to
        and m.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
    """)
    Object[] rangeTotals(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
        select coalesce(sum(m.netTotal),0), count(m)
        from SalesInvoiceMaster m
        where m.invoiceDate >= :from and m.invoiceDate <= :to
          and m.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
    """)
    Object[] rangeSalesAndCount(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
        select m.invoiceDate, coalesce(sum(m.netTotal),0), count(m)
        from SalesInvoiceMaster m
        where m.invoiceDate >= :from and m.invoiceDate <= :to
          and m.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
        group by m.invoiceDate
        order by m.invoiceDate asc
    """)
    List<Object[]> trend(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
        select m.invoiceId, m.invoiceNumber, m.invoiceDate, m.netTotal, m.payMethod, m.payStatus, m.customerName
        from SalesInvoiceMaster m
        order by m.invoiceId desc
    """)
    List<Object[]> recentInvoices(org.springframework.data.domain.Pageable pageable);

    /* =========================================================
       ✅ NEW: PENDING AMOUNTS
    ========================================================= */

    @Query("""
      select coalesce(sum(m.netTotal),0)
      from SalesInvoiceMaster m
      where m.invoiceDate = :date
        and m.payStatus = com.pos.app.Enum.PaymentStatus.PENDING
    """)
    Object todayPendingAmount(@Param("date") LocalDate date);

    @Query("""
      select coalesce(sum(m.netTotal),0)
      from SalesInvoiceMaster m
      where m.invoiceDate >= :from and m.invoiceDate <= :to
        and m.payStatus = com.pos.app.Enum.PaymentStatus.PENDING
    """)
    Object rangePendingAmount(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
      select coalesce(sum(m.netTotal),0)
      from SalesInvoiceMaster m
      where m.payStatus = com.pos.app.Enum.PaymentStatus.PENDING
    """)
    Object allTimePendingAmount();

    /* =========================================================
       ✅ NEW: PAYMENT METHOD TOTALS (TODAY / RANGE / ALL TIME)
    ========================================================= */

    @Query("""
      select m.payMethod, coalesce(sum(m.netTotal),0)
      from SalesInvoiceMaster m
      where m.invoiceDate = :date
        and m.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
      group by m.payMethod
    """)
    List<Object[]> dayMethodTotals(@Param("date") LocalDate date);

    @Query("""
      select m.payMethod, coalesce(sum(m.netTotal),0)
      from SalesInvoiceMaster m
      where m.invoiceDate >= :from and m.invoiceDate <= :to
        and m.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
      group by m.payMethod
    """)
    List<Object[]> rangeMethodTotals(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
      select m.payMethod, coalesce(sum(m.netTotal),0)
      from SalesInvoiceMaster m
      where m.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
      group by m.payMethod
    """)
    List<Object[]> allTimeMethodTotals();

    /* =========================================================
       ✅ NEW: ALL TIME TOTALS (since start)
    ========================================================= */
    @Query("""
      select
        coalesce(sum(m.netTotal),0),
        coalesce(sum(m.subTotal),0),
        coalesce(sum(m.gstTotal),0),
        coalesce(sum(m.discountValue),0),
        count(m)
      from SalesInvoiceMaster m
      where m.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
    """)
    Object[] allTimeTotals();

    /* =========================================================
       ✅ Pagination / search / filter (Phase 2)
    ========================================================= */
    @Query("""
      select m from SalesInvoiceMaster m
      where (:fromDate is null or m.invoiceDate >= :fromDate)
        and (:toDate is null or m.invoiceDate <= :toDate)
        and (cast(:search as string) is null or cast(:search as string) = '' or
             lower(m.invoiceNumber) like lower(concat('%', cast(:search as string), '%')) or
             lower(m.customerName) like lower(concat('%', cast(:search as string), '%')) or
             lower(m.customerPhone) like lower(concat('%', cast(:search as string), '%')))
        and (:payStatus is null or m.payStatus = :payStatus)
        and (:payMethod is null or m.payMethod = :payMethod)
    """)
    Page<SalesInvoiceMaster> search(@Param("fromDate") LocalDate fromDate,
                                     @Param("toDate") LocalDate toDate,
                                     @Param("search") String search,
                                     @Param("payStatus") PaymentStatus payStatus,
                                     @Param("payMethod") PaymentMethod payMethod,
                                     Pageable pageable);

    // ✅ Same filters as search() above, but a single aggregate row instead of
    // every matching invoice -- lets the paginated /search endpoint report the
    // grand total (and count) across ALL matching invoices, not just the page
    // that happens to be loaded on screen.
    @Query("""
      select coalesce(sum(m.netTotal),0), count(m)
      from SalesInvoiceMaster m
      where (:fromDate is null or m.invoiceDate >= :fromDate)
        and (:toDate is null or m.invoiceDate <= :toDate)
        and (cast(:search as string) is null or cast(:search as string) = '' or
             lower(m.invoiceNumber) like lower(concat('%', cast(:search as string), '%')) or
             lower(m.customerName) like lower(concat('%', cast(:search as string), '%')) or
             lower(m.customerPhone) like lower(concat('%', cast(:search as string), '%')))
        and (:payStatus is null or m.payStatus = :payStatus)
        and (:payStatus is not null or m.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED)
        and (:payMethod is null or m.payMethod = :payMethod)
    """)
    Object[] searchTotals(@Param("fromDate") LocalDate fromDate,
                           @Param("toDate") LocalDate toDate,
                           @Param("search") String search,
                           @Param("payStatus") PaymentStatus payStatus,
                           @Param("payMethod") PaymentMethod payMethod);
}
