package com.pos.app.Service;

import org.springframework.http.ResponseEntity;

import com.pos.app.DTO.AddItemsToInvoiceDTO;

public interface ISalesInvoiceItem {

	ResponseEntity<?> addItemsToInvoiceDB(AddItemsToInvoiceDTO itemList);

}
