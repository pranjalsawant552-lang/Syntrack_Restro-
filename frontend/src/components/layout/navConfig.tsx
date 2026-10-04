import React, { useCallback, useEffect, useState } from "react";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CategoryIcon from "@mui/icons-material/Category";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import BadgeIcon from "@mui/icons-material/Badge";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import HistoryIcon from "@mui/icons-material/History";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import SoupKitchenIcon from "@mui/icons-material/SoupKitchen";
import KitchenIcon from "@mui/icons-material/Kitchen";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import { hasAnyPermission, type Permission } from "../../utils/permissions";

export type NavGroup = "daily" | "menu" | "business" | "stock" | "admin";

export type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  anyOf: Permission[];
  group: NavGroup;
  /** hidden in Simple mode (still one tap away via "Show all features") */
  advanced?: boolean;
};

export const GROUP_LABEL: Record<NavGroup, string> = {
  daily: "Daily work",
  menu: "Menu",
  business: "Business",
  stock: "Stock & cost",
  admin: "Admin",
};
export const GROUP_ORDER: NavGroup[] = ["daily", "menu", "business", "stock", "admin"];

export const NAV_ITEMS: NavItem[] = [
  { label: "Orders", path: "/restaurant/tables", icon: <TableRestaurantIcon />, anyOf: ["RESTAURANT_VIEW", "RESTAURANT_MANAGE"], group: "daily" },
  { label: "Kitchen", path: "/restaurant/kitchen", icon: <SoupKitchenIcon />, anyOf: ["KITCHEN_VIEW"], group: "daily" },
  { label: "Dashboard", path: "/dashboard", icon: <DashboardIcon />, anyOf: ["DASHBOARD_VIEW"], group: "daily" },
  { label: "Invoices", path: "/invoices", icon: <ReceiptLongIcon />, anyOf: ["INVOICE_VIEW"], group: "daily" },
  { label: "Cash Drawer", path: "/cash", icon: <PointOfSaleIcon />, anyOf: ["CASH_VIEW"], group: "daily" },

  { label: "Menu", path: "/products", icon: <Inventory2Icon />, anyOf: ["PRODUCT_VIEW"], group: "menu" },
  { label: "Availability", path: "/menu-availability", icon: <ToggleOnIcon />, anyOf: ["RESTAURANT_VIEW", "RESTAURANT_MANAGE", "PRODUCT_EDIT", "PRODUCT_VIEW", "KITCHEN_VIEW"], group: "menu" },
  { label: "Menu Categories", path: "/category", icon: <CategoryIcon />, anyOf: ["CATEGORY_VIEW"], group: "menu" },

  { label: "Reports", path: "/reports", icon: <AssessmentIcon />, anyOf: ["REPORT_VIEW"], group: "business" },
  { label: "Customers", path: "/customers", icon: <PeopleAltIcon />, anyOf: ["CUSTOMER_VIEW"], group: "business", advanced: true },

  { label: "Inventory", path: "/stockManagement", icon: <WarehouseIcon />, anyOf: ["STOCK_VIEW"], group: "stock", advanced: true },
  { label: "Ingredients", path: "/inventory", icon: <KitchenIcon />, anyOf: ["INVENTORY_VIEW"], group: "stock", advanced: true },
  { label: "Recipes & Cost", path: "/recipes", icon: <MenuBookIcon />, anyOf: ["RECIPE_VIEW"], group: "stock", advanced: true },
  { label: "Vendors", path: "/suppliers", icon: <LocalShippingIcon />, anyOf: ["SUPPLIER_VIEW"], group: "stock", advanced: true },
  { label: "Ingredient Purchases", path: "/purchases", icon: <ShoppingCartIcon />, anyOf: ["PURCHASE_VIEW"], group: "stock", advanced: true },

  { label: "Settings", path: "/settings", icon: <SettingsIcon />, anyOf: ["SETTINGS_VIEW", "SETTINGS_EDIT"], group: "admin" },
  { label: "Team", path: "/admin/users", icon: <BadgeIcon />, anyOf: ["USER_VIEW"], group: "admin" },
  { label: "Roles", path: "/admin/roles", icon: <AdminPanelSettingsIcon />, anyOf: ["ROLE_VIEW", "USER_VIEW"], group: "admin", advanced: true },
  { label: "Audit Log", path: "/admin/audit-log", icon: <HistoryIcon />, anyOf: ["AUDIT_VIEW"], group: "admin", advanced: true },
];

/** Bottom-bar priority on phones / portrait tablets (the rest live under "More"). */
export const BOTTOM_PRIORITY = ["/restaurant/tables", "/restaurant/kitchen", "/dashboard", "/cash", "/invoices"];

/* ---------- Simple / Full menu mode: remembered per device ---------- */
export type NavMode = "SIMPLE" | "FULL";
const KEY = "ui.navMode.v1";
const EVENT = "ui:navMode";

export function loadNavMode(): NavMode {
  try {
    return localStorage.getItem(KEY) === "FULL" ? "FULL" : "SIMPLE"; // Simple by default: less to learn on day one
  } catch {
    return "SIMPLE";
  }
}

export function useNavMode(): [NavMode, (m: NavMode) => void] {
  const [mode, setMode] = useState<NavMode>(loadNavMode);
  useEffect(() => {
    const sync = () => setMode(loadNavMode());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const set = useCallback((m: NavMode) => {
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* private mode: the toggle just won't persist */
    }
    setMode(m);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [mode, set];
}

/**
 * Items this user may see: permission-gated, and in Simple mode without the advanced ones —
 * except the page they are on right now, so nobody is ever "lost" on a hidden screen.
 */
export function visibleNavItems(
  user: Parameters<typeof hasAnyPermission>[0],
  mode: NavMode,
  pathname: string
): NavItem[] {
  return NAV_ITEMS.filter(
    (it) =>
      hasAnyPermission(user, it.anyOf) &&
      (mode === "FULL" || !it.advanced || pathname.startsWith(it.path))
  );
}
