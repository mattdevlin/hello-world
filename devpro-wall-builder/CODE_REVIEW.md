# Code Review — DevPro Wall Builder

**Date:** 2026-03-13
**Scope:** Full codebase review against industry best practices
**Files reviewed:** 80+ source files (components, utilities, pages, exporters)

---

## Executive Summary

The DevPro Wall Builder is a well-structured React + Vite application with clear separation of concerns (pages, components, utils). However, this review identified **60+ issues** across security, correctness, performance, accessibility, and maintainability. The most impactful findings are grouped by severity below.

---

## CRITICAL — Bugs & Correctness Issues

### 1. Division by zero in H1 calculator
**File:** `src/utils/h1Calculator.js:29`
`computeWeightedR` computes `c.area / c.rValue` without guarding against `rValue === 0`. This produces `Infinity`, corrupting the weighted R-value result. Notably, `sumHeatLoss` (line 41) *does* guard against zero R-values — the two functions are inconsistent.

### 2. Empty-array `Math.min()` falsely passes compliance checks
**File:** `src/utils/h1Calculator.js:122,132,140,148`
`Math.min(...entries.filter(c => c.area > 0).map(c => c.rValue))` returns `Infinity` when the filtered array is empty. Since `Infinity >= minR` is always true, an empty set of constructions incorrectly passes the minimum R-value check.

### 3. Glue calculator uses wrong spline width (16% overstatement)
**File:** `src/utils/glueCalculator.js:126`
`splineEpsSA` uses `SPLINE_WIDTH` (146mm) but the actual EPS width inside a spline is `SPLINE_WIDTH - MAGBOARD * 2 = 126mm` (as correctly computed in `epsOptimizer.js:182`). This overstates spline glue area by ~16%.

### 4. Concave polygon clipping is semantically incorrect
**File:** `src/utils/polygonUtils.js:110-116`
For convex polygons, the code clips the rect to the polygon. For concave polygons, it swaps subject and clip, producing the polygon clipped to the rect instead. Sutherland-Hodgman requires a convex clip polygon. The `decomposeConvex` function exists but is never called here.

### 5. Floor EPS deductions silently wrong when `findIndex` returns -1
**File:** `src/utils/floorEpsDeductions.js:31-40`
`spanBreaks.findIndex(b => Math.abs(b - panel.y) < 1)` can return -1 due to floating-point mismatch. When this happens, both `bottom` and `top` deductions default to `splineDed`, applying incorrect deductions for perimeter panels.

### 6. Potential infinite loop in `computeSpanBreaks`
**File:** `src/utils/floorCalculator.js:366`
If `maxSpan - breaks[last]` never decreases (e.g., due to rounding or edge cases where `chosen` equals the previous break), this loop runs forever. No progress guard exists.

### 7. `buildHeightFn` division by zero for zero-length walls
**File:** `src/utils/calculator.js:31`
When `grossLen` is 0, `x / grossLen` produces `Infinity`/`NaN`. While a wall-length check exists at the caller level, `buildHeightFn` is a standalone function with no internal guard.

### 8. `Math.max()` on empty `availableSheets` returns `-Infinity`
**File:** `src/utils/calculator.js:60`
If `availableSheets` is empty, all subsequent sheet-fitting logic breaks silently.

### 9. Timber calculator doesn't check for layout errors
**File:** `src/utils/timberCalculator.js:53`
`calculateWallLayout` can return `{ error: ..., panels: [] }`, but `computeWallTimber` destructures the result without checking for errors, producing timber pieces with `NaN` lengths.

### 10. `effectiveWallArea` can go negative
**File:** `src/utils/timberCalculator.js:279`
If `openingArea > grossWallArea` (overlapping openings or bad input), `effectiveWallArea` is negative, producing a negative `timberPercentage`.

---

## HIGH — Security Vulnerabilities

### 11. Unsanitized project import data (XSS risk)
**File:** `src/utils/storage.js:313-400`
`importProject()` parses JSON from user-supplied `.devpro` ZIP files and stores string fields (`name`, `address`, `territorialAuthority`) directly into localStorage without sanitization. If these strings are later rendered unsafely, this is an XSS vector.

### 12. Prototype pollution via `Object.assign`
**File:** `src/utils/storage.js:86-94`
`updateProjectDetails` merges arbitrary `fields` into a project object via `Object.assign(p, fields)`. A caller could pass `{ __proto__: ... }` or overwrite the `id` field.

