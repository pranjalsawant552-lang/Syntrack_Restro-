import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Snackbar,
  Alert,
  Stack,
  Switch,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import PaginatedTable from "../components/common/PaginatedTable";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { supplierApi, type CreateSupplierDTO, type Supplier } from "../components/supplier/supplierApi";
import { downloadAuthenticatedFile } from "../utils/downloadFile";
import { useAppSelector } from "../store/hooks";
import { hasPermission } from "../utils/permissions";

type Toast = { open: boolean; msg: string; type: "success" | "error" };

const emptyForm: CreateSupplierDTO = { supplierName: "", phone: "", email: "", address: "", gstNumber: "" };

export default function SuppliersPage() {
  const currentUser = useAppSelector((s) => s.auth.user);
  const canCreate = hasPermission(currentUser, "SUPPLIER_CREATE");
  const canEdit = hasPermission(currentUser, "SUPPLIER_EDIT");

  const list = usePaginatedList<Supplier>(
    (args) => supplierApi.searchPaged({ page: args.page, size: args.size, search: args.search, filters: args.filters }),
    { initialSize: 10 }
  );

  const [activeFilter, setActiveFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<CreateSupplierDTO>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });

  const onActiveFilterChange = (val: string) => {
    setActiveFilter(val);
    list.setFilter("active", val === "all" ? undefined : val === "active");
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ supplierName: s.supplierName, phone: s.phone || "", email: s.email || "", address: s.address || "", gstNumber: s.gstNumber || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.supplierName.trim()) {
      setToast({ open: true, msg: "Supplier name is required", type: "error" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await supplierApi.update(editing.supplierId, form);
        setToast({ open: true, msg: "Supplier updated", type: "success" });
      } else {
        await supplierApi.create(form);
        setToast({ open: true, msg: "Supplier created", type: "success" });
      }
      setDialogOpen(false);
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to save supplier", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (s: Supplier) => {
    try {
      await supplierApi.toggleActive(s.supplierId, !s.isActive);
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to update supplier", type: "error" });
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Suppliers
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadAuthenticatedFile("/supplier/export", "suppliers.csv")}>
            Export CSV
          </Button>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Supplier
            </Button>
          )}
        </Stack>
      </Stack>

      <PaginatedTable<Supplier>
        searchInput={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Search by name, phone, or email..."
        filtersSlot={
          <Select size="small" value={activeFilter} onChange={(e) => onActiveFilterChange(e.target.value)} sx={{ minWidth: 130 }}>
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        }
        headerCells={
          <>
            <TableCell>Name</TableCell>
            <TableCell>Phone</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>GST Number</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </>
        }
        rows={list.rows}
        renderRow={(s) => (
          <TableRow key={s.supplierId} hover>
            <TableCell sx={{ fontWeight: 700 }}>{s.supplierName}</TableCell>
            <TableCell>{s.phone || "—"}</TableCell>
            <TableCell>{s.email || "—"}</TableCell>
            <TableCell>{s.gstNumber || "—"}</TableCell>
            <TableCell>
              <Chip size="small" label={s.isActive ? "Active" : "Inactive"} color={s.isActive ? "success" : "default"} />
            </TableCell>
            <TableCell align="right">
              {canEdit && (
                <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(s)} sx={{ mr: 1 }}>
                  Edit
                </Button>
              )}
              {canEdit && <Switch size="small" checked={s.isActive} onChange={() => handleToggleActive(s)} />}
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
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Supplier name" fullWidth value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
            <TextField label="Phone" fullWidth value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField label="Email" fullWidth value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField label="Address" fullWidth multiline rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <TextField label="GST Number" fullWidth value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3500} onClose={() => setToast({ ...toast, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.type} onClose={() => setToast({ ...toast, open: false })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
