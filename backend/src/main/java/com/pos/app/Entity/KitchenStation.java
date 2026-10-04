package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A place food/drinks are prepared: Main Kitchen, Tandoor, Bar, Dessert... Each gets its own KOT. */
@Entity
@Table(name = "kitchen_station")
@Data
@NoArgsConstructor
public class KitchenStation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long stationId;

    @Column(nullable = false, unique = true, length = 80)
    private String name;

    /** Free-text printer label shown on the KOT print (e.g. "Kitchen Printer", "Bar Printer"). */
    @Column(length = 120)
    private String printerName;

    /** The station that receives items whose menu item has no explicit station. */
    @Column(nullable = false)
    private boolean isDefault = false;

    @Column(nullable = false)
    private boolean active = true;
}
