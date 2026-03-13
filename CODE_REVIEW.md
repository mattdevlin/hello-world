# Code Review: devpro-wall-builder

**Date:** 2026-03-13
**Scope:** Full codebase review against industry best practices
**Files reviewed:** 69 source files (33 components, 6 pages, 28 utilities, 9 test files)

---

## Executive Summary

The devpro-wall-builder is a well-structured React SPA for designing prefabricated SIP wall/floor systems. The core calculation engine is solid with good test coverage on critical paths. However, the review identified **62 issues** across security, correctness, performance, accessibility, testing, and maintainability.

**By severity:**
- Critical: 4 (division by zero, infinite loop risks)
- High: 12 (code duplication, missing test coverage, security gaps)
- Medium: 22 (React anti-patterns, accessibility, missing validation)
- Low: 24 (naming, magic numbers, style patterns)

---

## 1. Critical Bugs

### 1.1 Division by Zero in DXF Course Join Lines
**Files:** `externalElevationDxf.js:189-190`, `combinedElevationDxf.js:189-190`
**Issue:** Course join line calculation divides by `(hR - hL)` without checking if left and right heights are equal (flat section of a raked wall).
**Impact:** NaN propagates to DXF coordinates, producing corrupt CAD output.
**Fix:** Guard with `if (Math.abs(hR - hL) < 0.001)` fallback.

### 1.2 Infinite Loop in computeCourses with Invalid Input
**File:** `calculator.js:89-97`
**Issue:** `while (remaining > maxSheet)` loop has no iteration guard. If `availableSheets` contains only zero or negative values, `maxSheet <= 0` and the loop never terminates.
**Fix:** Already partially addressed (empty array guard added), but should also validate `maxSheet > 0`.

### 1.3 Math.min/max on Empty Spread Arrays
**File:** `h1Calculator.js` (previously at lines 122, 132, 140, 148)
**Issue:** `Math.min(...[])` returns `Infinity`, which silently passes minimum R-value checks.
**Status:** Fixed — `safeMinRValue()` helper now guards this.

### 1.4 computeWeightedR Division by Zero
**File:** `h1Calculator.js:25-36`
**Issue:** If all constructions have `rValue <= 0`, `totalHeatLoss` is 0, causing `totalArea / 0 = Infinity`.
**Status:** Fixed — guard added for `totalHeatLoss === 0`.

---

## 2. Security

### 2.1 Prototype Pollution via Object.assign ✅ Fixed
**File:** `storage.js:88-98`
**Status:** Fixed — now uses allowlist (`ALLOWED_PROJECT_FIELDS`).

### 2.2 Zip Bomb / Large File Import ✅ Fixed
**File:** `storage.js:319-324`
**Status:** Fixed — 50MB limit enforced before loading.

### 2.3 CSV Formula Injection ✅ Fixed
**File:** `epsSpreadsheetExport.js:8-17`
**Status:** Fixed — formula-triggering characters prefixed with `'`.

### 2.4 Imported Data Sanitization ✅ Fixed
**File:** `storage.js:28-31, 341-343`
**Status:** Fixed — `sanitizeString()` strips `<>` and enforces max length.

### 2.5 Missing Floor Validation on Import ✅ Fixed
**File:** `storage.js:313-317`
**Status:** Fixed — `validateFloorData()` checks polygon structure.

### 2.6 DXF Filename Sanitization ✅ Fixed
**Files:** `dxfExporter.js`, `epsElevationDxf.js`, `epsPlanDxf.js`, `framingElevationDxf.js`, `panelPlansDxf.js`
**Status:** Fixed — `sanitize()` helper strips dangerous filename characters.

### 2.7 Remaining: storage.js exportProject Filename
**File:** `storage.js:296`
**Issue:** Uses aggressive `[^a-zA-Z0-9_-]` regex that strips unicode characters. Should use the same `sanitize()` function as DXF exporters for consistency.

---

## 3. Code Duplication (High Impact)

### 3.1 EPS Segment Extraction — 5 Copies
**Files:** `epsOptimizer.js`, `glueCalculator.js`, `epsElevationDxf.js`, `epsPlanDxf.js`, `framingElevationDxf.js`
**Issue:** Identical logic for building exclusion zones, clipping intervals, merging overlaps, and computing EPS segments with gaps. Any bug fix must be applied 5 times.
**Recommendation:** Extract to shared `buildExclusionZones(layout)` and `getEpsSegments(panelLeft, panelRight, exclusions)` utilities.

