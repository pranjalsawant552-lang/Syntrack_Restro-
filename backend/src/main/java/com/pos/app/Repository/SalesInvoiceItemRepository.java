package com.pos.app.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.SalesInvoiceItem;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface SalesInvoiceItemRepository extends JpaRepository<SalesInvoiceItem, Long>{

    /** True if any product in this category has ever been sold (blocks hard delete). */
    boolean existsByProduct_CategoryID_CategoryId(Long categoryId);


    @Query("""
        select i.product.productId, i.productName, coalesce(sum(i.quantity),0), coalesce(sum(i.totalAmountOfProd),0)
        from SalesInvoiceItem i
        where i.salesInvoiceMaster.invoiceDate >= :from and i.salesInvoiceMaster.invoiceDate <= :to
          and i.salesInvoiceMaster.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
        group by i.product.productId, i.productName
        order by coalesce(sum(i.totalAmountOfProd),0) desc
    """)
    List<Object[]> topProductsByRevenue(@Param("from") LocalDate from, @Param("to") LocalDate to,
                                        org.springframework.data.domain.Pageable pageable);

    @Query("""
        select i.product.productId, i.productName, coalesce(sum(i.quantity),0), coalesce(sum(i.totalAmountOfProd),0)
        from SalesInvoiceItem i
        where i.salesInvoiceMaster.invoiceDate >= :from and i.salesInvoiceMaster.invoiceDate <= :to
          and i.salesInvoiceMaster.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
        group by i.product.productId, i.productName
        order by coalesce(sum(i.quantity),0) desc
    """)
    List<Object[]> topProductsByQty(@Param("from") LocalDate from, @Param("to") LocalDate to,
                                    org.springframework.data.domain.Pageable pageable);

    @Query("""
        select c.categoryId, c.categoryName, coalesce(sum(i.totalAmountOfProd),0), coalesce(sum(i.quantity),0)
        from SalesInvoiceItem i
        join i.product p
        join p.categoryID c
        where i.salesInvoiceMaster.invoiceDate >= :from and i.salesInvoiceMaster.invoiceDate <= :to
          and i.salesInvoiceMaster.payStatus <> com.pos.app.Enum.PaymentStatus.CANCELLED
        group by c.categoryId, c.categoryName
        order by coalesce(sum(i.totalAmountOfProd),0) desc
    """)
    List<Object[]> categorySales(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /* ========== Profit (revenue after discount − cost); discount applied proportionally per line ========== */

    @Query(value = """
        SELECT COALESCE(SUM(
            i.total_amount_of_prod * (m.net_total / NULLIF(m.sub_total + m.gst_total, 0))
            - COALESCE(i.unit_buy_price, 0) * i.quantity
        ), 0)
        FROM sales_invoice_item i
        JOIN sales_invoice_master m ON i.invoice_id = m.invoice_id
        WHERE m.invoice_date = :date AND m.pay_status <> 'CANCELLED'
        """, nativeQuery = true)
    Double todayProfit(@Param("date") LocalDate date);

    @Query(value = """
        SELECT COALESCE(SUM(
            i.total_amount_of_prod * (m.net_total / NULLIF(m.sub_total + m.gst_total, 0))
            - COALESCE(i.unit_buy_price, 0) * i.quantity
        ), 0)
        FROM sales_invoice_item i
        JOIN sales_invoice_master m ON i.invoice_id = m.invoice_id
        WHERE m.invoice_date >= :from AND m.invoice_date <= :to AND m.pay_status <> 'CANCELLED'
        """, nativeQuery = true)
    Double rangeProfit(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = """
        SELECT COALESCE(SUM(
            i.total_amount_of_prod * (m.net_total / NULLIF(m.sub_total + m.gst_total, 0))
            - COALESCE(i.unit_buy_price, 0) * i.quantity
        ), 0)
        FROM sales_invoice_item i
        JOIN sales_invoice_master m ON i.invoice_id = m.invoice_id
        WHERE m.pay_status <> 'CANCELLED'
        """, nativeQuery = true)
    Double allTimeProfit();

    @Query(value = """
        SELECT i.product_id, i.product_name,
            COALESCE(SUM(
                i.total_amount_of_prod * (m.net_total / NULLIF(m.sub_total + m.gst_total, 0))
                - COALESCE(i.unit_buy_price, 0) * i.quantity
            ), 0) AS profit
        FROM sales_invoice_item i
        JOIN sales_invoice_master m ON i.invoice_id = m.invoice_id
        WHERE m.invoice_date >= :from AND m.invoice_date <= :to AND m.pay_status <> 'CANCELLED'
        GROUP BY i.product_id, i.product_name
        ORDER BY profit DESC
        """, nativeQuery = true)
    List<Object[]> topProductsByProfit(@Param("from") LocalDate from, @Param("to") LocalDate to);

}
