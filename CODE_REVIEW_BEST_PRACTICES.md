# Code Review: Industry Best Practices Audit

**Repository:** devpro-wall-builder
**Scope:** Full-stack application (React SPA + Express/SQLite backend)
**Date:** 2026-03-14

---

## Executive Summary

The DevPro Wall Builder is a well-structured application with clean separation of concerns, solid test coverage on core calculations, and good foundational patterns. This review identifies areas where the codebase diverges from industry best practices, organized by severity and category.

**Overall Grade: B+** — Strong fundamentals with actionable improvements needed around security, dependency hygiene, error handling, and operational readiness.

---

## 1. SECURITY

### 1.1 CORS is wide open (HIGH)
**File:** `server/index.js:21`
`app.use(cors())` allows requests from any origin. In production, this should be restricted to known frontend origins.

**Fix:** Configure allowed origins explicitly:
```js
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5174' }));
```

### 1.2 No rate limiting (MEDIUM)
No rate limiting on any API endpoints. The quote creation endpoint (`POST /api/quotes`) generates sequential quote numbers and writes to the database — vulnerable to abuse.

**Fix:** Add `express-rate-limit` middleware, at minimum on write endpoints.

### 1.3 No input sanitization on text fields (MEDIUM)
**Files:** `server/routes/clients.js`, `server/routes/quotes.js`
User-supplied strings (`name`, `company`, `notes`, `projectAddress`) are stored directly. While SQLite parameterized queries prevent SQL injection, these values could contain XSS payloads if rendered in a future admin UI without escaping.

**Recommendation:** Sanitize or validate string length/content at the API boundary.

### 1.4 Missing `parseInt` radix (LOW)
**File:** `server/routes/quotes.js:103`
`parseInt(...)` without a radix parameter. Always use `parseInt(value, 10)` to avoid unexpected octal parsing.

---

## 2. DEPENDENCY MANAGEMENT

### 2.1 Misplaced dependencies in server package.json (HIGH)
**File:** `server/package.json`
`react`, `@react-pdf/renderer`, and `@hubspot/api-client` are listed in the **server** dependencies. React packages belong exclusively in the client. `@hubspot/api-client` is unused.

**Impact:** Bloated server `node_modules`, slower installs, confusing dependency graph, potential supply chain risk from unnecessary packages.

**Fix:** Remove `react`, `@react-pdf/renderer`, and `@hubspot/api-client` from `server/package.json`.

### 2.2 Loose version pinning (MEDIUM)
Both `package.json` files use caret ranges (`^5`, `^19`, etc.) with major-version-only specifiers. While acceptable for development, this can lead to unexpected breaking changes.

**Best practice:** Pin to minor versions at minimum (e.g., `^5.1.0` instead of `^5`) and use a lockfile in CI. Consider `npm ci` over `npm install` in production builds.

### 2.3 No lockfile committed for server (LOW)
The server directory has its own `package.json` but no visible `package-lock.json`. Without a lockfile, builds are non-reproducible.

---

## 3. ERROR HANDLING & RESILIENCE

### 3.1 Generic error handler hides details (MEDIUM)
**File:** `server/middleware/errorHandler.js`
All 500 errors return `"Internal server error"` with no correlation ID. In production, this makes debugging difficult.

**Best practice:** Generate a unique error ID, log it with the stack trace, and return it to the client so support can correlate reports.

### 3.2 No request validation middleware (MEDIUM)
Each route handler validates its own input inline. This leads to inconsistent validation patterns and duplication.

**Best practice:** Use a schema validation library (e.g., `zod`, `joi`, or `express-validator`) as middleware. Define schemas once, validate consistently.

### 3.3 JSON parse errors not handled in GET /:id (LOW)
**File:** `server/routes/quotes.js:44-47`
`JSON.parse(row.material_quantities || '{}')` will throw on corrupt data. Wrap in try/catch or validate stored data integrity.

### 3.4 Shutdown timeout missing (LOW)
**File:** `server/index.js:43-49`
`server.close()` waits indefinitely for connections to drain. Add a forced shutdown timeout:
```js
setTimeout(() => process.exit(1), 10000);
```

---

## 4. DATABASE & DATA LAYER

