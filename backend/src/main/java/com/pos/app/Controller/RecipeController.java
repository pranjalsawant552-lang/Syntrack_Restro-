package com.pos.app.Controller;

import com.pos.app.DTO.inventory.InventoryDTO.*;
import com.pos.app.Service.RecipeService;
import com.pos.app.config.ApiVersionConfig;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Recipe / BOM per menu item, with food cost and margin. */
@RestController
@RequestMapping(ApiVersionConfig.API_VERSION + "/recipes")
public class RecipeController {

    @Autowired private RecipeService recipeService;

    @PreAuthorize("hasAuthority('PERM_RECIPE_VIEW')")
    @GetMapping("/costing")
    public List<CostingRow> costing() {
        return recipeService.costing();
    }

    /**
     * Live "how many plates can we still make" per recipe-based dish, from current ingredient
     * stock. Readable by anyone who can see the restaurant floor -- a waiter needs this to avoid
     * selling a dish that's about to run out, not just a manager.
     */
    @PreAuthorize("hasAuthority('PERM_RECIPE_VIEW') or hasAuthority('PERM_RESTAURANT_VIEW')")
    @GetMapping("/availability")
    public List<AvailabilityRow> availability() {
        return recipeService.availability();
    }

    @PreAuthorize("hasAuthority('PERM_RECIPE_VIEW')")
    @GetMapping("/product/{productId}")
    public RecipeView get(@PathVariable Long productId) {
        return recipeService.getRecipe(productId);
    }

    @PreAuthorize("hasAuthority('PERM_RECIPE_MANAGE')")
    @PutMapping("/product/{productId}")
    public RecipeView save(@PathVariable Long productId, @Valid @RequestBody RecipeRequest req) {
        return recipeService.saveRecipe(productId, req);
    }

    @PreAuthorize("hasAuthority('PERM_RECIPE_MANAGE')")
    @DeleteMapping("/product/{productId}")
    public ResponseEntity<Void> delete(@PathVariable Long productId) {
        recipeService.deleteRecipe(productId);
        return ResponseEntity.noContent().build();
    }
}
