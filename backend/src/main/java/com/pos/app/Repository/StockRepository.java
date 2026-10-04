package com.pos.app.Repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.Product;
import com.pos.app.Entity.Stock;

@Repository
public interface StockRepository extends JpaRepository<Stock, Long> {

	Optional<Stock> getByProduct(Product prod);

	// ✅ NEW: bulk stock lookup -- one query for every product's stock, instead of
	// the frontend calling /stock/{id}/stock-value once per product (which was
	// firing hundreds of separate HTTP requests + DB round-trips on the POS and
	// Stock Management screens on every load/refresh).
	@Query("select s.product.productId, s.qty from Stock s")
	List<Object[]> findAllProductIdAndQty();


    @Query("""
      select s.product.productId, s.product.productName, s.product.barcode, s.qty
      from Stock s
      where s.qty <= :threshold
      order by s.qty asc
    """)
    List<Object[]> lowStock(int threshold);

    @Query("""
      select count(s)
      from Stock s
      where s.qty <= :threshold
    """)
    long lowStockCount(int threshold);

    // ✅ Pagination / search / filter (Phase 2)
    @Query("""
      select s from Stock s
      where (cast(:search as string) is null or cast(:search as string) = '' or
             lower(s.product.productName) like lower(concat('%', cast(:search as string), '%')) or
             lower(s.product.barcode) like lower(concat('%', cast(:search as string), '%')))
        and (:maxQty is null or s.qty <= :maxQty)
    """)
    Page<Stock> search(@Param("search") String search, @Param("maxQty") Integer maxQty, Pageable pageable);

    // ✅ Reports: total value of stock on hand (qty * buy price), across active products
    @Query("""
      select coalesce(sum(s.qty * s.product.prodBuyPrice), 0)
      from Stock s
      where s.product.active = true
    """)
    Double totalInventoryValue();

    // ✅ Reports: products with stock on hand but no sales since the given date
    @Query("""
      select s.product.productId, s.product.productName, s.product.barcode, s.qty,
             (s.qty * s.product.prodBuyPrice)
      from Stock s
      where s.qty > 0
        and not exists (
          select 1 from SalesInvoiceItem i
          join i.salesInvoiceMaster m
          where i.product.productId = s.product.productId
            and m.invoiceDate >= :sinceDate
            and m.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
        )
      order by (s.qty * s.product.prodBuyPrice) desc
    """)
    List<Object[]> slowMovingSince(@Param("sinceDate") java.time.LocalDate sinceDate);

}
