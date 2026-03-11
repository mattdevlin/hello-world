# DEVPRO Wall Builder

A React SPA for designing prefabricated SIP (Structural Insulated Panel) wall systems. Define walls with custom dimensions, openings, and profiles, and the app calculates panel layouts, generates elevation drawings (SVG + DXF), optimizes material usage, and estimates glue consumption. All data is stored in the browser via localStorage.

## Features

- **Wall profiles**: Standard (constant height), Raked (linear slope), Gable (peaked)
- **Openings**: Windows, doors, single/double garage doors with configurable positions and sizes
- **Multi-course walls**: Automatic panel stacking when height exceeds max stock sheet height (3050mm)
- **SVG elevation views**: External elevation, framing, EPS insulation layout, panel plans, EPS cut plans
- **3D viewer**: Three.js-based assembly view with wall connections and snap positioning
- **DXF export**: CAD-compatible 1:1 scale drawings for all elevation types
- **Project zip export**: Bundle all DXF files for every wall into a single zip
- **Material optimization**: EPS bin-packing, magboard sheet optimization, glue consumption estimation
- **Project management**: Multiple projects, wall copying, import/export as `.devpro` files
- **Print support**: A3-formatted printing for all drawing types

## Getting Started

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173` with hot module replacement.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run test` | Run all Vitest unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | Run ESLint |

Run a single test file:

```bash
npx vitest run src/utils/calculator.test.js
```

Run standalone integration tests:

```bash
node test-gable-lintel.mjs
node test-multicourse.mjs
```

## Project Structure

```
src/
├── pages/
│   ├── ProjectsPage.jsx        # Project list
│   ├── ProjectPage.jsx         # Wall list + 3D viewer
│   └── WallBuilderPage.jsx     # Wall editor + all elevations
│
├── components/
│   ├── WallForm.jsx            # Wall parameter input
│   ├── WallDrawing.jsx         # SVG external elevation
│   ├── FramingElevation.jsx    # Structural framing view
│   ├── EpsElevation.jsx        # EPS insulation layout
│   ├── PanelPlans.jsx          # Per-panel cutting plans
│   ├── EpsCutPlans.jsx         # EPS cut optimization
│   ├── ModelViewer3D.jsx       # Three.js 3D viewer
│   ├── Offcuts.jsx             # Waste tracking
│   └── ...                     # Summaries, buttons, managers
│
├── utils/
│   ├── calculator.js           # Core layout engine
│   ├── constants.js            # Dimensions, materials, colours
│   ├── storage.js              # localStorage persistence
│   ├── epsOptimizer.js         # EPS bin-packing
│   ├── magboardOptimizer.js    # Sheet optimization
│   ├── glueCalculator.js       # Glue consumption
│   ├── projectExporter.js      # Project zip export
│   ├── dxfExporter.js          # Shared DXF utilities
│   ├── externalElevationDxf.js # External elevation DXF
│   ├── framingElevationDxf.js  # Framing DXF
│   ├── epsElevationDxf.js      # EPS elevation DXF
│   ├── epsPlanDxf.js           # EPS cut plan DXF
│   ├── panelPlansDxf.js        # Panel plan DXF
│   ├── floorPlan.js            # 3D floor plan utilities
│   ├── wallSnap.js             # Wall snap positioning
│   └── *.test.js               # Unit tests
│
├── App.jsx                     # Router setup
├── main.jsx                    # Entry point
└── index.css                   # Global styles
```

Root-level `test-*.mjs` files are standalone integration tests run with `node`.

## Routing

| Route | Page |
|-------|------|
| `/` | Project list |
| `/project/:projectId` | Wall list, 3D viewer, material summaries |
| `/project/:projectId/wall/:wallId` | Wall editor with all elevation views |
| `/project/:projectId/wall/new` | New wall creation |

## Core Concepts

### Dimensions

All measurements throughout the codebase are in **millimeters**.

### Panel System

- **Panel pitch**: 1205mm (1200mm panel + 5mm gap)
- **Stock sheet heights**: 2745mm and 3050mm
- **EPS**: 142mm thick for panels (4 slabs/block), 120mm for splines (5 slabs/block)
- **EPS slab size**: 4900 x 1220mm
- **Magboard**: 2 sheets per full panel (front + back)
- **Glue**: PU adhesive at 400 g/m², supplied in 200L drums

### Calculation Pipeline

`calculateWallLayout(wall)` in `calculator.js` is the central function. It takes a wall definition and returns panels, openings, footers, lintels, courses, end caps, deductions, and spline positions.

### DXF Export

All DXF output is 1:1 scale in mm. Y-axis is flipped from SVG (DXF: 0 = bottom, SVG: 0 = top). Five export types per wall: external elevation, framing, EPS elevation, EPS cut plans, and panel plans.

## Tech Stack

- **React 19** + **React Router 7**
- **Vite 7** (build + HMR)
- **Three.js** + **react-three-fiber** + **@react-three/drei** (3D)
- **dxf-writer** (CAD export)
- **jszip** (project archiving)
- **Vitest** (testing)
- **ESLint 9** (flat config)

## Data Storage

All data lives in browser `localStorage` under keys like `devpro-project-{id}`. Projects can be exported as `.devpro` files (zip archives containing JSON) for backup and sharing between machines.
