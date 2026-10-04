package com.pos.app.Entity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.pos.app.Enum.PaymentMethod;
import com.pos.app.Enum.PaymentStatus;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "sales_invoice_master", indexes = {
        // NOTE: columnList must be the physical (snake_case) column name, not the
        // Java field name -- confirmed against the actual column via existing native
        // queries elsewhere (e.g. SalesInvoiceItemRepository's "m.invoice_date").
        // Using the Java field name here ("invoiceDate") would generate DDL against
        // a column that doesn't exist and fail schema generation/repair entirely.
        @Index(name = "idx_sales_invoice_date", columnList = "invoice_date"),
        // ✅ InvoicesPage's /sales-invoice/search filters by these on every request
        @Index(name = "idx_sales_invoice_status", columnList = "pay_status"),
        @Index(name = "idx_sales_invoice_method", columnList = "pay_method")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SalesInvoiceMaster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long invoiceId;

    @Column(unique = true)
    private String invoiceNumber;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate invoiceDate;

    private double subTotal;
    private double gstTotal;
    private double discountValue;
    private double netTotal;

    @Enumerated(EnumType.STRING)
    private PaymentMethod payMethod;

    @Enumerated(EnumType.STRING)
    private PaymentStatus payStatus;

    /* =========================
       ✅ SPLIT PAYMENT (NEW)
       Only populated when payMethod == SPLIT. cashAmount + onlineAmount
       must equal netTotal (validated in the service layer).
    ========================= */
    private Double cashAmount;
    private Double onlineAmount;

    @Enumerated(EnumType.STRING)
    private PaymentMethod onlinePayMethod; // CARD or UPI - which online mode was used for onlineAmount

    private Long customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;

    @Column(length = 500)
    private String customerAddress;

    @OneToMany(mappedBy = "salesInvoiceMaster", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<SalesInvoiceItem> items = new ArrayList<>();

    /* =========================
       ✅ AUDIT FIELDS (NEW)
    ========================= */
    @Column(length = 255, updatable = false)
    private String createdBy;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(length = 255)
    private String updatedBy;

    private LocalDateTime updatedAt;
}