### 3.2 Exclusion Zone Building — 5 Copies
**Files:** Same as above.
**Issue:** ~30 lines of identical code in each file builds `[eL, eR]` ranges from panels, openings, lintel panels, footer panels, and deductions.

### 3.3 DXF Layer Setup — 2 Copies
**Files:** `dxfExporter.js:24-32`, `combinedElevationDxf.js:14-33`
**Issue:** Duplicate `LAYERS` object and `createDrawing()` function.

### 3.4 Course Join Line Computation — 2 Copies
**Files:** `externalElevationDxf.js:146-175`, `combinedElevationDxf.js:172-201`
**Issue:** Identical geometry for finding where wall height intersects course boundaries.

### 3.5 Duplicated Constants
**Issue:** `SPLINE_WIDTH`, `PANEL_EPS_DEPTH`, `SPLINE_EPS_DEPTH` re-declared in:
- `constants.js` (canonical)
- `epsOptimizer.js:25-28`
- `panelPlansDxf.js:10-11`
- `glueCalculator.js:16-18`

**Recommendation:** Import from `constants.js` everywhere. Add missing constants (`PANEL_EPS_DEPTH`, `SPLINE_EPS_DEPTH`) to `constants.js`.

---

## 4. React Anti-Patterns

### 4.1 Props as Initial State Without Sync
**Files:** `WallForm.jsx:28`, `FloorForm.jsx:22`, `H1Form.jsx:34`
**Issue:** `useState(initialProp || default)` captures prop value at mount time only. If the parent changes the prop without unmounting, state goes stale.
**Mitigation:** Parent pages use `key={loadKey}` to force remount — this works but is fragile. If any code path changes the prop without updating `loadKey`, the bug surfaces.

### 4.2 Index-Based Keys in Dynamic Lists
**Files:** `FloorForm.jsx:214,260,327,386`, `FloorSummary.jsx:107`, `EpsCutPlans.jsx:279,297`, `FloorEpsCutPlans.jsx:32,43`, `FloorOffcuts.jsx:30`, `Offcuts.jsx:260,273`
**Issue:** Using array index as `key` for lists where items can be added/removed/reordered. React may reuse wrong component instances, causing state corruption or rendering bugs.
**Fix:** Use stable identifiers (e.g., `crypto.randomUUID()` assigned at creation time).

### 4.3 Inline Style Objects on Every Render
**Scope:** Pervasive across nearly all components.
**Issue:** `style={{ marginTop: 16 }}` creates a new object reference every render, defeating React's shallow comparison. When passed as props to child components, this causes unnecessary re-renders.
**Recommendation:** Extract to module-level `const styles = { ... }` objects (some components already do this — standardize the pattern).

### 4.4 Missing useMemo for Expensive Computations
**Files:**
- `FloorEpsPlan.jsx:38-76` — inset polygon offset calculation (geometry) recalculates every render
- `FloorPlanView.jsx:34-65` — fallback spanBreaks/columnPositions computation
- `FloorPlanView.jsx:76-78`, `FloorFramingPlan.jsx:37-38` — `tx`/`ty` transform functions recreated every render
- `EpsElevation.jsx` — complex SVG rendering with extensive calculations

### 4.5 Missing ErrorBoundary Coverage
**Issue:** Only `FloorBuilderPage` wraps visualization components in `ErrorBoundary`. Missing from:
- `WallBuilderPage` — WallDrawing, FramingElevation, EpsElevation
- `ProjectPage` — ModelViewer3D (Three.js, failure-prone)

### 4.6 Stale Closure in FloorForm removePoint ✅ Fixed
**File:** `FloorForm.jsx`
**Status:** Fixed — uses functional update to access latest state.

---

## 5. Accessibility

### 5.1 Form Labels Not Associated with Inputs
**Files:** `FloorForm.jsx`, `WallForm.jsx`, `H1Form.jsx`
**Issue:** `<label>` elements use inline text but lack `htmlFor` attribute linking to input `id`. Screen readers cannot associate labels with their inputs.

### 5.2 Interactive Elements Without Keyboard Support
**File:** `ProjectManager.jsx` (partially fixed)
**Issue:** Clickable `<div>` and `<span>` elements used as buttons without `role="button"`, `tabIndex`, or `onKeyDown` handlers.
**Status:** Partially fixed — some elements now have keyboard support.

