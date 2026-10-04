package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One component of a combo product: "combo X includes 2 x product Y". */
@Entity
@Table(name = "combo_item", indexes = @Index(name = "idx_combo_item_combo", columnList = "combo_product_id"))
@Data
@NoArgsConstructor
public class ComboItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "combo_product_id", nullable = false)
    private Long comboProductId;

    @Column(name = "component_product_id", nullable = false)
    private Long componentProductId;

    @Column(nullable = false)
    private int quantity = 1;
}
