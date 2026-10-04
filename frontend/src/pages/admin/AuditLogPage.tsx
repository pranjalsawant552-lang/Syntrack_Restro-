import React from "react";
import { Chip, Container, TableCell, TableRow, Typography } from "@mui/material";
import PaginatedTable from "../../components/common/PaginatedTable";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import { auditApi, type AuditLogEntry } from "../../components/admin/auditApi";

const actionColor = (action: string): "default" | "success" | "warning" | "error" => {
  if (action.includes("DELETED") || action.includes("CANCELLED")) return "error";
  if (action.includes("DEACTIVATED")) return "warning";
  if (action.includes("CREATED") || action.includes("ACTIVATED")) return "success";
  return "default";
};

export default function AuditLogPage() {
  const list = usePaginatedList<AuditLogEntry>(
    (args) => auditApi.search({ page: args.page, size: args.size, search: args.search }),
    { initialSize: 20 }
  );

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
        Audit Log
      </Typography>

      <PaginatedTable<AuditLogEntry>
        searchInput={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Search by action, entity, or user..."
        headerCells={
          <>
            <TableCell>When</TableCell>
            <TableCell>Action</TableCell>
            <TableCell>Entity</TableCell>
            <TableCell>By</TableCell>
            <TableCell>Details</TableCell>
          </>
        }
        rows={list.rows}
        renderRow={(a) => (
          <TableRow key={a.id} hover>
            <TableCell sx={{ whiteSpace: "nowrap" }}>
              {new Date(a.createdAt).toLocaleString()}
            </TableCell>
            <TableCell>
              <Chip size="small" label={a.action} color={actionColor(a.action)} />
            </TableCell>
            <TableCell>{a.entityType} #{a.entityId}</TableCell>
            <TableCell>{a.performedBy}</TableCell>
            <TableCell>
              <Typography variant="body2" color="text.secondary">
                {a.details || "—"}
              </Typography>
            </TableCell>
          </TableRow>
        )}
        loading={list.loading}
        error={list.error}
        page={list.page}
        size={list.size}
        totalElements={list.totalElements}
        onPageChange={list.setPage}
        onSizeChange={list.setSize}
        emptyMessage="No audit entries yet."
      />
    </Container>
  );
}
