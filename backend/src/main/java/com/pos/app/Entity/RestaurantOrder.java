package com.pos.app.Entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.pos.app.Enum.RestaurantOrderStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * One "tab" running on a table, from the first item added until it's settled
 * (billed into a {@link SalesInvoiceMaster}) or cancelled. A table can only
 * have one non-terminal order at a time (checked in the service layer).
 */
@Entity
@Table(name = "restaurant_order", indexes = {
        // ✅ TablesBoard/order-taking screen looks up "does this table have an open order"
        // and the KDS looks up "every order that has items still in the kitchen" constantly.
        @Index(name = "idx_restaurant_order_status", columnList = "status"),
        @Index(name = "idx_restaurant_order_table", columnList = "table_id"),
        // ✅ Parcel/Online counter-orders board filters by these together
        @Index(name = "idx_restaurant_order_type_status", columnList = "order_type, status")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long orderId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "table_id")
    private DiningTable table; // null for PARCEL/ONLINE orders -- see orderType

    @Enumerated(EnumType.STRING)
    private com.pos.app.Enum.OrderType orderType = com.pos.app.Enum.OrderType.DINE_IN;

    /** For ONLINE orders: which platform ("Zomato", "Swiggy", "Website"...), plus their order ref if given. */
    private String orderSource;
    private String externalOrderRef;

    /** For PARCEL/ONLINE orders (no table to identify who it's for). */
    private String customerName;
    private String customerPhone;

    @Enumerated(EnumType.STRING)
    private RestaurantOrderStatus status = RestaurantOrderStatus.OPEN;

    /** Optional -- who's running this table, for the KDS/floor view. */
    private String waiterName;

    /** Optional guest count, mainly for reporting. */
    private Integer guestCount;

    /** Free-text note for the whole order, e.g. "birthday, bring cake at the end". */
    private String notes;

    @CreationTimestamp
    private LocalDateTime openedAt;

    private LocalDateTime settledAt;

    /** Set once settle() converts this order into an invoice. */
    private Long invoiceId;
    private String invoiceNumber;

    private String createdBy;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<RestaurantOrderItem> items = new ArrayList<>();
}
