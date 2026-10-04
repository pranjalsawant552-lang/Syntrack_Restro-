import React, { type JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { Box, CircularProgress } from "@mui/material";

export default function ProtectedRoute({
  children,
}: {
  children: JSX.Element;
}) {
  const location = useLocation();
  const { isAuthenticated, token, bootLoading, user } = useSelector(
    (s: RootState) => s.auth
  );

  if (bootLoading) {
    return (
      <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Super Admin doesn't use the tenant app shell — bounce to their own console.
  if (user?.superAdmin && !location.pathname.startsWith("/superadmin")) {
    return <Navigate to="/superadmin/tenants" replace />;
  }

  return children;
}
