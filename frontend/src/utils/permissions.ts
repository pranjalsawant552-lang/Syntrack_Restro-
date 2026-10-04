// Mirrors backend com.pos.app.Enum.Permission — keep in sync if new permissions are added.
export const ALL_PERMISSIONS = [
  "USER_VIEW", "USER_CREATE", "USER_EDIT", "USER_DEACTIVATE",
  "ROLE_VIEW", "ROLE_CREATE", "ROLE_EDIT", "ROLE_DELETE",
  "PRODUCT_VIEW", "PRODUCT_CREATE", "PRODUCT_EDIT", "PRODUCT_DELETE",
  "CATEGORY_VIEW", "CATEGORY_CREATE", "CATEGORY_EDIT", "CATEGORY_DELETE",
  "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_EDIT", "CUSTOMER_DELETE",
  "SUPPLIER_VIEW", "SUPPLIER_CREATE", "SUPPLIER_EDIT", "SUPPLIER_DELETE",
  "PURCHASE_VIEW", "PURCHASE_CREATE", "PURCHASE_EDIT", "PURCHASE_CANCEL",
  "REPORT_VIEW",
  "STOCK_VIEW", "STOCK_ADJUST",
  "INVOICE_VIEW", "INVOICE_CREATE", "INVOICE_EDIT", "INVOICE_CANCEL",
  "DASHBOARD_VIEW",
  "SETTINGS_VIEW", "SETTINGS_EDIT",
  "AUDIT_VIEW",
  "RESTAURANT_VIEW", "RESTAURANT_MANAGE", "KITCHEN_VIEW", "RESTAURANT_ITEM_VOID",
  "INVENTORY_VIEW", "INVENTORY_MANAGE", "INVENTORY_ADJUST",
  "RECIPE_VIEW", "RECIPE_MANAGE",
  "CASH_VIEW", "CASH_MANAGE",
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

/** True if the user has this permission, or is a Super Admin (implicit all-access). */
export function hasPermission(
  user: { permissions?: string[] | null; superAdmin?: boolean } | null | undefined,
  perm: Permission
): boolean {
  if (!user) return false;
  if (user.superAdmin) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(perm);
}

export function hasAnyPermission(
  user: { permissions?: string[] | null; superAdmin?: boolean } | null | undefined,
  perms: Permission[]
): boolean {
  if (!user) return false;
  if (user.superAdmin) return true;
  return perms.some((p) => hasPermission(user, p));
}
