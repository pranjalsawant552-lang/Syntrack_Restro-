package com.pos.app.ServiceImpl;

import com.pos.app.common.util.PageGuard;
import com.pos.app.DTO.PurchaseItemRequestDTO;
import com.pos.app.DTO.PurchaseListRowDTO;
import com.pos.app.DTO.PurchaseRequestDTO;
import com.pos.app.DTO.inventory.InventoryDTO;
import com.pos.app.Entity.Ingredient;
import com.pos.app.Entity.Product;
import com.pos.app.Entity.PurchaseInvoiceItem;
import com.pos.app.Entity.PurchaseInvoiceMaster;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.IngredientRepository;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Repository.PurchaseInvoiceMasterRepository;
import com.pos.app.Service.IPurchaseService;
import com.pos.app.Service.InventoryService;
import com.pos.app.common.util.UnitConverter;
import com.pos.app.common.service.AuditService;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class PurchaseServiceImpl implements IPurchaseService {

    @Autowired private PurchaseInvoiceMasterRepository purchaseRepo;
    @Autowired private ProductRepository productRepo;
    @Autowired private StockMovementServiceImpl stockMovService;
    @Autowired private AuditService auditService;
    @Autowired private IngredientRepository ingredientRepo;
    @Autowired private InventoryService inventoryService;

    // Serializes purchase-number generation + save so two concurrent purchases can
    // never read the same day's count and mint the same PUR-YYYYMMDD-##### number
    // (this app runs as a single instance, so a JVM-level lock is sufficient; if it
    // is ever scaled horizontally, this must move to a DB-level sequence instead).
    private static final Object PURCHASE_NUMBER_LOCK = new Object();

    private String generatePurchaseNumber() {
        // Based on the highest number already issued today, NOT on a row count: counting breaks as
        // soon as any purchase is cancelled (deleted) -- the count drops, the next number collides
        // with an existing one and the unique constraint rejects the new purchase.
        LocalDate today = LocalDate.now();
        String prefix = "PUR-" + today.toString().replace("-", "") + "-";
        String max = purchaseRepo.findMaxPurchaseNumberWithPrefix(prefix);
        long next = 1;
        if (max != null && max.length() > prefix.length()) {
            try { next = Long.parseLong(max.substring(prefix.length())) + 1; }
            catch (NumberFormatException e) { next = purchaseRepo.countByPurchaseDate(today) + 1; }
        }
        return String.format("%s%05d", prefix, next);
    }

    @Override
    public ResponseEntity<?> createPurchase(PurchaseRequestDTO request, String createdBy) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            return new ResponseEntity<>(Map.of("message", "Items cannot be empty", "error", "Items cannot be empty"),
                    HttpStatus.BAD_REQUEST);
        }

        // Validate EVERY line before writing anything. Returning a 400 half-way through the loop (as
        // this used to) does not roll the transaction back, which left an empty purchase row and
        // already-applied stock behind.
        for (PurchaseItemRequestDTO li : request.getItems()) {
            String problem = validateLine(li);
            if (problem != null) {
                return new ResponseEntity<>(Map.of("message", problem, "error", problem), HttpStatus.BAD_REQUEST);
            }
        }

        PurchaseInvoiceMaster purchase = new PurchaseInvoiceMaster();
        purchase.setPurchaseDate(LocalDate.now());
        purchase.setSupplierBillNumber(request.getSupplierBillNumber());

        // Reserve the purchase number and persist it immediately, inside the lock,
        // so a concurrent call can never mint the same number (see PURCHASE_NUMBER_LOCK javadoc above).
        String purchaseNumber;
        synchronized (PURCHASE_NUMBER_LOCK) {
            purchaseNumber = generatePurchaseNumber();
            purchase.setPurchaseNumber(purchaseNumber);
            purchaseRepo.saveAndFlush(purchase);
        }

        purchase.setPayMethod(request.getPayMethod());
        purchase.setPayStatus(request.getPayStatus());

        purchase.setSupplierId(request.getSupplierId());
        purchase.setSupplierName(request.getSupplierName());
        purchase.setSupplierPhone(request.getSupplierPhone());
        purchase.setSupplierAddress(request.getSupplierAddress());

        purchase.setCreatedBy(createdBy);

        boolean updateBuyPrice = request.getUpdateProductBuyPrice() == null || request.getUpdateProductBuyPrice();
        String batchInvoiceRef = (request.getSupplierBillNumber() != null && !request.getSupplierBillNumber().isBlank())
                ? request.getSupplierBillNumber().trim() : purchaseNumber;
        if (batchInvoiceRef.length() > 60) batchInvoiceRef = batchInvoiceRef.substring(0, 60);

        double subTotal = 0;
        double gstTotal = 0;

        for (PurchaseItemRequestDTO itemReq : request.getItems()) {
            PurchaseInvoiceItem item = new PurchaseInvoiceItem();
            item.setPurchaseInvoiceMaster(purchase);

            double taxable;
            double gstPercent;

            if (itemReq.getIngredientId() != null) {
                // ---------- INGREDIENT line: goes into ingredient inventory as a new batch ----------
                Ingredient ing = ingredientRepo.findById(itemReq.getIngredientId())
                        .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Ingredient not found"));
                BigDecimal qty = itemReq.getIngredientQty();
                String unit = UnitConverter.norm(itemReq.getUnit());
                double unitCost = itemReq.getUnitCost();
                gstPercent = itemReq.getGstPercent() != null ? itemReq.getGstPercent() : 0;

                item.setIngredientId(ing.getIngredientId());
                item.setProductName(ing.getName());
                item.setIngredientQty(qty);
                item.setIngredientUnit(unit);
                item.setUnitCost(unitCost);
                item.setGstPercent(gstPercent);
                item.setQuantity(0);

                taxable = BigDecimal.valueOf(unitCost).multiply(qty).setScale(2, RoundingMode.HALF_UP).doubleValue();

                inventoryService.receive(new InventoryDTO.ReceiveRequest(
                        ing.getIngredientId(), qty, unit, BigDecimal.valueOf(unitCost),
                        itemReq.getBatchNo(), itemReq.getExpiryDate(), request.getSupplierId(), batchInvoiceRef));
            } else {
                // ---------- PRODUCT line: retail / menu-item stock ----------
                Product product = productRepo.findById(itemReq.getProductId())
                        .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product not found"));

                double unitCost = itemReq.getUnitCost() != null ? itemReq.getUnitCost() : product.getProdBuyPrice();
                gstPercent = itemReq.getGstPercent() != null ? itemReq.getGstPercent() : product.getProdGST();
                int qty = itemReq.getQuantity();

                item.setProduct(product);
                item.setProductName(product.getProductName());
                item.setUnitCost(unitCost);
                item.setGstPercent(gstPercent);
                item.setQuantity(qty);

                taxable = unitCost * qty;

                // Buying stock IN increases quantity on hand.
                stockMovService.productIN(itemReq.getProductId(), qty);

                // Keep the product's cost price current for future profit calculations.
                if (updateBuyPrice) {
                    product.setProdBuyPrice(unitCost);
                    productRepo.save(product);
                }
            }

            double gst = taxable * gstPercent / 100.0;
            item.setTaxableAmount(taxable);
            item.setGstAmount(gst);
            item.setTotalAmountOfProd(taxable + gst);

            subTotal += taxable;
            gstTotal += gst;

            purchase.getItems().add(item);
        }

        double discount = request.getDiscountValue();
        if (discount < 0) discount = 0;
        double gross = subTotal + gstTotal;
        if (discount > gross) discount = gross;

        purchase.setSubTotal(subTotal);
        purchase.setGstTotal(gstTotal);
        purchase.setDiscountValue(discount);
        purchase.setNetTotal(gross - discount);

        PurchaseInvoiceMaster saved = purchaseRepo.save(purchase);

        auditService.log("PURCHASE_CREATED", "Purchase", String.valueOf(saved.getPurchaseId()),
                "Purchase " + purchaseNumber + " created by " + createdBy + ", net total " + saved.getNetTotal());

        // Return a lean response DTO instead of the raw entity: the entity graph
        // (items -> product -> category, a lazy association) can fail to
        // serialize once the request leaves the transactional context, and the
        // client only needs these summary fields to confirm the purchase.
        Map<String, Object> response = new HashMap<>();
        response.put("purchaseId", saved.getPurchaseId());
        response.put("purchaseNumber", saved.getPurchaseNumber());
        response.put("purchaseDate", saved.getPurchaseDate());
        response.put("supplierBillNumber", saved.getSupplierBillNumber());
        response.put("subTotal", saved.getSubTotal());
        response.put("gstTotal", saved.getGstTotal());
        response.put("discountValue", saved.getDiscountValue());
        response.put("netTotal", saved.getNetTotal());
        response.put("payMethod", saved.getPayMethod());
        response.put("payStatus", saved.getPayStatus());
        response.put("itemCount", request.getItems().size());

        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /** @return a user-facing problem description, or null if the line is valid */
    private String validateLine(PurchaseItemRequestDTO li) {
        boolean isIngredient = li.getIngredientId() != null;
        boolean isProduct = li.getProductId() != null;
        if (isIngredient == isProduct) {
            return "Each purchase line must be either a product or an ingredient";
        }
        if (isProduct) {
            return li.getQuantity() <= 0 ? "Quantity must be > 0" : null;
        }
        if (li.getIngredientQty() == null || li.getIngredientQty().signum() <= 0) {
            return "Ingredient quantity must be > 0";
        }
        if (!UnitConverter.isSupported(li.getUnit())) {
            return "Unsupported unit: " + li.getUnit();
        }
        if (li.getUnitCost() == null || li.getUnitCost() < 0) {
            return "Enter the cost per " + UnitConverter.norm(li.getUnit()) + " for each ingredient line";
        }
        return null;
    }

    @Override
    public ResponseEntity<?> getPurchaseById(long purchaseId) {
        PurchaseInvoiceMaster purchase = purchaseRepo.findByIdWithItems(purchaseId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Purchase not found"));
        return ResponseEntity.ok(purchase);
    }

    @Override
    public ResponseEntity<?> cancelPurchase(long purchaseId, String cancelledBy) {
        PurchaseInvoiceMaster purchase = purchaseRepo.findByIdWithItems(purchaseId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Purchase not found"));

        String purNo = purchase.getPurchaseNumber();

        // Reverse the stock this purchase added.
        for (PurchaseInvoiceItem item : purchase.getItems()) {
            if (item.getIngredientId() != null) {
                inventoryService.reversePurchaseReceipt(item.getIngredientId(), item.getIngredientQty(),
                        item.getIngredientUnit(), "Purchase " + purNo + " cancelled");
            } else if (item.getProduct() != null) {
                stockMovService.productOUT(item.getProduct().getProductId(), item.getQuantity(),
                        "Purchase " + purNo + " cancelled");
            }
        }

        purchaseRepo.delete(purchase);

        auditService.log("PURCHASE_CANCELLED", "Purchase", String.valueOf(purchaseId),
                "Purchase " + purNo + " cancelled by " + cancelledBy + ", stock reversed");

        return ResponseEntity.ok("Purchase cancelled & stock reverted (by " + cancelledBy + ")");
    }

    @Override
    public ResponseEntity<?> searchPurchases(int page, int size, LocalDate fromDate, LocalDate toDate,
                                              String search, com.pos.app.Enum.PaymentStatus payStatus,
                                              com.pos.app.Enum.PaymentMethod payMethod, String sort) {
        String[] sortParts = sort.split(",");
        String sortField = sortParts.length > 0 && !sortParts[0].isBlank() ? sortParts[0] : "purchaseDate";
        Sort.Direction dir = sortParts.length > 1 && sortParts[1].equalsIgnoreCase("asc")
                ? Sort.Direction.ASC : Sort.Direction.DESC;

        Page<PurchaseInvoiceMaster> result = purchaseRepo.search(fromDate, toDate, search, payStatus, payMethod,
                PageRequest.of(PageGuard.page(page), PageGuard.size(size), Sort.by(dir, sortField)));

        List<PurchaseListRowDTO> rows = result.getContent().stream()
                .map(p -> new PurchaseListRowDTO(
                        p.getPurchaseId(),
                        p.getPurchaseNumber(),
                        p.getSupplierBillNumber(),
                        p.getPurchaseDate(),
                        p.getNetTotal(),
                        p.getPayMethod(),
                        p.getPayStatus(),
                        p.getSupplierName(),
                        p.getSupplierPhone()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "content", rows,
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "page", page,
                "size", size
        ));
    }
}