### 13. No zip bomb protection on import
**File:** `src/utils/storage.js:315`
`JSZip.loadAsync(file)` decompresses arbitrarily large files into memory. No file size check is performed before processing.

### 14. CSV injection in spreadsheet export
**File:** `src/utils/epsSpreadsheetExport.js:8-14`
`escapeCsv()` handles commas, quotes, and newlines, but doesn't defend against CSV injection. Wall names starting with `=`, `+`, `-`, or `@` will be interpreted as formulas by spreadsheet applications.

### 15. Filename sanitization only in one exporter
**File:** `src/utils/projectExporter.js:41`
Only `projectExporter.js` has a `sanitize()` function for filenames. All other DXF exporters (`epsElevationDxf.js:387`, `framingElevationDxf.js:413`, etc.) build filenames from unsanitized `projectName` and `wallName`.

---

## HIGH — React Anti-Patterns & Bugs

### 16. Stale `initialState` from props — 3 components affected
**Files:** `WallForm.jsx:28`, `FloorForm.jsx:22`, `H1Form.jsx:34`
`useState(initialWall || defaultWall)` only uses the initial prop on first render. If the parent passes a different prop (e.g., user loads a different wall), the form does not update. Fix: add a `useEffect` that resets state when the prop changes, or use a `key` prop on the component.

### 17. Index-based keys on dynamic lists
**Files:** `FloorForm.jsx:216,262,329,388,470`, `H1Form.jsx:140,155,172,193,207,248`
All `.map()` calls on lists that support add/remove use `key={i}`. This causes React reconciliation bugs — stale input values persist in wrong rows when items are removed from the middle.

### 18. GPU memory leak in ModelViewer3D
**File:** `src/components/ModelViewer3D.jsx:133-142, 230-238`
`THREE.ExtrudeGeometry` created via `useMemo` allocates GPU resources but is never `.dispose()`d on unmount or memo recomputation. This leaks GPU memory over time.

### 19. Stale closures in ModelViewer3D undo/redo
**File:** `src/components/ModelViewer3D.jsx:621-647`
`handleUndo` and `handleRedo` capture `placedWallIds`, `connections`, and `wallPositions` in their closure. Rapid undo/redo pushes stale snapshots. Should use functional state updaters.

### 20. Expensive inline computation re-runs every render
**File:** `src/components/WallDrawing.jsx:245-254`
Nested `for` loops iterate pixel by pixel (`for (let x = pLeft; x <= pRight; x += 1)`) during every render. For walls thousands of millimeters wide, this runs thousands of iterations per render. Should be memoized with `useMemo`.

---

## MEDIUM — Performance Issues

### 21. `calculateWallLayout` called for every wall on every change
**File:** `src/components/ModelViewer3D.jsx:549-556`
The `layouts` useMemo depends on `floorPlan`, which is a new array reference whenever anything changes. Every wall layout is recomputed even if only one wall moved.

### 22. `columnPositions.indexOf(col)` in nested loops
**File:** `src/utils/floorCalculator.js:559,589`
O(n) `indexOf` call per panel makes panel grid generation O(n*m). Should use loop index directly.

### 23. `getWallsForProject` called on every render
**File:** `src/components/ProjectManager.jsx:99-101`
When a non-active project is expanded, `getWallsForProject(p.id)` reads from localStorage on every render cycle. Should be memoized or cached.

### 24. Synchronous zip generation holds all DXF strings in memory
**File:** `src/utils/projectExporter.js:58-89`
All DXF strings are generated synchronously and held in memory simultaneously inside JSZip. For large projects (20+ walls), this could be significant.

---

## MEDIUM — Accessibility (a11y) Issues

### 25. ~50 form inputs lack proper label association
**Files:** `WallForm.jsx`, `FloorForm.jsx`, `H1Form.jsx`
`<label>` elements are siblings to `<input>` elements but not associated via `htmlFor`/`id`. Screen readers cannot associate labels with their inputs.

### 26. Clickable `<div>` elements without keyboard support
**File:** `src/components/ProjectManager.jsx:105,126,129,132-133,151`
Interactive `<div>` elements use `onClick` but lack `role="button"`, `tabIndex={0}`, and `onKeyDown` handlers. These are unreachable via keyboard navigation.

