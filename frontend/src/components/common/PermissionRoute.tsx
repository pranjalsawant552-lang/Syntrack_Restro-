import React, { type JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { Box, CircularProgress } from "@mui/material";
import { hasAnyPermission, type Permission } from "../../utils/permissions";

/**
 * Gate a route behind one or more permissions. The signed-in user needs at least
 * ONE of `anyOf` (or is a Super Admin, who always passes). Use this instead of the
 * old role-name checks — role names are now tenant-defined and not a reliable
 * signal on their own.
 */
// Where a signed-in user lands (and is bounced to when they open a page they can't use): the first of
// these they have access to. Ordered by how often each role type works there.
const LANDING: { path: string; anyOf: Permission[] }[] = [
  { path: "/restaurant/tables", anyOf: ["RESTAURANT_VIEW", "RESTAURANT_MANAGE"] },
  { path: "/restaurant/kitchen", anyOf: ["KITCHEN_VIEW"] },
  { path: "/dashboard", anyOf: ["DASHBOARD_VIEW"] },
  { path: "/cash", anyOf: ["CASH_VIEW"] },
  { path: "/invoices", anyOf: ["INVOICE_VIEW"] },
  { path: "/products", anyOf: ["PRODUCT_VIEW"] },
  { path: "/inventory", anyOf: ["INVENTORY_VIEW"] },
  { path: "/purchases", anyOf: ["PURCHASE_VIEW"] },
  { path: "/reports", anyOf: ["REPORT_VIEW"] },
  { path: "/settings", anyOf: ["SETTINGS_VIEW", "SETTINGS_EDIT"] },
  { path: "/admin/users", anyOf: ["USER_VIEW"] },
];

/** First page this user is allowed to open, or null if they have no page permissions at all. */
export function firstAllowedPath(user: Parameters<typeof hasAnyPermission>[0]): string | null {
  return LANDING.find((l) => hasAnyPermission(user, l.anyOf))?.path ?? null;
}

export default function PermissionRoute({
  children,
  anyOf,
  fallback,
}: {
  children: JSX.Element;
  anyOf: Permission[];
  fallback?: string;
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

  if (user?.superAdmin) {
    // Super Admin doesn't operate inside tenant screens.
    return <Navigate to="/superadmin/tenants" replace />;
  }

  if (!hasAnyPermission(user, anyOf)) {
    const target = fallback ?? firstAllowedPath(user);
    // Never redirect to the page we're already on (that would loop forever for a role with no access here)
    if (!target || target === location.pathname) {
      return (
        <Box sx={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center", p: 3 }}>
          <div>
            <h3>No access</h3>
            <p>Your role doesn't have permission to open any screen. Ask your admin to update your role.</p>
          </div>
        </Box>
      );
    }
    return <Navigate to={target} replace />;
  }

  return children;
}
