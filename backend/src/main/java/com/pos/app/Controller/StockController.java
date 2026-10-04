package com.pos.app.Controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pos.app.Service.IStockService;
import com.pos.app.config.ApiVersionConfig;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/stock")
public class StockController {

	@Autowired
	private IStockService stockService;

	@PreAuthorize("hasAuthority('PERM_STOCK_ADJUST')")
	@PostMapping("/{prodId}/stock-add")
	ResponseEntity<?> addStockQtyToProduct(@PathVariable long prodId, @RequestParam int stockQty) {

		return stockService.addQtyToProduct(prodId, stockQty);
	}
	
	@PreAuthorize("hasAuthority('PERM_STOCK_VIEW')")
	@GetMapping("/{prodId}/stock-value")
	ResponseEntity<?> getStockQtyOfProduct(@PathVariable long prodId) {

		return stockService.displayStockQtyOfProduct(prodId);
	}

	// ✅ NEW: every product's stock qty in ONE call (productId -> qty), instead of
	// calling the endpoint above once per product. Use this for any screen that
	// needs stock alongside a full product list (POS billing screen, Stock
	// Management list) -- looping the single-product endpoint per row does one
	// extra HTTP round-trip + DB query per product, which gets slow fast as the
	// catalog grows.
	@PreAuthorize("hasAuthority('PERM_STOCK_VIEW')")
	@GetMapping("/all")
	ResponseEntity<?> getAllStockQuantities() {

		return stockService.allStockQuantities();
	}
	
	@PreAuthorize("hasAuthority('PERM_STOCK_ADJUST')")
	@PutMapping("/{prodId}/stock-update")
	ResponseEntity<?> updateStockQtyToProduct(@PathVariable long prodId, @RequestParam int updateStockQty) {

		return stockService.updateQtyToProduct(prodId, updateStockQty);
	}

	// ✅ paginated / searchable stock list
	@PreAuthorize("hasAuthority('PERM_STOCK_VIEW')")
	@GetMapping("/search")
	ResponseEntity<?> searchStock(
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "10") int size,
			@RequestParam(required = false) String search,
			@RequestParam(required = false) Integer maxQty,
			@RequestParam(defaultValue = "qty,asc") String sort
	) {
		return stockService.searchStock(page, size, search, maxQty, sort);
	}
}