### 27. SVG drawings have no accessible alternatives
**File:** `src/components/WallDrawing.jsx`
The SVG wall drawing has no `role="img"`, `aria-label`, or `<desc>` element. Screen readers cannot convey the drawing's content.

### 28. Tables lack proper semantic markup
**File:** `src/components/H1Results.jsx:32-102`
Tables are missing `scope` attributes on `<th>` elements and `<caption>` elements for screen readers.

### 29. Low contrast text colors fail WCAG AA
**Files:** `src/utils/designTokens.js`, `src/App.jsx:17`
`NEUTRAL.textMuted` (`#888`) and `NEUTRAL.textFaint` (`#999`) both fail WCAG AA contrast requirements (4.5:1) against white backgrounds. The loading fallback `color: '#999'` has the same issue.

### 30. 3D viewer is not keyboard accessible
**File:** `src/components/ModelViewer3D.jsx:943`
The Canvas relies entirely on mouse interaction. No ARIA roles on the canvas element, and keyboard shortcuts only work in specific modes.

---

## MEDIUM — Code Duplication (DRY Violations)

### 31. `shelfPack` algorithm duplicated across two files
**Files:** `src/utils/epsOptimizer.js:227-293`, `src/utils/magboardOptimizer.js:202-261`
Identical bin-packing algorithm. Extract to a shared `shelfPack.js` utility.

### 32. EPS exclusion zone logic duplicated
**Files:** `src/utils/epsOptimizer.js:49-112`, `src/utils/glueCalculator.js:55-105`
Nearly identical exclusion zone construction logic.

### 33. `getEpsSegments` duplicated verbatim
**Files:** `src/utils/epsElevationDxf.js:90-115`, `src/utils/epsPlanDxf.js:52-77`
Identical segment-merging/clipping function.

### 34. `hAt` helper function duplicated in 4 DXF files
**Files:** `epsElevationDxf.js:33`, `framingElevationDxf.js:26`, `externalElevationDxf.js:25`, `combinedElevationDxf.js:45`
`const hAt = (x) => heightAt ? heightAt(x) : height;` — identical in all four files.

### 35. `HALF_SPLINE` constant redefined in 4 files
**Files:** `epsElevationDxf.js:13`, `epsPlanDxf.js:10`, `framingElevationDxf.js:14`, `panelPlansDxf.js:11`
`const HALF_SPLINE = SPLINE_WIDTH / 2;` defined identically in each.

### 36. Download blob pattern duplicated 4 times
**Files:** `dxfExporter.js`, `floorPlanDxf.js:63-72`, `epsSpreadsheetExport.js:30-40`, `projectExporter.js:96-103`
The create-blob/create-anchor/click/revoke pattern is reimplemented in each file. Should be a shared `downloadBlob(blob, filename)` utility.

### 37. Polygon-edge intersection pattern repeated ~7 times
**File:** `src/utils/floorCalculator.js`
The same intersection-finding pattern appears at lines 172-179, 186-191, 638-648, 680-688, 722-728, 769-775, 822-828.

### 38. Opening/lintel/footer drawing duplicated across 4 DXF files
**Files:** `epsElevationDxf.js`, `framingElevationDxf.js`, `externalElevationDxf.js`, `combinedElevationDxf.js`
Opening rectangles, lintel panels, and footer panels are drawn with nearly identical code in each file instead of calling shared helpers from `dxfExporter.js`.

---

## LOW — Error Handling Gaps

### 39. Zero error handling in entire DXF export pipeline
**Files:** All 13 DXF/export files
None of the `build*Dxf()` or `export*Dxf()` functions have try/catch. If `calculateWallLayout()` throws or returns malformed data, the error propagates as an unhandled exception.

### 40. ExportDxfButton has no try/catch
**File:** `src/components/ExportDxfButton.jsx:25-28`
Unlike `ExportProjectButton` which wraps exports in try/catch, this component has no error handling.

### 41. `alert()` used for error display
**File:** `src/components/ExportProjectButton.jsx:21`
`window.alert()` blocks the UI thread. Use an inline error state or toast notification instead.

### 42. ErrorBoundary bypasses React Router
**File:** `src/components/ErrorBoundary.jsx:26`
Direct `window.location.hash` mutation bypasses React Router's navigation, which may cause state inconsistencies. Should use the router's navigation method.

