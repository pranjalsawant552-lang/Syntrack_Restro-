package com.pos.app.Service;

import org.springframework.http.ResponseEntity;

public interface IStockMovementService {

    void productIN(long prodId, int prodQty);

    void productOUT(long prodId, int prodQty, String reason);

    void productSALE(long prodId, int prodQty, String invoiceNum);

    void productRETURN(long prodId, int prodQty, String invoiceNum);

    void productADJUSTMENT(long prodId, int finalQty, String user);

    ResponseEntity<?> getStockMovByProdId(long prodId);

    ResponseEntity<?> getStockMovByProdIdDate(long prodId, String fromDate, String toDate);

    ResponseEntity<?> getListProductsByStockMovTyp(String movType);
}
