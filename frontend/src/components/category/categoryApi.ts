import type { Category } from "../../utils/types";
import axiosClient from "../axiosData/axiosClient";
import { cachedRequest, invalidateCache } from "../../utils/requestCache";

export const categoryApi = {
  // ✅ Cached: the speed report's HAR capture showed /category/category_list
  // hit 4 times in one session (CategoryPage, ProductsPage, PosPage,
  // StockManagementPage each fetch it independently on mount). Categories
  // change rarely, so reusing a result for a short window avoids re-hitting
  // the network every time another page mounts.
  list: async (includeInactive = true): Promise<Category[]> => {
    return cachedRequest(`category:list:${includeInactive}`, async () => {
      const res = await axiosClient.get("/category/category_list", {
        params: { includeInactive },
      });
      return Array.isArray(res.data) ? res.data : [];
    });
  },

  // ✅ NEW: sub-categories of a given parent category
  subCategoriesOf: async (parentCategoryId: number, includeInactive = true): Promise<Category[]> => {
    const res = await axiosClient.get("/category/subcategories", {
      params: { parentCategoryId, includeInactive },
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  // parentCategoryId omitted/undefined => top-level category
  create: async (categoryName: string, parentCategoryId?: number | null) => {
    const res = await axiosClient.post("/category/add_category", null, {
      params: { categoryName, ...(parentCategoryId ? { parentCategoryId } : {}) },
    });
    invalidateCache("category:");
    return res.data;
  },

  // parentCategoryId omitted/undefined => (re)set to top-level
  update: async (categoryId: number, categoryName: string, parentCategoryId?: number | null) => {
    const res = await axiosClient.put("/category/update_category", null, {
      params: { categoryId, categoryName, ...(parentCategoryId ? { parentCategoryId } : {}) },
    });
    invalidateCache("category:");
    return res.data;
  },

  // if you have normal delete endpoint
  remove: async (categoryId: number) => {
    const res = await axiosClient.delete("/category/force_delete_category", {
      params: { categoryId },
    });
    invalidateCache("category:");
    return res.data;
  },

  // ✅ force delete
  forceRemove: async (categoryId: number) => {
    const res = await axiosClient.delete("/category/force_delete_category", {
      params: { categoryId },
    });
    invalidateCache("category:");
    return res.data;
  },

  // ✅ active/inactive
  toggleStatus: async (categoryId: number, active: boolean) => {
    const res = await axiosClient.put("/category/toggle_status", null, {
      params: { categoryId, active },
    });
    invalidateCache("category:");
    return res.data;
  },
};
