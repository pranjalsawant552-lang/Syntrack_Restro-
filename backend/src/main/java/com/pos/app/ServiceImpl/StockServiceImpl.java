package com.pos.app.ServiceImpl;

import com.pos.app.common.util.PageGuard;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.pos.app.Entity.Product;
import com.pos.app.Entity.Stock;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Repository.StockRepository;
import com.pos.app.Service.IStockService;

import jakarta.transaction.Transactional;
@Service
@Transactional
public class StockServiceImpl implements IStockService {

	@Autowired
	private StockRepository stockRepo;
	
	@Autowired
	private ProductRepository prodRepo;

	@Autowired
	private StockMovementServiceImpl stockMovService;

	@Override
	public ResponseEntity<?> addQtyToProduct(long prodId, int stockQty) {
		Product prod = prodRepo.findById(prodId).orElseThrow(()-> new ResourceNotFoundExceptionHandling("Product Not found"));

		// Delegate to StockMovementService: it correctly finds-or-creates the
		// product's single Stock row and adds to it, and records an auditable
		// StockMovement. The previous implementation here always inserted a
		// brand-new Stock row on every call -- silently creating duplicate
		// stock rows per product instead of incrementing the existing one.
		stockMovService.productIN(prodId, stockQty);

		return new ResponseEntity<>("Stock "+stockQty+" added to "+prod.getProductName()+" successfully", HttpStatus.CREATED);
	}

	@Override
	public ResponseEntity<?> displayStockQtyOfProduct(long prodId) {
		// TODO Auto-generated method stub
		Product prod = prodRepo.findById(prodId).orElseThrow(()-> new ResourceNotFoundExceptionHandling("Product Not found"));
		
		Stock stk = stockRepo.getByProduct(prod).orElseGet(() -> {
            Stock newStock = new Stock();
            newStock.setProduct(prod);
            newStock.setQty(0);
            return newStock;
        });
		
		return ResponseEntity.ok(stk.getQty());
	}

	@Override
	public ResponseEntity<?> updateQtyToProduct(long prodId, int updateStockQty) {
		Product prod = prodRepo.findById(prodId).orElseThrow(()-> new ResourceNotFoundExceptionHandling("Product Not found"));
		
		Stock stk = stockRepo.getByProduct(prod).orElseGet(() -> {
            Stock newStock = new Stock();
            newStock.setProduct(prod);
            newStock.setQty(0);
            return newStock;
        });
		
		stk.setQty(updateStockQty);
		// Explicit save: for a product with no existing Stock row, `stk` above is a
		// brand-new, never-persisted entity. JPA dirty-checking only auto-flushes
		// already-managed entities, so without this call the update silently never
		// reached the database for that case (while reporting success).
		stockRepo.save(stk);
		
		return new ResponseEntity<>("Stock "+updateStockQty+" Updated to "+prod.getProductName()+" successfully", HttpStatus.OK);

	}

	// ✅ NEW: every product's stock qty in one call, instead of the frontend
	// looping /stock/{id}/stock-value once per product.
	@Override
	public ResponseEntity<?> allStockQuantities() {
		java.util.Map<Long, Integer> qtyByProductId = new java.util.HashMap<>();
		for (Object[] row : stockRepo.findAllProductIdAndQty()) {
			Long productId = (Long) row[0];
			Integer qty = ((Number) row[1]).intValue();
			qtyByProductId.put(productId, qty);
		}
		return ResponseEntity.ok(qtyByProductId);
	}

	@Override
	public ResponseEntity<?> searchStock(int page, int size, String search, Integer maxQty, String sort) {
		String[] sortParts = sort.split(",");
		String sortField = sortParts.length > 0 && !sortParts[0].isBlank() ? sortParts[0] : "qty";
		org.springframework.data.domain.Sort.Direction dir =
				sortParts.length > 1 && sortParts[1].equalsIgnoreCase("desc")
						? org.springframework.data.domain.Sort.Direction.DESC
						: org.springframework.data.domain.Sort.Direction.ASC;

		org.springframework.data.domain.Page<Stock> result = stockRepo.search(
				search, maxQty,
				org.springframework.data.domain.PageRequest.of(PageGuard.page(page), PageGuard.size(size),
						org.springframework.data.domain.Sort.by(dir, sortField)));

		return ResponseEntity.ok(java.util.Map.of(
				"content", result.getContent(),
				"totalElements", result.getTotalElements(),
				"totalPages", result.getTotalPages(),
				"page", page,
				"size", size
		));
	}
}
