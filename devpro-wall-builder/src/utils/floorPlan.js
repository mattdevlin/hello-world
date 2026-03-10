/**
 * Floor Plan Layout Utility
 *
 * Arranges project walls into a rectangular floor plan.
 * Walls are assigned to sides: front (south), right (east), back (north), left (west).
 *
 * Convention (top-down view, Y points into screen = "north"):
 *
 *       Back (Wall 3)
 *     ┌───────────────┐
 *     │               │
 *  L  │               │  R
 *  e  │               │  i
 *  f  │               │  g
 *  t  │               │  h
 *     │               │  t
 *  (4)│               │(2)
 *     │               │
 *     └───────────────┘
 *       Front (Wall 1)
 *
 * 3D coordinate system (Three.js default):
 *   X = left/right
 *   Y = up/down (height)
 *   Z = forward/backward (depth)
 *
 * The rectangle is centered at the origin.
 * Wall thickness = WALL_THICKNESS from constants.
 */

import { WALL_THICKNESS } from './constants.js';
import { resolveFloorPlanLayout, computeLayoutBounds } from './wallSnap.js';

/**
 * Compute the 3D position and rotation for each wall in a rectangular floor plan.
 *
 * @param {Array} walls - Array of wall input objects (with at least length_mm, height_mm)
 *                        Expected order: [front, right, back, left] (or fewer)
 * @returns {Array<{wall, position: {x,y,z}, rotation: {x,y,z}, dimensions: {length,height,thickness}}>}
 */
