import axiosClient from "../axiosData/axiosClient";
import type { PagedResponse } from "../../hooks/usePaginatedList";

export type AuditLogEntry = {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  details: string;
  createdAt: string;
};

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const auditApi = {
  search: async (args: { page: number; size: number; search: string }): Promise<PagedResponse<AuditLogEntry>> => {
    const res = await axiosClient.get(`/audit-logs`, {
      params: { page: args.page, size: args.size, search: args.search || undefined },
    });
    return pickData(res) as PagedResponse<AuditLogEntry>;
  },
};
