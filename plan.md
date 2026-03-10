# Fix: Dead ternary branches in EpsElevation.jsx lintel beam/EPS positioning

## Problem
Lines 557-562 and 567-568 of `EpsElevation.jsx` have ternaries on `hasSill` that produce identical results in both branches. The intent is to position the timber beam and EPS differently depending on whether the opening has splines (windows with sills) or just plates (doors to the floor).

From the existing exclusion logic (lines 66-78):
- **hasSill=true** (window): opening has both **plates** (45mm) and **splines** (146mm) on each side
- **hasSill=false** (door): opening has only **plates** (45mm) on each side

The beam/EPS should span to the outer structural edge. For windows with splines, that edge extends further out by `SPLINE_WIDTH`.

## Changes

### File: `devpro-wall-builder/src/components/EpsElevation.jsx`

**Step 1**: Fix `beamLeft` / `beamRight` (lines 557-562) — when `hasSill`, extend to spline outer edge:
```jsx
// Before (both branches identical):
const beamLeft = hasSill
  ? op.x - BOTTOM_PLATE + EPS_INSET
  : op.x - BOTTOM_PLATE + EPS_INSET;
const beamRight = hasSill
  ? op.x + op.drawWidth + BOTTOM_PLATE - EPS_INSET
  : op.x + op.drawWidth + BOTTOM_PLATE - EPS_INSET;

// After:
const beamLeft = hasSill
  ? op.x - BOTTOM_PLATE - SPLINE_WIDTH + EPS_INSET
  : op.x - BOTTOM_PLATE + EPS_INSET;
const beamRight = hasSill
  ? op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH - EPS_INSET
  : op.x + op.drawWidth + BOTTOM_PLATE - EPS_INSET;
```

**Step 2**: Fix `epsLeft` / `epsRight` (lines 567-568) to match:
```jsx
// Before:
const epsLeft = op.x - BOTTOM_PLATE + EPS_INSET;
const epsRight = op.x + op.drawWidth + BOTTOM_PLATE - EPS_INSET;

// After:
const epsLeft = hasSill
  ? op.x - BOTTOM_PLATE - SPLINE_WIDTH + EPS_INSET
  : op.x - BOTTOM_PLATE + EPS_INSET;
const epsRight = hasSill
  ? op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH - EPS_INSET
  : op.x + op.drawWidth + BOTTOM_PLATE - EPS_INSET;
```

This ensures windows (with splines) get a wider beam/EPS span than doors (plates only), matching how the rest of the codebase treats these two cases.
