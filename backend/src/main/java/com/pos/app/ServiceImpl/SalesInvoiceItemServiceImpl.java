package com.pos.app.ServiceImpl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.pos.app.DTO.AddItemsToInvoiceDTO;
import com.pos.app.DTO.ItemProdInvoiceDTO;
import com.pos.app.Entity.Product;
import com.pos.app.Entity.SalesInvoiceMaster;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Repository.SalesInvoiceItemRepository;
import com.pos.app.Repository.SalesInvoiceMasterRepository;
import com.pos.app.Service.ISalesInvoiceItem;

import jakarta.transaction.Transactional;

@Service
@Transactional
public class SalesInvoiceItemServiceImpl implements ISalesInvoiceItem {

	@Autowired
	private ProductRepository prodRepo;
	
	@Autowired
	private SalesInvoiceItemRepository saleItemRepo;
	
	@Autowired
	private SalesInvoiceMasterRepository salesInvoiceRepo;

	@Override
	public ResponseEntity<?> addItemsToInvoiceDB(AddItemsToInvoiceDTO itemList) {
		// TODO Auto-generated method stub
		SalesInvoiceMaster invoiceMaster = salesInvoiceRepo.findById(itemList.getSalesInvoiceMaster()).orElseThrow(()-> new ResourceNotFoundExceptionHandling("Invoice Not found"));
		
		/*for(OrderItemsDTO itemDTO : orderDetails.getOrderItems())
		{
			CartProducts item = new CartProducts();
			item.setProducts(itemDTO.getProduct());
			item.setQuantity(itemDTO.getQuantity());
			item.setShoppingCartObj(shopKart);
			shopKart.getCartProductsList().add(item);
		}*/
		
		for(ItemProdInvoiceDTO itemDTO : itemList.getProdList() )
		{
			Product prod = prodRepo.findById(itemDTO.getProduct()).orElseThrow(()-> new ResourceNotFoundExceptionHandling("Product Not found"));
			
		}
		
		return null;
	}
}
