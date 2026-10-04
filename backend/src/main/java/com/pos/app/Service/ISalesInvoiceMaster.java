package com.pos.app.Service;

import org.springframework.http.ResponseEntity;

import com.pos.app.DTO.InvoiceRequestDTO;
import com.pos.app.Entity.SalesInvoiceMaster;

import java.time.LocalDate;

public interface ISalesInvoiceMaster {

    ResponseEntity<?> insertInvoiceInDB(SalesInvoiceMaster invoiceData);

    ResponseEntity<?> fetchSingleInvoiceById(long invoiceId);

    // ✅ UPDATED: createdBy
    ResponseEntity<?> createInvoice(InvoiceRequestDTO request, String createdBy);

    ResponseEntity<?> listInvoices(LocalDate fromDate, LocalDate toDate);

    // ✅ UPDATED: deletedBy (optional but good)
    ResponseEntity<?> voidInvoice(long invoiceId, String reason, String voidedBy);

    // ✅ UPDATED: updatedBy
    ResponseEntity<?> updateInvoice(long invoiceId, InvoiceRequestDTO request, String updatedBy);

    ResponseEntity<?> searchInvoices(int page, int size, java.time.LocalDate fromDate, java.time.LocalDate toDate,
                                      String search, com.pos.app.Enum.PaymentStatus payStatus,
                                      com.pos.app.Enum.PaymentMethod payMethod, String sort);
}
