import axiosClient from "../axiosData/axiosClient";
import type { PagedResponse } from "../../hooks/usePaginatedList";

export type Supplier = {
  supplierId: number;
  supplierName: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  isActive: boolean;
};

export type CreateSupplierDTO = {
  supplierName: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
};

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const supplierApi = {
  listAll: async (): Promise<Supplier[]> => {
    const res = await axiosClient.get(`/supplier/list`);
    const data = pickData(res);
    return Array.isArray(data) ? data : [];
  },

  searchPaged: async (args: { page: number; size: number; search: string; filters: Record<string, any> }): Promise<PagedResponse<Supplier>> => {
    const res = await axiosClient.get(`/supplier/search-paged`, {
      params: { page: args.page, size: args.size, search: args.search || undefined, active: args.filters?.active },
    });
    return pickData(res) as PagedResponse<Supplier>;
  },

  create: async (dto: CreateSupplierDTO): Promise<Supplier> => {
    const res = await axiosClient.post(`/supplier/create`, dto);
    return pickData(res) as Supplier;
  },

  update: async (id: number, dto: Partial<CreateSupplierDTO>): Promise<Supplier> => {
    const res = await axiosClient.put(`/supplier/${id}/update`, dto);
    return pickData(res) as Supplier;
  },

  toggleActive: async (id: number, isActive: boolean): Promise<Supplier> => {
    const res = await axiosClient.patch(`/supplier/${id}/status`, null, { params: { isActive } });
    return pickData(res) as Supplier;
  },
};
