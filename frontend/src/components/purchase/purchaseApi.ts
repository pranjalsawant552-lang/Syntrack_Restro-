import axiosClient from "../axiosData/axiosClient";
import type { PagedResponse } from "../../hooks/usePaginatedList";

export type PurchaseListRow = {
  purchaseId: number;
  purchaseNumber: string;
  supplierBillNumber?: string;
  purchaseDate: string;
  netTotal: number;
  payMethod: "CASH" | "CARD" | "UPI";
  payStatus: "PAID" | "PENDING" | "CANCELLED";
  supplierName?: string;
  supplierPhone?: string;
};

/** A purchase line is EITHER a product line (productId + quantity) OR an ingredient line (ingredientId + ingredientQty + unit). */
export type PurchaseItemInput = {
  productId?: number;
  quantity?: number;
  ingredientId?: number;
  ingredientQty?: number;
  unit?: string;
  batchNo?: string;
  expiryDate?: string;
  unitCost?: number; // per unit (per `unit` for ingredients)
  gstPercent?: number;
};

export type CreatePurchasePayload = {
  payMethod: "CASH" | "CARD" | "UPI";
  payStatus: "PAID" | "PENDING" | "CANCELLED";
  discountValue: number;
  supplierBillNumber?: string;
  items: PurchaseItemInput[];
  supplierId?: number;
  supplierName?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  updateProductBuyPrice?: boolean;
};

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const purchaseApi = {
  search: async (args: {
    page: number; size: number; fromDate?: string; toDate?: string; search: string;
    payStatus?: string; payMethod?: string; sort: string;
  }): Promise<PagedResponse<PurchaseListRow>> => {
    const res = await axiosClient.get(`/purchase/search`, {
      params: {
        page: args.page, size: args.size, fromDate: args.fromDate, toDate: args.toDate,
        search: args.search || undefined, payStatus: args.payStatus, payMethod: args.payMethod, sort: args.sort,
      },
    });
    return pickData(res) as PagedResponse<PurchaseListRow>;
  },

  getById: async (id: number): Promise<any> => {
    const res = await axiosClient.get(`/purchase/${id}`);
    return pickData(res);
  },

  create: async (payload: CreatePurchasePayload): Promise<any> => {
    const res = await axiosClient.post(`/purchase/create`, payload);
    return pickData(res);
  },

  cancel: async (id: number): Promise<void> => {
    await axiosClient.delete(`/purchase/${id}`);
  },
};
