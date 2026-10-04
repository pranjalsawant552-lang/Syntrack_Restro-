package com.pos.app.Repository;

import org.springframework.data.domain.Pageable; // ✅ correct
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.pos.app.DTO.StockMovTypeDTO;
import com.pos.app.Entity.Product;
import com.pos.app.Entity.StockMovement;
import com.pos.app.Enum.MovementType;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    // ✅ includes reason, invoiceNum, actionUser
    @Query("""
		SELECT new com.pos.app.DTO.StockMovTypeDTO(
			m.movementId,
			m.movType,
			m.stkMovmentQty,
			m.referneceId,
			m.createdAt,
			m.reason,
			m.invoiceNum,
			m.actionUser
		)
		FROM StockMovement m
		WHERE m.prodId = ?1
		ORDER BY m.movementId DESC
	""")
    // Pageable = "newest N only": a busy product can have tens of thousands of movements over the years
    List<StockMovTypeDTO> findAllByProduct(Product prod, Pageable pageable);

    // ✅ listing by movement type (kept same pattern; includes prod object + new fields)
    @Query("""
		SELECT new com.pos.app.DTO.StockMovTypeDTO(
			m.movementId,
			m.prodId,
			m.stkMovmentQty,
			m.referneceId,
			m.createdAt,
			m.reason,
			m.invoiceNum,
			m.actionUser
		)
		FROM StockMovement m
		WHERE m.movType = ?1
		ORDER BY m.movementId DESC
	""")
    List<StockMovTypeDTO> findAllProductByMovementType(MovementType movtypeEnm, Pageable pageable);

    // ✅ NEW: date range query (DTO class compatible)
    @Query("""
		SELECT new com.pos.app.DTO.StockMovTypeDTO(
			m.movementId,
			m.movType,
			m.stkMovmentQty,
			m.referneceId,
			m.createdAt,
			m.reason,
			m.invoiceNum,
			m.actionUser
		)
		FROM StockMovement m
		WHERE m.prodId = ?1
		  AND m.createdAt >= ?2
		  AND m.createdAt < ?3
		ORDER BY m.movementId DESC
	""")
    List<StockMovTypeDTO> findAllByProductAndCreatedAtBetween(Product product, LocalDateTime from, LocalDateTime to, Pageable pageable);



    @Query("""
      select sm.movementId, sm.movType, sm.stkMovmentQty, sm.prodId.productId, sm.prodId.productName,
             sm.invoiceNum, sm.reason, sm.actionUser, sm.createdAt
      from StockMovement sm
      order by sm.movementId desc
    """)
    List<Object[]> recent(Pageable pageable);
}
