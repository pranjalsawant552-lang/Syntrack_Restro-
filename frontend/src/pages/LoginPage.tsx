import React, { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Collapse,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";
import BusinessIcon from "@mui/icons-material/Business";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useDispatch, useSelector } from "react-redux";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import type { AppDispatch, RootState } from "../store/store";
import {
  authFail,
  authStart,
  authSuccess,
  clearAuthError,
} from "../store/authSlice";
import { fetchPublicBranding, selectBranding } from "../store/brandingSlice";
import axiosClient from "../components/axiosData/axiosClient";

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s: RootState) => s.auth);
  const branding = useSelector(selectBranding);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showCompanyField, setShowCompanyField] = useState(false);
  const [companySlug, setCompanySlug] = useState("");

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !loading;
  }, [email, password, loading]);

  const handleCompanyBlur = () => {
    // Re-fetch branding scoped to this company slug so the login screen shows
    // the right logo/name once the admin knows which company they're signing into.
    if (companySlug.trim()) {
      dispatch(fetchPublicBranding(companySlug.trim().toLowerCase()));
    }
  };

  const handleLogin = async () => {
    if (!canSubmit) return;

    dispatch(clearAuthError());
    dispatch(authStart());

    try {
      const res = await axiosClient.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
        companySlug: companySlug.trim() ? companySlug.trim().toLowerCase() : undefined,
      });

      // response: { token, user }
      dispatch(authSuccess(res.data));
      const user = res.data?.user;
      navigate(user?.superAdmin ? "/superadmin/tenants" : "/", { replace: true });
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Login failed";
      dispatch(authFail(msg));
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
      <Paper
        elevation={10}
        sx={{
          width: "100%",
          maxWidth: 420,
          p: 3,
          borderRadius: 3,
          border: "1px solid rgba(0,0,0,0.06)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Stack alignItems="center" spacing={1} sx={{ mb: 1 }}>
          {branding.logoUrl ? (
            <Avatar src={branding.logoUrl} sx={{ width: 64, height: 64, bgcolor: "transparent", "& img": { objectFit: "contain" } }} variant="rounded" />
          ) : null}
        </Stack>

        <Stack spacing={0.5} sx={{ mb: 2, textAlign: "center" }}>
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: 0.2 }}>
            {branding.appName || "Syntrack Restro"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in to continue
          </Typography>
        </Stack>

        {error && error.trim() !== "" && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />

          <TextField
            fullWidth
            label="Password"
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPwd((s) => !s)}
                    edge="end"
                    aria-label="toggle password"
                  >
                    {showPwd ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />

          <Box>
            <MuiLink
              component="button"
              type="button"
              variant="caption"
              onClick={() => setShowCompanyField((s) => !s)}
              sx={{ textDecoration: "none" }}
            >
              {showCompanyField ? "Hide company field" : "Signing in as a company admin?"}
            </MuiLink>
            <Collapse in={showCompanyField}>
              <TextField
                fullWidth
                size="small"
                sx={{ mt: 1 }}
                label="Company (optional)"
                placeholder="e.g. acme-traders"
                value={companySlug}
                onChange={(e) => setCompanySlug(e.target.value)}
                onBlur={handleCompanyBlur}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BusinessIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Collapse>
          </Box>

          <Button
            fullWidth
            size="large"
            variant="contained"
            disabled={!canSubmit}
            onClick={handleLogin}
            sx={{
              py: 1.2,
              borderRadius: 2,
              fontWeight: 800,
              textTransform: "none",
            }}
          >
            {loading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} color="inherit" />
                <span>Logging in...</span>
              </Stack>
            ) : (
              "Login"
            )}
          </Button>

          <Box sx={{ textAlign: "center" }}>
            <MuiLink component={RouterLink} to="/forgot-password" variant="body2">
              Forgot password?
            </MuiLink>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
