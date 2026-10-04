// src/components/Stock/stockMovementApi.ts
import axiosClient from "../axiosData/axiosClient";

const pickData = (res: any) => res?.data?.data ?? res?.data;

export type MovementType = "IN" | "OUT" | "SALE" | "RETURN" | "ADJUSTMENT";

export type StockMovTypeDTO = {
  movementId: number;
  movType: MovementType;
  stkMovmentQty: number;
  referneceId?: string;
  createdAt?: string;

  reason?: string | null;
  invoiceNum?: string | null;
  actionUser?: string | null;
};

export const stockMovementApi = {
  in: async (prodId: number, prodQty: number) => {
    const res = await axiosClient.post(`/stk-mvmt/${prodId}/prod-IN`, null, {
      params: { prodQty },
    });
    return pickData(res);
  },

  out: async (prodId: number, prodQty: number, reason: string) => {
    const res = await axiosClient.post(`/stk-mvmt/${prodId}/prod-OUT`, null, {
      params: { prodQty, reason },
    });
    return pickData(res);
  },

  // ✅ FIX: SALE needs invoiceNum as backend requires it
  sale: async (prodId: number, prodQty: number, invoiceNum: string) => {
    const res = await axiosClient.post(`/stk-mvmt/${prodId}/prod-SALE`, null, {
      params: { prodQty, invoiceNum },
    });
    return pickData(res);
  },

  ret: async (prodId: number, prodQty: number, invoiceNum: string) => {
    const res = await axiosClient.post(`/stk-mvmt/${prodId}/prod-RETURN`, null, {
      params: { prodQty, invoiceNum },
    });
    return pickData(res);
  },

  // ✅ ADJUSTMENT means SET FINAL QTY (backend will set final qty now)
  adjustment: async (prodId: number, finalQty: number, user: string) => {
    const res = await axiosClient.post(`/stk-mvmt/${prodId}/prod-ADJUSTMENT`, null, {
      params: { prodQty: finalQty, user },
    });
    return pickData(res);
  },

  // old (all)
  movementsByProduct: async (prodId: number): Promise<StockMovTypeDTO[]> => {
    const res = await axiosClient.get(`/stk-mvmt/${prodId}/mov-by-prodId`);
    return (pickData(res) ?? []) as StockMovTypeDTO[];
  },

  // ✅ NEW: date-wise history
  movementsByProductDate: async (
    prodId: number,
    fromDate: string, // yyyy-MM-dd
    toDate: string // yyyy-MM-dd
  ): Promise<StockMovTypeDTO[]> => {
    const res = await axiosClient.get(`/stk-mvmt/${prodId}/mov-by-prodId-date`, {
      params: { fromDate, toDate },
    });
    return (pickData(res) ?? []) as StockMovTypeDTO[];
  },
};
