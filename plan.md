# Wall Snapping Feature — Implementation Plan

## Overview

Replace the fixed rectangular floor plan (`computeFloorPlan`) with a flexible graph-based layout where walls snap to the ends of other walls at 90-degree increments. Users select a wall in the 3D viewer, then attach other walls to either end, choosing orientation (0/90/180/270 degrees). Deductions determine the exact snap point along the wall's length.

---

## Data Model

### New: `FloorPlanConnection` (persisted per-project in storage)

```js
{
  connections: [
    {
      id: "conn-1",
      wallId: "wall-A",          // the wall being snapped TO (anchor)
      anchorEnd: "left" | "right", // which end of wallId
      attachedWallId: "wall-B",  // the wall being attached
      attachedEnd: "left" | "right", // which end of wall-B connects
      angleDeg: 0 | 90 | 180 | 270  // rotation of attached wall relative to anchor wall's direction
    }
  ]
}
```

Deductions are already on each wall (`deduction_left_mm`, `deduction_right_mm`). The snap point for a wall's "left" end = `deduction_left_mm` inset from the geometric left edge. Similarly for "right" = `deduction_right_mm` inset from the geometric right edge.

---

## Step-by-step Plan

### Step 1: Fix existing bugs found in review

**Files:** `src/utils/calculator.js`

- Fix `grossLen` → `grossLength` on lines 176 and 408 (ReferenceError for gable walls with openings).

This is a prerequisite — gable walls crash without it, and the snapping feature must work with all wall profiles.

---

### Step 2: Create `src/utils/wallSnap.js` — core snap geometry engine

Pure functions, no React dependency, fully testable.

**Functions:**

1. **`computeWallEndpoint(wall, end)`** → `{ x_mm, z_mm }`
   - For a wall positioned at origin facing along +X: left end is at `x = deduction_left_mm`, right end is at `x = wall.length_mm - deduction_right_mm`.
   - Returns the snap point in local wall coordinates.

2. **`computeSnapPosition(anchorWall, anchorEnd, anchorPos, anchorAngleRad, attachedWall, attachedEnd, angleDeg)`** → `{ position: {x,y,z}, rotation: {x,y,z} }`
   - Given the anchor wall's world position/rotation and which end to snap to, compute the world position and rotation of the attached wall.
   - The anchor's snap point = anchor wall center + offset to the specified end (accounting for deduction), transformed by the anchor's world rotation.
   - The attached wall is then positioned so that its specified end aligns with that snap point, rotated by `angleDeg` relative to the anchor wall's facing direction.
   - Wall thickness offset: the attached wall is offset by `WALL_THICKNESS / 2` perpendicular to the anchor wall's face so that the surfaces butt cleanly.

3. **`resolveFloorPlanLayout(walls, connections)`** → `Array<{ wall, position: {x,y,z}, rotation: {x,y,z}, dimensions: {length, height, thickness} }>`
   - Takes all walls and the connections array. Places the first wall at origin (or uses the first wall with no incoming connections as the "root").
   - Walks the connection graph (BFS/DFS) calling `computeSnapPosition` for each connected wall.
   - Walls with no connections are placed at origin (single-wall fallback, same as current behavior).
   - Returns the same shape as current `computeFloorPlan` output so `ModelViewer3D` needs minimal changes.

4. **`validateConnections(walls, connections)`** → `Array<{ type, message, connectionId? }>`
   - Checks for: duplicate connections on same endpoint, circular references, missing wall IDs, walls connected to themselves.

---

### Step 3: Create `src/utils/wallSnap.test.js` — comprehensive unit tests

**Test cases:**

**`computeWallEndpoint`:**
- Wall with no deductions → endpoints at 0 and length_mm
- Wall with left deduction → left endpoint shifted inward
- Wall with right deduction → right endpoint shifted inward
- Wall with both deductions

