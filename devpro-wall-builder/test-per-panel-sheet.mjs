/**
 * Per-panel sheet height assignment — comprehensive test suite.
 *
 * Verifies that each panel on raked/gable walls gets the correct stock
 * sheet height based on its own max(heightLeft, heightRight), not a
 * global course-level sheet.
 *
 * Run: node test-per-panel-sheet.mjs
 */

import { calculateWallLayout, computeCourses } from './src/utils/calculator.js';
import { extractMagboardPieces } from './src/utils/magboardOptimizer.js';
import { WALL_PROFILES, STOCK_SHEET_HEIGHTS, MAX_SHEET_HEIGHT } from './src/utils/constants.js';

let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function section(title) {
  console.log(`\n═══ ${title} ═══`);
}

// Helper: get the max height of a panel
function panelMaxH(p) {
  return Math.max(p.heightLeft, p.heightRight);
}

// ──────────────────────────────────────────────────────────────
// TEST 1: Standard flat wall 2400mm — all panels use 2745mm sheet
// ──────────────────────────────────────────────────────────────
section('Test 1: Standard flat wall 2400mm');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    profile: WALL_PROFILES.STANDARD,
    openings: [],
  });
  assert(layout.isMultiCourse === false, 'wall should NOT be multi-course');
  for (const p of layout.panels) {
    assert(p.sheetHeight === 2745, `P${p.index + 1}: sheetHeight should be 2745, got ${p.sheetHeight}`);
    assert(p.isMultiCourse === false, `P${p.index + 1}: should NOT be multi-course`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 2: Standard flat wall 2800mm — all panels use 3050mm sheet
// ──────────────────────────────────────────────────────────────
section('Test 2: Standard flat wall 2800mm');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2800,
    profile: WALL_PROFILES.STANDARD,
    openings: [],
  });
  assert(layout.isMultiCourse === false, 'wall should NOT be multi-course');
  for (const p of layout.panels) {
    assert(p.sheetHeight === 3050, `P${p.index + 1}: sheetHeight should be 3050, got ${p.sheetHeight}`);
    assert(p.isMultiCourse === false, `P${p.index + 1}: should NOT be multi-course`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 3: Standard flat wall 3600mm — all panels multi-course
// ──────────────────────────────────────────────────────────────
section('Test 3: Standard flat wall 3600mm');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 3600,
    profile: WALL_PROFILES.STANDARD,
    openings: [],
  });
  assert(layout.isMultiCourse === true, 'wall should be multi-course');
  for (const p of layout.panels) {
    assert(p.isMultiCourse === true, `P${p.index + 1}: should be multi-course (height=${panelMaxH(p)})`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 4: THE BUG SCENARIO — Raked wall 2400L → 3639R
//   P2 (end, ~2762mm) should get 3050mm sheet, NOT 2745mm
// ──────────────────────────────────────────────────────────────
section('Test 4: Raked wall 2400L → 3639R (the original bug)');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    height_right_mm: 3639,
    profile: WALL_PROFILES.RAKED,
    openings: [],
  });
  assert(layout.isMultiCourse === true, 'wall should be multi-course (maxHeight=3639)');

  console.log(`  → ${layout.panels.length} panels:`);
  for (const p of layout.panels) {
    const maxH = panelMaxH(p);
    console.log(`    P${p.index + 1} (${p.type}): ${p.heightLeft}→${p.heightRight}mm, max=${maxH}, sheet=${p.sheetHeight}, multiCourse=${p.isMultiCourse}`);

    // Single-course panel's sheet should cover its max height
    if (!p.isMultiCourse) {
      assert(p.sheetHeight >= maxH,
        `P${p.index + 1}: sheetHeight (${p.sheetHeight}) must be >= panelMaxH (${maxH})`);
    }

    // Panels ≤ 2745 should use 2745, not 3050
    if (maxH <= 2745) {
      assert(p.sheetHeight === 2745, `P${p.index + 1}: maxH=${maxH} should use 2745mm sheet, got ${p.sheetHeight}`);
      assert(p.isMultiCourse === false, `P${p.index + 1}: maxH=${maxH} should NOT be multi-course`);
    }

    // Panels between 2745 and 3050 should use 3050
    if (maxH > 2745 && maxH <= 3050) {
      assert(p.sheetHeight === 3050, `P${p.index + 1}: maxH=${maxH} should use 3050mm sheet, got ${p.sheetHeight}`);
      assert(p.isMultiCourse === false, `P${p.index + 1}: maxH=${maxH} should NOT be multi-course`);
    }

    // Panels > 3050 should be multi-course
    if (maxH > 3050) {
      assert(p.isMultiCourse === true, `P${p.index + 1}: maxH=${maxH} should be multi-course`);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 5: Raked wall 2400L → 2700R — all panels fit on 2745mm
// ──────────────────────────────────────────────────────────────
section('Test 5: Raked wall 2400L → 2700R');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    height_right_mm: 2700,
    profile: WALL_PROFILES.RAKED,
    openings: [],
  });
  assert(layout.isMultiCourse === false, 'wall should NOT be multi-course (maxHeight=2700)');
  for (const p of layout.panels) {
    assert(p.sheetHeight === 2745, `P${p.index + 1}: sheetHeight should be 2745, got ${p.sheetHeight}`);
    assert(p.isMultiCourse === false, `P${p.index + 1}: should NOT be multi-course`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 6: Raked wall 2400L → 3050R — rightmost panel uses 3050mm
// ──────────────────────────────────────────────────────────────
section('Test 6: Raked wall 2400L → 3050R');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    height_right_mm: 3050,
    profile: WALL_PROFILES.RAKED,
    openings: [],
  });
  assert(layout.isMultiCourse === false, 'wall should NOT be multi-course (maxHeight=3050)');

  // Find the rightmost panel
  const sorted = [...layout.panels].sort((a, b) => b.x - a.x);
  const rightmost = sorted[0];
  const rightMaxH = panelMaxH(rightmost);

  if (rightMaxH > 2745) {
    assert(rightmost.sheetHeight === 3050,
      `Rightmost panel (max=${rightMaxH}mm): should use 3050mm sheet, got ${rightmost.sheetHeight}`);
  }

  // Left panels should use 2745
  const leftmost = sorted[sorted.length - 1];
  const leftMaxH = panelMaxH(leftmost);
  if (leftMaxH <= 2745) {
    assert(leftmost.sheetHeight === 2745,
      `Leftmost panel (max=${leftMaxH}mm): should use 2745mm sheet, got ${leftmost.sheetHeight}`);
  }

  for (const p of layout.panels) {
    assert(p.isMultiCourse === false, `P${p.index + 1}: should NOT be multi-course`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 7: Gable wall 2700 sides → 3600 peak — mixed assignments
// ──────────────────────────────────────────────────────────────
section('Test 7: Gable wall 2700 sides → 3600 peak');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2700,
    peak_height_mm: 3600,
    peak_position_mm: 3000,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });
  assert(layout.isMultiCourse === true, 'wall should be multi-course (maxHeight=3600)');

  let has2745 = false;
  let has3050 = false;
  let hasMultiCourse = false;

  for (const p of layout.panels) {
    const maxH = panelMaxH(p);
    if (!p.isMultiCourse) {
      assert(p.sheetHeight >= maxH,
        `P${p.index + 1}: sheetHeight (${p.sheetHeight}) must be >= panelMaxH (${maxH})`);
    } else {
      // Multi-course panels use max stock sheet for bottom course
      assert(p.sheetHeight === MAX_SHEET_HEIGHT,
        `P${p.index + 1}: multi-course sheetHeight should be ${MAX_SHEET_HEIGHT}, got ${p.sheetHeight}`);
    }

    if (p.sheetHeight === 2745) has2745 = true;
    if (p.sheetHeight === 3050) has3050 = true;
    if (p.isMultiCourse) hasMultiCourse = true;
  }

  console.log(`  → Gable panel breakdown: has2745=${has2745}, has3050=${has3050}, hasMultiCourse=${hasMultiCourse}`);
  // With 2700→3600 peak, some panels near peak should exceed 3050 (multi-course)
  // and edge panels should fit on 2745 or 3050 sheets
  assert(hasMultiCourse, 'at least one panel near peak should be multi-course');
}

