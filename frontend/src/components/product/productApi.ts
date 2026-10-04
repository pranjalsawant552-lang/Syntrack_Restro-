// import type { ProductDTO } from "../../utils/types";
// import axiosClient from "../axiosData/axiosClient";

// export const productApi = {
//   listByCategory: async (cateId: number): Promise<ProductDTO[]> => {
//     const res = await axiosClient.get(`/product/${cateId}/product_list`);
//     console.log( "prod list",res.data);
    
//     return Array.isArray(res.data) ? res.data : [];
//   },

//   listAll: async (): Promise<ProductDTO[]> => {
//     const res = await axiosClient.get(`/product/all_prodcut_list`);
//     console.log( "all prod list",res.data);

//     return Array.isArray(res.data) ? res.data : [];
//   },

//   create: async (cateId: number, payload: ProductDTO) => {
//     const res = await axiosClient.post(`/product/${cateId}/add_product`, payload);
//     return res.data;
//   },

//   update: async (cateId: number, prodId: number, payload: ProductDTO) => {
//     const res = await axiosClient.put(`/product/${cateId}/product/${prodId}`, payload);
//     return res.data;
//   },

//   remove: async (cateId: number, prodId: number) => {
//     const res = await axiosClient.delete(`/product/${cateId}/product/${prodId}`);
//     return res.data;
//   },

//   setStatus: async (cateId: number, prodId: number, isActive: boolean) => {
//     const res = await axiosClient.patch(
//       `/product/${cateId}/product/${prodId}/status`,
//       null,
//       { params: { isActive } }
//     );
//     return res.data;
//   },
// };


import type { Product, ProductDTO } from "../../utils/types";
import axiosClient from "../axiosData/axiosClient";
import type { PagedResponse } from "../../hooks/usePaginatedList";
import { cachedRequest, invalidateCache } from "../../utils/requestCache";

/**
 * Backend sometimes returns ProductDTO where productId can be undefined (bad for UI lists).
 * UI list requires Product.productId to be number always.
 */
const toProduct = (p: any): Product | null => {
  const id = p?.productId;
  if (typeof id !== "number") return null;

  return {
    productId: id,
    productName: String(p?.productName ?? ""),
    prodPrice: Number(p?.prodPrice ?? 0),
    prodGST: Number(p?.prodGST ?? 0),
    prodBuyPrice: typeof p?.prodBuyPrice === "number" ? p.prodBuyPrice : undefined,

    barcode: p?.barcode ?? undefined,

    // backend may send active or isActive
    active: typeof p?.active === "boolean" ? p.active : undefined,
    isActive: typeof p?.isActive === "boolean" ? p.isActive : undefined,

    // if your backend returns these
    categoryId: typeof p?.categoryId === "number" ? p.categoryId : undefined,
    categoryName: typeof p?.categoryName === "string" ? p.categoryName : undefined,

    // menu flags -- these MUST be carried through: the edit form re-sends them, and dropping them
    // here used to silently reset veg/non-veg on every edit and hide "86'd" items from the picker.
    isVeg: typeof p?.isVeg === "boolean" ? p.isVeg : null,
    temporarilyUnavailable: p?.temporarilyUnavailable === true,
    trackStock: p?.trackStock !== false, // missing (older backend) = stock product, as before
    combo: p?.combo === true,

    createdAt: p?.createdAt ?? undefined,
    updatedAt: p?.updatedAt ?? undefined,
  };
};

const asProductList = (data: any): Product[] => {
  const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return arr.map(toProduct).filter(Boolean) as Product[];
};

export const productApi = {
  // ✅ LIST APIs must return Product[]
  listByCategory: async (cateId: number): Promise<Product[]> => {
    const res = await axiosClient.get(`/product/${cateId}/product_list`);
    return asProductList(res.data);
  },

  listAll: async (activeOnly = false): Promise<Product[]> => {
    // ✅ Cached: the speed report's HAR capture caught /product/all_prodcut_list
    // being hit 4 TIMES in a single session at 580-706ms each -- the single
    // biggest cost in the whole capture. ProductsPage no longer calls this at
    // all (it uses `search` below), but PosPage and PurchasesPage still need
    // the FULL catalog in memory (instant barcode scan / instant product
    // picker), so this can't just become pagination there. A short cache
    // means navigating POS -> Purchases -> POS again within a few seconds
    // reuses the same fetch instead of re-downloading the whole catalog.
    return cachedRequest(`product:listAll:${activeOnly}`, async () => {
      const res = await axiosClient.get(`/product/all_prodcut_list`, { params: { activeOnly } });
      return asProductList(res.data);
    });
  },

  // ✅ Server-side pagination: only the current page is fetched/transferred,
  // instead of downloading and parsing the entire catalog on every load
  // (what the old listAll-based product list did). Backend already had this
  // endpoint (ProductController#searchProducts) wired to a real DB Page
  // query -- the product list page just wasn't calling it. Mirrors
  // supplierApi.searchPaged / purchaseApi.search.
  search: async (args: {
    page: number;
    size: number;
    search?: string;
    categoryId?: number;
    active?: boolean;
    sort?: string;
  }): Promise<PagedResponse<Product>> => {
    const res = await axiosClient.get(`/product/search`, {
      params: {
        page: args.page,
        size: args.size,
        search: args.search || undefined,
        categoryId: args.categoryId,
        active: args.active,
        sort: args.sort || "productName,asc",
      },
    });
    const data = res.data ?? {};
    return {
      content: asProductList(data.content),
      totalElements: Number(data.totalElements ?? 0),
      totalPages: Number(data.totalPages ?? 0),
      page: Number(data.page ?? args.page),
      size: Number(data.size ?? args.size),
    };
  },

  // ✅ create/update: payload is ProductDTO
  create: async (cateId: number, payload: ProductDTO): Promise<Product> => {
    const res = await axiosClient.post(`/product/${cateId}/add_product`, payload);
    // response can be ProductDTO or Product, normalize:
    const p = toProduct(res.data);
    if (!p) throw new Error("Invalid product response from backend");
    invalidateCache("product:");
    return p;
  },

  update: async (cateId: number, prodId: number, payload: ProductDTO): Promise<Product> => {
    const res = await axiosClient.put(`/product/${cateId}/product/${prodId}`, payload);
    const p = toProduct(res.data);
    if (!p) throw new Error("Invalid product response from backend");
    invalidateCache("product:");
    return p;
  },

  remove: async (cateId: number, prodId: number) => {
    const res = await axiosClient.delete(`/product/${cateId}/product/${prodId}`);
    invalidateCache("product:");
    return res.data;
  },

  setStatus: async (cateId: number, prodId: number, isActive: boolean) => {
    const res = await axiosClient.patch(`/product/${cateId}/product/${prodId}/status`, null, {
      params: { isActive },
    });
    invalidateCache("product:");
    return res.data;
  },

  // ✅ "86" board -- today-only "out of stock" toggle, separate from the
  // permanent active/inactive flag. See Product.temporarilyUnavailable.
  toggle86: async (prodId: number, unavailable: boolean) => {
    const res = await axiosClient.patch(`/product/${prodId}/86`, null, { params: { unavailable } });
    invalidateCache("product:");
    return res.data;
  },

  list86: async (): Promise<Product[]> => {
    const res = await axiosClient.get(`/product/86-list`);
    return asProductList(res.data);
  },

  clearAll86s: async () => {
    const res = await axiosClient.post(`/product/86-list/clear`);
    invalidateCache("product:");
    return res.data;
  },
};
