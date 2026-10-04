import React from "react";
import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

export type PaginatedTableProps<T> = {
  title?: string;
  searchInput: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filtersSlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
  headerCells: React.ReactNode;
  rows: T[];
  renderRow: (row: T) => React.ReactNode;
  loading: boolean;
  error: string | null;
  page: number;
  size: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  emptyMessage?: string;
  // Optional row-selection support (bulk actions)
  selectable?: boolean;
  getRowId?: (row: T) => number | string;
  selectedIds?: Set<number | string>;
  onToggleSelect?: (id: number | string) => void;
  onToggleSelectAll?: (ids: (number | string)[]) => void;
};

export default function PaginatedTable<T>({
  title,
  searchInput,
  onSearchChange,
  searchPlaceholder = "Search...",
  filtersSlot,
  actionsSlot,
  headerCells,
  rows,
  renderRow,
  loading,
  error,
  page,
  size,
  totalElements,
  onPageChange,
  onSizeChange,
  emptyMessage = "No records found",
  selectable = false,
  getRowId,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: PaginatedTableProps<T>) {
  const rowIds = selectable && getRowId ? rows.map(getRowId) : [];
  const allSelected = selectable && rowIds.length > 0 && rowIds.every((id) => selectedIds?.has(id));
  const someSelected = selectable && rowIds.some((id) => selectedIds?.has(id));

  return (
    <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ p: 2 }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          {title && (
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mr: 1 }}>
              {title}
            </Typography>
          )}
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          {filtersSlot}
        </Stack>
        {actionsSlot}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer sx={{ position: "relative", minHeight: 120 }}>
        {loading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,0.6)",
              zIndex: 1,
            }}
          >
            <CircularProgress size={28} />
          </Box>
        )}
        <Table size="small">
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    indeterminate={someSelected && !allSelected}
                    checked={allSelected}
                    onChange={() => onToggleSelectAll?.(rowIds)}
                  />
                </TableCell>
              )}
              {headerCells}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && !loading ? (
              <TableRow>
                <td colSpan={20} style={{ textAlign: "center", padding: 24, color: "#888" }}>
                  {emptyMessage}
                </td>
              </TableRow>
            ) : (
              rows.map((row) => renderRow(row))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={totalElements}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        rowsPerPage={size}
        onRowsPerPageChange={(e) => onSizeChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Paper>
  );
}
