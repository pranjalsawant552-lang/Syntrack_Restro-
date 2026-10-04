import axiosClient from "../axiosData/axiosClient";

export type Role = {
  id: number;
  name: string;
  description?: string;
  systemRole: boolean;
  permissions: string[];
};

export type CreateRolePayload = {
  name: string;
  description?: string;
  permissions: string[];
};

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const roleApi = {
  listAll: async (): Promise<Role[]> => {
    const res = await axiosClient.get(`/roles`);
    const data = pickData(res);
    return Array.isArray(data) ? data : [];
  },

  listAllPermissions: async (): Promise<string[]> => {
    const res = await axiosClient.get(`/roles/permissions`);
    const data = pickData(res);
    return Array.isArray(data) ? data : [];
  },

  create: async (payload: CreateRolePayload): Promise<Role> => {
    const res = await axiosClient.post(`/roles`, payload);
    return pickData(res) as Role;
  },

  update: async (id: number, payload: Partial<CreateRolePayload>): Promise<Role> => {
    const res = await axiosClient.put(`/roles/${id}`, payload);
    return pickData(res) as Role;
  },

  remove: async (id: number): Promise<void> => {
    await axiosClient.delete(`/roles/${id}`);
  },
};