**`computeSnapPosition`:**
- Snap wall-B's left end to wall-A's right end at 90° → verify position and rotation
- Snap at 0° (inline/continuation) → walls extend in same direction
- Snap at 180° (U-turn) → wall doubles back
- Snap at 270° (left turn) → perpendicular other direction
- Snap with deductions on both walls → verify offsets are correct
- Snap right-to-right (both walls' right ends meet) → verify orientation flips correctly
- Different wall heights → verify Y positioning is independent (each wall centered on its own height)

**`resolveFloorPlanLayout`:**
- No connections → each wall at origin (backward compat with single-wall)
- Linear chain: A→B→C → verify positions cascade correctly
- L-shape: A→B at 90° → verify classic corner
- Rectangle: 4 walls, 4 connections at 90° each → verify it closes (gap validation)
- T-junction: A has B on right end and C on left end → both placed correctly
- Disconnected walls: some connected, some standalone

**`validateConnections`:**
- Valid connections → no errors
- Wall connected to itself → error
- Same endpoint used twice → error
- Missing wall ID → error

---

### Step 4: Update `src/utils/floorPlan.js`

- Keep `computeFloorPlan` as-is for backward compatibility (projects without connections).
- Add a new export: `computeFloorPlanFromConnections(walls, connections)` that delegates to `resolveFloorPlanLayout` from `wallSnap.js` and returns the same output shape.
- Update `computeFloorPlanCorners` and `validateCornerJoins` to work with the new arbitrary layout (or deprecate them — they assume a rectangle).

---

### Step 5: Update `src/utils/storage.js` — persist connections

- Add `getProjectConnections(projectId)` → reads from `devpro-project-{id}-connections` key.
- Add `saveProjectConnections(projectId, connections)` → writes to localStorage.
- When a wall is deleted (`deleteWall`), also remove any connections referencing that wall's ID.
- Include connections in `exportProject` / `importProject`.

---

### Step 6: Update `ModelViewer3D.jsx` — wall selection + snap UI

**Wall selection:**
- Add `selectedWallId` state.
- On click of a `WallMesh`, set it as selected (highlight with emissive color or outline).
- Show endpoint markers (small spheres/cones) at the left and right snap points of the selected wall.

**Snap controls (overlay panel):**
- When an endpoint marker is clicked, show a dropdown of available walls to attach.
- Show orientation picker (4 buttons: 0°, 90°, 180°, 270°) with visual arrow indicators.
- "Attach" button creates a connection and re-renders the layout.
- "Detach" button on existing connections to remove them.

**Rendering changes:**
- Switch from `computeFloorPlan(walls)` to `computeFloorPlanFromConnections(walls, connections)` when connections exist; fall back to `computeFloorPlan(walls)` when there are none.
- Pass `selectedWallId` and `onSelectWall` to `WallMesh`.
- Add `SnapPointMarker` sub-component (small sphere at each endpoint).

**Props change:**
- `ModelViewer3D` now also receives `connections` and `onConnectionsChange` (or manages connections via storage internally).

---

### Step 7: Update `ProjectPage.jsx` — wire up connections state

- Load connections from storage alongside walls.
- Pass `connections` and `onConnectionsChange` to `ModelViewer3D`.
- `onConnectionsChange` saves to storage and refreshes state.

---

### Step 8: Update scene bounds calculation

Replace the fragile `walls[0]`/`walls[1]` index-based bounds with a calculation derived from the resolved floor plan positions — iterate all placed walls and compute the bounding box from their world-space extents.

---

## File Change Summary

| File | Action |
|------|--------|
| `src/utils/calculator.js` | **Fix** `grossLen` bug (lines 176, 408) |
| `src/utils/wallSnap.js` | **New** — snap geometry engine |
| `src/utils/wallSnap.test.js` | **New** — unit tests |
| `src/utils/floorPlan.js` | **Update** — add `computeFloorPlanFromConnections` |
| `src/utils/storage.js` | **Update** — persist connections, clean up on wall delete |
| `src/components/ModelViewer3D.jsx` | **Update** — selection, snap UI, use new layout |
| `src/pages/ProjectPage.jsx` | **Update** — load/pass connections |

## Out of Scope (future work)

- Arbitrary angles (non-90° snapping)
- Collision detection between walls
- Auto-matching deductions when walls are connected
- 3D CSG for true opening cutouts
- Error boundary around Canvas (noted in review, separate concern)