export function computeFloorPlan(walls) {
  if (!walls || walls.length === 0) return [];

  const t = WALL_THICKNESS; // 162mm
  const results = [];

  if (walls.length === 1) {
    // Single wall: center it along Z=0
    const w = walls[0];
    results.push({
      wall: w,
      side: 'front',
      position: { x: 0, y: w.height_mm / 2, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { length: w.length_mm, height: w.height_mm, thickness: t },
    });
    return results;
  }

  // For 2-4 walls, arrange as a rectangle.
  // Front wall (index 0) and back wall (index 2) run along X axis.
  // Right wall (index 1) and left wall (index 3) run along Z axis.
  //
  // Rectangle dimensions determined by wall lengths:
  //   Width (X) = front wall length (or back wall length — they should match)
  //   Depth (Z) = right wall length (or left wall length — they should match)

  const frontWall = walls[0];
  const rightWall = walls.length > 1 ? walls[1] : null;
  const backWall = walls.length > 2 ? walls[2] : null;
  const leftWall = walls.length > 3 ? walls[3] : null;

  // Use front wall length as the X dimension
  const rectWidth = frontWall.length_mm;
  // Use right wall (or left wall) length as the Z dimension
  const rectDepth = rightWall ? rightWall.length_mm : rectWidth;

  const halfW = rectWidth / 2;
  const halfD = rectDepth / 2;
  const halfT = t / 2;

  // Side definitions: each wall's center position and Y-rotation
  const sides = [
    {
      // Front wall: runs along X at Z = +halfD (near side)
      side: 'front',
      wall: frontWall,
      position: { x: 0, y: frontWall.height_mm / 2, z: halfD + halfT },
      rotation: { x: 0, y: 0, z: 0 },
    },
    {
      // Right wall: runs along Z at X = +halfW
      side: 'right',
      wall: rightWall,
      position: { x: halfW + halfT, y: rightWall?.height_mm / 2, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
    },
    {
      // Back wall: runs along X at Z = -halfD (far side), rotated 180
      side: 'back',
      wall: backWall,
      position: { x: 0, y: backWall?.height_mm / 2, z: -(halfD + halfT) },
      rotation: { x: 0, y: Math.PI, z: 0 },
    },
    {
      // Left wall: runs along Z at X = -halfW
      side: 'left',
      wall: leftWall,
      position: { x: -(halfW + halfT), y: leftWall?.height_mm / 2, z: 0 },
      rotation: { x: 0, y: -Math.PI / 2, z: 0 },
    },
  ];

  for (const s of sides) {
    if (!s.wall) continue;
    results.push({
      wall: s.wall,
      side: s.side,
      position: s.position,
      rotation: s.rotation,
      dimensions: { length: s.wall.length_mm, height: s.wall.height_mm, thickness: t },
    });
  }

  return results;
}

/**
 * Compute the expected corner positions (top-down 2D) for a rectangular floor plan.
 * Returns 4 corners in order: front-left, front-right, back-right, back-left.
 *
 * @param {Array} walls - Array of wall input objects [front, right, back, left]
 * @returns {Array<{x: number, z: number}>} Corner positions in mm
 */
export function computeFloorPlanCorners(walls) {
  if (!walls || walls.length < 2) return [];

  const frontLen = walls[0].length_mm;
  const sideLen = walls[1].length_mm;
  const halfW = frontLen / 2;
  const halfD = sideLen / 2;

  return [
    { x: -halfW, z: halfD },   // front-left
    { x: halfW, z: halfD },    // front-right
    { x: halfW, z: -halfD },   // back-right
    { x: -halfW, z: -halfD },  // back-left
  ];
}

/**
 * Validate that wall endpoints meet at rectangle corners.
 * Returns an array of { corner, wallA, wallB, gap_mm } for each corner.
 *
 * @param {Array} floorPlanEntries - Output of computeFloorPlan()
 * @returns {Array<{corner: string, endA: {x,z}, endB: {x,z}, gap_mm: number}>}
 */
/**
 * Compute floor plan layout from walls and snap connections.
 * Falls back to the rectangular computeFloorPlan when no connections exist.
 *
 * @param {Array} walls - All wall objects in the project
 * @param {Array} connections - Snap connection objects (may be empty/null)
 * @returns {Array} Same shape as computeFloorPlan output
 */
export function computeFloorPlanFromConnections(walls, connections) {
  if (!connections || connections.length === 0) {
    return computeFloorPlan(walls);
  }
  return resolveFloorPlanLayout(walls, connections);
}

export function validateCornerJoins(floorPlanEntries) {
  if (floorPlanEntries.length < 2) return [];

  const t = WALL_THICKNESS;
  const results = [];

  // Get wall endpoints for each side
  function getEndpoints(entry) {
    const { position, rotation, dimensions } = entry;
    const halfLen = dimensions.length / 2;
    const angle = rotation.y;

    // Wall runs along its local X axis. Endpoints in world space:
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return {
      start: {
        x: position.x - halfLen * cos,
        z: position.z + halfLen * sin,
      },
      end: {
        x: position.x + halfLen * cos,
        z: position.z - halfLen * sin,
      },
    };
  }

  const byIndex = {};
  for (const entry of floorPlanEntries) {
    byIndex[entry.side] = getEndpoints(entry);
  }

  // Corner joins (which wall endpoints should meet):
  const cornerDefs = [
    { corner: 'front-right', sideA: 'front', endA: 'end', sideB: 'right', endB: 'start' },
    { corner: 'back-right', sideA: 'right', endA: 'end', sideB: 'back', endB: 'start' },
    { corner: 'back-left', sideA: 'back', endA: 'end', sideB: 'left', endB: 'start' },
    { corner: 'front-left', sideA: 'left', endA: 'end', sideB: 'front', endB: 'start' },
  ];

  for (const cd of cornerDefs) {
    const a = byIndex[cd.sideA];
    const b = byIndex[cd.sideB];
    if (!a || !b) continue;

    const ptA = a[cd.endA];
    const ptB = b[cd.endB];
    const dx = ptA.x - ptB.x;
    const dz = ptA.z - ptB.z;
    const gap = Math.sqrt(dx * dx + dz * dz);

    results.push({
      corner: cd.corner,
      endA: ptA,
      endB: ptB,
      gap_mm: gap,
    });
  }

  return results;
}
