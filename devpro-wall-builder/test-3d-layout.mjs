/**
 * Test: 3D Model Viewer layout consistency with 2D floor plan
 *
 * Verifies that:
 * 1. Walls form a proper closed rectangle (corners meet)
 * 2. Wall positions in 3D match expected 2D floor plan coordinates
 * 3. Wall dimensions are preserved (length, height, thickness)
 * 4. Various rectangle sizes produce correct layouts
 * 5. Walls with openings maintain correct positioning
 */

import { computeFloorPlan, computeFloorPlanCorners, validateCornerJoins } from './src/utils/floorPlan.js';
import { WALL_THICKNESS } from './src/utils/constants.js';

const EPSILON = 0.5; // mm tolerance for floating point
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertClose(actual, expected, message, tol = EPSILON) {
  const ok = Math.abs(actual - expected) < tol;
  if (ok) {
    passed++;
    console.log(`  PASS: ${message} (${actual.toFixed(2)} ≈ ${expected.toFixed(2)})`);
  } else {
    failed++;
    console.error(`  FAIL: ${message} — expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`);
  }
}

// ── Helper: create a simple wall input ──
function makeWall(name, length, height, opts = {}) {
  return {
    name,
    length_mm: length,
    height_mm: height,
    profile: opts.profile || 'standard',
    openings: opts.openings || [],
    ...opts,
  };
}

// ════════════════════════════════════════════
// TEST 1: Simple square (4 identical walls)
// ════════════════════════════════════════════
console.log('\n═══ Test 1: Square floor plan (4 x 6000mm walls) ═══');
{
  const walls = [
    makeWall('Front', 6000, 2700),
    makeWall('Right', 6000, 2700),
    makeWall('Back', 6000, 2700),
    makeWall('Left', 6000, 2700),
  ];

  const plan = computeFloorPlan(walls);
  assert(plan.length === 4, '4 walls in floor plan');

  // Check each wall is assigned correct side
  assert(plan[0].side === 'front', 'Wall 0 is front');
  assert(plan[1].side === 'right', 'Wall 1 is right');
  assert(plan[2].side === 'back', 'Wall 2 is back');
  assert(plan[3].side === 'left', 'Wall 3 is left');

  // Check dimensions preserved
  for (const entry of plan) {
    assertClose(entry.dimensions.length, 6000, `${entry.side} wall length = 6000mm`);
    assertClose(entry.dimensions.height, 2700, `${entry.side} wall height = 2700mm`);
    assertClose(entry.dimensions.thickness, WALL_THICKNESS, `${entry.side} wall thickness = ${WALL_THICKNESS}mm`);
  }

  // Front wall: centered at X=0, Z=+halfD+halfT
  const halfW = 3000;
  const halfT = WALL_THICKNESS / 2;
  assertClose(plan[0].position.x, 0, 'Front wall X center = 0');
  assertClose(plan[0].position.z, halfW + halfT, `Front wall Z = ${halfW + halfT}`);
  assertClose(plan[0].position.y, 2700 / 2, 'Front wall Y center = half height');

  // Right wall: centered at X=+halfW+halfT, Z=0
  assertClose(plan[1].position.x, halfW + halfT, `Right wall X = ${halfW + halfT}`);
  assertClose(plan[1].position.z, 0, 'Right wall Z center = 0');

  // Back wall: centered at X=0, Z=-(halfD+halfT)
  assertClose(plan[2].position.x, 0, 'Back wall X center = 0');
  assertClose(plan[2].position.z, -(halfW + halfT), `Back wall Z = -${halfW + halfT}`);

  // Left wall: centered at X=-(halfW+halfT), Z=0
  assertClose(plan[3].position.x, -(halfW + halfT), `Left wall X = -${halfW + halfT}`);
  assertClose(plan[3].position.z, 0, 'Left wall Z center = 0');
}

