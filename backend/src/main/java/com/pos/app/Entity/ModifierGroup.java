package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A reusable set of add-on choices ("Spice level", "Extras", "Cheese"), attached to any number of
 * menu items via {@link ProductModifierGroup}. Its choices live in {@link ModifierOption}.
 */
@Entity
@Table(name = "modifier_group")
@Data
@NoArgsConstructor
public class ModifierGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long groupId;

    @Column(nullable = false, length = 80)
    private String name;

    /** When true the waiter must pick at least one option (minSelect is then at least 1). */
    @Column(columnDefinition = "BOOLEAN DEFAULT FALSE")
    private boolean required;

    @Column(columnDefinition = "INT DEFAULT 0")
    private int minSelect;

    /** 0 = no upper limit. 1 = pick-one (radio behaviour in the UI). */
    @Column(columnDefinition = "INT DEFAULT 0")
    private int maxSelect;

    @Column(columnDefinition = "BOOLEAN DEFAULT TRUE")
    private boolean active = true;
}
