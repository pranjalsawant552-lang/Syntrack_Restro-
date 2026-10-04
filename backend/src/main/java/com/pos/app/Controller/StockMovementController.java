package com.pos.app.Controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import com.pos.app.Service.IStockMovementService;
import com.pos.app.config.ApiVersionConfig;

@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/stk-mvmt")
public class StockMovementController {

    @Autowired
    private IStockMovementService stkMvmtService;

    @PreAuthorize("hasAuthority('PERM_STOCK_ADJUST')")
	@PostMapping("/{prodId}/prod-IN")
    public ResponseEntity<?> stockMovementTypeIN(@PathVariable long prodId, @RequestParam int prodQty) {
        stkMvmtService.productIN(prodId, prodQty);
        return ResponseEntity.status(HttpStatus.CREATED).body("Product IN in store successfully");
    }

    @PreAuthorize("hasAuthority('PERM_STOCK_ADJUST')")
	@PostMapping("/{prodId}/prod-OUT")
    public ResponseEntity<?> stockMovementTypeOUT(
            @PathVariable long prodId,
            @RequestParam int prodQty,
            @RequestParam String reason
    ) {
        stkMvmtService.productOUT(prodId, prodQty, reason);
        return ResponseEntity.status(HttpStatus.CREATED).body("Product OUT from store successfully");
    }

    @PreAuthorize("hasAuthority('PERM_STOCK_ADJUST')")
	@PostMapping("/{prodId}/prod-SALE")
    public ResponseEntity<?> stockMovementTypeSALE(
            @PathVariable long prodId,
            @RequestParam int prodQty,
            @RequestParam String invoiceNum
    ) {
        stkMvmtService.productSALE(prodId, prodQty, invoiceNum);
        return ResponseEntity.status(HttpStatus.CREATED).body("Product SALE from store successfully");
    }

    @PreAuthorize("hasAuthority('PERM_STOCK_ADJUST')")
	@PostMapping("/{prodId}/prod-RETURN")
    public ResponseEntity<?> stockMovementTypeRETURN(
            @PathVariable long prodId,
            @RequestParam int prodQty,
            @RequestParam String invoiceNum
    ) {
        stkMvmtService.productRETURN(prodId, prodQty, invoiceNum);
        return ResponseEntity.status(HttpStatus.CREATED).body("Product Return to store successfully");
    }

    @PreAuthorize("hasAuthority('PERM_STOCK_ADJUST')")
	@PostMapping("/{prodId}/prod-ADJUSTMENT")
    public ResponseEntity<?> stockMovementTypeADJUSTMENT(
            @PathVariable long prodId,
            @RequestParam int prodQty,   // FINAL QTY
            @RequestParam String user
    ) {
        stkMvmtService.productADJUSTMENT(prodId, prodQty, user);
        return ResponseEntity.status(HttpStatus.CREATED).body("Product Adjusted successfully");
    }

    @PreAuthorize("hasAuthority('PERM_STOCK_VIEW')")
	@GetMapping("/{prodId}/mov-by-prodId")
    public ResponseEntity<?> getListStockMovementTypeByProductId(@PathVariable long prodId) {
        return stkMvmtService.getStockMovByProdId(prodId);
    }

    @PreAuthorize("hasAuthority('PERM_STOCK_VIEW')")
	@GetMapping("/{prodId}/mov-by-prodId-date")
    public ResponseEntity<?> getMovementsByProdIdDate(
            @PathVariable long prodId,
            @RequestParam String fromDate,
            @RequestParam String toDate
    ) {
        return stkMvmtService.getStockMovByProdIdDate(prodId, fromDate, toDate);
    }

    @PreAuthorize("hasAuthority('PERM_STOCK_VIEW')")
	@GetMapping("/list-mov-type-by")
    public ResponseEntity<?> getListOfProductByStockMovementType(@RequestParam String movType) {
        return stkMvmtService.getListProductsByStockMovTyp(movType);
    }
}
