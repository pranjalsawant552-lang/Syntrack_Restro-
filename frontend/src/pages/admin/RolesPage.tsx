import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import { roleApi, type Role } from "../../components/admin/roleApi";
import { useAppSelector } from "../../store/hooks";
import { hasPermission } from "../../utils/permissions";

type Toast = { open: boolean; msg: string; type: "success" | "error" };

const groupPermissions = (perms: string[]) => {
  const groups: Record<string, string[]> = {};
  perms.forEach((p) => {
    const prefix = p.split("_")[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(p);
  });
  return groups;
};

export default function RolesPage() {
  const currentUser = useAppSelector((s) => s.auth.user);
  const canCreate = hasPermission(currentUser, "ROLE_CREATE");
  const canEdit = hasPermission(currentUser, "ROLE_EDIT");
  const canDelete = hasPermission(currentUser, "ROLE_DELETE");

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([roleApi.listAll(), roleApi.listAllPermissions()]);
      setRoles(r);
      setAllPermissions(p);
    } catch (e: any) {
      setToast({ open: true, msg: "Failed to load roles", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingRole(null);
    setName("");
    setDescription("");
    setSelectedPerms(new Set());
    setDialogOpen(true);
  };

  const openEdit = (r: Role) => {
    setEditingRole(r);
    setName(r.name);
    setDescription(r.description || "");
    setSelectedPerms(new Set(r.permissions || []));
    setDialogOpen(true);
  };

  const togglePerm = (p: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingRole) {
        await roleApi.update(editingRole.id, {
          description,
          permissions: Array.from(selectedPerms),
        });
        setToast({ open: true, msg: "Role updated", type: "success" });
      } else {
        if (!name.trim()) {
          setToast({ open: true, msg: "Role name is required", type: "error" });
          setSaving(false);
          return;
        }
        await roleApi.create({ name: name.trim(), description, permissions: Array.from(selectedPerms) });
        setToast({ open: true, msg: "Role created", type: "success" });
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to save role", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Role) => {
    if (!window.confirm(`Delete role "${r.name}"? This can't be undone.`)) return;
    try {
      await roleApi.remove(r.id);
      setToast({ open: true, msg: "Role deleted", type: "success" });
      load();
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to delete role", type: "error" });
    }
  };

  const permGroups = groupPermissions(allPermissions);

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Roles & Permissions
        </Typography>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            New Role
          </Button>
        )}
      </Stack>

      <Grid container spacing={2}>
        {roles.map((r) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={r.id}>
            <Card variant="outlined" sx={{ height: "100%" }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{r.name}</Typography>
                    {r.systemRole && (
                      <Tooltip title="Built-in role, cannot be edited or deleted">
                        <LockIcon fontSize="small" color="disabled" />
                      </Tooltip>
                    )}
                  </Stack>
                  <Stack direction="row">
                    {canEdit && !r.systemRole && (
                      <IconButton size="small" onClick={() => openEdit(r)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    {canDelete && !r.systemRole && (
                      <IconButton size="small" onClick={() => handleDelete(r)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {r.description || "No description"}
                </Typography>
                <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.5}>
                  {(r.permissions || []).slice(0, 6).map((p) => (
                    <Chip key={p} label={p} size="small" />
                  ))}
                  {r.permissions && r.permissions.length > 6 && (
                    <Chip label={`+${r.permissions.length - 6} more`} size="small" variant="outlined" />
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingRole ? `Edit role — ${editingRole.name}` : "New role"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {!editingRole && (
              <TextField label="Role name" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
            )}
            <TextField label="Description" fullWidth value={description} onChange={(e) => setDescription(e.target.value)} />

            <Typography variant="subtitle2" sx={{ mt: 1 }}>Permissions</Typography>
            {Object.entries(permGroups).map(([group, perms]) => (
              <Box key={group}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {group}
                </Typography>
                <Grid container>
                  {perms.map((p) => (
                    <Grid size={{ xs: 6, sm: 4 }} key={p}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={selectedPerms.has(p)}
                            onChange={() => togglePerm(p)}
                          />
                        }
                        label={<Typography variant="body2">{p}</Typography>}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
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
