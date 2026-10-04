package com.pos.app.Repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.pos.app.Entity.PurchaseInvoiceItem;

@Repository
public interface PurchaseInvoiceItemRepository extends JpaRepository<PurchaseInvoiceItem, Long> {

    /** True if any product in this category has ever been purchased (blocks hard delete). */
    boolean existsByProduct_CategoryID_CategoryId(Long categoryId);
}
