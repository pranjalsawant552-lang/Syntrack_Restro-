# PostgreSQL setup (read first)

The project now runs on **PostgreSQL 13+** (was MySQL).

1. Create/choose a DB role that can create databases: `ALTER ROLE postgres CREATEDB;` (superuser already can).
2. Set `DB_HOST`, `DB_PORT` (default 5432), `DB_USERNAME`, `DB_PASSWORD` (and optionally `DB_NAME`, default `syntrack`,
   and `DB_URL_PARAMS`, e.g. `?sslmode=require`).
3. Start the backend. It creates the master database `syntrack` if missing, then builds the master tables.
   Every new company you create as Super Admin gets its own database `tenant_<slug>` + full schema automatically.
4. Existing MySQL data is **not** migrated by this change (use a tool such as pgloader if you need it). Tenants must be
   re-created on PostgreSQL. `docker compose up -d --build` now starts a `postgres:16` container instead of MySQL.

---

# Multi-Tenant POS — Backend Setup (Phase 1)

This covers what was built in Phase 1: multi-tenancy, RBAC, Super Admin, forgot/reset
password, and dynamic branding. Phase 2 (pagination/filters on remaining list endpoints)
and Phase 3 (frontend) are not in this drop — see "What's next" at the bottom.

## 1. Architecture recap

- **Master DB** (`pos_master`): `tenants`, `super_admins`, `tenant_user_index` (email→tenant
  lookup used only to route login).
- **Tenant DBs** (`tenant_<slug>`): one physical PostgreSQL database per company, created
  automatically when Super Admin onboards a tenant. Contains that company's Users, Roles,
  Products, Invoices, Stock, Settings — fully isolated, no `tenant_id` column needed anywhere
  because the database itself is the boundary.
- Every authenticated request's JWT carries which tenant DB to route to; a routing
  datasource (`TenantRoutingDataSource`) switches per-request. Super Admin requests never
  touch a tenant DB.

## 2. Required environment variables

```
# PostgreSQL (same server/user works for both master + tenant DBs; user needs CREATE DATABASE privilege)
# already set directly in application.properties for local dev — override for prod via env

MAIL_HOST=smtp.yourprovider.com
MAIL_PORT=587
MAIL_USERNAME=you@yourcompany.com
MAIL_PASSWORD=your-smtp-password
MAIL_FROM=no-reply@yourcompany.com

FRONTEND_BASE_URL=https://your-frontend-domain.com   # used to build password-reset links

JWT_SECRET=<a long random base64 string — replace the default in application.properties>

SUPERADMIN_EMAIL=you@yourcompany.com     # seeded automatically on first boot
SUPERADMIN_PASSWORD=<a strong password>  # CHANGE THIS after first login
```

`application.properties` has working local defaults (`localhost:5432`, user `postgres`) —
update `app.master-db.*` and `app.tenant-db.*` if your DB host/credentials differ.

## 3. First boot

