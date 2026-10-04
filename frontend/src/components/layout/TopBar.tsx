import React, { useMemo } from "react";
import { AppBar, Toolbar, Typography, Box, Button, Avatar, Divider } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../../store/store";
import { logout } from "../../store/authSlice";
import { selectBranding } from "../../store/brandingSlice";
import BrandLogo from "./BrandLogo";
import { formatRoleLabel } from "../../utils/roleLabel";

const titleFromPath = (path: string) => {
  if (path.startsWith("/dashboard")) return "Dashboard";
  if (path.startsWith("/restaurant/tables")) return "Orders";
  if (path.startsWith("/restaurant/kitchen")) return "Kitchen";
  if (path.startsWith("/cash")) return "Cash Drawer";
  if (path.startsWith("/inventory")) return "Ingredients";
  if (path.startsWith("/recipes")) return "Recipes & Cost";
  if (path.startsWith("/products")) return "Menu";
  if (path.startsWith("/category")) return "Category";
  if (path.startsWith("/stockManagement")) return "Stock";
  if (path.startsWith("/customers")) return "Customers";
  if (path.startsWith("/suppliers")) return "Suppliers";
  if (path.startsWith("/purchases")) return "Purchases";
  if (path.startsWith("/reports")) return "Reports";
  if (path.startsWith("/invoices")) return "Invoices";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/admin/users")) return "Team Members";
  if (path.startsWith("/admin/roles")) return "Roles & Permissions";
  return "Syntrack Restro";
};

export default function TopBar({ drawerWidth }: { drawerWidth: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const title = titleFromPath(location.pathname);

  const user = useSelector((s: RootState) => s.auth.user);
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);
  const branding = useSelector(selectBranding);

  const showLogout = useMemo(() => {
    return isAuthenticated && !location.pathname.startsWith("/login");
  }, [isAuthenticated, location.pathname]);

  const handleLogout = () => {
    dispatch(logout());
    sessionStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <AppBar
      position="fixed"
      elevation={2}
      sx={{
        zIndex: (t) => t.zIndex.drawer + 1,
        background: "linear-gradient(90deg, #1B2A8C 0%, #2A3FA0 55%, #3A56C4 100%)",
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 48, md: 56 },
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pl: { md: `calc(${drawerWidth}px + 16px)` },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 1.75 }, minWidth: 0 }}>
          <BrandLogo
            logoUrl={branding.logoUrl}
            appName={branding.appName}
            showName={!isAuthenticated}
            size={32}
          />

          {isAuthenticated && (
            <>
              <Divider
                orientation="vertical"
                flexItem
                sx={{ borderColor: "rgba(255,255,255,0.25)", display: { xs: "none", sm: "block" }, my: 1 }}
              />
              <Typography
                variant="h6"
                noWrap
                sx={{ fontWeight: 700, fontSize: { xs: "1rem", md: "1.15rem" }, letterSpacing: "-0.2px" }}
              >
                {title}
              </Typography>
            </>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {user && (
            <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1 }}>
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  fontSize: 13,
                  fontWeight: 800,
                  bgcolor: "rgba(255,255,255,0.18)",
                }}
              >
                {(user.firstName || "?").trim().charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2" sx={{ opacity: 0.95, fontWeight: 600 }}>
                {user.firstName} <Box component="span" sx={{ opacity: 0.7, fontWeight: 500 }}>({formatRoleLabel(user.role)})</Box>
              </Typography>
            </Box>
          )}

          {showLogout && (
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{
                fontWeight: 700,
                textTransform: "none",
                borderRadius: 999,
                px: 1.5,
                "&:hover": { background: "rgba(255,255,255,0.12)" },
              }}
            >
              Logout
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
