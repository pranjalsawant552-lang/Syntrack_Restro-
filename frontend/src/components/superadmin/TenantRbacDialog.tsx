import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { superAdminRoleApi, type SuperAdminRole } from "./superAdminRoleApi";

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

export default function TenantRbacDialog({
  open,
  onClose,
  tenantId,
  tenantName,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: number | null;
  tenantName: string;
}) {
  const [roles, setRoles] = useState<SuperAdminRole[]>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });

  // Local, unsaved permission edits per role, keyed by role id.
  const [draftPerms, setDraftPerms] = useState<Record<number, Set<string>>>({});

  useEffect(() => {
    if (!open || tenantId == null) return;
    setLoading(true);
    Promise.all([superAdminRoleApi.listRoles(tenantId), superAdminRoleApi.listAllPermissions()])
      .then(([r, p]) => {
        setRoles(r);
        setAllPermissions(p);
        const drafts: Record<number, Set<string>> = {};
        r.forEach((role) => {
          drafts[role.id] = new Set(role.permissions || []);
        });
        setDraftPerms(drafts);
      })
      .catch((e: any) => {
        setToast({
          open: true,
          msg: e?.response?.data?.message || "Failed to load this tenant's roles",
          type: "error",
        });
      })
      .finally(() => setLoading(false));
  }, [open, tenantId]);

  const togglePerm = (roleId: number, perm: string) => {
    setDraftPerms((prev) => {
      const next = { ...prev };
      const set = new Set(next[roleId] || []);
      if (set.has(perm)) set.delete(perm);
      else set.add(perm);
      next[roleId] = set;
      return next;
    });
  };

  const hasChanges = (role: SuperAdminRole) => {
    const draft = draftPerms[role.id];
    if (!draft) return false;
    const original = new Set(role.permissions || []);
    if (draft.size !== original.size) return true;
    for (const p of draft) if (!original.has(p)) return true;
    return false;
  };

  const saveRole = async (role: SuperAdminRole) => {
    if (tenantId == null) return;
    setSaving(role.id);
    try {
      const updated = await superAdminRoleApi.updatePermissions(
        tenantId,
        role.id,
        Array.from(draftPerms[role.id] || [])
      );
      setRoles((prev) => prev.map((r) => (r.id === role.id ? updated : r)));
      setToast({ open: true, msg: `Updated permissions for "${role.name}"`, type: "success" });
    } catch (e: any) {
      setToast({
        open: true,
        msg: e?.response?.data?.message || "Failed to update permissions",
        type: "error",
      });
    } finally {
      setSaving(null);
    }
  };

  const permGroups = groupPermissions(allPermissions);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          RBAC — {tenantName}
          <Typography variant="body2" color="text.secondary">
            View and adjust which permissions each role has in this tenant. Use this to unblock a
            tenant admin who's locked their team out of a needed action.
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <Typography variant="body2" color="text.secondary">
              Loading roles…
            </Typography>
          ) : roles.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              This tenant has no roles yet.
            </Typography>
          ) : (
            <Stack spacing={3}>
              {roles.map((role) => (
                <Box key={role.id}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {role.name}
                    </Typography>
                    {role.systemRole && (
                      <Tooltip title="Built-in role">
                        <LockIcon fontSize="small" color="disabled" />
                      </Tooltip>
                    )}
                    <Box sx={{ flex: 1 }} />
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!hasChanges(role) || saving === role.id}
                      onClick={() => saveRole(role)}
                    >
                      {saving === role.id ? "Saving…" : "Save changes"}
                    </Button>
                  </Stack>

                  {Object.entries(permGroups).map(([group, perms]) => (
                    <Box key={group} sx={{ mb: 1 }}>
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
                                  checked={draftPerms[role.id]?.has(p) ?? false}
                                  onChange={() => togglePerm(role.id, p)}
                                />
                              }
                              label={<Typography variant="body2">{p}</Typography>}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  ))}
                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
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
    </>
  );
}
