import axiosClient from "../axiosData/axiosClient";

const pickData = (res: any) => res?.data?.data ?? res?.data;

export type VariantView = { variantId: number; name: string; price: number; recipeFactor: number; active: boolean };
export type OptionView = { optionId: number; name: string; price: number; active: boolean };
export type GroupView = {
  groupId: number;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number; // 0 = no limit, 1 = pick one
  active: boolean;
  options: OptionView[];
};
export type ComboLine = { componentProductId: number; componentName: string; quantity: number };
export type ProductOptions = {
  productId: number;
  combo: boolean;
  variants: VariantView[];
  groups: GroupView[];
  comboItems: ComboLine[];
};

export type VariantInput = { name: string; price: number; recipeFactor?: number; active?: boolean };
export type GroupInput = {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  active: boolean;
  options: { name: string; price: number; active?: boolean }[];
};

export const menuOptionsApi = {
  /** forOrdering=true (default): only what a waiter may choose; false: everything, for the editor. */
  forProduct: async (productId: number, forOrdering = true): Promise<ProductOptions> => {
    const res = await axiosClient.get(`/menu-options/products/${productId}`, {
      params: { includeInactive: !forOrdering },
    });
    return pickData(res);
  },
  setVariants: async (productId: number, variants: VariantInput[]): Promise<ProductOptions> =>
    pickData(await axiosClient.put(`/menu-options/products/${productId}/variants`, variants)),
  setModifierGroups: async (productId: number, groupIds: number[]): Promise<ProductOptions> =>
    pickData(await axiosClient.put(`/menu-options/products/${productId}/modifier-groups`, groupIds)),
  setCombo: async (productId: number, items: { componentProductId: number; quantity: number }[]): Promise<ProductOptions> =>
    pickData(await axiosClient.put(`/menu-options/products/${productId}/combo`, items)),

  listGroups: async (): Promise<GroupView[]> => (pickData(await axiosClient.get(`/menu-options/groups`)) ?? []),
  createGroup: async (g: GroupInput): Promise<GroupView> => pickData(await axiosClient.post(`/menu-options/groups`, g)),
  updateGroup: async (id: number, g: GroupInput): Promise<GroupView> =>
    pickData(await axiosClient.put(`/menu-options/groups/${id}`, g)),
  deleteGroup: async (id: number) => pickData(await axiosClient.delete(`/menu-options/groups/${id}`)),
};
