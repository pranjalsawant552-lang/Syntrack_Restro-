package com.pos.app.Controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pos.app.DTO.AddItemsToInvoiceDTO;
import com.pos.app.Service.ISalesInvoiceItem;
import com.pos.app.config.ApiVersionConfig;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION+"/items-invoice")
public class SalesInvoiceItemController {

	@Autowired
	private ISalesInvoiceItem itemService;
	
	@PreAuthorize("hasAuthority('PERM_INVOICE_CREATE')")
	@PostMapping("/add-items")
	ResponseEntity<?> addItemsOfInvoice(@RequestBody AddItemsToInvoiceDTO itemList)
	{
		return itemService.addItemsToInvoiceDB(itemList);
	}
}
