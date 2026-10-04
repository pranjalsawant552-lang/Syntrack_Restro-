package com.pos.app.Entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Bill of materials for ONE portion of a menu item. At most one recipe per menu item. */
@Entity
@Table(name = "recipe", uniqueConstraints = @UniqueConstraint(name = "uk_recipe_product", columnNames = "product_id"))
@Getter
@Setter
@NoArgsConstructor
public class Recipe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long recipeId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecipeItem> items = new ArrayList<>();

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