### 5.3 SVG Visualizations Lack Accessible Names ✅ Partially Fixed
**File:** `WallDrawing.jsx` — now has `role="img"` and `aria-label`.
**Remaining:** `FloorPlanView.jsx`, `FloorFramingPlan.jsx`, `FloorEpsPlan.jsx`, `EpsElevation.jsx` SVGs still lack accessible names.

### 5.4 Color Contrast ✅ Fixed
**File:** `designTokens.js`
**Status:** Fixed — text colors now meet WCAG AA contrast ratios.

### 5.5 Progress Indicator Semantics
**File:** `GlueSummary.jsx:87-88`
**Issue:** Uses `<div role="progressbar">` — should use native `<progress>` element or ensure all required ARIA attributes (`aria-valuetext`) are present.

---

## 6. Testing Gaps

### 6.1 Coverage Summary

| Category | Files | Tested | Coverage |
|----------|-------|--------|----------|
| Core calculators | 5 | 4 | ~75% |
| Material optimizers | 3 | 1 | ~33% |
| DXF exporters | 11 | 0 | 0% |
| Storage/data | 3 | 0 | 0% |
| Geometry utils | 2 | 2 | ~60% |
| Floor-specific utils | 3 | 1 | ~33% |
| **Total** | **28** | **9** | **~40%** |

### 6.2 Critical Untested Modules

1. **epsOptimizer.js** (450 lines) — Bin-packing shelf algorithm with rotation, slab slicing, wastage calculation. Zero tests for correctness of material optimization.
2. **glueCalculator.js** (280 lines) — Area exclusion merging, multi-course aggregation. Zero tests.
3. **storage.js** (360 lines) — localStorage CRUD, project/wall lifecycle, import/export. Zero unit tests (only integration via projectExporter mocks).
4. **11 DXF exporters** — No validation of output format, coordinate systems, or layer structure.

### 6.3 Missing Edge Case Tests

| Module | Missing Edge Cases |
|--------|--------------------|
| calculator.js | Negative deductions, zero-length walls, peak at wall edge |
| floorCalculator.js | Self-intersecting polygons, single-point polygon, dir≠0/90 |
| polygonUtils.js | Degenerate polygons (collinear points), self-intersecting shapes |
| h1Calculator.js | All R-values zero, missing element types |
| wallSnap.js | Invalid angles (not 0/90/180/270), orphan connections |

