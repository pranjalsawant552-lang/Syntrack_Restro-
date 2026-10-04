package com.pos.app.DTO;

import java.time.LocalDateTime;

import com.pos.app.Entity.Product;
import com.pos.app.Enum.MovementType;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StockMovTypeDTO {

    private Long movementId;
    private MovementType movType;
    private int stkMovmentQty;

    // NOTE: you are returning Product object in dto for some query
    private Product prodId;

    private String referneceId;
    private LocalDateTime createdAt;

    // ✅ NEW FIELDS
    private String reason;
    private String invoiceNum;
    private String actionUser;

    // m.movementId, m.movType,m.stkMovmentQty,m.referneceId,m.createdAt
    public StockMovTypeDTO(Long movementId, MovementType movType, int stkMovmentQty, String referneceId,
                           LocalDateTime createdAt) {
        this.movementId = movementId;
        this.movType = movType;
        this.stkMovmentQty = stkMovmentQty;
        this.referneceId = referneceId;
        this.createdAt = createdAt;
    }

    // ✅ NEW constructor (includes new fields)
    // m.movementId, m.movType,m.stkMovmentQty,m.referneceId,m.createdAt,m.reason,m.invoiceNum,m.actionUser
    public StockMovTypeDTO(Long movementId, MovementType movType, int stkMovmentQty, String referneceId,
                           LocalDateTime createdAt, String reason, String invoiceNum, String actionUser) {
        this.movementId = movementId;
        this.movType = movType;
        this.stkMovmentQty = stkMovmentQty;
        this.referneceId = referneceId;
        this.createdAt = createdAt;
        this.reason = reason;
        this.invoiceNum = invoiceNum;
        this.actionUser = actionUser;
    }

    // m.movementId, m.prodId,m.stkMovmentQty,m.referneceId,m.createdAt
    public StockMovTypeDTO(Long movementId, Product prodId, int stkMovmentQty, String referneceId,
                           LocalDateTime createdAt) {
        this.movementId = movementId;
        this.prodId = prodId;
        this.stkMovmentQty = stkMovmentQty;
        this.referneceId = referneceId;
        this.createdAt = createdAt;
    }

    // ✅ NEW constructor for movementType listing with extra fields too
    // m.movementId, m.prodId,m.stkMovmentQty,m.referneceId,m.createdAt,m.reason,m.invoiceNum,m.actionUser
    public StockMovTypeDTO(Long movementId, Product prodId, int stkMovmentQty, String referneceId,
                           LocalDateTime createdAt, String reason, String invoiceNum, String actionUser) {
        this.movementId = movementId;
        this.prodId = prodId;
        this.stkMovmentQty = stkMovmentQty;
        this.referneceId = referneceId;
        this.createdAt = createdAt;
        this.reason = reason;
        this.invoiceNum = invoiceNum;
        this.actionUser = actionUser;
    }
}