### 43. Missing floor data validation on import
**File:** `src/utils/storage.js:357-378`
Walls are validated via `validateWallData` and connections via `validateConnectionData`, but floor data passes through without any validation.

---

## LOW — Configuration & Tooling

### 44. Test environment set to `'node'` instead of `'jsdom'`
**File:** `vite.config.js:11`
The test environment is `'node'`, but the application uses `localStorage`, DOM APIs, and `URL.createObjectURL` extensively. Component/integration tests will fail or require manual mocking.

### 45. Conflicting `ecmaVersion` settings
**File:** `eslint.config.js:18,20`
`ecmaVersion: 2020` at `languageOptions` level is overridden by `ecmaVersion: 'latest'` in `parserOptions`. Remove the dead outer value.

### 46. Overly broad unused-vars ignore pattern
**File:** `eslint.config.js:26`
`varsIgnorePattern: '^[A-Z_]'` silently ignores unused imported components. Convention is `'^_'`.

### 47. `PANEL_PITCH` not derived from its constituent constants
**File:** `src/utils/constants.js:4`
Hardcoded to `1205` while `PANEL_WIDTH` is `1200` and `PANEL_GAP` is `5`. Should be `PANEL_WIDTH + PANEL_GAP`.

### 48. `SPLINE_WIDTH` magic number in `panelPlansDxf.js`
**File:** `src/utils/panelPlansDxf.js:10`
`const SPLINE_WIDTH = 146;` is a local magic number that duplicates the constant from `constants.js`. If the value changes in constants, this file will be out of sync.

---

## LOW — Miscellaneous

### 49. `isRaked` flag is misleading
**File:** `src/utils/calculator.js:155`
`isRaked` is `true` for both RAKED and GABLE profiles. The variable name is deceptive.

### 50. No-op array mapping
**File:** `src/utils/dxfExporter.js:72`
`pts.map(([x, y]) => [x, y])` maps `[x, y]` to itself — a no-op transformation.

### 51. `exportProjectZip` parameter ordering
**File:** `src/utils/projectExporter.js:52`
`floors = []` (optional with default) is placed after `onProgress` (required callback), forcing callers to pass `onProgress` even when they only want to specify floors.

### 52. Redundant vertex in pier profile
**File:** `src/utils/panelPlansDxf.js:105`
Third vertex `{ x: ovh, y: lLintel }` is identical to the first, creating a zero-length segment.

### 53. Unused parameter silently ignored
**File:** `src/utils/floorPlanDxf.js:63`
`floorName` is passed to `buildFloorPlanDxf` but the function signature doesn't accept it.

### 54. Variable shadowing with `p` in storage callbacks
**File:** `src/utils/storage.js:78,88,97,118,188,413`
`const p = projects.find(p => p.id === id)` — outer `p` shadows the callback parameter.

### 55. `combinedElevationDxf.js` imports `calculateWallLayout` (coupling concern)
**File:** `src/utils/combinedElevationDxf.js:8`
This DXF-rendering module imports the calculator, unlike all other DXF modules that accept pre-computed layouts.

---

## Recommended Priority Actions

### Immediate (fix before next release)
1. Fix division-by-zero in `h1Calculator.js` (#1, #2)
2. Fix glue calculator wrong spline width (#3)
3. Fix concave polygon clipping (#4)
4. Fix floor EPS deduction `findIndex` returning -1 (#5)
5. Add input sanitization for imported project data (#11, #12)
6. Add zip bomb protection (#13)

### Short-term (next sprint)
7. Fix stale `initialState` in forms (#16) — use `key` prop or `useEffect`
8. Replace index-based keys with stable IDs (#17)
9. Dispose THREE.js geometries on unmount (#18)
10. Memoize expensive computations in WallDrawing (#20)
11. Add try/catch to DXF export pipeline (#39, #40)
12. Fix CSV injection (#14) and filename sanitization (#15)

### Medium-term (backlog)
13. Extract shared utilities: `shelfPack`, `downloadBlob`, `getEpsSegments`, `hAt`, DXF drawing helpers (#31-38)
14. Add proper `htmlFor`/`id` to all form labels (#25)
15. Add keyboard support to interactive elements (#26, #30)
16. Switch test environment to `jsdom` (#44)
17. Add input validation to all public utility functions (#39)
18. Fix `PANEL_PITCH` derivation and eliminate magic numbers (#47, #48)
