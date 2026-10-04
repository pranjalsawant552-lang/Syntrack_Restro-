package com.pos.app.ServiceImpl;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import com.pos.app.DTO.StockMovTypeDTO;
import com.pos.app.Entity.Product;
import com.pos.app.Entity.Stock;
import com.pos.app.Entity.StockMovement;
import com.pos.app.Enum.MovementType;
import com.pos.app.Exception.InsufficientStockException;
import com.pos.app.Exception.ResourceNotFoundExceptionHandling;
import com.pos.app.Repository.ProductRepository;
import com.pos.app.Repository.StockMovementRepository;
import com.pos.app.Repository.StockRepository;
import com.pos.app.Service.IStockMovementService;

import jakarta.transaction.Transactional;

@Service
@Transactional
public class StockMovementServiceImpl implements IStockMovementService {

    /** History lists return the newest 500 movements only (older ones stay in the database). */
    private static final int MAX_MOVEMENTS = 500;

    @Autowired
    private ProductRepository prodRepo;

    @Autowired
    private StockMovementRepository stkMovRepo;

    @Autowired
    private StockRepository stockRepo;

    private static final DateTimeFormatter YYYYMMDD = DateTimeFormatter.ofPattern("yyyyMMdd");

    public static String todayYYYYMMDD() {
        return LocalDate.now().format(YYYYMMDD);
    }

    // These are cosmetic reference-id counters only (not unique-constrained, not
    // used for stock math) and are shared across all tenants in this JVM, so
    // numbering isn't sequential per-tenant. Fine for a human-readable label;
    // don't rely on them for anything that needs true per-tenant sequencing.
    // Thread-safe: plain longs with `++` are a read-modify-write race under
    // concurrent requests and can hand out the same reference id twice.
    // AtomicLong.incrementAndGet() is a single atomic operation.
    private static final java.util.concurrent.atomic.AtomicLong counterIN = new java.util.concurrent.atomic.AtomicLong(0);
    private static final java.util.concurrent.atomic.AtomicLong counterOUT = new java.util.concurrent.atomic.AtomicLong(0);
    private static final java.util.concurrent.atomic.AtomicLong counterADJUSTMENT = new java.util.concurrent.atomic.AtomicLong(0);
    private static final java.util.concurrent.atomic.AtomicLong counterRETURN = new java.util.concurrent.atomic.AtomicLong(0);

    private Stock getOrCreateStock(Product prod) {
        return stockRepo.getByProduct(prod).orElseGet(() -> {
            Stock newStock = new Stock();
            newStock.setProduct(prod);
            newStock.setQty(0);
            return newStock;
        });
    }

