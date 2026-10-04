import axiosClient from "../axiosData/axiosClient";
import type { PagedResponse } from "../../hooks/usePaginatedList";

export type Tenant = {
  id: number;
  name: string;
  slug: string;
  contactEmail?: string;
  contactPhone?: string;
  logoUrl?: string;
  active: boolean;
  maxUsers?: number | null;
  maxProducts?: number | null;
  createdAt: string;
};

export type CreateTenantPayload = {
  companyName: string;
  slug: string;
  contactEmail?: string;
  contactPhone?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail: string;
  adminPassword: string;
  adminPhoneNumber?: string;
};

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const tenantApi = {
  search: async (args: { page: number; size: number; search: string; filters: Record<string, any> }): Promise<PagedResponse<Tenant>> => {
    const res = await axiosClient.get(`/superadmin/tenants`, {
      params: { page: args.page, size: args.size, search: args.search || undefined, active: args.filters?.active },
    });
    return pickData(res) as PagedResponse<Tenant>;
  },

  create: async (payload: CreateTenantPayload): Promise<Tenant> => {
    const res = await axiosClient.post(`/superadmin/tenants`, payload);
    return pickData(res) as Tenant;
  },

  activate: async (id: number): Promise<Tenant> => {
    const res = await axiosClient.put(`/superadmin/tenants/${id}/activate`);
    return pickData(res) as Tenant;
  },

  deactivate: async (id: number): Promise<Tenant> => {
    const res = await axiosClient.put(`/superadmin/tenants/${id}/deactivate`);
    return pickData(res) as Tenant;
  },

  updateBranding: async (id: number, payload: { name?: string; logoUrl?: string }): Promise<Tenant> => {
    const res = await axiosClient.put(`/superadmin/tenants/${id}/branding`, payload);
    return pickData(res) as Tenant;
  },

  updateLimits: async (id: number, payload: { maxUsers?: number | null; maxProducts?: number | null }): Promise<Tenant> => {
    const res = await axiosClient.put(`/superadmin/tenants/${id}/limits`, payload);
    return pickData(res) as Tenant;
  },

  getUsage: async (id: number): Promise<{
    userCount: number; maxUsers: number | null;
    productCount: number; maxProducts: number | null;
    customerCount: number; invoiceCount: number;
  }> => {
    const res = await axiosClient.get(`/superadmin/tenants/${id}/usage`);
    return pickData(res);
  },

  remove: async (id: number): Promise<void> => {
    await axiosClient.delete(`/superadmin/tenants/${id}`, { params: { confirm: true } });
  },
};
