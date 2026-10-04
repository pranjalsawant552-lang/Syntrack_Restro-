import axiosClient from "../axiosData/axiosClient";

/** Staff-side API for QR table ordering (customers use publicQrApi instead). */

export type QrTableInfo = {
  tableId: number;
  tableName: string;
  section?: string | null;
  /** e.g. "/t/my-restaurant/AbC123..." -- prefix with the site origin to get the URL printed in the QR. */
  path: string;
  liveState?: "HOLD" | "ACTIVE" | null;
  pendingRequests: number;
  billRequested: boolean;
};

export type QrApprovalMode = "NONE" | "FIRST_ORDER" | "EVERY_ORDER";

export type QrSettings = {
  enabled: boolean;
  holdMinutes: number;
  sessionMinutes: number;
  approvalMode: QrApprovalMode;
};

export type QrRequestLine = {
  name: string;
  quantity: number;
  variantName?: string | null;
  optionsText?: string | null;
  notes?: string | null;
  lineTotal: number;
};

export type QrPendingRequest = {
  requestId: number;
  tableId: number;
  tableName: string;
  ageSeconds: number;
  sessionState?: string | null;
  /** true when the table already has a running order (customer is adding to it) */
  tableAlreadyOrdering: boolean;
  lines: QrRequestLine[];
  total: number;
  customerNote?: string | null;
};

const pick = (res: any) => res?.data?.data ?? res?.data;

/**
 * The URL encoded in a table's QR. Uses VITE_PUBLIC_APP_URL when set (handy if staff open the admin app
 * on a different address than customers use, e.g. localhost vs the public domain), else this site's origin.
 */
export const qrFullUrl = (path: string): string => {
  const base = ((import.meta as any).env?.VITE_PUBLIC_APP_URL as string | undefined) || window.location.origin;
  return `${base.replace(/\/+$/, "")}${path}`;
};

export const qrApi = {
  tables: async (): Promise<QrTableInfo[]> => pick(await axiosClient.get(`/restaurant/qr/tables`)) ?? [],
  rotate: async (tableId: number): Promise<QrTableInfo> =>
    pick(await axiosClient.post(`/restaurant/qr/tables/${tableId}/rotate`)),

  settings: async (): Promise<QrSettings> => pick(await axiosClient.get(`/restaurant/qr/settings`)),
  updateSettings: async (patch: Partial<QrSettings>): Promise<QrSettings> =>
    pick(await axiosClient.put(`/restaurant/qr/settings`, patch)),

  pending: async (): Promise<QrPendingRequest[]> => pick(await axiosClient.get(`/restaurant/qr/requests`)) ?? [],
  approve: async (requestId: number) => pick(await axiosClient.post(`/restaurant/qr/requests/${requestId}/approve`)),
  reject: async (requestId: number, reason?: string) =>
    pick(await axiosClient.post(`/restaurant/qr/requests/${requestId}/reject`, { reason })),

  extend: async (tableId: number, minutes: number) =>
    pick(await axiosClient.post(`/restaurant/qr/tables/${tableId}/extend`, null, { params: { minutes } })),
  end: async (tableId: number) => pick(await axiosClient.post(`/restaurant/qr/tables/${tableId}/end`)),
  dismissBillRequest: async (tableId: number) =>
    pick(await axiosClient.post(`/restaurant/qr/tables/${tableId}/dismiss-bill-request`)),
};