// ──────────────────────────────────────────────────────────────
// TEST 8: Gable wall 2400 sides → 2800 peak — no multi-course
// ──────────────────────────────────────────────────────────────
section('Test 8: Gable wall 2400 sides → 2800 peak');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    peak_height_mm: 2800,
    peak_position_mm: 3000,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });
  assert(layout.isMultiCourse === false, 'wall should NOT be multi-course (maxHeight=2800)');

  let has2745 = false;
  let has3050 = false;

  for (const p of layout.panels) {
    const maxH = panelMaxH(p);
    assert(p.isMultiCourse === false, `P${p.index + 1}: should NOT be multi-course`);
    assert(p.sheetHeight >= maxH,
      `P${p.index + 1}: sheetHeight (${p.sheetHeight}) must be >= panelMaxH (${maxH})`);

    if (p.sheetHeight === 2745) has2745 = true;
    if (p.sheetHeight === 3050) has3050 = true;
  }

  // Edge panels at 2400mm → 2745, peak panels at ~2800mm → 3050
  console.log(`  → has2745=${has2745}, has3050=${has3050}`);
}

// ──────────────────────────────────────────────────────────────
// TEST 9: Edge case — panel max height exactly 2745mm
// ──────────────────────────────────────────────────────────────
section('Test 9: Flat wall exactly 2745mm');
{
  const layout = calculateWallLayout({
    length_mm: 3000,
    height_mm: 2745,
    profile: WALL_PROFILES.STANDARD,
    openings: [],
  });
  for (const p of layout.panels) {
    assert(p.sheetHeight === 2745, `P${p.index + 1}: exactly 2745mm should use 2745mm sheet, got ${p.sheetHeight}`);
    assert(p.isMultiCourse === false, `P${p.index + 1}: should NOT be multi-course`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 10: Edge case — panel max height exactly 3050mm
// ──────────────────────────────────────────────────────────────
section('Test 10: Flat wall exactly 3050mm');
{
  const layout = calculateWallLayout({
    length_mm: 3000,
    height_mm: 3050,
    profile: WALL_PROFILES.STANDARD,
    openings: [],
  });
  for (const p of layout.panels) {
    assert(p.sheetHeight === 3050, `P${p.index + 1}: exactly 3050mm should use 3050mm sheet, got ${p.sheetHeight}`);
    assert(p.isMultiCourse === false, `P${p.index + 1}: should NOT be multi-course`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 11: Edge case — panel max height 3051mm (just over max sheet)
// ──────────────────────────────────────────────────────────────
section('Test 11: Flat wall 3051mm (just over max sheet)');
{
  const layout = calculateWallLayout({
    length_mm: 3000,
    height_mm: 3051,
    profile: WALL_PROFILES.STANDARD,
    openings: [],
  });
  assert(layout.isMultiCourse === true, 'wall should be multi-course');
  for (const p of layout.panels) {
    assert(p.isMultiCourse === true, `P${p.index + 1}: should be multi-course at 3051mm`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 12: Edge case — panel max height 2746mm (just over 2745)
// ──────────────────────────────────────────────────────────────
section('Test 12: Flat wall 2746mm (just over 2745)');
{
  const layout = calculateWallLayout({
    length_mm: 3000,
    height_mm: 2746,
    profile: WALL_PROFILES.STANDARD,
    openings: [],
  });
  for (const p of layout.panels) {
    assert(p.sheetHeight === 3050, `P${p.index + 1}: 2746mm should use 3050mm sheet, got ${p.sheetHeight}`);
    assert(p.isMultiCourse === false, `P${p.index + 1}: should NOT be multi-course`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 13: Magboard optimizer uses per-panel sheet heights
// ──────────────────────────────────────────────────────────────
section('Test 13: Magboard optimizer per-panel sheet heights');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    height_right_mm: 3639,
    profile: WALL_PROFILES.RAKED,
    openings: [],
  });
  const { panelSheets } = extractMagboardPieces(layout, 'Test Wall');

  // Panels that fit on 2745mm should have 2745mm sheets
  // Panels between 2745-3050 should have 3050mm sheets
  // Multi-course panels should have course-level sheets
  const has2745 = panelSheets.some(s => s.sheetHeight === 2745);
  const has3050 = panelSheets.some(s => s.sheetHeight === 3050);
  assert(has2745, 'magboard should include 2745mm sheets for short panels');
  assert(has3050, 'magboard should include 3050mm sheets for taller panels');

  console.log(`  → Sheet breakdown: ${panelSheets.filter(s => s.sheetHeight === 2745).length} × 2745mm, ${panelSheets.filter(s => s.sheetHeight === 3050).length} × 3050mm`);
}

// ──────────────────────────────────────────────────────────────
// TEST 14: Global courses array unchanged (backward compatibility)
// ──────────────────────────────────────────────────────────────
section('Test 14: Global courses array backward compatibility');
{
  // Standard flat multi-course wall
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 3600,
    profile: WALL_PROFILES.STANDARD,
    openings: [],
  });
  assert(layout.courses.length === 2, `should have 2 courses, got ${layout.courses.length}`);
  assert(layout.courses[0].y === 0, `course[0].y should be 0`);
  assert(layout.courses[1].y > 0, `course[1].y should be > 0`);
  assert(layout.courses[1].y + layout.courses[1].height === 3600,
    `courses should sum to 3600, got ${layout.courses[1].y + layout.courses[1].height}`);

  // Raked multi-course wall — global courses still based on maxHeight
  const rakedLayout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    height_right_mm: 3639,
    profile: WALL_PROFILES.RAKED,
    openings: [],
  });
  assert(rakedLayout.courses.length === 2, `raked should have 2 global courses`);
  assert(rakedLayout.isMultiCourse === true, `raked wall isMultiCourse should be true`);
  const { courses } = computeCourses(3639);
  assert(rakedLayout.courses[0].sheetHeight === courses[0].sheetHeight,
    `global course[0].sheetHeight should match computeCourses output`);
  assert(rakedLayout.courses[1].sheetHeight === courses[1].sheetHeight,
    `global course[1].sheetHeight should match computeCourses output`);
}

// ──────────────────────────────────────────────────────────────
// TEST 15: Every panel's sheetHeight >= its max height (universal invariant)
// ──────────────────────────────────────────────────────────────
section('Test 15: Universal invariant — sheetHeight >= panelMaxH');
{
  const configs = [
    { length_mm: 6000, height_mm: 2440, profile: WALL_PROFILES.STANDARD, openings: [] },
    { length_mm: 6000, height_mm: 2745, profile: WALL_PROFILES.STANDARD, openings: [] },
    { length_mm: 6000, height_mm: 3050, profile: WALL_PROFILES.STANDARD, openings: [] },
    { length_mm: 6000, height_mm: 3600, profile: WALL_PROFILES.STANDARD, openings: [] },
    { length_mm: 6000, height_mm: 2400, height_right_mm: 2700, profile: WALL_PROFILES.RAKED, openings: [] },
    { length_mm: 6000, height_mm: 2400, height_right_mm: 3050, profile: WALL_PROFILES.RAKED, openings: [] },
    { length_mm: 6000, height_mm: 2400, height_right_mm: 3639, profile: WALL_PROFILES.RAKED, openings: [] },
    { length_mm: 6000, height_mm: 2700, peak_height_mm: 3600, peak_position_mm: 3000, profile: WALL_PROFILES.GABLE, openings: [] },
    { length_mm: 6000, height_mm: 2400, peak_height_mm: 2800, peak_position_mm: 3000, profile: WALL_PROFILES.GABLE, openings: [] },
  ];

  let totalPanels = 0;
  let allValid = true;
  for (const cfg of configs) {
    const layout = calculateWallLayout(cfg);
    for (const p of layout.panels) {
      totalPanels++;
      const maxH = panelMaxH(p);
      if (p.isMultiCourse) {
        // Multi-course: sheetHeight is the max stock sheet (bottom course)
        if (p.sheetHeight !== MAX_SHEET_HEIGHT) {
          allValid = false;
          console.error(`  ✗ FAIL: ${cfg.profile} wall ${cfg.height_mm}mm — P${p.index + 1}: multi-course sheetHeight should be ${MAX_SHEET_HEIGHT}, got ${p.sheetHeight}`);
          fail++;
        }
      } else {
        // Single-course: sheetHeight must cover the panel's max height
        if (p.sheetHeight < maxH) {
          allValid = false;
          console.error(`  ✗ FAIL: ${cfg.profile} wall ${cfg.height_mm}mm — P${p.index + 1}: sheetHeight ${p.sheetHeight} < panelMaxH ${maxH}`);
          fail++;
        }
      }
    }
  }
  if (allValid) {
    pass++;
    console.log(`  ✓ All ${totalPanels} panels across ${configs.length} wall configs have valid sheetHeight`);
  }
}

// ──────────────────────────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────────────────────────
section('SUMMARY');
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
