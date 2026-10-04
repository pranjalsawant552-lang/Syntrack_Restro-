package com.pos.app.Service;

import org.springframework.http.ResponseEntity;

public interface IStockService {

	ResponseEntity<?> addQtyToProduct(long prodId, int stockQty);

	ResponseEntity<?> displayStockQtyOfProduct(long prodId);

	ResponseEntity<?> updateQtyToProduct(long prodId, int updateStockQty);

	ResponseEntity<?> searchStock(int page, int size, String search, Integer maxQty, String sort);

	// ✅ NEW: every product's stock qty in one call (productId -> qty)
	ResponseEntity<?> allStockQuantities();

}