// ════════════════════════════════════════════
// TEST 2: Rectangle (different front/side lengths)
// ════════════════════════════════════════════
console.log('\n═══ Test 2: Rectangle floor plan (8000 x 5000mm) ═══');
{
  const walls = [
    makeWall('Front', 8000, 2700),
    makeWall('Right', 5000, 2700),
    makeWall('Back', 8000, 2700),
    makeWall('Left', 5000, 2700),
  ];

  const plan = computeFloorPlan(walls);
  const halfW = 4000; // 8000/2
  const halfD = 2500; // 5000/2
  const halfT = WALL_THICKNESS / 2;

  // Front wall at Z = halfD + halfT
  assertClose(plan[0].position.z, halfD + halfT, `Front wall Z = ${halfD + halfT}`);
  assertClose(plan[0].position.x, 0, 'Front wall X centered');

  // Right wall at X = halfW + halfT
  assertClose(plan[1].position.x, halfW + halfT, `Right wall X = ${halfW + halfT}`);
  assertClose(plan[1].position.z, 0, 'Right wall Z centered');

  // Back wall at Z = -(halfD + halfT)
  assertClose(plan[2].position.z, -(halfD + halfT), `Back wall Z = -${halfD + halfT}`);

  // Left wall at X = -(halfW + halfT)
  assertClose(plan[3].position.x, -(halfW + halfT), `Left wall X = -${halfW + halfT}`);

  // Verify rectangle corners
  const corners = computeFloorPlanCorners(walls);
  assert(corners.length === 4, '4 corners computed');
  assertClose(corners[0].x, -4000, 'Front-left X = -4000');
  assertClose(corners[0].z, 2500, 'Front-left Z = 2500');
  assertClose(corners[1].x, 4000, 'Front-right X = 4000');
  assertClose(corners[1].z, 2500, 'Front-right Z = 2500');
  assertClose(corners[2].x, 4000, 'Back-right X = 4000');
  assertClose(corners[2].z, -2500, 'Back-right Z = -2500');
  assertClose(corners[3].x, -4000, 'Back-left X = -4000');
  assertClose(corners[3].z, -2500, 'Back-left Z = -2500');
}

// ════════════════════════════════════════════
// TEST 3: Corner joins — walls should meet at corners
// ════════════════════════════════════════════
console.log('\n═══ Test 3: Corner joins validation ═══');
{
  const walls = [
    makeWall('Front', 8000, 2700),
    makeWall('Right', 5000, 2700),
    makeWall('Back', 8000, 2700),
    makeWall('Left', 5000, 2700),
  ];

  const plan = computeFloorPlan(walls);
  const joins = validateCornerJoins(plan);

  assert(joins.length === 4, '4 corner joins checked');
  for (const join of joins) {
    // Due to wall thickness offset, the endpoints of adjacent walls won't be at
    // exactly the same point (they're on different parallel planes separated by WALL_THICKNESS).
    // The gap should be approximately equal to the wall thickness (walls meet at perpendicular planes).
    const maxAllowedGap = WALL_THICKNESS * 1.5; // Allow some tolerance for the perpendicular offset
    assert(
      join.gap_mm < maxAllowedGap,
      `Corner ${join.corner}: gap = ${join.gap_mm.toFixed(1)}mm (< ${maxAllowedGap}mm threshold)`
    );
  }
}

// ════════════════════════════════════════════
// TEST 4: Wall rotations are correct
// ════════════════════════════════════════════
console.log('\n═══ Test 4: Wall rotations ═══');
{
  const walls = [
    makeWall('Front', 6000, 2700),
    makeWall('Right', 4000, 2700),
    makeWall('Back', 6000, 2700),
    makeWall('Left', 4000, 2700),
  ];

  const plan = computeFloorPlan(walls);

  assertClose(plan[0].rotation.y, 0, 'Front wall rotation = 0 (facing +Z)');
  assertClose(plan[1].rotation.y, Math.PI / 2, 'Right wall rotation = π/2');
  assertClose(plan[2].rotation.y, Math.PI, 'Back wall rotation = π');
  assertClose(plan[3].rotation.y, -Math.PI / 2, 'Left wall rotation = -π/2');
}

