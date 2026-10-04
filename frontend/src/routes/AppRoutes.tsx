import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import AppShell from "../components/layout/AppShell";

import LoginPage from "../pages/LoginPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";

import ProtectedRoute from "../components/common/ProtectedRoute";
import PermissionRoute, { firstAllowedPath } from "../components/common/PermissionRoute";
import { useAppSelector } from "../store/hooks";
import SuperAdminRoute from "../components/common/SuperAdminRoute";

// Each screen is downloaded only when it is first opened (the app used to ship as one big file), so the
// first load on a phone/tablet is much faster. Login + the shell stay in the main bundle.
const DashboardPage = lazyPage(() => import("../pages/DashboardPage"));
const ProductsPage = lazyPage(() => import("../pages/ProductsPage"));
const InvoicesPage = lazyPage(() => import("../pages/InvoicesPage"));
const CashPage = lazyPage(() => import("../pages/CashPage"));
const CategoryPage = lazyPage(() => import("../pages/CategoryPage"));
const SettingPage = lazyPage(() => import("../pages/SettingPage"));
const StockManagementPage = lazyPage(() => import("../pages/StockManagementPage"));
const CustomersPage = lazyPage(() => import("../components/customer/CustomersPage"));
const SuppliersPage = lazyPage(() => import("../pages/SuppliersPage"));
const PurchasesPage = lazyPage(() => import("../pages/PurchasesPage"));
const ReportsPage = lazyPage(() => import("../pages/ReportsPage"));
const UsersPage = lazyPage(() => import("../pages/admin/UsersPage"));
const RolesPage = lazyPage(() => import("../pages/admin/RolesPage"));
const AuditLogPage = lazyPage(() => import("../pages/admin/AuditLogPage"));
const SuperAdminTenantsPage = lazyPage(() => import("../pages/superadmin/SuperAdminTenantsPage"));
const SuperAdminAccountPage = lazyPage(() => import("../pages/superadmin/SuperAdminAccountPage"));
const TablesBoardPage = lazyPage(() => import("../pages/restaurant/TablesBoardPage"));
const KitchenDisplayPage = lazyPage(() => import("../pages/restaurant/KitchenDisplayPage"));
const InventoryPage = lazyPage(() => import("../pages/InventoryPage"));
const RecipesPage = lazyPage(() => import("../pages/RecipesPage"));
const QrOrderPage = lazyPage(() => import("../pages/public/QrOrderPage"));
const MenuAvailabilityPage = lazyPage(() => import("../pages/MenuAvailabilityPage"));

// If a phone still has the previous release's index.html open, a page's JS file may no longer exist on the server.
// Reload once to pick up the new release instead of showing a blank screen.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyPage<T extends React.ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load()
      .then((m) => {
        sessionStorage.removeItem("chunkReloaded");
        return m;
      })
      .catch((err) => {
        if (!sessionStorage.getItem("chunkReloaded")) {
          sessionStorage.setItem("chunkReloaded", "1");
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
        throw err;
      })
  );
}

const PageLoading = () => (
  <div style={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
    <span style={{ fontFamily: "sans-serif", color: "#666" }}>Loading…</span>
  </div>
);

// Layout wrapper for the tenant app (Dashboard/POS/etc)
function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

// "/" and unknown URLs: send each user to the first screen their role can actually open.
function HomeRedirect() {
  const user = useAppSelector((s) => s.auth.user);
  const target = firstAllowedPath(user);
  if (target) return <Navigate to={target} replace />;
  // No page permissions at all: say so (redirecting to /login would bounce straight back here).
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
      <div>
        <h3>No access</h3>
        <p>Your role doesn't have permission to open any screen. Ask your admin to update your role.</p>
      </div>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
        <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Customer QR ordering: what a table's printed QR opens. No login. */}
          <Route path="/t/:slug/:qrToken" element={<QrOrderPage />} />

          {/* Super Admin console — separate from the tenant app shell */}
          <Route
            path="/superadmin/tenants"
            element={
              <SuperAdminRoute>
                <SuperAdminTenantsPage />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/superadmin/account"
            element={
              <SuperAdminRoute>
                <SuperAdminAccountPage />
              </SuperAdminRoute>
            }
          />

          {/* Tenant app, protected + permission gated */}
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<HomeRedirect />} />

            <Route
              path="/restaurant/tables"
              element={
                <PermissionRoute anyOf={["RESTAURANT_VIEW", "RESTAURANT_MANAGE"]}>
                  <TablesBoardPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/menu-availability"
              element={
                <PermissionRoute anyOf={["RESTAURANT_VIEW", "RESTAURANT_MANAGE", "PRODUCT_EDIT", "PRODUCT_VIEW", "KITCHEN_VIEW"]}>
                  <MenuAvailabilityPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/restaurant/kitchen"
              element={
                <PermissionRoute anyOf={["KITCHEN_VIEW"]}>
                  <KitchenDisplayPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PermissionRoute anyOf={["DASHBOARD_VIEW"]}>
                  <DashboardPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/products"
              element={
                <PermissionRoute anyOf={["PRODUCT_VIEW"]}>
                  <ProductsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/category"
              element={
                <PermissionRoute anyOf={["CATEGORY_VIEW"]}>
                  <CategoryPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <PermissionRoute anyOf={["INVOICE_VIEW"]}>
                  <InvoicesPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PermissionRoute anyOf={["SETTINGS_VIEW", "SETTINGS_EDIT"]}>
                  <SettingPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/stockManagement"
              element={
                <PermissionRoute anyOf={["STOCK_VIEW"]}>
                  <StockManagementPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <PermissionRoute anyOf={["INVENTORY_VIEW"]}>
                  <InventoryPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/recipes"
              element={
                <PermissionRoute anyOf={["RECIPE_VIEW"]}>
                  <RecipesPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <PermissionRoute anyOf={["CUSTOMER_VIEW"]}>
                  <CustomersPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <PermissionRoute anyOf={["SUPPLIER_VIEW"]}>
                  <SuppliersPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/purchases"
              element={
                <PermissionRoute anyOf={["PURCHASE_VIEW"]}>
                  <PurchasesPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <PermissionRoute anyOf={["REPORT_VIEW"]}>
                  <ReportsPage />
                </PermissionRoute>
              }
            />

            {/* Tenant Admin: team + roles */}
            <Route
              path="/admin/users"
              element={
                <PermissionRoute anyOf={["USER_VIEW"]}>
                  <UsersPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <PermissionRoute anyOf={["ROLE_VIEW", "USER_VIEW"]}>
                  <RolesPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/admin/audit-log"
              element={
                <PermissionRoute anyOf={["AUDIT_VIEW"]}>
                  <AuditLogPage />
                </PermissionRoute>
              }
            />

            <Route
              path="/cash"
              element={
                <PermissionRoute anyOf={["CASH_VIEW"]}>
                  <CashPage />
                </PermissionRoute>
              }
            />

            {/* fallback */}
            <Route path="*" element={<HomeRedirect />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
