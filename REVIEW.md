# Code Review: `claude/create-new-repo-aidxu`

## Branch: DevPro Wall Builder — Quote Module
**Commits reviewed:** 3 (Phase 1 backend foundation, Phase 1 hardening, Phase 2 client/quote CRUD)
**Files changed:** 22 | **Lines added:** ~4,765

---

## What's Good

- **Clean architecture** — Pure pricing engine (`quoteCalculator.js`) with no side effects; easy to test.
- **Solid test coverage** — Edge cases covered well (zero quantities, missing categories, negative clamping, rounding). In-memory SQLite for numbering tests is the right approach.
- **Idempotent seeding** — `INSERT OR IGNORE` ensures safe re-runs.
- **Proper shutdown** — Server closes DB on SIGINT/SIGTERM.
- **Quote versioning** — Revision system (`parent_quote_id`, `Q-YYYY-NNN-vN`) is well designed.
- **Settings whitelist** — `VALID_KEYS` set prevents arbitrary key creation.

---

## Issues to Address

### 1. Misplaced dependencies in server `package.json`
`react`, `@react-pdf/renderer`, and `@hubspot/api-client` are in the **server** `package.json`. React packages belong in the client. HubSpot client is unused in this branch. This bloats the server's `node_modules` and the 3,667-line `package-lock.json`.

### 2. No shape validation on `materials` input (`POST /api/quotes`)
The `materials` object is accepted as-is. Malformed input (e.g., `materials: "string"`) produces garbage quotes silently. Add schema validation for the expected shape (`{ magboard: { totalSheets }, eps: { totalBlocks }, ... }`).

### 3. Client deletion doesn't handle foreign key violations gracefully
`DELETE /api/clients/:id` will throw a generic 500 if the client has quotes referencing it (FK constraint). Catch the `SQLITE_CONSTRAINT` error and return a descriptive 400/409.

### 4. `quoteAggregator.js` imports modules not in this branch
Imports `magboardOptimizer.js`, `epsOptimizer.js`, `glueCalculator.js`, `timberCalculator.js` — none present in this diff. Confirm these exist on the target branch, otherwise this file will crash at import time.

### 5. Revision endpoint can't update materials
`POST /:id/revise` re-prices with current pricing/margins but always uses the original quote's materials. Consider accepting an optional `materials` override in the request body for revisions that change scope.

### 6. Missing `data/` directory creation
The SQLite DB path (`server/data/devpro-quotes.db`) assumes the `data/` directory exists. First run will fail with `SQLITE_CANTOPEN`. Either auto-create the directory in `db.js` or add a `.gitkeep`.

### 7. Duplicate/confusing test config
`vite.config.js` (root) has `test` settings, but `server/vitest.config.js` also exists. Clarify which config governs which test suite to avoid confusion.

### 8. `GET /api/quotes` doesn't validate `status` parameter
The `status` query parameter isn't validated against `VALID_STATUSES`, unlike the PUT endpoint. A user can filter by arbitrary strings (no harm, but inconsistent).

---

## Minor / Nits

- `quotes.js:95` — `parseInt(...)` without radix — use `parseInt(..., 10)`.
- No pagination on `GET /api/quotes` or `GET /api/clients` — fine for now but will need it as data grows.
- `errorHandler` could log request body on 4xx errors for easier debugging.

---

## Summary

The core pricing logic and quote CRUD are solid and well-tested. **Top priorities:** (1) move misplaced deps out of server `package.json`, (2) add `materials` input validation, (3) handle FK constraint on client deletion, (4) ensure `data/` directory is auto-created.
