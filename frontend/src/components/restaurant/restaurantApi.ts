import axiosClient from "../axiosData/axiosClient";

export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
export type RestaurantOrderStatus = "OPEN" | "KOT_SENT" | "SERVED" | "SETTLED" | "CANCELLED";
export type OrderItemStatus = "PENDING" | "SENT_TO_KITCHEN" | "SERVED";
export type OrderType = "DINE_IN" | "PARCEL" | "ONLINE";

export type TableBoardRow = {
  tableId: number;
  tableName: string;
  capacity?: number | null;
  section?: string | null;
  status: TableStatus;
  orderId?: number | null;
  itemCount?: number | null;
  runningTotal?: number | null;
  waiterName?: string | null;
  // QR self-ordering overlay (absent when nobody has scanned this table)
  qrState?: "HOLD" | "ACTIVE" | null;
  qrSecondsLeft?: number | null;
  qrPendingRequests?: number | null;
  qrBillRequested?: boolean | null;
};

export type RestaurantOrderItem = {
  orderItemId: number;
  productName: string;
  unitPrice: number;
  gstPercent: number;
  quantity: number;
  notes?: string | null;
  status: OrderItemStatus;
  billed: boolean;
  product?: { productId: number };
  variantId?: number | null;
  variantName?: string | null;
  optionsText?: string | null;
  displayName?: string | null;
};

/** What settling returns: the order in its new state + the invoice just generated. */
export type SettleResult = {
  order: RestaurantOrder;
  invoiceId: number;
  invoiceNumber: string;
  orderClosed: boolean;
};

export type RestaurantOrder = {
  orderId: number;
  table?: { tableId: number; tableName: string } | null;
  orderType: OrderType;
  orderSource?: string | null; // e.g. "Zomato", "Swiggy", "Website" -- ONLINE orders only
  externalOrderRef?: string | null;
  customerName?: string | null; // PARCEL/ONLINE orders only (no table to identify who it's for)
  customerPhone?: string | null;
  status: RestaurantOrderStatus;
  waiterName?: string | null;
  guestCount?: number | null;
  notes?: string | null;
  openedAt: string;
  settledAt?: string | null;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  items: RestaurantOrderItem[];
};

export type KitchenQueueItem = {
  orderItemId: number;
  orderId: number;
  tableName: string;
  productName: string;
  quantity: number;
  notes?: string | null;
};

export type SettleOrderPayload = {
  payMethod: "CASH" | "CARD" | "UPI" | "SPLIT";
  payStatus: "PAID" | "PENDING" | "CANCELLED";
  discountValue?: number;
  cashAmount?: number;
  onlineAmount?: number;
  onlinePayMethod?: "CARD" | "UPI";
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  /** Split-bill: bill only these order-item IDs; omit to bill everything unbilled. */
  itemIds?: number[];
};

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const restaurantApi = {
  listTables: async (): Promise<TableBoardRow[]> => {
    const res = await axiosClient.get(`/restaurant/tables`);
    return pickData(res) ?? [];
  },

  createTable: async (tableName: string, capacity?: number, section?: string) => {
    const res = await axiosClient.post(`/restaurant/tables`, null, {
      params: { tableName, capacity, section },
    });
    return pickData(res);
  },

  updateTable: async (
    tableId: number,
    patch: { tableName?: string; capacity?: number; section?: string; active?: boolean }
  ) => {
    const res = await axiosClient.put(`/restaurant/tables/${tableId}`, null, { params: patch });
    return pickData(res);
  },

  openOrder: async (tableId: number, waiterName?: string, guestCount?: number): Promise<RestaurantOrder> => {
    const res = await axiosClient.post(`/restaurant/tables/${tableId}/open-order`, null, {
      params: { waiterName, guestCount },
    });
    return pickData(res);
  },

  // ✅ Parcel (walk-in takeaway) or Online (delivery platform) order -- no table.
  openQuickOrder: async (args: {
    orderType: "PARCEL" | "ONLINE";
    customerName?: string;
    customerPhone?: string;
    orderSource?: string;
    externalOrderRef?: string;
  }): Promise<RestaurantOrder> => {
    const res = await axiosClient.post(`/restaurant/orders/quick`, null, { params: args });
    return pickData(res);
  },

  // ✅ The counter-orders board -- every active Parcel/Online order.
  listCounterOrders: async (): Promise<RestaurantOrder[]> => {
    const res = await axiosClient.get(`/restaurant/orders/counter`);
    return pickData(res) ?? [];
  },

  getOrder: async (orderId: number): Promise<RestaurantOrder> => {
    const res = await axiosClient.get(`/restaurant/orders/${orderId}`);
    return pickData(res);
  },

  addItem: async (
    orderId: number,
    productId: number,
    quantity: number,
    notes?: string,
    variantId?: number | null,
    modifierIds?: number[]
  ): Promise<RestaurantOrder> => {
    const res = await axiosClient.post(`/restaurant/orders/${orderId}/items`, {
      productId,
      quantity,
      notes,
      variantId: variantId ?? undefined,
      modifierIds: modifierIds && modifierIds.length ? modifierIds : undefined,
    });
    return pickData(res);
  },

  updateItem: async (orderId: number, itemId: number, patch: { quantity?: number; notes?: string }) => {
    const res = await axiosClient.put(`/restaurant/orders/${orderId}/items/${itemId}`, patch);
    return pickData(res);
  },

  removeItem: async (orderId: number, itemId: number) => {
    const res = await axiosClient.delete(`/restaurant/orders/${orderId}/items/${itemId}`);
    return pickData(res);
  },

  // Items already on a KOT can't be plainly removed -- they're voided with a reason + manager approval.
  voidItem: async (orderId: number, itemId: number, body: { reason: string; approverEmail: string; approverPassword: string }) => {
    const res = await axiosClient.post(`/restaurant/orders/${orderId}/items/${itemId}/void`, body);
    return pickData(res);
  },

  sendKot: async (orderId: number): Promise<RestaurantOrder> => {
    const res = await axiosClient.post(`/restaurant/orders/${orderId}/send-kot`);
    return pickData(res);
  },

  settleOrder: async (orderId: number, payload: SettleOrderPayload): Promise<SettleResult> => {
    const res = await axiosClient.post(`/restaurant/orders/${orderId}/settle`, payload);
    return pickData(res);
  },

  cancelOrder: async (orderId: number) => {
    const res = await axiosClient.post(`/restaurant/orders/${orderId}/cancel`);
    return pickData(res);
  },

  mergeOrders: async (sourceOrderId: number, targetOrderId: number): Promise<RestaurantOrder> => {
    const res = await axiosClient.post(`/restaurant/orders/${sourceOrderId}/merge-into/${targetOrderId}`);
    return pickData(res);
  },

  kitchenQueue: async (): Promise<KitchenQueueItem[]> => {
    const res = await axiosClient.get(`/restaurant/kitchen/queue`);
    return pickData(res) ?? [];
  },

  markServed: async (orderItemId: number) => {
    const res = await axiosClient.post(`/restaurant/kitchen/items/${orderItemId}/serve`);
    return pickData(res);
  },
};
