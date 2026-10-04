package com.pos.app.Enum;

/** Why an ingredient's stock changed. Stock ONLY changes through one of these movements. */
public enum IngredientMovementType {
    PURCHASE,     // goods received from a supplier (+)
    CONSUMPTION,  // recipe-based deduction when a dish is sent to the kitchen / billed (-)
    WASTAGE,      // spoilage, spillage, staff meal, returns to vendor etc. (-)
    ADJUSTMENT,   // stock-count correction (+/-)
    RETURN        // stock put back (e.g. reversal of a consumption) (+)
}