    @Override
    public void productIN(long prodId, int prodQty) {

        if (prodQty <= 0) throw new IllegalArgumentException("prodQty must be > 0");

        Product prod = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));

        Stock stk = getOrCreateStock(prod);
        stk.setQty(stk.getQty() + prodQty);

        StockMovement mov = new StockMovement(prod, prodQty);
        mov.setMovType(MovementType.IN);

        String ref = "GRN-" + todayYYYYMMDD() + "-" + counterIN.incrementAndGet();
        mov.setReferneceId(ref);

        stockRepo.save(stk);
        stkMovRepo.save(mov);
    }

    @Override
    public void productOUT(long prodId, int prodQty, String reason) {

        if (prodQty <= 0) throw new IllegalArgumentException("prodQty must be > 0");

        Product prod = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));

        Stock stk = getOrCreateStock(prod);

        if (stk.getQty() < prodQty) {
            throw new InsufficientStockException(
                    "Insufficient stock for OUT: " + prod.getProductName() +
                            ". Available=" + stk.getQty() + ", Required=" + prodQty
            );
        }

        stk.setQty(stk.getQty() - prodQty);

        StockMovement mov = new StockMovement(prod, prodQty * (-1));
        mov.setMovType(MovementType.OUT);
        mov.setReason(reason);

        String ref = "OUT-" + todayYYYYMMDD() + "-" + counterOUT.incrementAndGet();
        mov.setReferneceId(ref);

        stockRepo.save(stk);
        stkMovRepo.save(mov);
    }

    @Override
    public void productSALE(long prodId, int prodQty, String invoiceNum) {

        if (prodQty <= 0) throw new IllegalArgumentException("prodQty must be > 0");

        Product prod = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));

        Stock stk = getOrCreateStock(prod);

        if (stk.getQty() < prodQty) {
            throw new InsufficientStockException(
                    "Insufficient stock for SALE: " + prod.getProductName() +
                            ". Available=" + stk.getQty() + ", Required=" + prodQty
            );
        }

        stk.setQty(stk.getQty() - prodQty);

        StockMovement mov = new StockMovement(prod, prodQty * (-1));
        mov.setMovType(MovementType.SALE);

        mov.setInvoiceNum(invoiceNum);
        mov.setReferneceId(invoiceNum);
        mov.setActionUser(null);

        stockRepo.save(stk);
        stkMovRepo.save(mov);
    }

    @Override
    public void productADJUSTMENT(long prodId, int finalQty, String user) {

        if (finalQty < 0) throw new IllegalArgumentException("finalQty must be >= 0");

        Product prod = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));

        Stock stk = getOrCreateStock(prod);

        int currentQty = stk.getQty();
        int diff = finalQty - currentQty; // may be +/-

        stk.setQty(finalQty);

        StockMovement mov = new StockMovement(prod, diff);
        mov.setMovType(MovementType.ADJUSTMENT);
        mov.setActionUser(user);

        String ref = "ADJ-" + todayYYYYMMDD() + "-" + counterADJUSTMENT.incrementAndGet();
        mov.setReferneceId(ref);

        stockRepo.save(stk);
        stkMovRepo.save(mov);
    }

    @Override
    public void productRETURN(long prodId, int prodQty, String invoiceNum) {

        if (prodQty <= 0) throw new IllegalArgumentException("prodQty must be > 0");

        Product prod = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));

        Stock stk = getOrCreateStock(prod);
        stk.setQty(stk.getQty() + prodQty);

        StockMovement mov = new StockMovement(prod, prodQty);
        mov.setMovType(MovementType.RETURN);

        mov.setInvoiceNum(invoiceNum);
        String ref = "RET-" + todayYYYYMMDD() + "-" + counterRETURN.incrementAndGet();
        mov.setReferneceId(ref);

        stockRepo.save(stk);
        stkMovRepo.save(mov);
    }

    @Override
    public ResponseEntity<?> getStockMovByProdId(long prodId) {
        Product prod = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));

        List<StockMovTypeDTO> stkList = stkMovRepo.findAllByProduct(prod, org.springframework.data.domain.PageRequest.of(0, MAX_MOVEMENTS));
        return ResponseEntity.ok(stkList);
    }

    @Override
    public ResponseEntity<?> getStockMovByProdIdDate(long prodId, String fromDate, String toDate) {

        Product prod = prodRepo.findById(prodId)
                .orElseThrow(() -> new ResourceNotFoundExceptionHandling("Product Not found"));

        LocalDate from = LocalDate.parse(fromDate); // yyyy-MM-dd
        LocalDate to = LocalDate.parse(toDate);

        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay(); // inclusive end date

        List<StockMovTypeDTO> list = stkMovRepo.findAllByProductAndCreatedAtBetween(prod, start, end, org.springframework.data.domain.PageRequest.of(0, MAX_MOVEMENTS));
        return ResponseEntity.ok(list);
    }

    @Override
    public ResponseEntity<?> getListProductsByStockMovTyp(String movType) {

        MovementType movtypeEnm;
        try {
            movtypeEnm = MovementType.valueOf(movType.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid movType: " + movType);
        }

        List<StockMovTypeDTO> stkListByMovTyp = stkMovRepo.findAllProductByMovementType(movtypeEnm, org.springframework.data.domain.PageRequest.of(0, MAX_MOVEMENTS));
        return ResponseEntity.ok(stkListByMovTyp);
    }
}
