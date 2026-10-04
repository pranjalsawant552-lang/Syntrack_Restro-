import axiosClient from "../axiosData/axiosClient";
import type { PagedResponse } from "../../hooks/usePaginatedList";

export type TenantUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phoneNumber?: string;
  active: boolean;
  permissions: string[];
};

export type CreateUserPayload = {
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  phoneNumber?: string;
  roleName: string;
};

export type UpdateUserPayload = {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  roleName?: string;
};

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const userApi = {
  search: async (args: { page: number; size: number; search: string; sort: string; filters: Record<string, any> }): Promise<PagedResponse<TenantUser>> => {
    const res = await axiosClient.get(`/users`, {
      params: {
        page: args.page,
        size: args.size,
        search: args.search || undefined,
        sort: args.sort || undefined,
        role: args.filters?.role || undefined,
        active: args.filters?.active,
      },
    });
    return pickData(res) as PagedResponse<TenantUser>;
  },

  create: async (payload: CreateUserPayload): Promise<TenantUser> => {
    const res = await axiosClient.post(`/users`, payload);
    return pickData(res) as TenantUser;
  },

  update: async (id: number, payload: UpdateUserPayload): Promise<TenantUser> => {
    const res = await axiosClient.put(`/users/${id}`, payload);
    return pickData(res) as TenantUser;
  },

  activate: async (id: number): Promise<TenantUser> => {
    const res = await axiosClient.put(`/users/${id}/activate`);
    return pickData(res) as TenantUser;
  },

  deactivate: async (id: number): Promise<TenantUser> => {
    const res = await axiosClient.put(`/users/${id}/deactivate`);
    return pickData(res) as TenantUser;
  },

  bulkActivate: async (ids: number[]): Promise<{ updated: number }> => {
    const res = await axiosClient.put(`/users/bulk-activate`, ids);
    return pickData(res);
  },

  bulkDeactivate: async (ids: number[]): Promise<{ updated: number }> => {
    const res = await axiosClient.put(`/users/bulk-deactivate`, ids);
    return pickData(res);
  },
};
