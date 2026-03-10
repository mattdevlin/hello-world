import { describe, it, expect } from 'vitest';
import {
  computeWallEndpoint,
  computeSnapPosition,
  resolveFloorPlanLayout,
  validateConnections,
  computeLayoutBounds,
} from './wallSnap.js';
import { WALL_THICKNESS } from './constants.js';

// ── Helpers ──

function makeWall(overrides = {}) {
  return {
    id: 'w1',
    name: 'Wall 1',
    length_mm: 4800,
    height_mm: 2700,
    profile: 'standard',
    deduction_left_mm: 0,
    deduction_right_mm: 0,
    openings: [],
    ...overrides,
  };
}

function approxEqual(a, b, tolerance = 0.5) {
  return Math.abs(a - b) < tolerance;
}

// ─────────────────────────────────────────────────────────────
// computeWallEndpoint
// ─────────────────────────────────────────────────────────────
describe('computeWallEndpoint', () => {
  it('wall with no deductions: left end at -halfLen, right end at +halfLen', () => {
    const wall = makeWall({ length_mm: 4800 });
    const left = computeWallEndpoint(wall, 'left');
    const right = computeWallEndpoint(wall, 'right');
    expect(left.localX_mm).toBe(-2400);
    expect(right.localX_mm).toBe(2400);
  });

  it('wall with left deduction: left snap point shifted inward', () => {
    const wall = makeWall({ length_mm: 4800, deduction_left_mm: 162 });
    const left = computeWallEndpoint(wall, 'left');
    expect(left.localX_mm).toBe(-2400 + 162);
  });

  it('wall with right deduction: right snap point shifted inward', () => {
    const wall = makeWall({ length_mm: 4800, deduction_right_mm: 162 });
    const right = computeWallEndpoint(wall, 'right');
    expect(right.localX_mm).toBe(2400 - 162);
  });

  it('wall with both deductions: both endpoints shifted inward', () => {
    const wall = makeWall({ length_mm: 4800, deduction_left_mm: 200, deduction_right_mm: 100 });
    const left = computeWallEndpoint(wall, 'left');
    const right = computeWallEndpoint(wall, 'right');
    expect(left.localX_mm).toBe(-2400 + 200);
    expect(right.localX_mm).toBe(2400 - 100);
  });

  it('short wall with no deductions', () => {
    const wall = makeWall({ length_mm: 1200 });
    const left = computeWallEndpoint(wall, 'left');
    const right = computeWallEndpoint(wall, 'right');
    expect(left.localX_mm).toBe(-600);
    expect(right.localX_mm).toBe(600);
  });
});

