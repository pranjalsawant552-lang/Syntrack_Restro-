import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PaginatedTable from "../../components/common/PaginatedTable";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import { userApi, type CreateUserPayload, type TenantUser } from "../../components/admin/userApi";
import { roleApi, type Role } from "../../components/admin/roleApi";
import { useAppSelector } from "../../store/hooks";
import { hasPermission } from "../../utils/permissions";
import { formatRoleLabel } from "../../utils/roleLabel";

type Toast = { open: boolean; msg: string; type: "success" | "error" };

const emptyForm: CreateUserPayload = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phoneNumber: "",
  roleName: "",
};

export default function UsersPage() {
  const currentUser = useAppSelector((s) => s.auth.user);
  const canCreate = hasPermission(currentUser, "USER_CREATE");
  const canEdit = hasPermission(currentUser, "USER_EDIT");
  const canDeactivate = hasPermission(currentUser, "USER_DEACTIVATE");

  const list = usePaginatedList<TenantUser>(
    (args) =>
      userApi.search({
        page: args.page,
        size: args.size,
        search: args.search,
        sort: args.sort || "createdAt,desc",
        filters: args.filters,
      }),
    { initialSize: 10 }
  );

  const [roles, setRoles] = useState<Role[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [form, setForm] = useState<CreateUserPayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    roleApi.listAll().then(setRoles).catch(() => setRoles([]));
  }, []);

  const onRoleFilterChange = (val: string) => {
    setRoleFilter(val);
    list.setFilter("role", val === "all" ? undefined : val);
  };

  const onActiveFilterChange = (val: string) => {
    setActiveFilter(val);
    list.setFilter("active", val === "all" ? undefined : val === "active");
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (u: TenantUser) => {
    setEditingUser(u);
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      password: "",
      phoneNumber: u.phoneNumber || "",
      roleName: u.role,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingUser) {
        await userApi.update(editingUser.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          phoneNumber: form.phoneNumber,
          roleName: form.roleName,
        });
        setToast({ open: true, msg: "User updated", type: "success" });
      } else {
        if (!form.email.trim() || !form.password.trim() || !form.roleName) {
          setToast({ open: true, msg: "Email, password and role are required", type: "error" });
          setSaving(false);
          return;
        }
        await userApi.create(form);
        setToast({ open: true, msg: "User created", type: "success" });
      }
      setDialogOpen(false);
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to save user", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: TenantUser) => {
    try {
      if (u.active) await userApi.deactivate(u.id);
      else await userApi.activate(u.id);
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to update user", type: "error" });
    }
  };

  const toggleSelect = (id: number | string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id as number)) next.delete(id as number);
      else next.add(id as number);
      return next;
    });
  };

  const toggleSelectAll = (ids: (number | string)[]) => {
    setSelectedIds((prev) => {
      const idsAsNum = ids as number[];
      const allSelected = idsAsNum.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(idsAsNum);
    });
  };

  const handleBulkActivate = async () => {
    try {
      await userApi.bulkActivate(Array.from(selectedIds));
      setToast({ open: true, msg: `${selectedIds.size} user(s) activated`, type: "success" });
      setSelectedIds(new Set());
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Bulk activate failed", type: "error" });
    }
  };

  const handleBulkDeactivate = async () => {
    if (!window.confirm(`Deactivate ${selectedIds.size} selected user(s)?`)) return;
    try {
      await userApi.bulkDeactivate(Array.from(selectedIds));
      setToast({ open: true, msg: `${selectedIds.size} user(s) deactivated`, type: "success" });
      setSelectedIds(new Set());
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Bulk deactivate failed", type: "error" });
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Team Members
        </Typography>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            New User
          </Button>
        )}
      </Stack>

      {canDeactivate && selectedIds.size > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {selectedIds.size} selected
          </Typography>
          <Button size="small" startIcon={<CheckCircleIcon />} onClick={handleBulkActivate}>
            Activate
          </Button>
          <Button size="small" color="error" startIcon={<CancelIcon />} onClick={handleBulkDeactivate}>
            Deactivate
          </Button>
        </Stack>
      )}

      <PaginatedTable<TenantUser>
        searchInput={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Search by name or email..."
        filtersSlot={
          <Stack direction="row" spacing={1}>
            <Select size="small" value={roleFilter} onChange={(e) => onRoleFilterChange(e.target.value)} sx={{ minWidth: 140 }}>
              <MenuItem value="all">All roles</MenuItem>
              {roles.map((r) => (
                <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>
              ))}
            </Select>
            <Select size="small" value={activeFilter} onChange={(e) => onActiveFilterChange(e.target.value)} sx={{ minWidth: 130 }}>
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Deactivated</MenuItem>
            </Select>
          </Stack>
        }
        headerCells={
          <>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </>
        }
        rows={list.rows}
        selectable={canDeactivate}
        getRowId={(u) => u.id}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        renderRow={(u) => (
          <TableRow key={u.id} hover selected={selectedIds.has(u.id)}>
            {canDeactivate && (
              <TableCell padding="checkbox">
                <Checkbox size="small" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} />
              </TableCell>
            )}
            <TableCell>{u.firstName} {u.lastName}</TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell><Chip size="small" label={formatRoleLabel(u.role)} /></TableCell>
            <TableCell>
              <Chip size="small" label={u.active ? "Active" : "Deactivated"} color={u.active ? "success" : "default"} />
            </TableCell>
            <TableCell align="right">
              {canEdit && (
                <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(u)} sx={{ mr: 1 }}>
                  Edit
                </Button>
              )}
              {canDeactivate && (
                <Switch size="small" checked={u.active} onChange={() => handleToggleActive(u)} />
              )}
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
        <DialogTitle>{editingUser ? "Edit user" : "New user"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField label="First name" fullWidth value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              <TextField label="Last name" fullWidth value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Stack>
            <TextField
              label="Email"
              fullWidth
              value={form.email}
              disabled={!!editingUser}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {!editingUser && (
              <TextField
                label="Temporary password"
                fullWidth
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                helperText="The user can change this later, or use 'Forgot password'."
              />
            )}
            <TextField label="Phone" fullWidth value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
            <Select
              value={form.roleName}
              onChange={(e) => setForm({ ...form, roleName: e.target.value })}
              displayEmpty
            >
              <MenuItem value="" disabled>Select role</MenuItem>
              {roles.map((r) => (
                <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>
              ))}
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.type} onClose={() => setToast({ ...toast, open: false })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
