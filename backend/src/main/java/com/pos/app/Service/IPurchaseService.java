package com.pos.app.Service;

import com.pos.app.DTO.PurchaseRequestDTO;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;

public interface IPurchaseService {

    ResponseEntity<?> createPurchase(PurchaseRequestDTO request, String createdBy);

    ResponseEntity<?> getPurchaseById(long purchaseId);

    ResponseEntity<?> cancelPurchase(long purchaseId, String cancelledBy);

    ResponseEntity<?> searchPurchases(int page, int size, LocalDate fromDate, LocalDate toDate,
                                       String search, com.pos.app.Enum.PaymentStatus payStatus,
                                       com.pos.app.Enum.PaymentMethod payMethod, String sort);
}