1. Make sure the PostgreSQL user in `app.master-db.*` / `app.tenant-db.*` can `CREATE DATABASE`.
2. Start the app — `pos_master` is created automatically (`createDatabaseIfNotExist=true`),
   and a Super Admin is seeded from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`. **Change that
   password immediately after first login** (there's no super-admin self-service password
   change endpoint yet — update it directly via the `super_admins` table or ask me to add one).
3. Log in as Super Admin: `POST /v1/auth/login` with that email/password.
4. Create your first tenant: `POST /v1/superadmin/tenants` — this creates the tenant's
   database, seeds default roles (`TENANT_ADMIN`, `MANAGER`, `CASHIER`) and the first
   Tenant Admin user in one call.

## 4. Existing single-tenant data

Your current `stock_mgmt2` database is **not touched or migrated automatically** — the app
now expects tenant data to live in per-tenant databases. If you want your existing data
carried over as "Tenant #1", the cleanest path is: create a new tenant via the API, then
copy rows from `stock_mgmt2` into the new `tenant_<slug>` database (same table structure,
so a plain `pg_dump`/restore per table works). I can script this migration if you share
which tables have data you need to keep.

## 5. New/changed API surface

| Area | Endpoint | Notes |
|---|---|---|
| Auth | `POST /v1/auth/login` | body: `{email, password, companySlug?}`. Auto-detects Super Admin vs tenant user. |
| Auth | `POST /v1/auth/forgot-password` | body: `{email, companySlug?}`. Always returns generic success (no email enumeration). |
| Auth | `POST /v1/auth/reset-password` | body: `{token, newPassword}`. |
| Auth | `POST /v1/auth/signup` | **disabled** — returns 403. Users are created by Tenant Admin / Super Admin only. |
| Super Admin | `POST /v1/superadmin/tenants` | Create + provision a tenant + its first admin. |
| Super Admin | `GET /v1/superadmin/tenants?page&size&search&active` | Paginated tenant list. |
| Super Admin | `PUT /v1/superadmin/tenants/{id}/activate` \| `/deactivate` | Suspend/restore a company. |
| Super Admin | `PUT /v1/superadmin/tenants/{id}/branding` | `{name?, logoUrl?}` — updates the tenant's live branding. |
| Tenant Admin | `GET /v1/users?page&size&search&role&active&sort` | Paginated/filterable user list. |
| Tenant Admin | `POST /v1/users` \| `PUT /v1/users/{id}` | Create/edit users. |
| Tenant Admin | `PUT /v1/users/{id}/activate` \| `/deactivate` | Can't deactivate yourself. |
| Tenant Admin | `GET /v1/roles` \| `GET /v1/roles/permissions` \| `POST/PUT/DELETE /v1/roles/{id}` | Custom roles; `TENANT_ADMIN` role is protected. |
| Branding | `GET /v1/branding` (auth) | Current tenant's app name + logo. |
| Branding | `GET /v1/branding/public?slug=` (public) | For the login screen, before auth. |
| Branding | `PUT /v1/branding` \| `POST /v1/branding/logo` | Tenant Admin edits name/logo (text or file upload, 3MB max, images only). |

All existing Product/Category/Customer/Stock/Invoice/Dashboard endpoints are now
permission-gated (`@PreAuthorize`) per the RBAC model but otherwise unchanged.

## 5b. Phase 2 — Pagination / filters / search

New paginated list endpoints (all return `{content, totalElements, totalPages, page, size}`
and accept `page`, `size`, `sort` (`field,asc|desc`) plus the filters below):

| Resource | Endpoint | Filters |
|---|---|---|
| Products | `GET /v1/product/search` | `search` (name/barcode), `categoryId`, `active` |
| Categories | `GET /v1/category/search` | `search` (name), `active` |
| Stock | `GET /v1/stock/search` | `search` (product name/barcode), `maxQty` (e.g. for low-stock views) |
| Customers | `GET /v1/customer/search-paged` | `search` (name/phone/email), `active` |
| Invoices | `GET /v1/sales-invoice/search` | `fromDate`, `toDate`, `search` (invoice #/customer/phone), `payStatus`, `payMethod` |
| Users | `GET /v1/users` | `search`, `role`, `active` (from Phase 1) |
| Tenants | `GET /v1/superadmin/tenants` | `search`, `active` (from Phase 1) |

The old unpaginated endpoints (`/all_prodcut_list`, `/category_list`, `/customer/search`,
`/sales-invoice/list`) are all still there and unchanged, so nothing that currently calls
them breaks — the new `/search` endpoints are additive.

## 6. Permission codes

See `com.pos.app.Enum.Permission` for the full list. Default role → permission mapping is
seeded per-tenant in `TenantProvisioningService`:
- **TENANT_ADMIN**: everything.
- **MANAGER**: catalog, customers, stock, view+create invoices, dashboard, view settings.
- **CASHIER**: billing counter only (view products, create invoices, view/create customers).

Tenant Admins can create additional custom roles with any subset of permissions via
`POST /v1/roles`.

## 7. What's next (not yet built)

- Super Admin self-service password change/reset endpoint.
- Pagination/filter UI wired into the Category/Stock/Invoice pages themselves (the
  reusable `PaginatedTable` + `usePaginatedList` pattern and all backend endpoints are
  ready — Products page is the reference; Category/Stock/Invoices can be wired the same
  way in a follow-up pass).
- Data migration script for your existing `stock_mgmt2` database into a tenant, if wanted.

## 8. Frontend (Phase 3)

Stack: React 19 + TypeScript + MUI v7 + Redux Toolkit + React Router 7. Located in
`frontend/POS_Billings`.

**What's new:**
- `LoginPage` — optional "Company" field (auto-resolves from email otherwise), link to
  Forgot Password, shows tenant branding (logo + name) once known.
- `ForgotPasswordPage` / `ResetPasswordPage` — full flow against the new backend endpoints.
- `authSlice` — `AppUser` now carries `permissions: string[]`, `superAdmin`, `tenantName`,
  `tenantSlug`, `active`. Role is a free-text string (custom roles are supported).
- `PermissionRoute` — replaces the old hardcoded `ADMIN`/`STAFF` route guards; gates a
  route behind `hasAnyPermission(user, [...])`. `SuperAdminRoute` gates the Super Admin
  console. `SideNav` / `MobileBottomNav` filter items by permission the same way.
- `brandingSlice` + `BrandingCard` (in Settings) — app name + logo, editable by anyone
  with `SETTINGS_EDIT`, applied globally (header logo, browser tab title/favicon, login
  screen).
- `/superadmin/tenants` — Super Admin console: create/list/search tenants, activate/
  deactivate, edit branding. Completely separate shell (`SuperAdminShell`) from the
  tenant app.
- `/admin/users` and `/admin/roles` — Tenant Admin console: paginated/searchable/
  filterable user management, custom role + permission management. Gated by
  `USER_VIEW`/`USER_CREATE`/etc. and `ROLE_VIEW`/etc.
- `usePaginatedList` + `PaginatedTable` — a reusable hook + table shell (search box,
  filter slot, sortable columns, pagination footer) built against the
  `{content, totalElements, totalPages, page, size}` shape every new backend `/search`
  endpoint returns. Reused across Tenants, Users, and ready to wire into any remaining
  list page.

**Local dev:** `axiosClient` calls `/v1/...` with no absolute host, so either run the
frontend behind the same origin as the backend, or add a Vite dev proxy in
`vite.config.ts`:

```ts
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/v1': 'http://localhost:8084' } },
});
```

## 9. Phase 4 — Security, ops, and business features

**Security:**
- Password policy: 8+ chars, upper/lower/digit required (`PasswordPolicy`), enforced on signup, tenant provisioning, and reset.
- Token revocation: `User`/`SuperAdmin` now carry `tokenVersion`, embedded in JWTs and checked on every request. Changing your password (or an admin bumping it) invalidates all existing sessions immediately.
- Self-service password change: `POST /v1/users/me/change-password` (tenant users), `POST /v1/superadmin/account/change-password` (Super Admin). Both require the current password and log the user out on success.
- Rate limiting: `RateLimitFilter` (Bucket4j, in-memory) caps `/v1/auth/login`, `/v1/auth/forgot-password`, `/v1/auth/reset-password` at 8 attempts/minute per IP+email. **Note:** in-memory only — if you horizontally scale this app, swap for a shared store (e.g. Redis-backed Bucket4j).
- Swagger UI at `/swagger-ui.html` (JWT bearer auth built in). Actuator health at `/actuator/health` (public); other actuator endpoints require authentication.

**Multi-tenancy ops:**
- Tenant seat limits: `Tenant.maxUsers` / `maxProducts` (null = unlimited), enforced on creation. Manage via `PUT /v1/superadmin/tenants/{id}/limits` or the Super Admin console's "Limits & Usage" dialog.
- Usage metrics: `GET /v1/superadmin/tenants/{id}/usage` — user/product/customer/invoice counts.
- Tenant deletion: `DELETE /v1/superadmin/tenants/{id}?confirm=true` — **irreversible**, drops the physical database. The console requires typing the tenant's slug to confirm.

**Audit trail:**
- `AuditLog` (tenant-scoped) records user/role/invoice/branding changes with who/when/what. View at `GET /v1/audit-logs` (paginated/searchable) or the "Audit Log" page in the sidebar — gated by the new `AUDIT_VIEW` permission (not granted to any role by default; a Tenant Admin needs to add it to a role, e.g. their own, via Roles & Permissions).

**Business features:**
- Invoice PDF: `GET /v1/sales-invoice/{invoiceId}/pdf` — download button on the Invoices page.
- CSV export: `GET /v1/product/export`, `/v1/customer/export`, `/v1/sales-invoice/export` — buttons on the respective pages.
- Low-stock email alerts: daily scheduled job (`LOW_STOCK_CRON`, default 8 AM) emails all active Tenant Admins when any product is at or below `LOW_STOCK_THRESHOLD` (default 10 units).

**New environment variables:**
```
LOW_STOCK_THRESHOLD=10
LOW_STOCK_CRON=0 0 8 * * *
```

**Explicitly not built** (flagged as low-value or needing input I don't have): onboarding wizard for new tenants, barcode-scanner hardware integration, multi-currency/tax-per-tenant support.

**Cross-tenant session-end notifications:** if a session ends mid-use for a reason outside the user's control (Super Admin suspended the company, an admin deactivated the account, the token was revoked by a password change elsewhere), `axiosClient`'s response interceptor now captures the server's reason before redirecting, and the login screen surfaces it via the existing error banner instead of a silent, unexplained bounce. This is handled centrally in `bootstrapAuth` (not duplicated in `LoginPage`) to avoid a race between the two on the full-page reload that a forced logout triggers.

**Tests added:** `PasswordPolicyTest`, `JwtServiceTest` (pure unit tests, no DB needed). The pre-existing `StockManagementPosSystemApplicationTests.contextLoads()` needs a live PostgreSQL instance to pass now, same as before — the multi-tenancy changes don't affect that.

**New dependency note:** I added `com.bucket4j:bucket4j_jdk17-core:8.10.1` for rate limiting. I couldn't verify this resolves against Maven Central from this sandbox (no network access) — if it fails to resolve, swap to `com.bucket4j:bucket4j-core:8.10.1` (the JDK8-baseline artifact, same API) in `pom.xml`.



I can't compile this in the current sandbox (no Maven Central access), so please run
`mvn clean install` locally before deploying — happy to fix anything that surfaces.

## 10. Known gaps found in a follow-up audit (all fixed)

After the naming-strategy bug, I audited for other places where disabling Spring Boot's
JPA auto-configuration (necessary for multi-tenancy) silently removed defaults the app
was relying on:

- **Naming strategy** (the original bug): fixed in all three EntityManagerFactory
  builders (`MasterDataSourceConfig`, `TenantDataSourceConfig`, `TenantProvisioningService`).
- **LazyInitializationException risk on invoice PDF export**: `SalesInvoiceMaster.items`
  is a lazy `@OneToMany`. The existing invoice-fetch code was already safe (wrapped in a
  `@Transactional` service method), but the new PDF export endpoint I added called
  `invoice.getItems()` from a plain (non-transactional) controller method, which would
  throw once the Hibernate session closed. Fixed with `findByIdWithItems()` — a
  `left join fetch` query that loads items eagerly in one round trip, sidestepping the
  transaction-boundary issue entirely.
- **Multipart upload size limit**: Spring Boot defaults to 1MB max file size, below the
  3MB `FileStorageService` allows for logo uploads — any 1-3MB image would fail with a
  generic 500 before reaching that check. Set `spring.servlet.multipart.max-file-size=5MB`.
- **Misleading `spring.jpa.*` properties**: `application.properties` still had
  `spring.jpa.show-sql`, `spring.jpa.hibernate.ddl-auto`, etc. — these are silently
  ignored now (see naming-strategy note above; actual settings live in the three EMF
  builder classes). Removed/commented to avoid confusing future edits.
- **Unbounded rate-limiter memory growth**: `RateLimitFilter`'s in-memory bucket map had
  no eviction — harmless short-term, but grows forever on a long-running instance as it
  sees more distinct IP/email combinations. Added a periodic sweep that evicts entries
  idle for 10+ minutes.

Audited and confirmed safe (no action needed): CSV export queries (Customer has no lazy
associations; Product/Invoice CSV exports only touch scalar fields, never `.getItems()`);
`@Async` usage (none exists, so no thread-context-loses-TenantContext risk); the
scheduled low-stock job (already manually manages `TenantContext` per iteration).

## 11. Second follow-up fix: naming strategy dependency + rate-limiter dependency removed

The `SnakeCasePhysicalNamingStrategy` fix in section 10 initially tried to reuse Spring
Boot's own `org.springframework.boot.orm.jpa.hibernate.SpringPhysicalNamingStrategy`
class. That class turned out not to resolve reliably (compile-time "not defined") in
at least one real environment — likely a Spring Boot version/module difference. It's
now a small hand-written class (`com.pos.app.common.config.SnakeCasePhysicalNamingStrategy`)
depending only on Hibernate's own stable `PhysicalNamingStrategy` interface, doing the
same camelCase to snake_case conversion. No Spring Boot internal classes involved.

Given that surprise, I also proactively removed the one other "guessed" external Maven
coordinate in this app: `com.bucket4j:bucket4j_jdk17-core` (used for login rate
limiting) is gone. `RateLimitFilter` is now a small hand-rolled fixed-window limiter
(8 requests/60s per IP+email, `java.util.concurrent` only) — same behavior, zero
dependency-resolution risk. `openpdf`, `commons-csv`, and `springdoc-openapi` remain,
since their package names (`com.lowagie.text`, `org.apache.commons.csv`,
`io.swagger.v3.oas.models`) are long-stable public APIs, unlike the Spring Boot
internal utility class that caused this issue.

**If you already manually patched the Spring-class version of the naming strategy fix
locally**, this zip supersedes that — it already includes the final hand-written
version and the bucket4j-free rate limiter.

## 12. Third follow-up: tenant schema migration, self-healing, and branding cleanup

*(Historical note: an old MySQL-only `tenant_naming_migration.sql` used to live here. It was removed when the
project moved to PostgreSQL — new PostgreSQL databases are created with the correct snake_case names from the start.)*

**Fixed an acronym bug in the naming strategy itself**: fields with embedded acronyms
like `prodGST` were converting to `prod_g_s_t` (each capital split separately) instead
of the conventional `prod_gst`. `SnakeCasePhysicalNamingStrategy` now uses the standard
two-pass regex approach that collapses acronym runs correctly. Verified this doesn't
affect the master DB (no master entity has an embedded acronym), so no master
re-migration needed — only the tenant migration script above.

**New: per-tenant schema repair**. `POST /v1/superadmin/tenants/{id}/repair-schema`
re-runs schema generation (add-only — creates missing tables/columns, never drops or
renames) against exactly that one tenant's own dedicated connection. Use this any time
an older tenant is missing something a newer part of the app expects (e.g. a tenant
created before `audit_logs` existed). I deliberately did NOT make this automatic on
every app restart for the *live, routed* tenant persistence unit — that EMF has no
tenant selected at startup time (no HTTP request in progress), so an automatic
schema-update there would silently run against the master DB's fallback connection
instead of any real tenant. The repair endpoint avoids this by always using a tenant's
own dedicated connection, the same safe pattern used at provisioning time.

**Branding**: unified the platform's own default app name to "Billora" everywhere
(previously an inconsistent mix of "Billora", "POS App", and "Billing App" across
different fallback strings in the frontend). This is only the *fallback* shown before a
tenant is known (e.g. the generic login screen). Once logged into a tenant, or once a
company slug is provided, the tenant's own branding (e.g. "Syntaxcore") takes over
automatically via the existing branding system — no code change was needed for that
part, since your tenant's name was already correctly seeded as its `SettingMaster.appName`
when you created it. It'll display correctly as soon as the migration above unblocks
that table.

## 13. New: Suppliers, Purchases, and Reports

**Suppliers** — mirrors the existing Customer module (CRUD, pagination/search, CSV
export). `GET/POST /v1/supplier/*`, page at `/suppliers`, permissions `SUPPLIER_VIEW`/
`CREATE`/`EDIT`/`DELETE`.

**Purchases** — records goods bought from a supplier. Mirrors the Sales Invoice
architecture: `PurchaseInvoiceMaster` + `PurchaseInvoiceItem`, auto-numbered
(`PUR-YYYYMMDD-00001`). Creating a purchase **increases stock** via the existing
`StockMovementServiceImpl.productIN()` for each line item, and (by default, toggleable
per-request via `updateProductBuyPrice`) updates each product's stored buy price to
what was actually paid — so future profit-margin reports stay accurate. Cancelling a
purchase reverses the stock via `productOUT()` and deletes the record. `GET/POST/DELETE
/v1/purchase/*`, page at `/purchases`, permissions `PURCHASE_VIEW`/`CREATE`/`EDIT`/
`CANCEL`.

**Reports** — combined Sales/GST + Inventory section, read-only aggregations over
existing data (no new source-of-truth):
- GST summary: sales GST collected vs. purchase GST paid (input tax) vs. net payable,
  for a date range — the core figure needed for periodic GST filing.
- Inventory: total stock value on hand, and a slow-moving items list (in stock, zero
  sales within a configurable window) to spot dead stock.
- Both have CSV export. `GET /v1/reports/gst-summary`, `GET /v1/reports/inventory`,
  page at `/reports`, permission `REPORT_VIEW`.

**Existing tenants**: the new permissions (`SUPPLIER_*`, `PURCHASE_*`, `REPORT_VIEW`)
are automatically available to `TENANT_ADMIN` (which always has all permissions), but
the seeded `MANAGER`/`CASHIER` roles on *already-provisioned* tenants won't have them
until a Tenant Admin adds them manually via Roles & Permissions (Tenant Admin already
sees these new permission codes there automatically). New tenants created from now on
get them by default. Also run `POST /v1/superadmin/tenants/{id}/repair-schema` for any
older tenant so the new `suppliers` / `purchase_invoice_master` / `purchase_invoice_item`
tables get created (see section 12) — needed regardless of the naming-strategy issue,
since these are simply new tables that didn't exist before.

**Caught during review**: `PurchasesPage.tsx` initially imported the `Product` type
from the wrong module (`productApi.ts`, which only imports it internally rather than
re-exporting it) — fixed to import from `utils/types` directly, where it's actually
defined.


## Troubleshooting: `relation "super_admins" does not exist` at start-up
Hibernate only *logs* a warning when it cannot create a table, and the app then fails later on the first query.
The app now checks the master tables first thing at start-up. If Hibernate did not create them, the app **creates
`super_admins`, `tenants` and `tenant_user_index` itself** (log line: "Hibernate had not created the master table(s)")
and then seeds the Super Admin as usual. Only if the database user is not allowed to create tables does it stop with a
**MASTER DATABASE IS NOT READY** message showing the database/user it connected as and the database's own error.
Usual causes:
1. PostgreSQL 15+ and the DB user has no CREATE right on schema `public` ->
   `GRANT ALL ON SCHEMA public TO <user>;  ALTER DATABASE <db> OWNER TO <user>;`
2. Wrong `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` in the IntelliJ run configuration (defaults: `syntrack`, `postgres`).
3. Local dev only: `DROP DATABASE syntrack;` and start again - the app re-creates the database and every table.

Default first Super Admin (from `application.properties`, override with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`):
email `superadmin@pos-app.local`. **Change the password right after the first login.**
