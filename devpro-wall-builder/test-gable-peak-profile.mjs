/**
 * Gable peak profile — comprehensive test suite.
 *
 * Verifies that panels straddling a gable peak get peakHeight/peakXLocal
 * properties, correct sheet height assignments, and that non-straddling
 * panels are unaffected.
 *
 * Run: node test-gable-peak-profile.mjs
 */

import { calculateWallLayout } from './src/utils/calculator.js';
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

// ──────────────────────────────────────────────────────────────
// TEST 1: Gable 7200mm, 2700 sides, 4890 peak — panel straddling peak
// ──────────────────────────────────────────────────────────────
section('Test 1: Gable 7200mm wall — peak-straddling panel gets peakHeight');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  const peakPanels = layout.panels.filter(p => p.peakHeight != null);
  assert(peakPanels.length >= 1, `at least 1 panel should straddle peak, got ${peakPanels.length}`);

  for (const p of peakPanels) {
    assert(p.peakHeight === 4890, `P${p.index + 1}: peakHeight should be 4890, got ${p.peakHeight}`);
    assert(p.peakXLocal > 0, `P${p.index + 1}: peakXLocal should be > 0, got ${p.peakXLocal}`);
    assert(p.peakXLocal < p.width, `P${p.index + 1}: peakXLocal should be < width (${p.width}), got ${p.peakXLocal}`);
    // peakXLocal = peakX - panel.x
    assert(p.x + p.peakXLocal === 3600, `P${p.index + 1}: global peak position should be 3600, got ${p.x + p.peakXLocal}`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 2: Non-straddling panels have no peakHeight
// ──────────────────────────────────────────────────────────────
section('Test 2: Non-straddling panels have no peakHeight');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  const nonPeakPanels = layout.panels.filter(p => p.peakHeight == null);
  assert(nonPeakPanels.length >= 1, `at least 1 panel should NOT straddle peak`);
  for (const p of nonPeakPanels) {
    assert(p.peakHeight == null, `P${p.index + 1}: peakHeight should be undefined, got ${p.peakHeight}`);
    assert(p.peakXLocal == null, `P${p.index + 1}: peakXLocal should be undefined, got ${p.peakXLocal}`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 3: Per-panel max height includes peakHeight for sheet assignment
// ──────────────────────────────────────────────────────────────
section('Test 3: Panel max height includes peakHeight');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  for (const p of layout.panels) {
    const maxH = Math.max(p.heightLeft, p.heightRight, p.peakHeight || 0);
    if (maxH <= MAX_SHEET_HEIGHT) {
      assert(p.sheetHeight >= maxH,
        `P${p.index + 1}: sheetHeight (${p.sheetHeight}) >= maxH (${maxH})`);
      assert(!p.isMultiCourse, `P${p.index + 1}: should not be multi-course (maxH=${maxH})`);
    } else {
      assert(p.isMultiCourse, `P${p.index + 1}: should be multi-course (maxH=${maxH})`);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 4: Sheet height for peak-straddling panel (peak > 3050)
// ──────────────────────────────────────────────────────────────
section('Test 4: Peak-straddling panel with peak > 3050 is multi-course');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  const peakPanel = layout.panels.find(p => p.peakHeight != null);
  assert(peakPanel != null, 'should find a peak-straddling panel');
  if (peakPanel) {
    assert(peakPanel.isMultiCourse === true,
      `peak panel P${peakPanel.index + 1} should be multi-course (peakHeight=${peakPanel.peakHeight})`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 5: Non-gable walls unaffected — standard
// ──────────────────────────────────────────────────────────────
section('Test 5: Standard wall — no peakHeight on any panel');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    profile: WALL_PROFILES.STANDARD,
    openings: [],
  });
  for (const p of layout.panels) {
    assert(p.peakHeight == null, `P${p.index + 1}: standard wall should have no peakHeight`);
    assert(p.peakXLocal == null, `P${p.index + 1}: standard wall should have no peakXLocal`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 6: Non-gable walls unaffected — raked
// ──────────────────────────────────────────────────────────────
section('Test 6: Raked wall — no peakHeight on any panel');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    height_right_mm: 3000,
    profile: WALL_PROFILES.RAKED,
    openings: [],
  });
  for (const p of layout.panels) {
    assert(p.peakHeight == null, `P${p.index + 1}: raked wall should have no peakHeight`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 7: Short gable (peak 2600, sides 2400) — no multi-course
// ──────────────────────────────────────────────────────────────
section('Test 7: Short gable — peak 2600mm, sides 2400mm');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    peak_height_mm: 2600,
    peak_position_mm: 3000,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  for (const p of layout.panels) {
    assert(!p.isMultiCourse, `P${p.index + 1}: should not be multi-course`);
  }

  const peakPanel = layout.panels.find(p => p.peakHeight != null);
  if (peakPanel) {
    assert(peakPanel.sheetHeight === 2745,
      `peak panel sheetHeight should be 2745 (peakHeight=${peakPanel.peakHeight}), got ${peakPanel.sheetHeight}`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 8: Tall gable (peak 3200, sides 2700) — peak panel multi-course
// ──────────────────────────────────────────────────────────────
section('Test 8: Tall gable — peak 3200mm, sides 2700mm');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2700,
    peak_height_mm: 3200,
    peak_position_mm: 3000,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  const peakPanel = layout.panels.find(p => p.peakHeight != null);
  if (peakPanel) {
    assert(peakPanel.isMultiCourse === true,
      `peak panel P${peakPanel.index + 1} should be multi-course (peakHeight=${peakPanel.peakHeight})`);
  }

  // Edge panels should NOT be multi-course (2700mm fits in 2745mm sheet)
  const edgePanels = layout.panels.filter(p => !p.peakHeight);
  for (const p of edgePanels) {
    const maxH = Math.max(p.heightLeft, p.heightRight);
    if (maxH <= 2745) {
      assert(p.sheetHeight === 2745, `P${p.index + 1}: edge panel sheetHeight should be 2745, got ${p.sheetHeight}`);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 9: Peak at exact panel boundary — edge case
// ──────────────────────────────────────────────────────────────
section('Test 9: Peak at panel boundary');
{
  // With PANEL_PITCH = 1205 (1200 + 5), panel boundaries are at 0, 1205, 2410, 3615, ...
  // If peak is at a panel boundary (e.g. 2410), no panel should straddle it
  // because the condition is panel.x < peakX && panelRight > peakX (strict inequality)
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2400,
    peak_height_mm: 3000,
    peak_position_mm: 2410, // At panel boundary
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  // Check if panels at the boundary are handled correctly
  // The peak should either straddle a panel or be at a boundary
  const peakPanels = layout.panels.filter(p => p.peakHeight != null);
  // Log panel positions for debugging
  for (const p of layout.panels) {
    const right = p.x + p.width;
    if (p.peakHeight) {
      assert(p.x < 2410 && right > 2410,
        `P${p.index + 1}: should span peak (x=${p.x}, right=${right})`);
    }
  }
  // If no panel straddles, that's also valid (peak is at exact boundary)
  console.log(`  ${peakPanels.length} panel(s) straddle peak at x=2410`);
}

// ──────────────────────────────────────────────────────────────
// TEST 10: Peak at centre of a full panel
// ──────────────────────────────────────────────────────────────
section('Test 10: Peak at centre of a full panel');
{
  // Panel 1 spans 0 to 1200 (pitch 1205), panel 2 spans 1205 to 2405, etc.
  // Peak at 600 should be in panel 1 (x=0, width=1200)
  const layout = calculateWallLayout({
    length_mm: 3600,
    height_mm: 2400,
    peak_height_mm: 2800,
    peak_position_mm: 600,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  const p1 = layout.panels[0];
  if (p1 && p1.x <= 600 && p1.x + p1.width > 600) {
    assert(p1.peakHeight === 2800, `P1: peakHeight should be 2800, got ${p1.peakHeight}`);
    assert(p1.peakXLocal === 600 - p1.x, `P1: peakXLocal should be ${600 - p1.x}, got ${p1.peakXLocal}`);
  } else {
    assert(false, `P1 should straddle peak at 600 (P1 x=${p1?.x}, width=${p1?.width})`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 11: Gable with peak exactly at 2745mm — fits in smallest sheet
// ──────────────────────────────────────────────────────────────
section('Test 11: Gable with peakHeight exactly 2745mm');
{
  const layout = calculateWallLayout({
    length_mm: 4800,
    height_mm: 2400,
    peak_height_mm: 2745,
    peak_position_mm: 2400,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  const peakPanel = layout.panels.find(p => p.peakHeight != null);
  if (peakPanel) {
    assert(peakPanel.sheetHeight === 2745,
      `peak panel sheetHeight should be 2745, got ${peakPanel.sheetHeight}`);
    assert(!peakPanel.isMultiCourse, 'peak panel should not be multi-course');
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 12: Gable with peak exactly at 3050mm — fits in 3050 sheet
// ──────────────────────────────────────────────────────────────
section('Test 12: Gable with peakHeight exactly 3050mm');
{
  const layout = calculateWallLayout({
    length_mm: 4800,
    height_mm: 2400,
    peak_height_mm: 3050,
    peak_position_mm: 2400,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  const peakPanel = layout.panels.find(p => p.peakHeight != null);
  if (peakPanel) {
    assert(peakPanel.sheetHeight === 3050,
      `peak panel sheetHeight should be 3050, got ${peakPanel.sheetHeight}`);
    assert(!peakPanel.isMultiCourse, 'peak panel should not be multi-course');
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 13: Gable with peak at 3051mm — multi-course
// ──────────────────────────────────────────────────────────────
section('Test 13: Gable with peakHeight 3051mm — multi-course');
{
  const layout = calculateWallLayout({
    length_mm: 4800,
    height_mm: 2400,
    peak_height_mm: 3051,
    peak_position_mm: 2400,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  const peakPanel = layout.panels.find(p => p.peakHeight != null);
  if (peakPanel) {
    assert(peakPanel.isMultiCourse === true,
      `peak panel should be multi-course (peakHeight=${peakPanel.peakHeight})`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 14: Layout return values — peakHeight and peakPosition
// ──────────────────────────────────────────────────────────────
section('Test 14: Layout peakHeight and peakPosition');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  assert(layout.peakHeight === 4890, `layout.peakHeight should be 4890, got ${layout.peakHeight}`);
  assert(layout.peakPosition === 3600, `layout.peakPosition should be 3600, got ${layout.peakPosition}`);
}

// ──────────────────────────────────────────────────────────────
// TEST 15: Panel without peak — heightLeft/heightRight correctly follow slope
// ──────────────────────────────────────────────────────────────
section('Test 15: Non-peak panels follow gable slope');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  });

  // All panels on the ascending side (left of peak) should have heightRight >= heightLeft
  const ascendingPanels = layout.panels.filter(p => p.x + p.width <= 3600 && !p.peakHeight);
  for (const p of ascendingPanels) {
    assert(p.heightRight >= p.heightLeft,
      `P${p.index + 1} (ascending): heightRight (${p.heightRight}) >= heightLeft (${p.heightLeft})`);
  }

  // All panels on the descending side (right of peak) should have heightLeft >= heightRight
  const descendingPanels = layout.panels.filter(p => p.x >= 3600 && !p.peakHeight);
  for (const p of descendingPanels) {
    assert(p.heightLeft >= p.heightRight,
      `P${p.index + 1} (descending): heightLeft (${p.heightLeft}) >= heightRight (${p.heightRight})`);
  }
}

// ──────────────────────────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`RESULTS: ${pass} passed, ${fail} failed out of ${pass + fail} assertions`);
if (fail > 0) {
  console.error('⚠ SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('✓ All tests passed');
}
