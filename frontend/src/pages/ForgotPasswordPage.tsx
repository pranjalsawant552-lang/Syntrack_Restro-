import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Link as MuiLink,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import InputAdornment from "@mui/material/InputAdornment";
import { Link as RouterLink } from "react-router-dom";
import axiosClient from "../components/axiosData/axiosClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await axiosClient.post("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
        companySlug: companySlug.trim() ? companySlug.trim().toLowerCase() : undefined,
      });
      setSubmitted(true);
    } catch (e: any) {
      // Backend intentionally returns success even for unknown emails, so an error
      // here means something else went wrong (network, validation, etc).
      setError(e?.response?.data?.error || "Something went wrong. Please try again.");
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
            Forgot password
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your email and we'll send you a reset link.
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {submitted ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            If an account exists for that email, a password reset link has been sent.
            Check your inbox (and spam folder).
          </Alert>
        ) : (
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
            <TextField
              fullWidth
              size="small"
              label="Company (optional)"
              placeholder="e.g. acme-traders"
              value={companySlug}
              onChange={(e) => setCompanySlug(e.target.value)}
            />
            <Button
              fullWidth
              size="large"
              variant="contained"
              disabled={!email.trim() || loading}
              onClick={handleSubmit}
              sx={{ py: 1.2, borderRadius: 2, fontWeight: 800, textTransform: "none" }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : "Send reset link"}
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
