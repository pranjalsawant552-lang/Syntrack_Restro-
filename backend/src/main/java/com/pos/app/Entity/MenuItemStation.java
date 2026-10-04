package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Routes a menu item (Product) to a kitchen station. One row per product; absent = default station. */
@Entity
@Table(name = "menu_item_station", uniqueConstraints = @UniqueConstraint(name = "uk_menu_item_station_product", columnNames = "product_id"))
@Data
@NoArgsConstructor
public class MenuItemStation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "station_id", nullable = false)
    private Long stationId;
}
