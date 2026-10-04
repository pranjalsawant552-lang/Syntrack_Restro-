package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "recipe_item")
@Getter
@Setter
@NoArgsConstructor
public class RecipeItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long recipeItemId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipe_id", nullable = false)
    private Recipe recipe;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    /** Quantity per portion, in {@link #unit}. */
    @Column(nullable = false, precision = 16, scale = 4)
    private BigDecimal quantity;

    /** Any unit of the same family as the ingredient's base unit (e.g. KG for a G ingredient). */
    @Column(nullable = false, length = 8)
    private String unit;

    /** Extra % lost in prep (peeling, trimming...). Consumption = quantity * (1 + wastage/100). */
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal wastagePercent = BigDecimal.ZERO;
}
