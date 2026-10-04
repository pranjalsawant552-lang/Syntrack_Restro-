import type { Product } from "../../utils/types";
import axiosClient from "../axiosData/axiosClient";
import { cachedRequest, invalidateCache } from "../../utils/requestCache";

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const stockApi = {
  // ✅ all products
  listProducts: async (): Promise<Product[]> => {
    const res = await axiosClient.get(`/product/all_prodcut_list`);
    return pickData(res) ?? [];
  },

  // ✅ read current stock (NO INSERT)
  getStockValue: async (prodId: number): Promise<number> => {
    const res = await axiosClient.get(`/stock/${prodId}/stock-value`);
    return Number(pickData(res) ?? 0);
  },

  // ✅ NEW: every product's stock in ONE request (productId -> qty), instead of
  // calling getStockValue once per product. Use this whenever you need stock
  // alongside a full product list -- looping getStockValue per row was firing
  // one HTTP request (+ one DB query) per product, which got slow fast as the
  // catalog grew.
  //
  // ✅ Cached, but with a deliberately SHORT ttl (8s, not the usual 30s):
  // the speed report caught /stock/all being hit twice in one session (POS +
  // Stock Management both load it on mount), but stock quantities change on
  // every sale, so this can't be cached as aggressively as settings/categories
  // without risking a cashier oversimg against a stale "max allowed qty".
  // Any local stock change (stockIn/stockSetExact) invalidates it immediately.
  getAllStockQuantities: async (): Promise<Record<string, number>> => {
    return cachedRequest(
      "stock:all",
      async () => {
        const res = await axiosClient.get(`/stock/all`);
        return (pickData(res) ?? {}) as Record<string, number>;
      },
      8_000
    );
  },

  // ✅ Stock IN (increment) -> creates StockMovement + updates Stock
  stockIn: async (prodId: number, prodQty: number): Promise<any> => {
    const res = await axiosClient.post(
      `/stk-mvmt/${prodId}/prod-IN`,
      null,
      { params: { prodQty } }
    );
    invalidateCache("stock:");
    return pickData(res);
  },

  // ✅ Stock SET exact qty -> use ADJUSTMENT endpoint
  // NOTE: your backend uses param name 'prodQty' even for adjustment, we pass finalQty into it.
  stockSetExact: async (prodId: number, finalQty: number, user: string): Promise<any> => {
    const res = await axiosClient.post(
      `/stk-mvmt/${prodId}/prod-ADJUSTMENT`,
      null,
      { params: { prodQty: finalQty, user } }
    );
    invalidateCache("stock:");
    return pickData(res);
  },

  // ✅ optional: movement history
  getMovementsByProduct: async (prodId: number): Promise<any[]> => {
    const res = await axiosClient.get(`/stk-mvmt/${prodId}/mov-by-prodId`);
    return pickData(res) ?? [];
  },
};
