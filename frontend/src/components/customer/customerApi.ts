
import type { Customer } from "../../utils/types";
import axiosClient from "../axiosData/axiosClient";

const pickData = (res: any) => res?.data?.data ?? res?.data;

export type CreateCustomerDTO = {
  customerName: string;   // ✅ mandatory
  phone?: string;
  email?: string;
  address?: string;
};

export const customerApi = {
  listAll: async (): Promise<Customer[]> => {
    const res = await axiosClient.get(`/customer/list`); // 🔁 adjust endpoint
    const data = pickData(res);
    return (Array.isArray(data) ? data : []) as Customer[];
  },

  /** Server-side page + search + active filter (what the Customers screen uses). */
  searchPaged: async (args: { page: number; size: number; search?: string; active?: boolean; sort?: string }) => {
    const res = await axiosClient.get(`/customer/search-paged`, {
      params: {
        page: args.page,
        size: args.size,
        search: args.search || undefined,
        active: args.active,
        sort: args.sort || "customerName,asc",
      },
    });
    const d = pickData(res) ?? {};
    return {
      content: (Array.isArray(d.content) ? d.content : []) as Customer[],
      totalElements: Number(d.totalElements ?? 0),
      totalPages: Number(d.totalPages ?? 0),
      page: Number(d.page ?? args.page),
      size: Number(d.size ?? args.size),
    };
  },

  search: async (q: string): Promise<Customer[]> => {
    const res = await axiosClient.get(`/customer/search`, { params: { q } }); // 🔁 adjust endpoint
    const data = pickData(res);
    return (Array.isArray(data) ? data : []) as Customer[];
  },

  create: async (payload: CreateCustomerDTO): Promise<Customer> => {
    const res = await axiosClient.post(`/customer/create`, payload); // 🔁 adjust endpoint
    return pickData(res) as Customer;
  },

  // ✅ ADD THIS (used in CustomersPage)
  update: async (customerId: number, payload: CreateCustomerDTO): Promise<Customer> => {
    const res = await axiosClient.put(`/customer/${customerId}/update`, payload); // 🔁 adjust endpoint
    return pickData(res) as Customer;
  },

  // ✅ ADD THIS (used in CustomersPage)
  toggleActive: async (customerId: number, isActive: boolean): Promise<any> => {
    // backend style 1: PATCH with params
    const res = await axiosClient.patch(`/customer/${customerId}/status`, null, {
      params: { isActive },
    }); // 🔁 adjust endpoint
    return pickData(res);
  },
};
