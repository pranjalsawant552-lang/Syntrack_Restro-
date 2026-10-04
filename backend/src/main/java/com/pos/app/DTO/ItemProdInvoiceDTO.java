package com.pos.app.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ItemProdInvoiceDTO {

	private Long product;
    
	 // Snapshot fields (VERY IMPORTANT)
	    private String productName;      // snapshot
	    private double unitPrice;         // price at sale time
	    private double gstPercent;        // GST at sale time

	    private int quantity;

	    private double taxableAmount;
	    private double gstAmount;
	    private double totalAmountOfProd;
}
