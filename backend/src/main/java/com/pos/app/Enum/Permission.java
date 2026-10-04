package com.pos.app.Enum;

/**
 * Canonical list of permission codes. Roles hold a Set<String> of these codes
 * (stored as plain strings so new permissions can be added without a migration).
 */
public enum Permission {
    // Users & roles (tenant admin area)
    USER_VIEW, USER_CREATE, USER_EDIT, USER_DEACTIVATE,
    ROLE_VIEW, ROLE_CREATE, ROLE_EDIT, ROLE_DELETE,

    // Catalog
    PRODUCT_VIEW, PRODUCT_CREATE, PRODUCT_EDIT, PRODUCT_DELETE,
    CATEGORY_VIEW, CATEGORY_CREATE, CATEGORY_EDIT, CATEGORY_DELETE,

    // Customers
    CUSTOMER_VIEW, CUSTOMER_CREATE, CUSTOMER_EDIT, CUSTOMER_DELETE,

    // Suppliers & Purchases
    SUPPLIER_VIEW, SUPPLIER_CREATE, SUPPLIER_EDIT, SUPPLIER_DELETE,
    PURCHASE_VIEW, PURCHASE_CREATE, PURCHASE_EDIT, PURCHASE_CANCEL,

    // Reports
    REPORT_VIEW,

    // Stock
    STOCK_VIEW, STOCK_ADJUST,

    // Billing / POS
    INVOICE_VIEW, INVOICE_CREATE, INVOICE_EDIT, INVOICE_CANCEL,

    // Dashboards & settings
    DASHBOARD_VIEW,
    SETTINGS_VIEW, SETTINGS_EDIT,

    // Audit
    AUDIT_VIEW,

    // Restaurant module
    RESTAURANT_VIEW, RESTAURANT_MANAGE, KITCHEN_VIEW, RESTAURANT_ITEM_VOID,
    // Ingredient inventory + recipes (BOM)
    INVENTORY_VIEW, INVENTORY_MANAGE, INVENTORY_ADJUST,
    RECIPE_VIEW, RECIPE_MANAGE,
    // Cash drawer shifts + reconciliation
    CASH_VIEW, CASH_MANAGE;

    public static final String[] ALL_CODES;

    static {
        Permission[] values = values();
        ALL_CODES = new String[values.length];
        for (int i = 0; i < values.length; i++) {
            ALL_CODES[i] = values[i].name();
        }
    }
}
