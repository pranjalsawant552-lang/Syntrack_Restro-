import axiosClient from "../axiosData/axiosClient";

/** One menu item with its effective availability (see backend MenuAvailabilityService). */
export type AvailabilityRow = {
  productId: number;
  name: string;
  categoryId?: number | null;
  categoryName: string;
  price: number;
  veg?: boolean | null;
  combo: boolean;
  /** false = permanently hidden from the menu (managed on the Menu page) */
  active: boolean;
  /** the owner / kitchen switched it off */
  manualOff: boolean;
  /** when a manual "off" ends by itself; null = stays off until switched on */
  offUntil?: string | null;
  /** system reason it can't be made right now (ingredient/stock/combo part) -- restock to fix */
  blockReason?: string | null;
  portionsLeft?: number | null;
  shelfQty?: number | null;
  /** what customers/waiters can actually order right now */
  sellable: boolean;
};

export type AvailabilityBoard = {
  items: AvailabilityRow[];
  /** hour of day when "rest of today" ends and items come back on (e.g. 4 = 4:00 AM) */
  dayCutoverHour: number;
  serverTime: string;
};

export type OffDuration = "MANUAL" | "END_OF_DAY" | "H1" | "H2";

export type SetPayload = {
  productIds?: number[];
  categoryIds?: number[];
  available: boolean;
  /** only used when available = false */
  duration?: OffDuration;
};

const pick = (res: any) => res?.data?.data ?? res?.data;

export const menuAvailabilityApi = {
  board: async (): Promise<AvailabilityBoard> => pick(await axiosClient.get(`/menu-availability`)),

  set: async (p: SetPayload): Promise<AvailabilityBoard> => {
    const d = p.duration ?? "MANUAL";
    const body = {
      productIds: p.productIds,
      categoryIds: p.categoryIds,
      available: p.available,
      until: d === "END_OF_DAY" ? "END_OF_DAY" : d === "H1" || d === "H2" ? "MINUTES" : "MANUAL",
      minutes: d === "H1" ? 60 : d === "H2" ? 120 : undefined,
    };
    return pick(await axiosClient.post(`/menu-availability/set`, body));
  },

  /** Everything back on. */
  reset: async (): Promise<{ restored: number; board: AvailabilityBoard }> =>
    pick(await axiosClient.post(`/menu-availability/reset`)),
};
