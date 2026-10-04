// src/pages/SettingPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";

import type { SettingMaster } from "../utils/types";
import {
  fetchCurrentSetting,
  upsertCurrentSetting,
  selectCompanySetting,
  selectSettingsLoading,
} from "../store/settingsSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import BrandingCard from "../components/settings/BrandingCard";
import KotPrintCard from "../components/settings/KotPrintCard";
import ChangePasswordCard from "../components/common/ChangePasswordCard";

type Toast = { open: boolean; msg: string; type: "success" | "error" | "info" };

const normalize = (v: any) => String(v ?? "").trim();

// The server returns null for fields that were never filled in (e.g. GST number). All helpers below accept
// null/undefined so an unfilled field can never crash the page.
const isValidEmail = (email?: string | null) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());

const isValidPhone = (phone?: string | null) => {
  const p = String(phone ?? "").replace(/\s+/g, "");
  return /^[+]?[0-9]{10,15}$/.test(p);
};

const isValidGST = (gst?: string | null) => {
  const g = String(gst ?? "").trim().toUpperCase();
  if (!g) return true; // allow empty
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g);
};

const emptySetting: SettingMaster = {
  settingId: undefined as any,
  companyName: "",
  address: "",
  city: "",
  phoneNumber: "",
  email: "",
  gstNumber: "",
};

export default function SettingPage() {
  const dispatch = useAppDispatch();

  const reduxSetting = useAppSelector(selectCompanySetting);
  const loading = useAppSelector(selectSettingsLoading);

  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<Toast>({
    open: false,
    msg: "",
    type: "info",
  });
  const showToast = (type: Toast["type"], msg: string) =>
    setToast({ open: true, type, msg });

  const [form, setForm] = useState<SettingMaster>(emptySetting);
  const [initialForm, setInitialForm] = useState<SettingMaster>(emptySetting);

  // ✅ sync local form whenever redux updates (fetch/save)
  useEffect(() => {
    if (reduxSetting) {
      // null from the server would override the "" defaults and make inputs "uncontrolled" -> turn nulls into ""
      const clean = Object.fromEntries(
        Object.entries(reduxSetting).map(([k, v]) => [k, v === null ? "" : v])
      ) as unknown as SettingMaster;
      setForm({
        ...emptySetting,
        ...clean,
      });
      setInitialForm({
        ...emptySetting,
        ...clean,
      });
    } else {
      // if redux is null, keep empty
      setForm(emptySetting);
      setInitialForm(emptySetting);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduxSetting]);

  const changed = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  );

  const validate = (v: SettingMaster) => {
    if (!normalize(v.companyName)) return "Company name is required";
    if (!normalize(v.address)) return "Address is required";
    if (!normalize(v.city)) return "City is required";

    if (!normalize(v.phoneNumber)) return "Phone number is required";
    if (!isValidPhone(v.phoneNumber)) return "Phone number is invalid (10-15 digits)";

    if (!normalize(v.email)) return "Email is required";
    if (!isValidEmail(v.email)) return "Email is invalid";

    if (!isValidGST(v.gstNumber)) return "GST number format is invalid";

    return "";
  };

  const error = validate(form);

  const load = async () => {
    const action = await dispatch(fetchCurrentSetting());
    if (fetchCurrentSetting.rejected.match(action)) {
      showToast("info", "No setting found yet. Fill details and click Save.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    const err = validate(form);
    if (err) return showToast("error", err);

    setSaving(true);
    try {
      const payload: SettingMaster = {
        ...form,
        companyName: normalize(form.companyName),
        address: normalize(form.address),
        city: normalize(form.city),
        phoneNumber: normalize(form.phoneNumber),
        email: normalize(form.email),
        gstNumber: normalize(form.gstNumber).toUpperCase(),
      };

      const action = await dispatch(upsertCurrentSetting(payload));

      if (upsertCurrentSetting.fulfilled.match(action)) {
        showToast("success", "Company setting updated");
        // reduxSetting updates -> effect syncs form+initialForm
      } else {
        showToast("error", (action.payload as any) || "Failed to update setting");
      }
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    setForm(initialForm);
    showToast("info", "Changes reset");
  };

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <SettingsOutlinedIcon />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                Company Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Update company details used in invoices and POS screens.
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              onClick={load}
              variant="outlined"
              startIcon={loading ? <CircularProgress size={18} /> : <RefreshIcon />}
              disabled={loading || saving}
              sx={{ borderRadius: 999 }}
            >
              Reload
            </Button>

            <Button
              onClick={onSave}
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
              disabled={saving || loading || !!error || !changed}
              sx={{ borderRadius: 999 }}
            >
              Save
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }} color="text.secondary">
              Loading settings...
            </Typography>
          </Stack>
        ) : (
          <>
            {/* Form */}
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              }}
            >
              <TextField
                label="Company Name"
                value={form.companyName}
                onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                size="small"
                fullWidth
              />

              <TextField
                label="City"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                size="small"
                fullWidth
              />

              <TextField
                label="Phone Number"
                value={form.phoneNumber}
                onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                size="small"
                fullWidth
                inputProps={{ inputMode: "numeric" }}
                helperText="Example: 9876543210 or +919876543210"
              />

              <TextField
                label="Email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                size="small"
                fullWidth
              />

              <TextField
                label="GST Number"
                value={form.gstNumber}
                onChange={(e) =>
                  setForm((p) => ({ ...p, gstNumber: e.target.value.toUpperCase() }))
                }
                size="small"
                fullWidth
                helperText="Optional (valid GSTIN format)"
              />

              {/* Address full width */}
              <Box sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}>
                <TextField
                  label="Address"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  size="small"
                  fullWidth
                  multiline
                  minRows={3}
                />
              </Box>
            </Box>

            {!!error && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="flex-end"
              sx={{ mt: 2 }}
            >
              <Button onClick={onReset} variant="text" disabled={!changed || saving || loading}>
                Reset Changes
              </Button>
            </Stack>
          </>
        )}
      </Paper>

      <BrandingCard />

      <KotPrintCard />

      <ChangePasswordCard endpoint="/users/me/change-password" />

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.type}
          onClose={() => setToast((p) => ({ ...p, open: false }))}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
