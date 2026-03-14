# Code Review: Industry Best Practices Audit

**Repository:** devpro-wall-builder
**Stack:** React 19 SPA (Vite 7, React Router 7, react-three-fiber, Vitest)
**Date:** 2026-03-14

---

## Executive Summary

The DEVPRO Wall Builder is a React SPA for designing prefabricated wall panel systems. It calculates panel layouts, generates SVG/DXF elevations, optimizes material usage (EPS, magboard, timber), and estimates glue consumption. Data is persisted in localStorage.

The codebase demonstrates strong engineering fundamentals: good separation of concerns, solid test coverage on core calculations, well-documented constants, and thoughtful use of lazy loading and error boundaries. This review identifies areas where the codebase diverges from industry best practices.

**Overall Grade: B+** -- Strong fundamentals with actionable improvements needed around input validation, code duplication, error handling, testing gaps, and operational readiness.

---

## 1. ARCHITECTURE & PROJECT STRUCTURE

### 1.1 Lazy loading and code splitting (POSITIVE)
**File:** `src/App.jsx`
All page components use `React.lazy()` with a `Suspense` fallback. This is best practice for route-based code splitting with Vite.

### 1.2 Error boundary at the right level (POSITIVE)
**File:** `src/components/ErrorBoundary.jsx`
A top-level `ErrorBoundary` wraps the app, and a second one wraps the 3D viewer (`ProjectPage.jsx:214`). This layered approach prevents a Three.js crash from taking down the whole app.

### 1.3 localStorage as primary data store (MEDIUM)
**File:** `src/utils/storage.js`
All project data (walls, floors, connections, placements) lives in `localStorage`. This is a significant data loss risk for a professional construction tool:
- ~5MB browser limit
- Cleared on cache/data clear
- No sync across devices
- No backup beyond manual `.devpro` export

**Recommendation:** For production use, consider IndexedDB (larger quota, structured data) with periodic cloud sync, or a backend persistence layer.

### 1.4 No state management beyond props and local state (LOW)
The app passes data through props and reads from `localStorage` on mount. For the current scale this works, but deeper pages like `WallBuilderPage` manage 7 `useState` hooks with interrelated logic. If the app grows, consider `useReducer` or React Context for shared project state.

### 1.5 Inline style objects at module scope (LOW)
**Files:** All page and component files
Styles are defined as plain JS objects at the bottom of each file. While functional, this approach:
- Cannot express pseudo-classes (`:hover`, `:focus`, `:active`)
- Cannot use media queries for responsive design
- Duplicates common patterns across files (button styles appear in 5+ files)

**Recommendation:** Consolidate shared styles via the existing `designTokens.js` pattern, or adopt CSS modules / a lightweight CSS-in-JS solution.

### 1.6 `designTokens.js` is incomplete (LOW)
**File:** `src/utils/designTokens.js`
Only 3 pages (`WallBuilderPage`, `ProjectPage`, and some components) use the shared tokens. `ProjectsPage.jsx` still hardcodes `#f0f2f5`, `#2C5F8A`, etc. directly. This creates a split where some files use tokens and others don't.

**Fix:** Migrate remaining hardcoded colors to use the shared tokens.

---

## 2. INPUT VALIDATION & ERROR HANDLING

### 2.1 calculator.js -- inconsistent error reporting (HIGH)
**File:** `src/utils/calculator.js`
- Returns `{ error: "..." }` on invalid dimensions (lines ~145-150)
- But throws on invalid wall profile type
- Downstream consumers (WallBuilderPage, epsOptimizer, etc.) do not consistently check for the error return

**Best practice:** Choose one pattern (return error objects OR throw) and apply it consistently. Consumers should always check.

### 2.2 No division-by-zero guard in h1Calculator (HIGH)
**File:** `src/utils/h1Calculator.js`
`computeWeightedR()` computes `sum(area / rValue)`. If any `rValue` is 0, this produces `Infinity`, silently corrupting the compliance result. For a building code compliance calculator, this is a critical correctness risk.

**Fix:** Validate `rValue > 0` before calculation, or throw a descriptive error.

