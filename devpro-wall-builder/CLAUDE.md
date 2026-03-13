# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DEVPRO Wall Builder — a React SPA for designing prefabricated wall panel systems. Users define walls (dimensions, openings, profiles), and the app calculates panel layouts, generates elevation drawings (SVG + DXF), optimizes material usage (EPS blocks, magboard sheets), and estimates glue consumption. Data is stored in localStorage.

## Commands

- `npm run dev` — start Vite dev server with HMR
- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint (flat config, `eslint.config.js`)
- `npm run test` — run all Vitest tests (`vitest run`)
- `npm run test:watch` — run Vitest in watch mode
- `npx vitest run src/utils/calculator.test.js` — run a single test file
- `node test-gable-lintel.mjs` — run standalone integration test scripts (root-level `test-*.mjs` files)

## Architecture

### Routing & Pages
React Router with three routes:
- `/` → `ProjectsPage` — project list
- `/project/:projectId` → `ProjectPage` — wall list + 3D viewer for a project
- `/project/:projectId/wall/:wallId` → `WallBuilderPage` — main wall editor

### Core Calculation Pipeline
`src/utils/calculator.js` — `calculateWallLayout(wall)` is the central function. Takes a wall definition object and returns a complete layout: panels, openings, footers, lintel panels, courses, end caps, deductions, and spline positions. All dimensions are in millimeters.

Wall profiles: `STANDARD` (constant height), `RAKED` (linear slope left→right), `GABLE` (peak at configurable position). The `buildHeightFn(wall)` function creates a height-at-x function used throughout the layout.

Multi-course walls: when wall height exceeds max stock sheet height (3050mm), `computeCourses()` stacks multiple horizontal rows of sheets vertically, optimizing for minimal waste.

### Constants
`src/utils/constants.js` — all physical dimensions, material sizes, and colour definitions. Panel pitch is 1205mm (1200mm panel + 5mm gap). Stock sheet heights are 2745mm and 3050mm (2440mm is NOT stocked).

### Material Optimizers
- `epsOptimizer.js` — bin-packs EPS cut pieces into 4900×1220mm slabs (guillotine cuts). Tracks panel EPS (142mm thick, 4 slabs/block) and spline EPS (120mm thick, 5 slabs/block) separately.
- `magboardOptimizer.js` — optimizes magboard sheet usage. Full panels consume whole sheets (2 per panel, front+back). Smaller pieces (lintels, footers, splines) are bin-packed onto shared sheets.
- `glueCalculator.js` — computes PU glue consumption across all walls (400 g/m², 200L drums).

### Visualization Components
- `WallDrawing.jsx` — main SVG elevation view of a single wall
- `FramingElevation.jsx` — framing/structural elevation view
- `EpsElevation.jsx` — EPS insulation layout view
- `PanelPlans.jsx` — per-panel cut plans
- `EpsCutPlans.jsx` — EPS cutting layouts
- `Offcuts.jsx` — offcut/waste tracking
- `ModelViewer3D.jsx` — Three.js 3D viewer (react-three-fiber)

### DXF Export
Each elevation type has a corresponding DXF generator in `src/utils/`:
- `externalElevationDxf.js`, `framingElevationDxf.js`, `epsElevationDxf.js`, `epsPlanDxf.js`, `panelPlansDxf.js`
- `dxfExporter.js` — shared utilities. All DXF output is 1:1 scale in mm. Y-axis is flipped from SVG (DXF: 0=bottom, SVG: 0=top).

### Storage
`src/utils/storage.js` — localStorage-based persistence. Projects and walls are stored with keys like `devpro-project-{id}`.

## Key Conventions

- All measurements are in millimeters throughout the codebase.
- ESLint rule: unused vars are errors, except those starting with uppercase or underscore (`varsIgnorePattern: '^[A-Z_]'`).
- Root-level `test-*.mjs` files are standalone integration/smoke tests that import calculator functions directly and run with `node`.
- Unit tests use Vitest and live alongside source files as `*.test.js`.

## Lessons Learned & Anti-Patterns
- **Stock Constraints:** Claude previously suggested 2440mm sheets. **Correction:** We ONLY stock 2745mm and 3050mm. Reject any logic using 2440mm.
- **Y-Axis Flip:** When writing DXF export logic, remember: DXF 0 is bottom, SVG 0 is top. Claude often forgets to flip the Y-coordinates.
- **Spline Tolerance:** Always maintain the 5mm gap in panel pitch (1205mm). Do not calculate panels as flush 1200mm units.
