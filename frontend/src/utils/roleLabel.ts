/**
 * Converts a raw role name (as stored/returned by the backend, e.g.
 * "TENANT_ADMIN", "tenant_admin", "MANAGER") into a short, friendly label
 * for display in the UI (e.g. "Admin", "Manager").
 *
 * Known system roles get a concise, human label. Any other (custom) role
 * name is title-cased as a sensible fallback.
 */
const KNOWN_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TENANT_ADMIN: "Admin",
  MANAGER: "Manager",
  CASHIER: "Cashier",
};

export function formatRoleLabel(role?: string | null): string {
  if (!role) return "";
  const key = role.trim().toUpperCase().replace(/\s+/g, "_");
  if (KNOWN_ROLE_LABELS[key]) return KNOWN_ROLE_LABELS[key];

  // Fallback: turn CUSTOM_ROLE_NAME / custom-role-name into "Custom Role Name"
  return key
    .toLowerCase()
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
