import axiosClient from "../axiosData/axiosClient";

export type GstSummary = {
  fromDate: string;
  toDate: string;
  salesGstCollected: number;
  salesNetTotal: number;
  salesInvoiceCount: number;
  purchaseGstPaid: number;
  purchaseNetTotal: number;
  purchaseCount: number;
  netGstPayable: number;
};

export type SlowMovingItem = {
  productId: number;
  productName: string;
  barcode?: string;
  qty: number;
  stockValue: number;
};

export type InventoryReport = {
  totalInventoryValue: number;
  slowMovingDays: number;
  slowMovingCount: number;
  slowMovingItems: SlowMovingItem[];
};

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const reportApi = {
  gstSummary: async (fromDate: string, toDate: string): Promise<GstSummary> => {
    const res = await axiosClient.get(`/reports/gst-summary`, { params: { fromDate, toDate } });
    return pickData(res);
  },

  inventoryReport: async (slowMovingDays = 30): Promise<InventoryReport> => {
    const res = await axiosClient.get(`/reports/inventory`, { params: { slowMovingDays } });
    return pickData(res);
  },
};
