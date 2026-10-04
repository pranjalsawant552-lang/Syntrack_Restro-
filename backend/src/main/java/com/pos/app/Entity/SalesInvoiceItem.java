package com.pos.app.Entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SalesInvoiceItem {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long itemId;

	// Invoice reference
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "invoice_id", nullable = false)
//  @JsonIgnore
	@JsonBackReference
	private SalesInvoiceMaster salesInvoiceMaster;

	// Product reference
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "product_id", nullable = false)
	private Product product;

	// Snapshot fields (VERY IMPORTANT)
	private String productName; // snapshot
	private double unitPrice; // price at sale time
	private double unitBuyPrice; // buy/cost price at sale time (for profit)
	private double gstPercent; // GST at sale time

	private int quantity;

	// restaurant options snapshot (null for plain retail lines)
	private String variantName;
	@Column(length = 500)
	private String optionsText;

	private double taxableAmount;
	private double gstAmount;
	private double totalAmountOfProd;

	@CreationTimestamp
	private LocalDateTime createdAt;
}
