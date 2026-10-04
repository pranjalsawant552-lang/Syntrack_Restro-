package com.pos.app.Entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import com.fasterxml.jackson.annotation.JsonBackReference;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors SalesInvoiceItem, but for the cost side (what we paid the supplier). */
@Entity
@Table(name = "purchase_invoice_item")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseInvoiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long itemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_id", nullable = false)
    @JsonBackReference
    private PurchaseInvoiceMaster purchaseInvoiceMaster;

    /** Set for a menu-item/retail line; NULL for an ingredient line (see ingredientId). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    /** Set for an ingredient line (stock goes to ingredient inventory); NULL for a product line. */
    private Long ingredientId;

    /** Quantity as entered on the bill (e.g. 2.5), in {@link #ingredientUnit}. */
    @Column(precision = 16, scale = 4)
    private BigDecimal ingredientQty;

    /** Unit the ingredient was bought in (KG, L, DOZEN, G, ML, PCS ...). unitCost is per this unit. */
    @Column(length = 8)
    private String ingredientUnit;

    // Snapshot fields, same rationale as SalesInvoiceItem
    private String productName;
    private double unitCost;     // what we paid per unit this purchase
    private double gstPercent;
    private int quantity;
    private double taxableAmount;
    private double gstAmount;
    private double totalAmountOfProd;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
