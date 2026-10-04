package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One choice inside a {@link ModifierGroup}; {@code price} is ADDED to the line's unit price (0 = free). */
@Entity
@Table(name = "modifier_option", indexes = @Index(name = "idx_modifier_option_group", columnList = "group_id"))
@Data
@NoArgsConstructor
public class ModifierOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long optionId;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(nullable = false, length = 80)
    private String name;

    private double price;

    @Column(columnDefinition = "BOOLEAN DEFAULT TRUE")
    private boolean active = true;

    private int sortOrder;
}