// ─────────────────────────────────────────────────────────────
// computeSnapPosition
// ─────────────────────────────────────────────────────────────
describe('computeSnapPosition', () => {
  const originPos = { x: 0, y: 1350, z: 0 };

  it('snap wall-B left end to wall-A right end at 90°', () => {
    const wallA = makeWall({ id: 'A', length_mm: 4800 });
    const wallB = makeWall({ id: 'B', length_mm: 3600, height_mm: 2700 });

    const result = computeSnapPosition(
      wallA, 'right', originPos, 0,
      wallB, 'left', 90
    );

    // Wall A right end is at x=2400. Wall B rotated 90° so it runs along Z.
    // Wall B left end (localX=-1800) rotated 90° maps to Z direction.
    expect(result.rotation.y).toBeCloseTo(Math.PI / 2);
    // Snap point is at anchor right end x=2400
    // Wall B center should be offset so its left end hits x=2400
    // At 90° rotation, localX maps to -Z, so center.z = snapZ - (-1800)*sin(90°) = 0 + 1800 = ...
    // Actually let's verify the position makes geometric sense
    expect(result.position.y).toBe(1350); // centered on its own height
  });

  it('snap at 0° (inline continuation): walls extend in same direction', () => {
    const wallA = makeWall({ id: 'A', length_mm: 4800 });
    const wallB = makeWall({ id: 'B', length_mm: 3600 });

    const result = computeSnapPosition(
      wallA, 'right', originPos, 0,
      wallB, 'left', 0
    );

    // Angle should be 0 (same direction)
    expect(result.rotation.y).toBeCloseTo(0);
    // Wall B's left end should be at wall A's right end (x=2400)
    // Wall B center = 2400 - (-1800)*cos(0) = 2400 + 1800 = 4200
    expect(approxEqual(result.position.x, 4200)).toBe(true);
    expect(approxEqual(result.position.z, 0)).toBe(true);
  });

  it('snap at 180° (U-turn): wall doubles back', () => {
    const wallA = makeWall({ id: 'A', length_mm: 4800 });
    const wallB = makeWall({ id: 'B', length_mm: 3600 });

    const result = computeSnapPosition(
      wallA, 'right', originPos, 0,
      wallB, 'left', 180
    );

    expect(result.rotation.y).toBeCloseTo(Math.PI);
    // Wall B rotated 180°, left end should align with snap point
    // cos(180°) = -1, sin(180°) = 0
    // center.x = 2400 - (-1800)*(-1) = 2400 - 1800 = 600
    expect(approxEqual(result.position.x, 600)).toBe(true);
  });

  it('snap at 270° (left turn)', () => {
    const wallA = makeWall({ id: 'A', length_mm: 4800 });
    const wallB = makeWall({ id: 'B', length_mm: 3600 });

    const result = computeSnapPosition(
      wallA, 'right', originPos, 0,
      wallB, 'left', 270
    );

    expect(result.rotation.y).toBeCloseTo(3 * Math.PI / 2);
  });

  it('snap with deductions on both walls', () => {
    const wallA = makeWall({ id: 'A', length_mm: 4800, deduction_right_mm: 162 });
    const wallB = makeWall({ id: 'B', length_mm: 3600, deduction_left_mm: 162 });

    const result = computeSnapPosition(
      wallA, 'right', originPos, 0,
      wallB, 'left', 0
    );

    // Wall A right snap point: 2400 - 162 = 2238
    // Wall B left snap point: -1800 + 162 = -1638
    // Wall B center: 2238 - (-1638)*cos(0) = 2238 + 1638 = 3876
    expect(approxEqual(result.position.x, 3876)).toBe(true);
  });

  it('snap right-to-right: both right ends meet', () => {
    const wallA = makeWall({ id: 'A', length_mm: 4800 });
    const wallB = makeWall({ id: 'B', length_mm: 3600 });

    const result = computeSnapPosition(
      wallA, 'right', originPos, 0,
      wallB, 'right', 0
    );

    // Wall A right end at x=2400
    // Wall B right endpoint localX = 1800
    // center.x = 2400 - 1800*cos(0) = 2400 - 1800 = 600
    expect(approxEqual(result.position.x, 600)).toBe(true);
  });

  it('different wall heights: Y positioned independently', () => {
    const wallA = makeWall({ id: 'A', length_mm: 4800, height_mm: 2700 });
    const wallB = makeWall({ id: 'B', length_mm: 3600, height_mm: 3050 });

    const result = computeSnapPosition(
      wallA, 'right', { x: 0, y: 1350, z: 0 }, 0,
      wallB, 'left', 90
    );

    // Wall B should be centered on its own height
    expect(result.position.y).toBe(3050 / 2);
  });

  it('anchor wall already rotated: attached wall position accounts for anchor rotation', () => {
    const wallA = makeWall({ id: 'A', length_mm: 4800 });
    const wallB = makeWall({ id: 'B', length_mm: 3600 });

    // Anchor rotated 90° (running along Z)
    const result = computeSnapPosition(
      wallA, 'right', { x: 0, y: 1350, z: 0 }, Math.PI / 2,
      wallB, 'left', 0
    );

    // Wall A at 90°, its right end (localX=2400) maps to:
    // x = 0 + 2400*cos(90°) ≈ 0
    // z = 0 - 2400*sin(90°) = -2400
    // Wall B at 90° + 0° = 90°, its left end (localX=-1800):
    // center.x = 0 - (-1800)*cos(90°) ≈ 0
    // center.z = -2400 + (-1800)*sin(90°) = -2400 - 1800 = -4200
    expect(result.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(approxEqual(result.position.x, 0, 1)).toBe(true);
    expect(approxEqual(result.position.z, -4200)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// resolveFloorPlanLayout
// ─────────────────────────────────────────────────────────────
describe('resolveFloorPlanLayout', () => {
  it('no connections: each wall placed at origin', () => {
    const walls = [
      makeWall({ id: 'w1', length_mm: 4800 }),
      makeWall({ id: 'w2', length_mm: 3600 }),
    ];

    const layout = resolveFloorPlanLayout(walls, []);
    expect(layout).toHaveLength(2);
    expect(layout[0].position.x).toBe(0);
    expect(layout[1].position.x).toBe(0);
  });

  it('empty walls: returns empty array', () => {
    expect(resolveFloorPlanLayout([], [])).toEqual([]);
    expect(resolveFloorPlanLayout(null, [])).toEqual([]);
  });

  it('linear chain: A→B→C positions cascade', () => {
    const walls = [
      makeWall({ id: 'A', length_mm: 4800 }),
      makeWall({ id: 'B', length_mm: 3600 }),
      makeWall({ id: 'C', length_mm: 2400 }),
    ];
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'B', attachedEnd: 'left', angleDeg: 0 },
      { id: 'c2', wallId: 'B', anchorEnd: 'right', attachedWallId: 'C', attachedEnd: 'left', angleDeg: 0 },
    ];

    const layout = resolveFloorPlanLayout(walls, connections);
    expect(layout).toHaveLength(3);

    // All walls should be along the X axis
    const posA = layout.find(e => e.wall.id === 'A').position;
    const posB = layout.find(e => e.wall.id === 'B').position;
    const posC = layout.find(e => e.wall.id === 'C').position;

    // B should be to the right of A
    expect(posB.x).toBeGreaterThan(posA.x);
    // C should be to the right of B
    expect(posC.x).toBeGreaterThan(posB.x);
  });

  it('L-shape: A→B at 90°', () => {
    const walls = [
      makeWall({ id: 'A', length_mm: 4800 }),
      makeWall({ id: 'B', length_mm: 3600 }),
    ];
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'B', attachedEnd: 'left', angleDeg: 90 },
    ];

    const layout = resolveFloorPlanLayout(walls, connections);
    expect(layout).toHaveLength(2);

    const entryB = layout.find(e => e.wall.id === 'B');
    // B should be rotated 90°
    expect(entryB.rotation.y).toBeCloseTo(Math.PI / 2);
  });

  it('rectangle: 4 walls at 90° each', () => {
    const len = 4800;
    const walls = [
      makeWall({ id: 'A', length_mm: len }),
      makeWall({ id: 'B', length_mm: len }),
      makeWall({ id: 'C', length_mm: len }),
      makeWall({ id: 'D', length_mm: len }),
    ];
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'B', attachedEnd: 'left', angleDeg: 90 },
      { id: 'c2', wallId: 'B', anchorEnd: 'right', attachedWallId: 'C', attachedEnd: 'left', angleDeg: 90 },
      { id: 'c3', wallId: 'C', anchorEnd: 'right', attachedWallId: 'D', attachedEnd: 'left', angleDeg: 90 },
    ];

    const layout = resolveFloorPlanLayout(walls, connections);
    expect(layout).toHaveLength(4);

    // All 4 walls should be placed (not at origin)
    const positions = layout.map(e => e.position);
    const uniquePositions = new Set(positions.map(p => `${Math.round(p.x)},${Math.round(p.z)}`));
    // With a square, we expect 4 distinct center positions
    expect(uniquePositions.size).toBe(4);
  });

  it('T-junction: A has B on right and C on left', () => {
    const walls = [
      makeWall({ id: 'A', length_mm: 4800 }),
      makeWall({ id: 'B', length_mm: 3600 }),
      makeWall({ id: 'C', length_mm: 3600 }),
    ];
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'B', attachedEnd: 'left', angleDeg: 90 },
      { id: 'c2', wallId: 'A', anchorEnd: 'left', attachedWallId: 'C', attachedEnd: 'left', angleDeg: 270 },
    ];

    const layout = resolveFloorPlanLayout(walls, connections);
    expect(layout).toHaveLength(3);

    const entryB = layout.find(e => e.wall.id === 'B');
    const entryC = layout.find(e => e.wall.id === 'C');
    expect(entryB).toBeDefined();
    expect(entryC).toBeDefined();
  });

  it('disconnected walls: connected ones placed, standalone at origin', () => {
    const walls = [
      makeWall({ id: 'A', length_mm: 4800 }),
      makeWall({ id: 'B', length_mm: 3600 }),
      makeWall({ id: 'C', length_mm: 2400 }), // not connected
    ];
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'B', attachedEnd: 'left', angleDeg: 90 },
    ];

    const layout = resolveFloorPlanLayout(walls, connections);
    expect(layout).toHaveLength(3);

    const entryC = layout.find(e => e.wall.id === 'C');
    expect(entryC.position.x).toBe(0);
    expect(entryC.position.z).toBe(0);
  });

  it('root wall selection: prefers wall not attached by any connection', () => {
    const walls = [
      makeWall({ id: 'A', length_mm: 4800 }),
      makeWall({ id: 'B', length_mm: 3600 }),
    ];
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'B', attachedEnd: 'left', angleDeg: 90 },
    ];

    const layout = resolveFloorPlanLayout(walls, connections);
    // A is the anchor (root), should be at origin
    const entryA = layout.find(e => e.wall.id === 'A');
    expect(entryA.position.x).toBe(0);
    expect(entryA.position.z).toBe(0);
  });

  it('returns correct dimensions and thickness', () => {
    const walls = [makeWall({ id: 'A', length_mm: 4800, height_mm: 2700 })];
    const layout = resolveFloorPlanLayout(walls, []);
    expect(layout[0].dimensions.length).toBe(4800);
    expect(layout[0].dimensions.height).toBe(2700);
    expect(layout[0].dimensions.thickness).toBe(WALL_THICKNESS);
  });
});

