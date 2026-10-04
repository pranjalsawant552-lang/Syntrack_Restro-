import axiosClient from "../axiosData/axiosClient";

export type SuperAdminRole = {
  id: number;
  name: string;
  description?: string | null;
  systemRole: boolean;
  permissions: string[];
};

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const superAdminRoleApi = {
  listAllPermissions: async (): Promise<string[]> => {
    const res = await axiosClient.get(`/superadmin/permissions`);
    return pickData(res) ?? [];
  },

  listRoles: async (tenantId: number): Promise<SuperAdminRole[]> => {
    const res = await axiosClient.get(`/superadmin/tenants/${tenantId}/roles`);
    return pickData(res) ?? [];
  },

  updatePermissions: async (
    tenantId: number,
    roleId: number,
    permissions: string[]
  ): Promise<SuperAdminRole> => {
    const res = await axiosClient.put(`/superadmin/tenants/${tenantId}/roles/${roleId}`, {
      permissions,
    });
    return pickData(res);
  },
};
