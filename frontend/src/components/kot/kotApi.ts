import axiosClient from "../axiosData/axiosClient";

export type Station = { stationId: number; name: string; printerName?: string | null; isDefault: boolean; active: boolean };
export type KotItem = { kotItemId: number; orderItemId: number; productName: string; quantity: number; notes?: string | null; status: "NEW" | "PREPARING" | "READY" | "SERVED" | "VOIDED" };
export type Kot = {
  kotId: number; kotNumber: string; orderId: number; stationId: number; stationName: string;
  tableLabel: string; orderType: string; waiterName?: string | null;
  status: "NEW" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
  createdAt: string; elapsedSeconds: number; items: KotItem[];
};

const unwrap = (res: any) => res?.data?.data ?? res?.data;
export const errMsg = (e: any, fallback = "Something went wrong") =>
  e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;

export const kotApi = {
  stations: async (): Promise<Station[]> => unwrap(await axiosClient.get("/kot/stations")) ?? [],
  createStation: async (b: { name: string; printerName?: string; isDefault?: boolean }) =>
    unwrap(await axiosClient.post("/kot/stations", b)) as Station,
  updateStation: async (id: number, b: { name: string; printerName?: string; isDefault?: boolean; active?: boolean }) =>
    unwrap(await axiosClient.put(`/kot/stations/${id}`, b)) as Station,
  mappings: async (): Promise<{ productId: number; stationId: number }[]> => unwrap(await axiosClient.get("/kot/product-stations")) ?? [],
  assign: async (productId: number, stationId: number | null) =>
    axiosClient.put(`/kot/product-stations/${productId}`, { stationId }),
  active: async (stationId?: number): Promise<Kot[]> =>
    unwrap(await axiosClient.get("/kot/active", { params: { stationId } })) ?? [],
  forOrder: async (orderId: number): Promise<Kot[]> => unwrap(await axiosClient.get(`/kot/order/${orderId}`)) ?? [],
  start: async (kotId: number) => unwrap(await axiosClient.post(`/kot/${kotId}/start`)) as Kot,
  ready: async (kotId: number) => unwrap(await axiosClient.post(`/kot/${kotId}/ready`)) as Kot,
  setItemStatus: async (kotItemId: number, status: "PREPARING" | "READY") =>
    unwrap(await axiosClient.post(`/kot/items/${kotItemId}/status`, null, { params: { status } })) as Kot,
};
