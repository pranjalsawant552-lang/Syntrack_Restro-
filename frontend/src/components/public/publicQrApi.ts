import axios from "axios";
import type { ProductOptions } from "../menu/menuOptionsApi";

/**
 * Customer-side API for QR ordering. Deliberately NOT built on axiosClient: customers have no login, and
 * axiosClient's 401 handling would bounce them to /login. Identity here is the table's QR token (in the URL)
 * plus a private per-phone session token, sent as X-QR-Session.
 */
const http = axios.create({ baseURL: "/v1/public/qr", headers: { "Content-Type": "application/json" } });

export type Landing = { restaurantName: string; logoUrl: string; tableName: string; enabled: boolean; sessionMinutes: number };

export type SessionState = "HOLD" | "ACTIVE" | "CLOSED" | "EXPIRED" | "REJECTED";

export type OrderLineView = { name: string; quantity: number; status: "PENDING" | "SENT_TO_KITCHEN" | "SERVED"; lineTotal: number };
export type RequestLineView = {
  name: string;
  quantity: number;
  variantName?: string | null;
  optionsText?: string | null;
  notes?: string | null;
  lineTotal: number;
};
export type MyRequestView = {
  requestId: number;
  status: "PENDING" | "REJECTED" | "APPROVED";
  rejectReason?: string | null;
  lines: RequestLineView[];
  total: number;
};

export type SessionView = {
  state: SessionState;
  tableName: string;
  restaurantName: string;
  secondsLeft: number;
  approvalMode: "NONE" | "FIRST_ORDER" | "EVERY_ORDER";
  orderAccepted: boolean;
  items: OrderLineView[];
  total: number;
  requests: MyRequestView[];
  billRequested: boolean;
  closeReason?: string | null;
  invoiceNumber?: string | null;
};

export type StartedSession = { sessionToken: string; session: SessionView };

export type MenuItem = { productId: number; name: string; price: number; veg?: boolean | null; combo: boolean; customisable: boolean };
export type MenuCategory = { category: string; items: MenuItem[] };

export type SubmitLine = { productId: number; quantity: number; notes?: string; variantId?: number | null; modifierIds?: number[] };
export type SubmitResult = { requestId: number; status: "PENDING" | "APPROVED" | "REJECTED"; message: string };

export const errorMessage = (e: any, fallback = "Something went wrong. Please try again.") =>
  e?.response?.data?.message || e?.response?.data?.error || (typeof e?.response?.data === "string" ? e.response.data : "") || fallback;

const hdr = (token: string) => ({ headers: { "X-QR-Session": token } });

// One random id per browser: lets the server spot a single phone making repeated fake scans,
// without needing any personal details from the customer.
export const deviceId = (): string => {
  try {
    let id = localStorage.getItem("qr_device_id");
    if (!id) {
      id = (crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("qr_device_id", id!);
    }
    return id!;
  } catch {
    return "";
  }
};

export const publicQrApi = {
  landing: async (slug: string, qrToken: string): Promise<Landing> =>
    (await http.get(`/${slug}/table/${qrToken}`)).data,

  start: async (slug: string, qrToken: string, existingSession?: string): Promise<StartedSession> =>
    (
      await http.post(`/${slug}/table/${qrToken}/session`, null, {
        headers: { "X-QR-Device": deviceId(), ...(existingSession ? { "X-QR-Session": existingSession } : {}) },
      })
    ).data,

  session: async (slug: string, token: string): Promise<SessionView> => (await http.get(`/${slug}/session`, hdr(token))).data,
  menu: async (slug: string, token: string): Promise<MenuCategory[]> => (await http.get(`/${slug}/menu`, hdr(token))).data,
  options: async (slug: string, token: string, productId: number): Promise<ProductOptions> =>
    (await http.get(`/${slug}/menu/${productId}/options`, hdr(token))).data,

  submit: async (slug: string, token: string, items: SubmitLine[], note: string, clientRequestId: string): Promise<SubmitResult> =>
    (await http.post(`/${slug}/orders`, { items, note: note || null, clientRequestId }, hdr(token))).data,

  requestBill: async (slug: string, token: string) => (await http.post(`/${slug}/bill-request`, null, hdr(token))).data,
};
