import React from "react";
import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { AppDispatch } from "../../store/store";
import { logout } from "../../store/authSlice";
import BrandLogo from "./BrandLogo";

export default function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    sessionStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh", background: "#f7f7f7" }}>
      <AppBar position="static" elevation={2} color="default" sx={{ background: "linear-gradient(90deg, #12132b 0%, #1a1a2e 100%)" }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <BrandLogo appName="Syntrack Restro" showName={false} size={32} />
          <Typography
            variant="h6"
            sx={{ flex: 1, fontWeight: 700, letterSpacing: "-0.2px", color: "#fff", cursor: "pointer" }}
            onClick={() => navigate("/superadmin/tenants")}
          >
            Syntrack Restro <Box component="span" sx={{ opacity: 0.65, fontWeight: 500 }}>— Super Admin Console</Box>
          </Typography>
          <Button
            color="inherit"
            sx={{ color: "#fff", borderRadius: 999, "&:hover": { background: "rgba(255,255,255,0.12)" } }}
            startIcon={<AccountCircleIcon />}
            onClick={() => navigate("/superadmin/account")}
          >
            My Account
          </Button>
          <Button
            color="inherit"
            sx={{ color: "#fff", borderRadius: 999, "&:hover": { background: "rgba(255,255,255,0.12)" } }}
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: { xs: 1.5, md: 3 } }}>{children}</Box>
    </Box>
  );
}

