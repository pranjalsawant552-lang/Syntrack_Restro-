import React, { type JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { Box, CircularProgress } from "@mui/material";

export default function SuperAdminRoute({ children }: { children: JSX.Element }) {
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

  if (!user?.superAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
