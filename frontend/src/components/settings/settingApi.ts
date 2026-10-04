import type { SettingMaster } from "../../utils/types";
import axiosClient from "../axiosData/axiosClient";
import { cachedRequest, invalidateCache } from "../../utils/requestCache";

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const settingApi = {
  // ✅ Cached: the speed report's HAR capture showed /setting/current hit
  // 4 times in one session -- ProductsPage, PosPage and InvoicesPage each
  // dispatch fetchCurrentSetting() on mount with no shared cache, so every
  // page you visit re-fetches the shop's settings from scratch even though
  // they were just fetched seconds ago on the previous page.
  getCurrent: async (): Promise<SettingMaster> => {
    return cachedRequest("setting:current", async () => {
      const res = await axiosClient.get(`/setting/current`);
      return pickData(res) as SettingMaster;
    });
  },

  upsertCurrent: async (payload: SettingMaster): Promise<SettingMaster> => {
    const res = await axiosClient.put(`/setting/current`, payload);
    invalidateCache("setting:");
    return pickData(res) as SettingMaster;
  },
};
