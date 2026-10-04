import axiosClient from "../axiosData/axiosClient";

export type Ingredient = {
  ingredientId: number;
  name: string;
  baseUnit: "G" | "ML" | "PCS";
  currentQty: number;
  reorderLevel: number;
  avgCost: number; // per base unit
  stockValue: number;
  status: "OK" | "LOW" | "OUT" | "NEGATIVE";
  active: boolean;
};

export type Batch = {
  batchId: number;
  batchNo?: string;
  expiryDate?: string;
  qtyRemaining: number;
  unitCost: number;
  receivedAt: string;
};

export type Movement = {
  movementId: number;
  ingredientId: number;
  ingredientName: string;
  baseUnit: string;
  type: "PURCHASE" | "CONSUMPTION" | "WASTAGE" | "ADJUSTMENT" | "RETURN";
  qty: number;
  unitCost: number;
  balanceAfter: number;
  refType?: string;
  refId?: string;
  reason?: string;
  actionUser?: string;
  createdAt: string;
};

export type ExpiryAlert = {
  batchId: number;
  ingredientId: number;
  ingredientName: string;
  baseUnit: string;
  batchNo?: string;
  expiryDate: string;
  qtyRemaining: number;
  daysLeft: number;
};

export type Alerts = {
  lowStock: Ingredient[];
  outOfStock: Ingredient[];
  negativeStock: Ingredient[];
  expiringSoon: ExpiryAlert[];
  expired: ExpiryAlert[];
};

export type RecipeLine = {
  ingredientId: number;
  ingredientName?: string;
  baseUnit?: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
  lineCost?: number;
};

export type Recipe = {
  productId: number;
  productName: string;
  sellingPrice: number;
  lines: RecipeLine[];
  foodCost: number;
  marginAmount: number;
  marginPercent: number;
  foodCostPercent: number;
};

export type CostingRow = {
  productId: number;
  productName: string;
  active: boolean;
  hasRecipe: boolean;
  sellingPrice: number;
  foodCost: number | null;
  marginAmount: number | null;
  marginPercent: number | null;
  foodCostPercent: number | null;
};

/** Units the user may enter, grouped by the ingredient base unit they convert to. */
export const UNITS_FOR_BASE: Record<string, string[]> = {
  G: ["G", "KG", "MG"],
  ML: ["ML", "L"],
  PCS: ["PCS", "DOZEN"],
};

export const errMsg = (e: any, fallback = "Something went wrong") =>
  e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;

const unwrap = (res: any) => res?.data?.data ?? res?.data;

export const inventoryApi = {
  listIngredients: async (search?: string, active?: boolean): Promise<Ingredient[]> => {
    const res = await axiosClient.get("/inventory/ingredients", { params: { search: search || undefined, active } });
    const d = unwrap(res);
    return Array.isArray(d) ? d : [];
  },
  createIngredient: async (b: { name: string; baseUnit: string; reorderLevel?: number }) =>
    unwrap(await axiosClient.post("/inventory/ingredients", b)) as Ingredient,
  updateIngredient: async (id: number, b: { name: string; baseUnit: string; reorderLevel?: number; active?: boolean }) =>
    unwrap(await axiosClient.put(`/inventory/ingredients/${id}`, b)) as Ingredient,
  batches: async (id: number): Promise<Batch[]> => unwrap(await axiosClient.get(`/inventory/ingredients/${id}/batches`)) ?? [],
  receive: async (b: {
    ingredientId: number; qty: number; unit: string; costPerUnit: number;
    batchNo?: string; expiryDate?: string; invoiceRef?: string;
  }) => unwrap(await axiosClient.post("/inventory/receive", b)) as Ingredient,
  wastage: async (b: { ingredientId: number; qty: number; unit: string; reason: string }) =>
    unwrap(await axiosClient.post("/inventory/wastage", b)) as Ingredient,
  adjust: async (b: { ingredientId: number; countedQty: number; unit: string; reason: string }) =>
    unwrap(await axiosClient.post("/inventory/adjust", b)) as Ingredient,
  movements: async (p: { ingredientId?: number; type?: string; from?: string; to?: string }): Promise<Movement[]> => {
    const res = await axiosClient.get("/inventory/movements", { params: p });
    const d = unwrap(res);
    return Array.isArray(d) ? d : [];
  },
  alerts: async (days = 7): Promise<Alerts> => unwrap(await axiosClient.get("/inventory/alerts", { params: { days } })),
};

export type AvailabilityRow = {
  productId: number;
  hasRecipe: boolean;
  availablePortions: number | null;
  limitingIngredient?: string | null;
  outOfStock: boolean;
};

export const recipeApi = {
  availability: async (): Promise<AvailabilityRow[]> => {
    const d = unwrap(await axiosClient.get("/recipes/availability"));
    return Array.isArray(d) ? d : [];
  },
  costing: async (): Promise<CostingRow[]> => {
    const d = unwrap(await axiosClient.get("/recipes/costing"));
    return Array.isArray(d) ? d : [];
  },
  get: async (productId: number): Promise<Recipe> => unwrap(await axiosClient.get(`/recipes/product/${productId}`)),
  save: async (productId: number, lines: { ingredientId: number; quantity: number; unit: string; wastagePercent: number }[]) =>
    unwrap(await axiosClient.put(`/recipes/product/${productId}`, { lines })) as Recipe,
  remove: async (productId: number) => { await axiosClient.delete(`/recipes/product/${productId}`); },
};
