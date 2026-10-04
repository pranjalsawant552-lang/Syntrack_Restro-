package com.pos.app.ServiceImpl;

import com.pos.app.common.util.PageGuard;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.pos.app.DTO.InvoiceDetailDTO;
import com.pos.app.DTO.InvoiceItemRequestDTO;
import com.pos.app.DTO.InvoiceItemResponseDTO;
import com.pos.app.DTO.InvoiceRequestDTO;
import com.pos.app.Entity.Product;
import com.pos.app.Entity.SalesInvoiceItem;
import com.pos.app.Entity.SalesInvoiceMaster;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Repository.SalesInvoiceMasterRepository;
import com.pos.app.Service.ISalesInvoiceMaster;

import jakarta.transaction.Transactional;

@Service
@Transactional
public class SalesInvoiceMasterServiceImpl implements ISalesInvoiceMaster {

    @Autowired private SalesInvoiceMasterRepository salesInvoiceRepo;
    @Autowired private ProductRepository productRepo;
    @Autowired private StockMovementServiceImpl stockMovService;
    @Autowired private com.pos.app.common.service.AuditService auditService;
    @Autowired private com.pos.app.Service.RecipeService recipeService;
    @Autowired private com.pos.app.Repository.InvoiceVoidRepository invoiceVoidRepo;
    @Autowired private com.pos.app.Service.InventoryService inventoryService;
    @Autowired private com.pos.app.Repository.ComboItemRepository comboItemRepo;

    private static final Object INVOICE_NUMBER_LOCK = new Object();

    @Override
    public ResponseEntity<?> insertInvoiceInDB(SalesInvoiceMaster invoiceData) {
        salesInvoiceRepo.save(invoiceData);
        return new ResponseEntity<>("Invoice created successfully", HttpStatus.CREATED);
    }

    /* =========================
       VOID (replaces the old permanent delete): the invoice, its lines and its payment
       details are KEPT for audit; it is marked CANCELLED and drops out of every sales total.
    ========================= */
    @Override
    public ResponseEntity<?> voidInvoice(long invoiceId, String reason, String voidedBy) {
        if (reason == null || reason.isBlank()) {
            throw new com.pos.app.Exception.InvalidRequestException("A reason is required to void an invoice");
        }
        SalesInvoiceMaster invoice = salesInvoiceRepo.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Invoice not found"));
        if (invoice.getPayStatus() == com.pos.app.Enum.PaymentStatus.CANCELLED) {
            throw new com.pos.app.Exception.InvalidRequestException("Invoice is already void");
        }
        String invNo = invoice.getInvoiceNumber();

        // Retail products physically go back on the shelf. Recipe dishes do NOT: the food was
        // already cooked and consumed, so their ingredient stock is deliberately left as is.
        for (SalesInvoiceItem it : invoice.getItems()) {
            returnLine(it.getProduct(), it.getQuantity(), invNo);
        }

        invoice.setPayStatus(com.pos.app.Enum.PaymentStatus.CANCELLED);
        invoice.setUpdatedBy(voidedBy);
        invoice.setUpdatedAt(java.time.LocalDateTime.now());
        salesInvoiceRepo.save(invoice);

        com.pos.app.Entity.InvoiceVoid rec = new com.pos.app.Entity.InvoiceVoid();
        rec.setInvoiceId(invoice.getInvoiceId());
        rec.setInvoiceNumber(invNo);
        rec.setAmount(java.math.BigDecimal.valueOf(invoice.getNetTotal()).setScale(2, java.math.RoundingMode.HALF_UP));
        rec.setPayMethod(invoice.getPayMethod() == null ? null : invoice.getPayMethod().name());
        rec.setReason(reason.trim());
        rec.setVoidedBy(voidedBy);
        invoiceVoidRepo.save(rec);

        auditService.log("INVOICE_VOIDED", "Invoice", String.valueOf(invoiceId),
                "Invoice " + invNo + " voided by " + voidedBy + ": " + reason.trim());

        return ResponseEntity.ok("Invoice " + invNo + " voided (record kept)");
    }

