import React, { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import UploadIcon from "@mui/icons-material/UploadFile";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { fetchMyBranding, selectBranding } from "../../store/brandingSlice";
import { brandingApi } from "../branding/brandingApi";
import { hasPermission } from "../../utils/permissions";

export default function BrandingCard() {
  const dispatch = useDispatch<AppDispatch>();
  const branding = useSelector(selectBranding);
  const user = useSelector((s: RootState) => s.auth.user);
  const canEdit = hasPermission(user, "SETTINGS_EDIT");

  const [appName, setAppName] = useState(branding.appName);
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; msg: string; type: "success" | "error" }>({
    open: false,
    msg: "",
    type: "success",
  });

  useEffect(() => {
    setAppName(branding.appName);
    setLogoUrl(branding.logoUrl);
  }, [branding.appName, branding.logoUrl]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await brandingApi.update({ appName, logoUrl });
      await dispatch(fetchMyBranding());
      setToast({ open: true, msg: "Branding updated", type: "success" });
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to update branding", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { logoUrl: uploadedUrl } = await brandingApi.uploadLogo(file);
      setLogoUrl(uploadedUrl);
      await dispatch(fetchMyBranding());
      setToast({ open: true, msg: "Logo uploaded", type: "success" });
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to upload logo", type: "error" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (!canEdit) return null;

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, mt: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5 }}>
        Branding
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This name and logo appear across the whole app — header, login screen, and receipts.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
        <Avatar src={logoUrl || undefined} variant="rounded" sx={{ width: 64, height: 64 }} />
        <Button
          component="label"
          variant="outlined"
          startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
          disabled={uploading}
        >
          Upload logo
          <input type="file" hidden accept="image/*" onChange={handleFileChange} />
        </Button>
      </Stack>

      <Stack spacing={1.5} sx={{ mt: 2 }}>
        <TextField
          label="App / Company display name"
          size="small"
          fullWidth
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
        />
        <TextField
          label="Logo URL"
          size="small"
          fullWidth
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          helperText="Set automatically when you upload a file above, or paste a hosted image URL directly."
        />
      </Stack>

      <Box sx={{ textAlign: "right", mt: 2 }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
        >
          Save branding
        </Button>
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.type} onClose={() => setToast((p) => ({ ...p, open: false }))}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