### 4.1 No database migrations system (MEDIUM)
**File:** `server/db.js`
Schema is defined inline with `CREATE TABLE IF NOT EXISTS`. This works for initial setup but doesn't support schema evolution (adding columns, renaming fields, changing types).

**Best practice:** Use a migration tool (e.g., `knex` migrations, `better-sqlite3-helper`, or simple numbered SQL files) to version schema changes.

### 4.2 No indexes on frequently queried columns (MEDIUM)
**File:** `server/db.js`
`quotes` table is queried by `project_id`, `status`, `client_id`, and `parent_quote_id` — none are indexed. As data grows, query performance will degrade.

**Fix:** Add indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_quotes_project_id ON quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
```

### 4.3 Timestamps stored as strings (LOW)
All timestamps use `datetime('now')` returning ISO strings. While functional, integer Unix timestamps or SQLite's built-in date types would be more efficient for range queries and sorting.

### 4.4 No backup strategy (LOW)
SQLite with WAL mode is good, but there's no documented backup strategy. For production, add periodic `.backup()` calls or WAL checkpointing.

---

## 5. API DESIGN

### 5.1 Inconsistent response shapes (MEDIUM)
- `GET /api/quotes` returns raw rows (JSON fields as strings)
- `GET /api/quotes/:id` parses JSON fields before returning
- `DELETE` endpoints return `{ deleted: true }` instead of `204 No Content`

**Best practice:** Normalize all response shapes. Parse JSON fields consistently. Use proper HTTP status codes (204 for deletes).

### 5.2 No API versioning (LOW)
All routes are under `/api/`. When breaking changes are needed, there's no versioning strategy.

**Best practice:** Use `/api/v1/` prefix from the start.

### 5.3 No pagination on list endpoints (LOW)
**Files:** `server/routes/quotes.js:12`, `server/routes/clients.js:7`
`SELECT * FROM quotes` and `SELECT * FROM clients` return all rows. Fine for small datasets but will cause performance issues at scale.

### 5.4 Status filter not validated (LOW)
**File:** `server/routes/quotes.js:23`
`GET /api/quotes?status=invalid` silently returns empty results instead of a 400. The `VALID_STATUSES` array exists but isn't used for GET validation.

---

## 6. FRONTEND ARCHITECTURE

### 6.1 localStorage as primary storage (MEDIUM)
**File:** `src/utils/storage.js`
All project data (walls, floors, connections, H1 compliance) lives in `localStorage`. This is a significant data loss risk:
- ~5MB browser limit
- Cleared on cache/data clear
- No sync across devices
- No backup mechanism beyond manual export

**Recommendation:** For a production tool used in construction, data should persist server-side. The quote backend exists — extend it to store project data, or add IndexedDB with periodic cloud sync.

### 6.2 No state management library (LOW)
The app passes data through props and `localStorage`. For the current scale this is acceptable, but as the app grows, consider React Context for shared state (project data, user preferences) to avoid prop drilling.

### 6.3 ErrorBoundary uses hash navigation (LOW)
**File:** `src/components/ErrorBoundary.jsx:27`
`window.location.hash = '#/'` — the app uses `HashRouter`, so this works, but it's a fragile coupling. Use React Router's `useNavigate` or pass a callback prop instead.

### 6.4 Large component files (LOW)
Several components exceed 40KB (`FramingElevation.jsx`, `EpsElevation.jsx`, `ModelViewer3D.jsx`). While not a hard rule violation, files this large are difficult to review, test, and maintain.

**Best practice:** Extract reusable drawing primitives, helper functions, and sub-components into smaller modules.

---

## 7. TESTING

### 7.1 No integration/E2E tests (MEDIUM)
Test coverage is strong on pure utility functions (`calculator.js`, `quoteCalculator.js`, `h1Calculator.js`) but there are:
- No API integration tests (testing actual HTTP requests against the Express server)
- No E2E tests (Playwright/Cypress) for the React frontend
- No component tests (React Testing Library)

**Best practice:** Add at minimum API integration tests for the quote CRUD lifecycle.

### 7.2 Duplicate test configuration (LOW)
**Files:** `vite.config.js:10-17`, `server/vitest.config.js`
Both files configure Vitest. Clarify which config governs which test suite to avoid confusion. Consider a workspace-level vitest configuration.

### 7.3 No CI/CD pipeline (MEDIUM)
No `.github/workflows/`, no `Jenkinsfile`, no CI configuration. Tests, lint, and build are not enforced automatically.

**Best practice:** Add a GitHub Actions workflow that runs `npm run lint`, `npm test`, and `npm run build` on every PR.

---

## 8. CODE QUALITY & PATTERNS

### 8.1 Repeated pricing/margin loading pattern (MEDIUM)
**File:** `server/routes/quotes.js`
The same pricing + margin loading code appears in both `POST /` (lines 84-94) and `POST /:id/revise` (lines 198-208) — identical blocks.

**Fix:** Extract into a shared helper:
```js
function loadPricingAndMargins(db) {
  const pricing = Object.fromEntries(
    db.prepare('SELECT * FROM pricing').all().map(r => [r.category, r])
  );
  const margins = Object.fromEntries(
    db.prepare('SELECT * FROM margins').all().map(r => [r.key, r.value])
  );
  return { pricing, margins };
}
```

### 8.2 `updateProjectDetails` uses unsafe `Object.assign` (LOW)
**File:** `src/utils/storage.js:90`
`Object.assign(p, fields)` allows callers to overwrite any project field including `id` and `createdAt`. Whitelist allowed fields or use a pick function.

### 8.3 `PANEL_HEIGHTS` includes non-stocked value (LOW)
**File:** `src/utils/constants.js:27`
`PANEL_HEIGHTS = [2440, 2745, 3050]` includes 2440mm, but `STOCK_SHEET_HEIGHTS = [2745, 3050]` and the CLAUDE.md explicitly warns "2440mm is NOT stocked." This contradiction could confuse future developers.

---

## 9. OPERATIONAL READINESS

### 9.1 No environment-specific configuration (MEDIUM)
**File:** `server/.env.example`
Only `PORT` and `HUBSPOT_ACCESS_TOKEN` are configured via environment. Database path, CORS origins, log level, and other operational settings are hardcoded.

### 9.2 No structured logging (MEDIUM)
**File:** `server/index.js`, `server/middleware/errorHandler.js`
Uses `console.log` and `console.error` throughout. In production, structured logging (JSON format with timestamps, request IDs, log levels) is essential for observability.

**Best practice:** Use `pino` or `winston` with structured output.

### 9.3 No health check depth (LOW)
**File:** `server/index.js:32-34`
`GET /api/health` returns `{ status: 'ok' }` without checking database connectivity. A meaningful health check should verify the DB is accessible.

### 9.4 No `.dockerignore` or `Dockerfile` (LOW)
No containerization setup. For deployment, a Dockerfile with multi-stage build would standardize the environment.

---

## 10. DOCUMENTATION

### 10.1 CLAUDE.md is excellent (POSITIVE)
The `CLAUDE.md` file is comprehensive, well-organized, and includes lessons learned / anti-patterns. This is above industry standard for project documentation.

### 10.2 No API documentation (MEDIUM)
No OpenAPI/Swagger spec, no Postman collection, no documented API contracts. As the frontend-backend integration grows, API documentation becomes critical.

### 10.3 No contributing guide (LOW)
No `CONTRIBUTING.md` with setup instructions, code style guidelines, or PR process.

---

## Summary: Priority Action Items

| Priority | Issue | Effort |
|----------|-------|--------|
| **P0** | Remove misplaced deps from server `package.json` | 5 min |
| **P0** | Restrict CORS to known origins | 10 min |
| **P1** | Add rate limiting on write endpoints | 30 min |
| **P1** | Add database indexes on foreign keys | 10 min |
| **P1** | Add CI/CD pipeline (GitHub Actions) | 1 hr |
| **P1** | Add API integration tests | 2 hr |
| **P1** | Normalize API response shapes | 1 hr |
| **P2** | Implement schema validation middleware (zod/joi) | 2 hr |
| **P2** | Add structured logging | 1 hr |
| **P2** | Database migration system | 2 hr |
| **P2** | API versioning + OpenAPI docs | 2 hr |
| **P3** | Pagination on list endpoints | 1 hr |
| **P3** | Extract large components into smaller modules | Ongoing |
| **P3** | Data persistence strategy (beyond localStorage) | Large |
