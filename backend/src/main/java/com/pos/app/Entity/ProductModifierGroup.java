package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Which modifier groups are offered on which menu item. */
@Entity
@Table(name = "product_modifier_group",
        uniqueConstraints = @UniqueConstraint(name = "uk_product_modifier_group", columnNames = {"product_id", "group_id"}))
@Data
@NoArgsConstructor
public class ProductModifierGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    private int sortOrder;
}