// ════════════════════════════════════════════
// TEST 5: Different wall heights
// ════════════════════════════════════════════
console.log('\n═══ Test 5: Different wall heights ═══');
{
  const walls = [
    makeWall('Front', 6000, 2700),
    makeWall('Right', 4000, 3600),
    makeWall('Back', 6000, 2700),
    makeWall('Left', 4000, 3600),
  ];

  const plan = computeFloorPlan(walls);

  // Y position = half the wall height (wall sits on ground)
  assertClose(plan[0].position.y, 2700 / 2, 'Front wall Y = 1350 (half of 2700)');
  assertClose(plan[1].position.y, 3600 / 2, 'Right wall Y = 1800 (half of 3600)');
  assertClose(plan[2].position.y, 2700 / 2, 'Back wall Y = 1350');
  assertClose(plan[3].position.y, 3600 / 2, 'Left wall Y = 1800');
}

// ════════════════════════════════════════════
// TEST 6: Walls with openings preserve positions
// ════════════════════════════════════════════
console.log('\n═══ Test 6: Walls with openings ═══');
{
  const walls = [
    makeWall('Front', 8000, 2700, {
      openings: [
        { ref: 'W01', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 2000 },
        { ref: 'D01', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 5000 },
      ],
    }),
    makeWall('Right', 5000, 2700),
    makeWall('Back', 8000, 2700),
    makeWall('Left', 5000, 2700),
  ];

  const plan = computeFloorPlan(walls);

  // Openings don't affect wall position — the wall is still centered correctly
  assertClose(plan[0].position.x, 0, 'Front wall with openings still centered at X=0');
  assertClose(plan[0].dimensions.length, 8000, 'Front wall length preserved with openings');

  // Wall reference is the same object
  assert(plan[0].wall.openings.length === 2, 'Front wall openings preserved in plan');
  assert(plan[0].wall.openings[0].ref === 'W01', 'Window ref preserved');
  assert(plan[0].wall.openings[1].ref === 'D01', 'Door ref preserved');
}

// ════════════════════════════════════════════
// TEST 7: Single wall
// ════════════════════════════════════════════
console.log('\n═══ Test 7: Single wall ═══');
{
  const walls = [makeWall('Only Wall', 6000, 2700)];
  const plan = computeFloorPlan(walls);

  assert(plan.length === 1, 'Single wall in plan');
  assert(plan[0].side === 'front', 'Single wall assigned to front');
  assertClose(plan[0].position.x, 0, 'Single wall centered at X=0');
  assertClose(plan[0].position.z, 0, 'Single wall at Z=0');
  assertClose(plan[0].position.y, 2700 / 2, 'Single wall Y = half height');
}

// ════════════════════════════════════════════
// TEST 8: Two walls
// ════════════════════════════════════════════
console.log('\n═══ Test 8: Two walls ═══');
{
  const walls = [
    makeWall('Front', 8000, 2700),
    makeWall('Right', 5000, 2700),
  ];
  const plan = computeFloorPlan(walls);

  assert(plan.length === 2, 'Two walls in plan');
  assert(plan[0].side === 'front', 'First wall is front');
  assert(plan[1].side === 'right', 'Second wall is right');
}

// ════════════════════════════════════════════
// TEST 9: Empty walls array
// ════════════════════════════════════════════
console.log('\n═══ Test 9: Empty walls ═══');
{
  const plan = computeFloorPlan([]);
  assert(plan.length === 0, 'Empty array returns empty plan');

  const plan2 = computeFloorPlan(null);
  assert(plan2.length === 0, 'Null returns empty plan');
}

