package com.pos.app.Entity;

import com.pos.app.Enum.KotStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** One printed/displayed Kitchen Order Ticket: the items of one send-to-kitchen action for one station. */
@Entity
@Table(name = "kot", indexes = {
        @Index(name = "idx_kot_status", columnList = "status"),
        @Index(name = "idx_kot_order", columnList = "order_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Kot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long kotId;

    @Column(length = 20)
    private String kotNumber;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    private Long stationId;

    @Column(length = 80)
    private String stationName;

    /** Snapshot: table name, or "Takeaway - Ravi" / "Online - Zomato" for counter orders. */
    @Column(length = 120)
    private String tableLabel;

    @Column(length = 20)
    private String orderType;

    @Column(length = 120)
    private String waiterName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private KotStatus status = KotStatus.NEW;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime startedAt;
    private LocalDateTime readyAt;
    private LocalDateTime servedAt;

    @Column(length = 255)
    private String createdBy;

    @OneToMany(mappedBy = "kot", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<KotItem> items = new ArrayList<>();
}
