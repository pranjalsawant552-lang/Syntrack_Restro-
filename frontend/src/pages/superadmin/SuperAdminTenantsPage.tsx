import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
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
import AssessmentIcon from "@mui/icons-material/Assessment";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SecurityIcon from "@mui/icons-material/Security";
import SuperAdminShell from "../../components/layout/SuperAdminShell";
import PaginatedTable from "../../components/common/PaginatedTable";
import { usePaginatedList } from "../../hooks/usePaginatedList";
import { tenantApi, type CreateTenantPayload, type Tenant } from "../../components/superadmin/tenantApi";
import TenantRbacDialog from "../../components/superadmin/TenantRbacDialog";

type Toast = { open: boolean; msg: string; type: "success" | "error" };

const emptyCreateForm: CreateTenantPayload = {
  companyName: "",
  slug: "",
  contactEmail: "",
  contactPhone: "",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminPassword: "",
  adminPhoneNumber: "",
};

export default function SuperAdminTenantsPage() {
  const list = usePaginatedList<Tenant>(
    (args) => tenantApi.search({ page: args.page, size: args.size, search: args.search, filters: args.filters }),
    { initialSize: 10 }
  );

  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateTenantPayload>(emptyCreateForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });

  const [brandingOpen, setBrandingOpen] = useState<Tenant | null>(null);
  const [brandingName, setBrandingName] = useState("");
  const [brandingLogo, setBrandingLogo] = useState("");

  const [limitsOpen, setLimitsOpen] = useState<Tenant | null>(null);
  const [rbacOpen, setRbacOpen] = useState<Tenant | null>(null);
  const [maxUsers, setMaxUsers] = useState<string>("");
  const [maxProducts, setMaxProducts] = useState<string>("");
  const [usage, setUsage] = useState<{
    userCount: number; maxUsers: number | null;
    productCount: number; maxProducts: number | null;
    customerCount: number; invoiceCount: number;
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const onActiveFilterChange = (val: string) => {
    setActiveFilter(val);
    list.setFilter("active", val === "all" ? undefined : val === "active");
  };

  const handleCreate = async () => {
    if (!form.companyName.trim() || !form.slug.trim() || !form.adminEmail.trim() || !form.adminPassword.trim()) {
      setToast({ open: true, msg: "Company name, slug, admin email and password are required", type: "error" });
      return;
    }
    setSaving(true);
    try {
      await tenantApi.create(form);
      setToast({ open: true, msg: "Tenant created successfully", type: "success" });
      setCreateOpen(false);
      setForm(emptyCreateForm);
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to create tenant", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (t: Tenant) => {
    try {
      if (t.active) await tenantApi.deactivate(t.id);
      else await tenantApi.activate(t.id);
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to update tenant", type: "error" });
    }
  };

  const openBranding = (t: Tenant) => {
    setBrandingOpen(t);
    setBrandingName(t.name);
    setBrandingLogo(t.logoUrl || "");
  };

  const saveBranding = async () => {
    if (!brandingOpen) return;
    try {
      await tenantApi.updateBranding(brandingOpen.id, { name: brandingName, logoUrl: brandingLogo });
      setToast({ open: true, msg: "Branding updated", type: "success" });
      setBrandingOpen(null);
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to update branding", type: "error" });
    }
  };

  const openLimits = async (t: Tenant) => {
    setLimitsOpen(t);
    setMaxUsers(t.maxUsers != null ? String(t.maxUsers) : "");
    setMaxProducts(t.maxProducts != null ? String(t.maxProducts) : "");
    setUsage(null);
    setUsageLoading(true);
    try {
      const u = await tenantApi.getUsage(t.id);
      setUsage(u);
    } catch {
      // non-fatal, limits can still be edited without usage numbers
    } finally {
      setUsageLoading(false);
    }
  };

  const saveLimits = async () => {
    if (!limitsOpen) return;
    try {
      await tenantApi.updateLimits(limitsOpen.id, {
        maxUsers: maxUsers.trim() === "" ? null : parseInt(maxUsers, 10),
        maxProducts: maxProducts.trim() === "" ? null : parseInt(maxProducts, 10),
      });
      setToast({ open: true, msg: "Limits updated", type: "success" });
      setLimitsOpen(null);
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to update limits", type: "error" });
    }
  };

  const handleDelete = async (t: Tenant) => {
    const confirmText = window.prompt(
      `This PERMANENTLY deletes "${t.name}" and all of its data. This cannot be undone.\n\nType the company slug ("${t.slug}") to confirm.`
    );
    if (confirmText !== t.slug) {
      if (confirmText !== null) setToast({ open: true, msg: "Slug didn't match — deletion cancelled", type: "error" });
      return;
    }
    try {
      await tenantApi.remove(t.id);
      setToast({ open: true, msg: `"${t.name}" permanently deleted`, type: "success" });
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to delete tenant", type: "error" });
    }
  };

  return (
    <SuperAdminShell>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Companies (Tenants)
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New Company
        </Button>
      </Stack>

      <PaginatedTable<Tenant>
        searchInput={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Search by name or slug..."
        filtersSlot={
          <Select
            size="small"
            value={activeFilter}
            onChange={(e) => onActiveFilterChange(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Suspended</MenuItem>
          </Select>
        }
        headerCells={
          <>
            <TableCell>Company</TableCell>
            <TableCell>Slug</TableCell>
            <TableCell>Contact</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </>
        }
        rows={list.rows}
        renderRow={(t) => (
          <TableRow key={t.id} hover>
            <TableCell sx={{ fontWeight: 700 }}>{t.name}</TableCell>
            <TableCell>{t.slug}</TableCell>
            <TableCell>
              <Typography variant="body2">{t.contactEmail || "—"}</Typography>
              <Typography variant="caption" color="text.secondary">{t.contactPhone || ""}</Typography>
            </TableCell>
            <TableCell>
              <Chip
                size="small"
                label={t.active ? "Active" : "Suspended"}
                color={t.active ? "success" : "default"}
              />
            </TableCell>
            <TableCell align="right">
              <Button size="small" startIcon={<EditIcon />} onClick={() => openBranding(t)} sx={{ mr: 1 }}>
                Branding
              </Button>
              <Button size="small" startIcon={<AssessmentIcon />} onClick={() => openLimits(t)} sx={{ mr: 1 }}>
                Limits & Usage
              </Button>
              <Button size="small" startIcon={<SecurityIcon />} onClick={() => setRbacOpen(t)} sx={{ mr: 1 }}>
                RBAC
              </Button>
              <FormControlLabel
                control={<Switch size="small" checked={t.active} onChange={() => handleToggleActive(t)} />}
                label={t.active ? "Active" : "Suspended"}
                sx={{ ml: 0, mr: 1 }}
              />
              <Button size="small" color="error" startIcon={<DeleteForeverIcon />} onClick={() => handleDelete(t)}>
                Delete
              </Button>
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
        emptyMessage="No companies yet — create the first one."
      />

      {/* Create tenant dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Onboard a new company</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Company name"
              fullWidth
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
            <TextField
              label="Slug (used for login/URL, e.g. acme-traders)"
              fullWidth
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Contact email"
                fullWidth
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
              <TextField
                label="Contact phone"
                fullWidth
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </Stack>

            <Divider>First Tenant Admin</Divider>

            <Stack direction="row" spacing={2}>
              <TextField
                label="First name"
                fullWidth
                value={form.adminFirstName}
                onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
              />
              <TextField
                label="Last name"
                fullWidth
                value={form.adminLastName}
                onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
              />
            </Stack>
            <TextField
              label="Admin email (login)"
              fullWidth
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            />
            <TextField
              label="Admin temporary password"
              type="text"
              fullWidth
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              helperText="Share this with the admin — they can change it or use 'Forgot password' after first login."
            />
            <TextField
              label="Admin phone (optional)"
              fullWidth
              value={form.adminPhoneNumber}
              onChange={(e) => setForm({ ...form, adminPhoneNumber: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create Company"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Branding dialog */}
      <Dialog open={!!brandingOpen} onClose={() => setBrandingOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit branding — {brandingOpen?.name}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Display name"
              fullWidth
              value={brandingName}
              onChange={(e) => setBrandingName(e.target.value)}
            />
            <TextField
              label="Logo URL"
              fullWidth
              value={brandingLogo}
              onChange={(e) => setBrandingLogo(e.target.value)}
              helperText="Paste a hosted image URL, or ask the tenant admin to upload one from their Settings page."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBrandingOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveBranding}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Limits & usage dialog */}
      <Dialog open={!!limitsOpen} onClose={() => setLimitsOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Limits & usage — {limitsOpen?.name}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {usageLoading ? (
              <Typography variant="body2" color="text.secondary">Loading usage...</Typography>
            ) : usage ? (
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  Users: <b>{usage.userCount}</b>{usage.maxUsers != null ? ` / ${usage.maxUsers}` : " (unlimited)"}
                </Typography>
                <Typography variant="body2">
                  Products: <b>{usage.productCount}</b>{usage.maxProducts != null ? ` / ${usage.maxProducts}` : " (unlimited)"}
                </Typography>
                <Typography variant="body2">Customers: <b>{usage.customerCount}</b></Typography>
                <Typography variant="body2">Invoices: <b>{usage.invoiceCount}</b></Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">Usage data unavailable.</Typography>
            )}

            <Divider />

            <TextField
              label="Max users (blank = unlimited)"
              fullWidth
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <TextField
              label="Max products (blank = unlimited)"
              fullWidth
              value={maxProducts}
              onChange={(e) => setMaxProducts(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLimitsOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveLimits}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <TenantRbacDialog
        open={!!rbacOpen}
        onClose={() => setRbacOpen(null)}
        tenantId={rbacOpen?.id ?? null}
        tenantName={rbacOpen?.name ?? ""}
      />

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
    </SuperAdminShell>
  );
}