    @Override
    public ResponseEntity<?> listInvoices(LocalDate fromDate, LocalDate toDate) {
        List<SalesInvoiceMaster> list = salesInvoiceRepo
                .findByInvoiceDateBetweenOrderByInvoiceIdDesc(fromDate, toDate);

        List<com.pos.app.DTO.InvoiceListRowDTO> rows = list.stream()
                .map(i -> new com.pos.app.DTO.InvoiceListRowDTO(
                        i.getInvoiceId(),
                        i.getInvoiceNumber(),
                        i.getInvoiceDate(),
                        i.getNetTotal(),
                        i.getPayMethod(),
                        i.getPayStatus(),
                        i.getCustomerName(),
                        i.getCustomerPhone()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(rows);
    }

    /* =========================
       STOCK RULES PER LINE
       - combo        -> each component is handled by its own rule (below)
       - has a recipe -> ingredients are deducted (restaurant orders already did it at KOT time)
       - trackStock   -> classic product stock (Stock table + movement)
       - otherwise    -> a plain menu item: nothing to deduct
    ========================= */
    private void deductLine(Product product, int qty, String invoiceNumber, int lineNo, boolean inventoryHandled) {
        if (product.isCombo()) {
            for (com.pos.app.Entity.ComboItem c : comboItemRepo.findByComboProductIdOrderByIdAsc(product.getProductId())) {
                Product comp = productRepo.findById(c.getComponentProductId()).orElse(null);
                if (comp == null) continue;
                int compQty = c.getQuantity() * qty;
                if (recipeService.hasRecipe(comp.getProductId())) {
                    if (!inventoryHandled) {
                        inventoryService.consumeForRecipe(comp.getProductId(), compQty, "INVOICE_LINE",
                                invoiceNumber + "#" + lineNo + ":" + comp.getProductId());
                    }
                } else if (comp.isTrackStock()) {
                    stockMovService.productSALE(comp.getProductId(), compQty, invoiceNumber);
                }
            }
            return;
        }
        if (recipeService.hasRecipe(product.getProductId())) {
            if (!inventoryHandled) {
                inventoryService.consumeForRecipe(product.getProductId(), qty, "INVOICE_LINE", invoiceNumber + "#" + lineNo);
            }
            return;
        }
        if (product.isTrackStock()) {
            stockMovService.productSALE(product.getProductId(), qty, invoiceNumber);
        }
    }

    /** Puts back only what physically goes back on a shelf; cooked food (recipe ingredients) is never restocked. */
    private void returnLine(Product product, int qty, String invoiceNumber) {
        if (product.isCombo()) {
            for (com.pos.app.Entity.ComboItem c : comboItemRepo.findByComboProductIdOrderByIdAsc(product.getProductId())) {
                Product comp = productRepo.findById(c.getComponentProductId()).orElse(null);
                if (comp != null && !recipeService.hasRecipe(comp.getProductId()) && comp.isTrackStock()) {
                    stockMovService.productRETURN(comp.getProductId(), c.getQuantity() * qty, invoiceNumber);
                }
            }
            return;
        }
        if (!recipeService.hasRecipe(product.getProductId()) && product.isTrackStock()) {
            stockMovService.productRETURN(product.getProductId(), qty, invoiceNumber);
        }
    }

    /* =========================
       ✅ CREATE + createdBy
    ========================= */
    @Override
    public ResponseEntity<?> createInvoice(InvoiceRequestDTO request, String createdBy) {

        if (request.getItems() == null || request.getItems().isEmpty()) {
            return new ResponseEntity<>("Items cannot be empty", HttpStatus.BAD_REQUEST);
        }

        SalesInvoiceMaster invoice = new SalesInvoiceMaster();
        invoice.setInvoiceDate(LocalDate.now());

        // Reserve the invoice number and persist it immediately, inside the lock, so
        // a concurrent sale can never observe a stale count and mint the same
        // INV-YYYYMMDD-##### number (this app runs as a single instance; if it's ever
        // scaled horizontally, this must move to a DB-level sequence instead).
        String invoiceNumber;
        synchronized (INVOICE_NUMBER_LOCK) {
            invoiceNumber = generateInvoiceNumber();
            invoice.setInvoiceNumber(invoiceNumber);
            salesInvoiceRepo.saveAndFlush(invoice);
        }

        invoice.setPayMethod(request.getPayMethod());
        invoice.setPayStatus(request.getPayStatus());

        // ✅ AUDIT create
        invoice.setCreatedBy(createdBy);

        double subTotal = 0;
        double gstTotal = 0;

        int lineNo = 0;
        for (InvoiceItemRequestDTO itemReq : request.getItems()) {
            lineNo++;

            if (itemReq.getQuantity() <= 0) {
                return new ResponseEntity<>("Quantity must be > 0", HttpStatus.BAD_REQUEST);
            }

            Product product = productRepo.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product not found"));

            // ✅ price lock: use the caller's override if given (restaurant settle
            // passes the order item's own snapshotted price/GST here), otherwise
            // fall back to the product's current price/GST -- unchanged behavior
            // for the normal POS/Products-page path.
            double unitPrice = itemReq.getUnitPriceOverride() != null
                    ? itemReq.getUnitPriceOverride() : product.getProdPrice();
            double gstPercent = itemReq.getGstPercentOverride() != null
                    ? itemReq.getGstPercentOverride() : product.getProdGST();

            SalesInvoiceItem item = new SalesInvoiceItem();
            item.setSalesInvoiceMaster(invoice);

            // snapshot values
            item.setProduct(product);
            item.setProductName(product.getProductName());
            item.setUnitPrice(unitPrice);
            item.setUnitBuyPrice(product.getProdBuyPrice());
            item.setGstPercent(gstPercent);
            item.setVariantName(itemReq.getVariantName());
            item.setOptionsText(itemReq.getOptionsText());

            int qty = itemReq.getQuantity();
            double taxable = unitPrice * qty;
            double gst = taxable * gstPercent / 100.0;

            item.setQuantity(qty);
            item.setTaxableAmount(taxable);
            item.setGstAmount(gst);
            item.setTotalAmountOfProd(taxable + gst);

            subTotal += taxable;
            gstTotal += gst;

            invoice.getItems().add(item);

            deductLine(product, qty, invoiceNumber, lineNo, request.isInventoryHandled());
        }

        double discount = request.getDiscountValue();
        if (discount < 0) discount = 0;

        double gross = subTotal + gstTotal;
        if (discount > gross) discount = gross;

        double netTotal = gross - discount;

        invoice.setSubTotal(subTotal);
        invoice.setGstTotal(gstTotal);
        invoice.setDiscountValue(discount);
        invoice.setNetTotal(netTotal);

        // ✅ split payment (cash + online), only applies when payMethod == SPLIT
        // throws InvalidRequestException (→ 400, transaction rolled back) if invalid
        applySplitPayment(invoice, request, netTotal);

        // customer snapshot
        invoice.setCustomerId(request.getCustomerId());
        invoice.setCustomerName(request.getCustomerName());
        invoice.setCustomerPhone(request.getCustomerPhone());
        invoice.setCustomerEmail(request.getCustomerEmail());
        invoice.setCustomerAddress(request.getCustomerAddress());

        SalesInvoiceMaster saved = salesInvoiceRepo.save(invoice);

        return new ResponseEntity<>(
                new com.pos.app.DTO.InvoiceCreateResponseDTO(
                        saved.getInvoiceId(),
                        saved.getInvoiceNumber(),
                        saved.getInvoiceNumber() + " created successfully"
                ),
                HttpStatus.CREATED
        );
    }

    /* =========================
       ✅ UPDATE + updatedBy/updatedAt
    ========================= */
    @Override
    public ResponseEntity<?> updateInvoice(long invoiceId, InvoiceRequestDTO request, String updatedBy) {

        if (request.getItems() == null || request.getItems().isEmpty()) {
            return new ResponseEntity<>("Items cannot be empty", HttpStatus.BAD_REQUEST);
        }

        SalesInvoiceMaster invoice = salesInvoiceRepo.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Invoice not found"));

        if (invoice.getPayStatus() == com.pos.app.Enum.PaymentStatus.CANCELLED) {
            throw new com.pos.app.Exception.InvalidRequestException("A void invoice cannot be edited");
        }

        final String invoiceNumber = invoice.getInvoiceNumber();

        // ✅ AUDIT update
        invoice.setUpdatedBy(updatedBy);
        invoice.setUpdatedAt(LocalDateTime.now());

        /* 1) revert old stock (only what physically returns to a shelf) */
        List<SalesInvoiceItem> oldItems = new java.util.ArrayList<>(invoice.getItems());
        for (SalesInvoiceItem oldItem : oldItems) {
            returnLine(oldItem.getProduct(), oldItem.getQuantity(), invoiceNumber);
        }

        /* 2) clear old items (orphanRemoval=true deletes rows) */
        invoice.getItems().clear();

        /* 3) apply new data */
        invoice.setPayMethod(request.getPayMethod());
        invoice.setPayStatus(request.getPayStatus());

        invoice.setCustomerId(request.getCustomerId());
        invoice.setCustomerName(request.getCustomerName());
        invoice.setCustomerPhone(request.getCustomerPhone());
        invoice.setCustomerEmail(request.getCustomerEmail());
        invoice.setCustomerAddress(request.getCustomerAddress());

        double subTotal = 0;
        double gstTotal = 0;
        int editLine = 0;

        for (InvoiceItemRequestDTO itemReq : request.getItems()) {

            if (itemReq.getQuantity() <= 0) {
                return new ResponseEntity<>("Quantity must be > 0", HttpStatus.BAD_REQUEST);
            }

            Product product = productRepo.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product not found"));

            int qty = itemReq.getQuantity();

            // An edit must not silently reprice an old bill: if this product was already on the invoice,
            // keep that line's snapshot (price, GST, chosen size/add-ons); only genuinely new products use
            // today's menu price. An explicit override from the caller still wins.
            SalesInvoiceItem prev = oldItems.stream()
                    .filter(o -> o.getProduct().getProductId().equals(product.getProductId()))
                    .findFirst().orElse(null);
            if (prev != null) oldItems.remove(prev);

            double unitPrice = itemReq.getUnitPriceOverride() != null ? itemReq.getUnitPriceOverride()
                    : (prev != null ? prev.getUnitPrice() : product.getProdPrice());
            double gstPercent = itemReq.getGstPercentOverride() != null ? itemReq.getGstPercentOverride()
                    : (prev != null ? prev.getGstPercent() : product.getProdGST());

            SalesInvoiceItem item = new SalesInvoiceItem();
            item.setSalesInvoiceMaster(invoice);

            item.setProduct(product);
            item.setProductName(product.getProductName());
            item.setUnitPrice(unitPrice);
            item.setUnitBuyPrice(prev != null ? prev.getUnitBuyPrice() : product.getProdBuyPrice());
            item.setGstPercent(gstPercent);
            item.setVariantName(prev != null ? prev.getVariantName() : null);
            item.setOptionsText(prev != null ? prev.getOptionsText() : null);

            double taxable = unitPrice * qty;
            double gst = taxable * gstPercent / 100.0;

            item.setQuantity(qty);
            item.setTaxableAmount(taxable);
            item.setGstAmount(gst);
            item.setTotalAmountOfProd(taxable + gst);

            subTotal += taxable;
            gstTotal += gst;

            invoice.getItems().add(item);

            // sale again with same invoice number. Recipe ingredients are NOT touched on an edit: the food was
            // already cooked/consumed when the original sale happened (same rule as voiding).
            deductLine(product, qty, invoiceNumber, ++editLine, true);
        }

        double discount = request.getDiscountValue();
        if (discount < 0) discount = 0;

        double gross = subTotal + gstTotal;
        if (discount > gross) discount = gross;

        double netTotal = gross - discount;

        invoice.setSubTotal(subTotal);
        invoice.setGstTotal(gstTotal);
        invoice.setDiscountValue(discount);
        invoice.setNetTotal(netTotal);

        // ✅ split payment (cash + online), only applies when payMethod == SPLIT
        applySplitPayment(invoice, request, netTotal);

        SalesInvoiceMaster saved = salesInvoiceRepo.save(invoice);

        return ResponseEntity.ok(
                new com.pos.app.DTO.InvoiceCreateResponseDTO(
                        saved.getInvoiceId(),
                        saved.getInvoiceNumber(),
                        saved.getInvoiceNumber() + " updated successfully"
                )
        );
    }

    /* =========================
       ✅ FETCH SINGLE (add audit fields to DTO)
    ========================= */
    @Override
    public ResponseEntity<?> fetchSingleInvoiceById(long invoiceId) {
        SalesInvoiceMaster invoice = salesInvoiceRepo.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Invoice not found"));

        List<InvoiceItemResponseDTO> itemDTOs = invoice.getItems().stream()
                .map(item -> new InvoiceItemResponseDTO(
                        item.getItemId(),
                        item.getProduct().getProductId(),
                        item.getProductName(),
                        item.getUnitPrice(),
                        item.getGstPercent(),
                        item.getQuantity(),
                        item.getTaxableAmount(),
                        item.getGstAmount(),
                        item.getTotalAmountOfProd(),
                        item.getVariantName(),
                        item.getOptionsText()
                ))
                .toList();

        return ResponseEntity.ok(
                new InvoiceDetailDTO(
                        invoice.getInvoiceNumber(),
                        invoice.getInvoiceDate(),
                        invoice.getSubTotal(),
                        invoice.getGstTotal(),
                        invoice.getDiscountValue(),
                        invoice.getNetTotal(),
                        invoice.getPayMethod(),
                        invoice.getPayStatus(),

                        invoice.getCashAmount(),
                        invoice.getOnlineAmount(),
                        invoice.getOnlinePayMethod(),

                        invoice.getCustomerId(),
                        invoice.getCustomerName(),
                        invoice.getCustomerPhone(),
                        invoice.getCustomerEmail(),
                        invoice.getCustomerAddress(),

                        itemDTOs,

                        // ✅ AUDIT
                        invoice.getCreatedBy(),
                        invoice.getCreatedAt(),
                        invoice.getUpdatedBy(),
                        invoice.getUpdatedAt()
                )
        );
    }

    /**
     * Validates and applies split-payment fields onto the invoice.
     * When payMethod == SPLIT, cashAmount + onlineAmount must equal netTotal
     * (small rounding tolerance) and onlinePayMethod must be CARD or UPI.
     * For any other payMethod, the split fields are cleared.
     *
     * @throws com.pos.app.Exception.InvalidRequestException if validation fails.
     */
    private void applySplitPayment(SalesInvoiceMaster invoice, InvoiceRequestDTO request, double netTotal) {
        if (request.getPayMethod() != com.pos.app.Enum.PaymentMethod.SPLIT) {
            invoice.setCashAmount(null);
            invoice.setOnlineAmount(null);
            invoice.setOnlinePayMethod(null);
            return;
        }

        Double cash = request.getCashAmount();
        Double online = request.getOnlineAmount();
        com.pos.app.Enum.PaymentMethod onlineMethod = request.getOnlinePayMethod();

        if (cash == null || online == null) {
            throw new com.pos.app.Exception.InvalidRequestException(
                    "Cash amount and online amount are required for SPLIT payment");
        }
        if (cash < 0 || online < 0) {
            throw new com.pos.app.Exception.InvalidRequestException(
                    "Split payment amounts cannot be negative");
        }
        if (onlineMethod != com.pos.app.Enum.PaymentMethod.CARD
                && onlineMethod != com.pos.app.Enum.PaymentMethod.UPI) {
            throw new com.pos.app.Exception.InvalidRequestException(
                    "onlinePayMethod must be CARD or UPI for SPLIT payment");
        }

        double sum = cash + online;
        if (Math.abs(sum - netTotal) > 0.01) {
            throw new com.pos.app.Exception.InvalidRequestException(String.format(
                    "Split amounts (Cash %.2f + Online %.2f = %.2f) must add up to the payable amount (%.2f)",
                    cash, online, sum, netTotal));
        }

        invoice.setCashAmount(Math.round(cash * 100.0) / 100.0);
        invoice.setOnlineAmount(Math.round(online * 100.0) / 100.0);
        invoice.setOnlinePayMethod(onlineMethod);
    }

    private String generateInvoiceNumber() {
        LocalDate today = LocalDate.now();
        long todayCount = salesInvoiceRepo.countByInvoiceDate(today) + 1;
        return String.format("INV-%s-%05d", today.toString().replace("-", ""), todayCount);
    }

    @Override
    public ResponseEntity<?> searchInvoices(int page, int size, LocalDate fromDate, LocalDate toDate,
                                             String search, com.pos.app.Enum.PaymentStatus payStatus,
                                             com.pos.app.Enum.PaymentMethod payMethod, String sort) {
        String[] sortParts = sort.split(",");
        String sortField = sortParts.length > 0 && !sortParts[0].isBlank() ? sortParts[0] : "invoiceDate";
        org.springframework.data.domain.Sort.Direction dir =
                sortParts.length > 1 && sortParts[1].equalsIgnoreCase("asc")
                        ? org.springframework.data.domain.Sort.Direction.ASC
                        : org.springframework.data.domain.Sort.Direction.DESC;

        org.springframework.data.domain.Page<SalesInvoiceMaster> result = salesInvoiceRepo.search(
                fromDate, toDate, search, payStatus, payMethod,
                org.springframework.data.domain.PageRequest.of(PageGuard.page(page), PageGuard.size(size),
                        org.springframework.data.domain.Sort.by(dir, sortField)));

        List<com.pos.app.DTO.InvoiceListRowDTO> rows = result.getContent().stream()
                .map(i -> new com.pos.app.DTO.InvoiceListRowDTO(
                        i.getInvoiceId(),
                        i.getInvoiceNumber(),
                        i.getInvoiceDate(),
                        i.getNetTotal(),
                        i.getPayMethod(),
                        i.getPayStatus(),
                        i.getCustomerName(),
                        i.getCustomerPhone()
                ))
                .collect(Collectors.toList());

        // ✅ grand total across every matching invoice (all pages), not just the
        // page returned here -- the invoices list shows this next to the count
        // so the on-screen "Total" stays correct once the list itself is paginated.
        // Spring Data hands a multi-column aggregate back as Object[]{ Object[]{sum, count} } (the row
        // itself is nested one level down), so totals[0] is an array, not the sum -- calling
        // toString() on it produced "[Ljava.lang.Object;@..." and a NumberFormatException (500).
        Object[] totals = salesInvoiceRepo.searchTotals(fromDate, toDate, search, payStatus, payMethod);
        if (totals != null && totals.length == 1 && totals[0] instanceof Object[] inner) totals = inner;
        java.math.BigDecimal totalNetAmount = java.math.BigDecimal.ZERO;
        if (totals != null && totals.length > 0 && totals[0] instanceof Number n) {
            totalNetAmount = new java.math.BigDecimal(n.toString());
        }

        return ResponseEntity.ok(java.util.Map.of(
                "content", rows,
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "page", page,
                "size", size,
                "totalNetAmount", totalNetAmount
        ));
    }
}