### 2.3 WallForm validates but calculators don't (MEDIUM)
**File:** `src/components/WallForm.jsx:92-126`
The form validates wall dimensions and opening positions before calling `onCalculate`. This is good. However, the underlying `calculateWallLayout()`, `computeWallTimber()`, `epsOptimizer`, etc. perform little to no input validation. If these functions are ever called from outside the form (e.g., import, batch processing), invalid data flows through unchecked.

**Best practice:** Validate at system boundaries (UI form is good) AND at the calculation entry point. The "trust internal code" principle applies within a function, not across module boundaries.

### 2.4 Silent failures in storage.js (MEDIUM)
**File:** `src/utils/storage.js`
`readJson()` returns `null` on parse errors with no logging. Operations like `deleteWall` perform multi-step mutations (remove wall, update connections, update placements) without transaction-like guarantees. A failure mid-sequence leaves data inconsistent.

**Recommendation:** Add `console.warn` on parse failures. Consider a single `saveProject()` function that writes the entire project atomically.

### 2.5 `updateProjectDetails` allows overwriting protected fields (MEDIUM)
**File:** `src/utils/storage.js`
`Object.assign(p, fields)` allows callers to overwrite any field including `id` and `createdAt`.

**Fix:** Whitelist allowed fields:
```js
const ALLOWED_FIELDS = ['name', 'address', 'territorialAuthority'];
const safe = Object.fromEntries(
  Object.entries(fields).filter(([k]) => ALLOWED_FIELDS.includes(k))
);
Object.assign(p, safe);
```

### 2.6 projectExporter.js is browser-only with no guards (LOW)
**File:** `src/utils/projectExporter.js`
Uses `document.createElement('a')` to trigger downloads. Will crash if run in SSR or Node.js test environments. Guard with `typeof document !== 'undefined'`.

### 2.7 Empty `catch` blocks swallow errors (LOW)
**File:** `src/pages/WallBuilderPage.jsx:44,61`
```js
try { setTimberRatio(computeWallTimberRatio(wall)); } catch { setTimberRatio(null); }
```
This silently swallows calculation errors. At minimum, log the error for debugging.

---

## 3. CODE QUALITY & MAINTAINABILITY

### 3.1 `calculateWallLayout()` is 529 lines (HIGH)
**File:** `src/utils/calculator.js:144-673`
This function handles panel placement, opening layout, L-cuts, footers, lintels, end caps, multi-course splitting, deductions, and spline positioning -- all in a single function. This violates the Single Responsibility Principle and makes the function very difficult to test in isolation, review, or debug.

**Recommendation:** Extract named sub-functions:
- `placePanelsInSpan()` -- panel filling logic
- `layoutOpenings()` -- opening/lintel/footer placement
- `applyDeductions()` -- corner deduction handling
- `assignCourses()` -- multi-course splitting
- `computeSplines()` -- spline segment calculation

### 3.2 Duplicated bin-packing algorithm (HIGH)
**Files:** `src/utils/epsOptimizer.js`, `src/utils/magboardOptimizer.js`
Both files contain nearly identical `shelfPack()` functions (~60 lines each). This is a clear DRY violation.

**Fix:** Extract `shelfPack()` into a shared `src/utils/binPacking.js` module.

### 3.3 Duplicated EPS segment exclusion logic (MEDIUM)
**Files:** `src/utils/epsOptimizer.js`, `src/utils/glueCalculator.js`
Both files independently compute EPS segments by excluding opening zones. The logic is identical.

**Fix:** Export `getEpsSegments()` from a shared module or from `constants.js` (which already exports `buildHSplineSegments`).

### 3.4 String literals instead of constants for wall profiles (MEDIUM)
**File:** `src/utils/timberCalculator.js:261-263`
Uses `=== 'raked'` and `=== 'gable'` string comparisons instead of the imported `WALL_PROFILES` constants. This creates a fragile coupling -- if the profile string values ever change, this code would silently break.

**Fix:** Import and use `WALL_PROFILES.RAKED` / `WALL_PROFILES.GABLE`.

### 3.5 `PANEL_HEIGHTS` includes non-stocked value (MEDIUM)
**File:** `src/utils/constants.js:27`
```js
export const PANEL_HEIGHTS = [2440, 2745, 3050];
```
But `STOCK_SHEET_HEIGHTS = [2745, 3050]` and CLAUDE.md explicitly warns: "2440mm is NOT stocked." This contradiction could mislead future developers into using 2440mm in layout logic.

