package com.pos.app.Entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Stock {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long stockId;

	private int qty;

	@OneToOne
	@JoinColumn(name = "product_id")
	private Product product;

	@UpdateTimestamp
	private LocalDateTime updatedAt;
	
	public Stock(int qty)
	{
		this.qty = qty;
	}
}
