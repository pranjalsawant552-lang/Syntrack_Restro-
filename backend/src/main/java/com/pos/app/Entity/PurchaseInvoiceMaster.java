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

/** Mirrors SalesInvoiceMaster, but for goods bought FROM a supplier (increases stock). */
@Entity
@Table(name = "purchase_invoice_master")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseInvoiceMaster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long purchaseId;

    @Column(unique = true)
    private String purchaseNumber;

    /** The supplier's own bill/invoice reference number, if they gave one. Optional. */
    private String supplierBillNumber;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate purchaseDate;

    private double subTotal;
    private double gstTotal;
    private double discountValue;
    private double netTotal;

    @Enumerated(EnumType.STRING)
    private PaymentMethod payMethod;

    @Enumerated(EnumType.STRING)
    private PaymentStatus payStatus;

    private Long supplierId;
    private String supplierName;
    private String supplierPhone;

    @Column(length = 500)
    private String supplierAddress;

    @OneToMany(mappedBy = "purchaseInvoiceMaster", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<PurchaseInvoiceItem> items = new ArrayList<>();

    @Column(length = 255, updatable = false)
    private String createdBy;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(length = 255)
    private String updatedBy;

    private LocalDateTime updatedAt;
}
