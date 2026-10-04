import React, { useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../../store/store";
import { logout } from "../../store/authSlice";
import { useNavigate } from "react-router-dom";
import axiosClient from "../axiosData/axiosClient";

export default function ChangePasswordCard({ endpoint }: { endpoint: string }) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; msg: string; type: "success" | "error" }>({
    open: false,
    msg: "",
    type: "success",
  });

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPassword.length >= 8 && !mismatch && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await axiosClient.post(endpoint, { currentPassword, newPassword });
      setToast({ open: true, msg: "Password changed. Logging you out...", type: "success" });
      setTimeout(() => {
        dispatch(logout());
        sessionStorage.clear();
        navigate("/login", { replace: true });
      }, 1500);
    } catch (e: any) {
      setToast({ open: true, msg: e?.response?.data?.error || "Failed to change password", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, mt: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5 }}>
        Change password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Changing your password will sign you out of all devices.
      </Typography>

      <Stack spacing={1.5} sx={{ maxWidth: 420 }}>
        <TextField
          label="Current password"
          type="password"
          size="small"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <TextField
          label="New password"
          type="password"
          size="small"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          helperText="At least 8 characters, with an uppercase letter, a lowercase letter, and a number."
        />
        <TextField
          label="Confirm new password"
          type="password"
          size="small"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={mismatch}
          helperText={mismatch ? "Passwords do not match" : " "}
        />
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <LockResetIcon />}
          onClick={handleSubmit}
          disabled={!canSubmit}
          sx={{ alignSelf: "flex-start" }}
        >
          Update password
        </Button>
      </Stack>

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
