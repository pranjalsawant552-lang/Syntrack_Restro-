package com.pos.app.Entity;

import com.pos.app.Enum.KotItemStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "kot_item", indexes = @Index(name = "idx_kot_item_order_item", columnList = "order_item_id"))
@Getter
@Setter
@NoArgsConstructor
public class KotItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long kotItemId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "kot_id", nullable = false)
    private Kot kot;

    @Column(name = "order_item_id", nullable = false)
    private Long orderItemId;

    @Column(length = 255)
    private String productName;

    private int quantity;

    @Column(length = 255)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private KotItemStatus status = KotItemStatus.NEW;
}