**Fix:** Add a comment to `PANEL_HEIGHTS` clarifying this is the set of nominal heights (not stock), or remove 2440 if it's truly not used.

### 3.6 Magic numbers in geometry code (LOW)
**File:** `src/utils/polygonUtils.js`
Epsilon value `1e-10` appears in multiple places without a named constant. Similarly, `src/utils/glueCalculator.js` redefines `SPLINE_WIDTH = 146` locally instead of importing it from `constants.js`.

### 3.7 Large component files (LOW)
Several visualization components exceed 500+ lines: `FramingElevation.jsx`, `EpsElevation.jsx`, `ModelViewer3D.jsx`, `WallDrawing.jsx`. Extract reusable SVG/Three.js primitives into smaller sub-components.

---

## 4. TESTING

### 4.1 Strong unit test coverage on core logic (POSITIVE)
The calculation engine has excellent test coverage:
- `calculator.test.js` (884 lines, ~45 test cases) -- single/multi-course, raked, gable, openings
- `h1Calculator.test.js` (306 lines) -- thermal compliance across climate zones
- `timberCalculator.test.js` (404 lines) -- plate splitting, timber ratios
- `magboardOptimizer.test.js` (400 lines) -- sheet extraction and optimization
- `wallSnap.test.js` (462 lines) -- 3D positioning and connection validation

### 4.2 Standalone integration tests are valuable (POSITIVE)
Root-level `test-*.mjs` files test real-world scenarios (gable peaks, per-panel sheet heights, multi-course rendering). These serve as excellent regression tests for complex geometric edge cases.

### 4.3 No negative/invalid input tests (MEDIUM)
**Files:** All `*.test.js`
Tests assume valid input. There are no tests for:
- Negative dimensions, NaN values, zero-length walls
- Missing required properties
- Openings that overlap each other
- Walls smaller than a single panel

**Best practice:** Add a `describe('invalid input')` block to each test file covering boundary conditions and error cases.

### 4.4 No component tests (MEDIUM)
No React Testing Library or similar component tests. The visualization components (`WallDrawing`, `FramingElevation`, `EpsElevation`) contain significant rendering logic that is untested.

**Recommendation:** At minimum, test that components render without crashing given valid layout data (smoke tests).

### 4.5 No E2E tests (MEDIUM)
No Playwright or Cypress tests. The full user flow (create project -> add wall -> generate drawing -> export DXF) is only tested manually.

### 4.6 DXF export tests are shallow (LOW)
**File:** `src/utils/projectExporter.test.js`
Tests only check that DXF output is a non-empty string. No validation of DXF structure or content correctness.

### 4.7 No CI/CD pipeline (MEDIUM)
No `.github/workflows/`, no CI configuration. Tests and lint are not enforced on pull requests.

**Fix:** Add a GitHub Actions workflow:
```yaml
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

---

## 5. SECURITY & CONFIGURATION

### 5.1 No XSS risk in current architecture (POSITIVE)
React's JSX escaping prevents XSS by default. The app uses no `dangerouslySetInnerHTML`. DXF export generates text files, not HTML. localStorage is origin-scoped and not accessible cross-origin.

### 5.2 `.gitignore` covers essentials (POSITIVE)
Ignores `node_modules/`, `.env`, `.env.local`, editor files, and OS files. This is good.

### 5.3 Unencrypted project data in localStorage (LOW)
All project data (dimensions, addresses, territorial authorities) is stored in plaintext in localStorage. Any JavaScript running on the same origin can read it. For a professional tool handling property data, consider encrypting sensitive fields.

### 5.4 No Content Security Policy (LOW)
**File:** `index.html`
No CSP meta tag. For a Vite SPA, adding a strict CSP would prevent accidental script injection:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
```

### 5.5 `crypto.randomUUID()` for IDs (POSITIVE)
**File:** `src/components/WallForm.jsx:51`
Uses the browser's `crypto.randomUUID()` for generating unique IDs -- good practice, no homegrown UUID generation.

---

## 6. PERFORMANCE

### 6.1 Lazy loading with route-based splitting (POSITIVE)
All pages use `React.lazy()` + `Suspense`. Three.js and heavy visualization code is only loaded when needed.

