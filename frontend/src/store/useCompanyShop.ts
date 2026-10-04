import { useMemo } from "react";
import { useSelector } from "react-redux";
import { selectCompanySetting } from "../store/settingsSlice";

export type ShopInfo = {
  name: string;
  address: string;
  phone: string;
  gst: string;
};

export function useCompanyShop(): ShopInfo {
  const setting = useSelector(selectCompanySetting);

  return useMemo(() => {
    const name = setting?.companyName?.trim() || "My Shop";
    const address = [setting?.address, setting?.city].filter(Boolean).join(", ");
    const phone = setting?.phoneNumber?.trim() || "";
    const gst = setting?.gstNumber?.trim() || "";

    return { name, address, phone, gst };
  }, [setting]);
}