### 6.4 Missing Test Patterns
- **No integration tests** in Vitest (standalone `.mjs` files exist but aren't in CI)
- **No snapshot tests** for DXF output or report formatting
- **No shared test fixtures** — each test file has inline helpers
- **projectExporter.test.js** heavily mocked — doesn't test real ZIP creation

---

## 7. Error Handling

### 7.1 Silent Error Returns
**Pattern:** Many functions return `{ error: string }` objects that callers must check.
**Risk:** Easy to miss — no TypeScript to enforce checking.
**Files:** `calculateWallLayout`, `calculateFloorLayout`, `checkH1Compliance`

### 7.2 Missing try/catch in Export Functions ✅ Partially Fixed
**Status:** `ExportDxfButton` now has error handling. Still missing in some CSV export paths.

### 7.3 DXF Export Failures Not Surfaced
**Issue:** If `dxf-writer` throws during entity creation, errors are uncaught and the browser shows a blank/corrupt download with no user feedback.

### 7.4 localStorage Quota Handling
**File:** `storage.js:46`
**Issue:** `QuotaExceededError` is caught and re-thrown with a user message, but no component displays this to the user. The error bubbles up silently.

---

## 8. Performance

### 8.1 O(n) indexOf in Hot Loop ✅ Fixed
**File:** `floorCalculator.js`
**Status:** Fixed — `columnPositions.indexOf(col)` replaced with direct index variable.

### 8.2 Repeated Layout Calculations
**File:** `WallBuilderPage.jsx`
**Issue:** `calculateWallLayout(wall)` is called in the page, but some child components (e.g., export buttons) call it again independently. The layout should be computed once and passed down.

### 8.3 Large Component Re-renders
**File:** `EpsElevation.jsx` (~60KB)
**Issue:** Massive single component with complex SVG rendering. Any state change triggers full re-render of all SVG elements. Should be split into memoized sub-components.

### 8.4 FloorForm Deep State Updates
**File:** `FloorForm.jsx`
**Issue:** Every field change creates a new `floor` object via spread, triggering re-render of the entire form including all polygon/opening/recess sub-sections. Should split into sub-components with their own state.

---

## 9. Architecture & Maintainability

### 9.1 Large Files That Should Be Split

| File | Lines | Recommendation |
|------|-------|----------------|
| EpsElevation.jsx | ~1500+ | Split into EpsCanvas, PanelRenderer, SplineRenderer, DimensionRenderer |
| FloorForm.jsx | ~616 | Split into PolygonSection, BearerSection, OpeningsSection, RecessSection |
| calculator.js | ~680 | Already well-structured, but multi-course logic could be extracted |
| floorCalculator.js | ~860 | Split generateSplines and generateShortEdgeJoins into separate modules |

### 9.2 Coordinate System Confusion
**Issue:** DXF uses Y=0 at bottom (positive up), SVG uses Y=0 at top (positive down). Multiple files have manual Y-flipping with no shared helper.
**Recommendation:** Create `coordUtils.js` with `svgToDxf(y, maxY)` and `dxfToSvg(y, maxY)` helpers.

### 9.3 Magic Numbers
**Files:** `framingElevationDxf.js:47`, `dxfExporter.js:53`, `panelPlansDxf.js:10-11`, `polygonUtils.js:90,131`
**Issue:** Hardcoded values like `Math.max(20, Math.round(grossLength / 100))`, tolerance `1e-10`, etc. without named constants.
**Fix:** Extract to named constants (e.g., `GEOMETRY_EPSILON`, `DXF_CURVE_STEPS_RATIO`).

### 9.4 Naming Inconsistency
- `heightAt` (calculator.js) vs `hAt` (DXF exporters) for the same concept
- `deductionLeft` vs `dedLeft` within calculator.js
- `grossLength` (layout property) vs `length_mm` (wall input property)

---

## 10. Configuration & Tooling

### 10.1 No CI/CD Pipeline
**Issue:** No GitHub Actions, GitLab CI, or similar. Tests only run manually.
**Recommendation:** Add workflow that runs `npm test` and `npm run lint` on PRs.

### 10.2 Test Environment Mismatch
**File:** `vite.config.js:11`
**Issue:** Test environment is `node` but some tests (projectExporter.test.js) reference `global` (Node global) and would need `jsdom` for DOM-dependent code. Currently, no DOM-dependent utilities are tested.

### 10.3 Standalone Integration Tests Not in CI
**Files:** `test-3d-layout.mjs`, `test-gable-lintel.mjs`, etc.
**Issue:** 6 standalone test scripts run via `node test-*.mjs` but are excluded from `npm test` and coverage reporting. They should be migrated to Vitest or added to a CI script.

### 10.4 PANEL_PITCH Derived from Constants ✅ Fixed
**File:** `constants.js:4`
**Status:** Fixed — `PANEL_PITCH = PANEL_WIDTH + PANEL_GAP` instead of hardcoded `1205`.

---

## Recommendations Summary (Priority Order)

### P0 — Fix Now
1. Guard division by zero in `externalElevationDxf.js:189` and `combinedElevationDxf.js:189`
2. Validate `maxSheet > 0` in `computeCourses` after the empty-array guard

### P1 — High Priority
3. Extract shared `buildExclusionZones()` and `getEpsSegments()` utilities (eliminates 5x duplication)
4. Centralize duplicated constants to `constants.js`
5. Add tests for `epsOptimizer.js`, `glueCalculator.js`, and `storage.js`
6. Wrap WallBuilderPage and ProjectPage visualizations with ErrorBoundary

### P2 — Medium Priority
7. Replace index-based keys with stable IDs in FloorForm and list components
8. Extract inline styles to module-level constants across all components
9. Add `htmlFor`/`id` associations to form labels
10. Add useMemo for expensive geometry calculations in floor visualization components
11. Split EpsElevation.jsx and FloorForm.jsx into smaller components
12. Add CI pipeline with test + lint gates

### P3 — Low Priority
13. Standardize naming conventions (heightAt vs hAt, etc.)
14. Extract magic numbers to named constants
15. Create coordinate conversion helpers for DXF/SVG
16. Add snapshot tests for DXF output format
17. Migrate standalone test-*.mjs files into Vitest suite