// ─────────────────────────────────────────────────────────────
// validateConnections
// ─────────────────────────────────────────────────────────────
describe('validateConnections', () => {
  const walls = [
    makeWall({ id: 'A' }),
    makeWall({ id: 'B' }),
    makeWall({ id: 'C' }),
  ];

  it('valid connections: no errors', () => {
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'B', attachedEnd: 'left', angleDeg: 90 },
    ];
    const errors = validateConnections(walls, connections);
    expect(errors).toHaveLength(0);
  });

  it('empty connections: no errors', () => {
    expect(validateConnections(walls, [])).toHaveLength(0);
    expect(validateConnections(walls, null)).toHaveLength(0);
  });

  it('wall connected to itself: error', () => {
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'A', attachedEnd: 'left', angleDeg: 90 },
    ];
    const errors = validateConnections(walls, connections);
    expect(errors.some(e => e.type === 'self_connection')).toBe(true);
  });

  it('same endpoint used twice: error', () => {
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'B', attachedEnd: 'left', angleDeg: 90 },
      { id: 'c2', wallId: 'A', anchorEnd: 'right', attachedWallId: 'C', attachedEnd: 'left', angleDeg: 0 },
    ];
    const errors = validateConnections(walls, connections);
    expect(errors.some(e => e.type === 'duplicate_endpoint')).toBe(true);
  });

  it('missing wall ID: error', () => {
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'NONEXISTENT', attachedEnd: 'left', angleDeg: 90 },
    ];
    const errors = validateConnections(walls, connections);
    expect(errors.some(e => e.type === 'missing_wall')).toBe(true);
  });

  it('invalid angle: error', () => {
    const connections = [
      { id: 'c1', wallId: 'A', anchorEnd: 'right', attachedWallId: 'B', attachedEnd: 'left', angleDeg: 45 },
    ];
    const errors = validateConnections(walls, connections);
    expect(errors.some(e => e.type === 'invalid_angle')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// computeLayoutBounds
// ─────────────────────────────────────────────────────────────
describe('computeLayoutBounds', () => {
  it('empty layout: all zeros', () => {
    const bounds = computeLayoutBounds([]);
    expect(bounds.width).toBe(0);
    expect(bounds.depth).toBe(0);
    expect(bounds.maxHeight).toBe(0);
  });

  it('single wall at origin: bounds match wall dimensions', () => {
    const layout = [{
      wall: makeWall({ length_mm: 4800, height_mm: 2700 }),
      position: { x: 0, y: 1350, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { length: 4800, height: 2700, thickness: WALL_THICKNESS },
    }];

    const bounds = computeLayoutBounds(layout);
    expect(bounds.width).toBe(4800);
    expect(bounds.depth).toBe(WALL_THICKNESS);
    expect(bounds.maxHeight).toBe(2700);
  });

  it('L-shaped layout: bounds encompass both walls', () => {
    const layout = [
      {
        wall: makeWall({ id: 'A', length_mm: 4800 }),
        position: { x: 0, y: 1350, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: { length: 4800, height: 2700, thickness: WALL_THICKNESS },
      },
      {
        wall: makeWall({ id: 'B', length_mm: 3600 }),
        position: { x: 2400, y: 1350, z: -1800 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        dimensions: { length: 3600, height: 2700, thickness: WALL_THICKNESS },
      },
    ];

    const bounds = computeLayoutBounds(layout);
    // Should encompass both walls
    expect(bounds.width).toBeGreaterThan(4800);
    expect(bounds.depth).toBeGreaterThan(WALL_THICKNESS);
    expect(bounds.maxHeight).toBe(2700);
  });
});
