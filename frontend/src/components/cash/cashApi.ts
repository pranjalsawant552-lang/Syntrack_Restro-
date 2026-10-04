import axiosClient from "../axiosData/axiosClient";

const pickData = (res: any) => res?.data?.data ?? res?.data;

export type CashMovement = {
  movementId: number;
  type: "IN" | "OUT";
  amount: number;
  reason: string;
  createdBy?: string | null;
  createdAt: string;
};

export type CashShift = {
  shiftId: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  openedBy?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  openingFloat: number;
  cashSales: number;
  cardSales: number;
  upiSales: number;
  pendingSales: number;
  invoiceCount: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  countedCash?: number | null;
  variance?: number | null;
  openNotes?: string | null;
  closeNotes?: string | null;
  denominationsJson?: string | null;
  /** Orders still running (tables/parcel/online) -- warn before closing the till. */
  runningOrders: number;
  movements: CashMovement[];
};

export const cashApi = {
  /** The open shift, or null when the till is closed (HTTP 204). */
  current: async (): Promise<CashShift | null> => {
    const res = await axiosClient.get(`/cash/shifts/current`);
    if (res.status === 204) return null;
    return pickData(res) ?? null;
  },
  history: async (from: string, to: string): Promise<CashShift[]> =>
    pickData(await axiosClient.get(`/cash/shifts`, { params: { from, to } })) ?? [],
  open: async (openingFloat: number, notes?: string): Promise<CashShift> =>
    pickData(await axiosClient.post(`/cash/shifts/open`, { openingFloat, notes })),
  addMovement: async (shiftId: number, type: "IN" | "OUT", amount: number, reason: string): Promise<CashShift> =>
    pickData(await axiosClient.post(`/cash/shifts/${shiftId}/movements`, { type, amount, reason })),
  close: async (shiftId: number, countedCash: number, notes?: string, denominationsJson?: string): Promise<CashShift> =>
    pickData(await axiosClient.post(`/cash/shifts/${shiftId}/close`, { countedCash, notes, denominationsJson })),
};