### 6.2 Calculation runs synchronously on main thread (LOW)
**File:** `src/pages/WallBuilderPage.jsx:56`
`calculateWallLayout()` is called synchronously in the click handler. For complex walls (many openings, multi-course gable), this could block the UI. Consider using a Web Worker for heavy calculations.

### 6.3 No memoization of expensive renders (LOW)
Visualization components (`WallDrawing`, `FramingElevation`, `EpsElevation`) re-render when any parent state changes. Since these generate complex SVGs, wrapping them in `React.memo()` with a layout-comparison function would prevent unnecessary re-renders.

### 6.4 `getProjects()` called multiple times per render cycle (LOW)
**File:** `src/pages/ProjectPage.jsx:60,119`
`getProjects()` parses JSON from localStorage on every call. In `ProjectPage`, it's called in `refresh()` and again for `otherProjects` -- two localStorage reads + JSON parses for the same data.

---

## 7. DOCUMENTATION

### 7.1 CLAUDE.md is excellent (POSITIVE)
Comprehensive, well-organized, includes architecture overview, commands, key conventions, and lessons learned / anti-patterns. This is above industry standard.

### 7.2 Constants are well-documented (POSITIVE)
**File:** `src/utils/constants.js`
Every constant has a comment explaining its physical meaning and units. This is critical for a domain-specific engineering tool.

### 7.3 JSDoc on core functions (POSITIVE)
`calculator.js`, `constants.js`, and `h1Calculator.js` use JSDoc comments with `@param` and `@returns`. Not all files follow this pattern, but the most critical ones do.

### 7.4 No API/data model documentation (LOW)
The wall, floor, and project data shapes are implicit (defined by usage in `storage.js` and `WallForm.jsx`). A TypeScript migration or at least a `types.js` with JSDoc `@typedef` declarations would make the data contracts explicit.

---

## 8. DEPENDENCY MANAGEMENT

### 8.1 Modern, well-chosen dependencies (POSITIVE)
- React 19, Vite 7, Vitest 4 -- all current
- react-three-fiber for 3D (appropriate for the use case)
- dxf-writer for CAD export (lightweight, purpose-built)
- jszip for archive generation
- No unnecessary dependencies

### 8.2 TypeScript types installed but not used (LOW)
**File:** `package.json:27-28`
`@types/react` and `@types/react-dom` are in devDependencies, but the project uses `.jsx` not `.tsx`. These are harmless but unnecessary without TypeScript.

### 8.3 Consider TypeScript migration (LOW)
For a calculation-heavy engineering tool, TypeScript would catch unit mismatches, property access errors, and data shape violations at compile time. The wall/floor/opening data models would particularly benefit from type definitions.

---

## Summary: Priority Action Items

| Priority | Issue | Section | Effort |
|----------|-------|---------|--------|
| **P0** | Guard against division by zero in `computeWeightedR()` | 2.2 | 15 min |
| **P0** | Make `calculateWallLayout()` error handling consistent | 2.1 | 30 min |
| **P1** | Extract duplicate `shelfPack()` to shared module | 3.2 | 30 min |
| **P1** | Extract duplicate EPS segment logic | 3.3 | 30 min |
| **P1** | Add invalid-input test cases to all test files | 4.3 | 2 hr |
| **P1** | Add CI/CD pipeline (GitHub Actions) | 4.7 | 1 hr |
| **P1** | Whitelist fields in `updateProjectDetails` | 2.5 | 15 min |
| **P1** | Replace string literals with `WALL_PROFILES` constants | 3.4 | 15 min |
| **P2** | Break `calculateWallLayout()` into smaller functions | 3.1 | 4 hr |
| **P2** | Add component smoke tests | 4.4 | 2 hr |
| **P2** | Log errors instead of silently catching | 2.7 | 30 min |
| **P2** | Migrate remaining hardcoded colors to design tokens | 1.6 | 1 hr |
| **P2** | Clarify `PANEL_HEIGHTS` vs `STOCK_SHEET_HEIGHTS` | 3.5 | 10 min |
| **P3** | Consider IndexedDB or backend for data persistence | 1.3 | Large |
| **P3** | Add `React.memo()` to visualization components | 6.3 | 1 hr |
| **P3** | TypeScript migration | 8.3 | Large |
| **P3** | Extract large components into smaller modules | 3.7 | Ongoing |