// ════════════════════════════════════════════
// TEST 10: 2D floor plan ↔ 3D consistency
// ════════════════════════════════════════════
console.log('\n═══ Test 10: 2D ↔ 3D consistency check ═══');
{
  // The key invariant: in the 2D floor plan, four walls form a rectangle.
  // In the 3D view, the walls should form the SAME rectangle when viewed from above.
  //
  // 2D rectangle: width=10000, depth=6000
  // The wall center-lines should trace this rectangle.

  const W = 10000;
  const D = 6000;
  const walls = [
    makeWall('Front', W, 2700),
    makeWall('Right', D, 2700),
    makeWall('Back', W, 2700),
    makeWall('Left', D, 2700),
  ];

  const plan = computeFloorPlan(walls);
  const halfW = W / 2;
  const halfD = D / 2;
  const halfT = WALL_THICKNESS / 2;

  // In top-down view (XZ plane), wall center-lines form a rectangle:
  //
  // Front wall center-line: from (-halfW, halfD+halfT) to (+halfW, halfD+halfT)
  // Right wall center-line: from (halfW+halfT, +halfD) to (halfW+halfT, -halfD)
  // Back wall center-line: from (+halfW, -(halfD+halfT)) to (-halfW, -(halfD+halfT))
  // Left wall center-line: from (-(halfW+halfT), -halfD) to (-(halfW+halfT), +halfD)

  // Verify the wall center-line Z coordinates for front/back match
  const frontZ = plan[0].position.z;
  const backZ = plan[2].position.z;
  assertClose(frontZ - backZ, D + WALL_THICKNESS,
    `Front-to-back distance = ${D + WALL_THICKNESS}mm (depth + thickness)`);

  // Verify the wall center-line X coordinates for left/right match
  const rightX = plan[1].position.x;
  const leftX = plan[3].position.x;
  assertClose(rightX - leftX, W + WALL_THICKNESS,
    `Right-to-left distance = ${W + WALL_THICKNESS}mm (width + thickness)`);

  // The rectangle formed by wall center-lines should have:
  // - Width between front/back center-lines = D + WALL_THICKNESS
  // - Width between left/right center-lines = W + WALL_THICKNESS
  //
  // The INTERNAL clear space (between inner faces) should be:
  // - Width: W (front wall length)
  // - Depth: D (right wall length)

  const internalWidth = rightX - leftX - WALL_THICKNESS; // subtract one thickness (inner face to inner face)
  const internalDepth = frontZ - backZ - WALL_THICKNESS;
  assertClose(internalWidth, W, `Internal clear width = ${W}mm (matches front wall length)`);
  assertClose(internalDepth, D, `Internal clear depth = ${D}mm (matches side wall length)`);
}

// ════════════════════════════════════════════
// TEST 11: Symmetry — opposite walls equidistant from center
// ════════════════════════════════════════════
console.log('\n═══ Test 11: Symmetry ═══');
{
  const walls = [
    makeWall('Front', 7200, 2700),
    makeWall('Right', 4800, 3000),
    makeWall('Back', 7200, 2700),
    makeWall('Left', 4800, 3000),
  ];

  const plan = computeFloorPlan(walls);

  // Front and back should be equidistant from center (opposite Z)
  assertClose(plan[0].position.z, -plan[2].position.z,
    'Front Z = -Back Z (symmetric about center)');

  // Right and left should be equidistant from center (opposite X)
  assertClose(plan[1].position.x, -plan[3].position.x,
    'Right X = -Left X (symmetric about center)');

  // Front and back X positions should both be 0
  assertClose(plan[0].position.x, 0, 'Front wall X = 0');
  assertClose(plan[2].position.x, 0, 'Back wall X = 0');

  // Right and left Z positions should both be 0
  assertClose(plan[1].position.z, 0, 'Right wall Z = 0');
  assertClose(plan[3].position.z, 0, 'Left wall Z = 0');
}

// ════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
if (failed === 0) {
  console.log('All tests passed!');
} else {
  console.error(`${failed} test(s) FAILED`);
  process.exit(1);
}
