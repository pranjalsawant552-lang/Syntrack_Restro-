package com.pos.app.Repository;

import com.pos.app.Entity.InvoiceVoid;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvoiceVoidRepository extends JpaRepository<InvoiceVoid, Long> {
    List<InvoiceVoid> findByInvoiceIdOrderByVoidedAtDesc(Long invoiceId);
}
