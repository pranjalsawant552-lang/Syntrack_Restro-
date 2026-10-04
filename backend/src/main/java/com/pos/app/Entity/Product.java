package com.pos.app.Entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
// ✅ Perf: the product list/search screen filters and sorts by these columns on
// every keystroke (see ProductRepository.search). Without indexes PostgreSQL falls
// back to a full table scan, which is what made the page slow once the catalog
// grew large. columnList uses physical (snake_case) column names -- see
// SnakeCasePhysicalNamingStrategy / SalesInvoiceMaster for the same convention.
@Table(name = "product", indexes = {
        @Index(name = "idx_product_name", columnList = "product_name"),
        @Index(name = "idx_product_category_active", columnList = "category_id, active")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long productId;

    private String productName;
    private double prodPrice;

    @Column(columnDefinition = "DECIMAL(10,2) DEFAULT 0.00")
    private double prodBuyPrice;

    private double prodGST;

    @Column(columnDefinition = "BOOLEAN DEFAULT TRUE")
    private boolean active;

    /**
     * Restaurant menu flag: true = veg, false = non-veg, null = not applicable
     * (e.g. a retail product, or simply not set yet). Purely informational --
     * doesn't affect billing/stock.
     */
    private Boolean isVeg;

    /**
     * "86'd" -- temporarily out of stock for TODAY only (kitchen ran out of an
     * ingredient), as opposed to `active` which is the permanent
     * show/hide-from-catalog switch. Kept separate so a busy waiter can toggle
     * this in one tap without going through the full product edit form, and so
     * it's trivial to bulk-clear at the start of a new day/shift.
     */
    @Column(columnDefinition = "BOOLEAN DEFAULT FALSE")
    private boolean temporarilyUnavailable;

    /**
     * When set together with temporarilyUnavailable, the item switches itself back on at this time (a per-minute
     * job does it -- see MenuAvailabilityScheduler). Null = stays off until someone turns it back on.
     * This is what stops a dish marked "out" on Monday from still being hidden on Friday.
     */
    private LocalDateTime unavailableUntil;

    /**
     * true  = "stock product": quantity is tracked in the Stock table and reduced on every sale
     *         (bottled drinks, packaged snacks, retail items).
     * false = "menu item": no quantity to maintain. If it has a recipe its ingredients are
     *         deducted instead; otherwise nothing is deducted at all.
     * DEFAULT 1 keeps every product that existed before this flag behaving exactly as before.
     */
    @Column(columnDefinition = "BOOLEAN DEFAULT TRUE")
    private boolean trackStock = true;

    /** A combo/meal deal: sold as one line at its own price, made of components (see ComboItem). */
    @Column(columnDefinition = "BOOLEAN DEFAULT FALSE")
    private boolean combo = false;

    @Column(nullable = false, unique = true, length = 32)
    private String barcode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category categoryID;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
