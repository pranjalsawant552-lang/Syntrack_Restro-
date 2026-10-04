import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Link as MuiLink,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import axiosClient from "../components/axiosData/axiosClient";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validationError = useMemo(() => {
    if (!newPassword) return null;
    if (newPassword.length < 6) return "Password must be at least 6 characters";
    if (confirmPassword && newPassword !== confirmPassword) return "Passwords do not match";
    return null;
  }, [newPassword, confirmPassword]);

  const canSubmit =
    !!token && newPassword.length >= 6 && newPassword === confirmPassword && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await axiosClient.post("/auth/reset-password", { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.error || "This reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(1000px 600px at 20% 10%, #e3f2fd 0%, transparent 60%), radial-gradient(900px 600px at 90% 30%, #ede7f6 0%, transparent 55%), #f6f7fb",
        px: 2,
      }}
    >
      <Paper elevation={10} sx={{ width: "100%", maxWidth: 420, p: 3, borderRadius: 3 }}>
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Set a new password
          </Typography>
        </Stack>

        {!token && (
          <Alert severity="error" sx={{ mb: 2 }}>
            This link is missing a reset token. Please use the link from your email, or
            request a new one.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Password reset successfully. Redirecting to login...
          </Alert>
        ) : (
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="New password"
              type={showPwd ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={!token}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPwd((s) => !s)} edge="end">
                      {showPwd ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Confirm new password"
              type={showPwd ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={!token}
              error={!!validationError}
              helperText={validationError || " "}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
            <Button
              fullWidth
              size="large"
              variant="contained"
              disabled={!canSubmit}
              onClick={handleSubmit}
              sx={{ py: 1.2, borderRadius: 2, fontWeight: 800, textTransform: "none" }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : "Reset password"}
            </Button>
          </Stack>
        )}

        <Box sx={{ textAlign: "center", mt: 2 }}>
          <MuiLink component={RouterLink} to="/login" variant="body2">
            Back to login
          </MuiLink>
        </Box>
      </Paper>
    </Box>
  );
}
