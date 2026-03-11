/**
 * Gable wall lintel profile — comprehensive test suite.
 *
 * Verifies that lintels on gable walls get correct peakHeight/peakXLocal
 * when straddling the gable peak, correct height for magboard sizing,
 * and that non-gable lintels are unaffected.
 *
 * Run: node test-gable-lintel.mjs
 */

import { calculateWallLayout } from './src/utils/calculator.js';
import { extractMagboardPieces } from './src/utils/magboardOptimizer.js';
import { WALL_PROFILES, WINDOW_OVERHANG } from './src/utils/constants.js';

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
// TEST 1: User's exact scenario — gable 7200, peak 4890@3600, window at 3000
// ──────────────────────────────────────────────────────────────
section('Test 1: User scenario — gable lintel straddling peak');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    deduction_left_mm: 162,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 3000,
    }],
  });

  assert(layout.lintelPanels.length === 1, `should have 1 lintel, got ${layout.lintelPanels.length}`);
  const lintel = layout.lintelPanels[0];

  // Lintel spans x=2879 to x=4321, peak at x=3600
  const expectedPeakXLocal = 3600 - (3000 - WINDOW_OVERHANG);
  assert(lintel.peakHeight != null, 'lintel should have peakHeight');
  assert(lintel.peakXLocal != null, 'lintel should have peakXLocal');
  assert(lintel.peakXLocal === expectedPeakXLocal,
    `peakXLocal should be ${expectedPeakXLocal}, got ${lintel.peakXLocal}`);

  // Peak height = heightAt(3600) - openingTop = 4890 - 2100 = 2790
  const openingTop = 900 + 1200; // sill + window height
  const expectedPeakH = 4890 - openingTop;
  assert(lintel.peakHeight === expectedPeakH,
    `peakHeight should be ${expectedPeakH}, got ${lintel.peakHeight}`);

  // lintel.height should include peak
  assert(lintel.height === expectedPeakH,
    `lintel.height should be ${expectedPeakH} (includes peak), got ${lintel.height}`);

  // Height at edges should be less than peak
  assert(lintel.heightLeft < lintel.peakHeight,
    `heightLeft (${lintel.heightLeft}) < peakHeight (${lintel.peakHeight})`);
  assert(lintel.heightRight < lintel.peakHeight,
    `heightRight (${lintel.heightRight}) < peakHeight (${lintel.peakHeight})`);

  console.log(`  → Lintel: ${lintel.width}mm wide, hL=${lintel.heightLeft}, peak=${lintel.peakHeight}, hR=${lintel.heightRight}`);
}

// ──────────────────────────────────────────────────────────────
// TEST 2: Window entirely on ascending side (left of peak)
// ──────────────────────────────────────────────────────────────
section('Test 2: Window on ascending side — no peak in lintel');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 500,
    }],
  });

  const lintel = layout.lintelPanels[0];
  // Lintel right = 500 + 1200 + 121 = 1821, peak at 3600 → no straddle
  assert(lintel.peakHeight == null, 'lintel should NOT have peakHeight');
  assert(lintel.peakXLocal == null, 'lintel should NOT have peakXLocal');
  // Ascending side: right should be taller
  assert(lintel.heightRight >= lintel.heightLeft,
    `ascending side: heightRight (${lintel.heightRight}) >= heightLeft (${lintel.heightLeft})`);
}

// ──────────────────────────────────────────────────────────────
// TEST 3: Window entirely on descending side (right of peak)
// ──────────────────────────────────────────────────────────────
section('Test 3: Window on descending side — no peak in lintel');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 5500,
    }],
  });

  const lintel = layout.lintelPanels[0];
  // Lintel left = 5500 - 121 = 5379, peak at 3600 → no straddle
  assert(lintel.peakHeight == null, 'lintel should NOT have peakHeight');
  // Descending side: left should be taller
  assert(lintel.heightLeft >= lintel.heightRight,
    `descending side: heightLeft (${lintel.heightLeft}) >= heightRight (${lintel.heightRight})`);
}

// ──────────────────────────────────────────────────────────────
// TEST 4: Window centered at peak
// ──────────────────────────────────────────────────────────────
section('Test 4: Window centered exactly at peak');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 3000,
    }],
  });

  const lintel = layout.lintelPanels[0];
  assert(lintel.peakHeight != null, 'lintel straddling peak should have peakHeight');
  // Lintel should be symmetric-ish (3600 is center of 3000..4200)
  const diff = Math.abs(lintel.heightLeft - lintel.heightRight);
  assert(diff < 10, `heights should be nearly symmetric, diff=${diff}`);
}

// ──────────────────────────────────────────────────────────────
// TEST 5: Standard flat wall with window — no peak data
// ──────────────────────────────────────────────────────────────
section('Test 5: Standard wall — no peak on lintel');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2700,
    profile: WALL_PROFILES.STANDARD,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 2400,
    }],
  });

  const lintel = layout.lintelPanels[0];
  assert(lintel.peakHeight == null, 'standard wall lintel should NOT have peakHeight');
  assert(lintel.heightLeft === lintel.heightRight,
    `standard wall: heightLeft (${lintel.heightLeft}) === heightRight (${lintel.heightRight})`);
}

// ──────────────────────────────────────────────────────────────
// TEST 6: Raked wall with window — trapezoid, no peak
// ──────────────────────────────────────────────────────────────
section('Test 6: Raked wall — trapezoid lintel, no peak');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2700,
    height_right_mm: 3600,
    profile: WALL_PROFILES.RAKED,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 2400,
    }],
  });

  const lintel = layout.lintelPanels[0];
  assert(lintel.peakHeight == null, 'raked wall lintel should NOT have peakHeight');
  // Raked ascending: right side taller
  assert(lintel.heightRight > lintel.heightLeft,
    `raked ascending: heightRight (${lintel.heightRight}) > heightLeft (${lintel.heightLeft})`);
}

// ──────────────────────────────────────────────────────────────
// TEST 7: Peak exactly at lintel left edge — boundary
// ──────────────────────────────────────────────────────────────
section('Test 7: Peak at lintel left edge (boundary)');
{
  // Position window so lintel left edge = peakX
  // lintelLeft = position - 121, so position = peakX + 121
  const peakX = 3600;
  const position = peakX + WINDOW_OVERHANG; // 3721
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: peakX,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: position,
    }],
  });

  const lintel = layout.lintelPanels[0];
  // lintelLeft = 3721 - 121 = 3600 = peakX → strict inequality fails
  assert(lintel.peakHeight == null,
    'peak at lintel left edge (strict inequality) → no peakHeight');
}

// ──────────────────────────────────────────────────────────────
// TEST 8: Peak exactly at lintel right edge — boundary
// ──────────────────────────────────────────────────────────────
section('Test 8: Peak at lintel right edge (boundary)');
{
  // lintelRight = position + width + 121, so position = peakX - width - 121
  const peakX = 3600;
  const position = peakX - 1200 - WINDOW_OVERHANG; // 2279
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: peakX,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: position,
    }],
  });

  const lintel = layout.lintelPanels[0];
  // lintelRight = 2279 + 1200 + 121 = 3600 = peakX → strict inequality fails
  assert(lintel.peakHeight == null,
    'peak at lintel right edge (strict inequality) → no peakHeight');
}

// ──────────────────────────────────────────────────────────────
// TEST 9: Wide window spanning entire peak region
// ──────────────────────────────────────────────────────────────
section('Test 9: Wide window spanning peak');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 2400, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 2400,
    }],
  });

  const lintel = layout.lintelPanels[0];
  assert(lintel.peakHeight != null, 'wide window lintel should straddle peak');
  // Large difference between edge heights and peak
  const edgeMax = Math.max(lintel.heightLeft, lintel.heightRight);
  assert(lintel.peakHeight > edgeMax,
    `peakHeight (${lintel.peakHeight}) > max edge height (${edgeMax})`);
}

// ──────────────────────────────────────────────────────────────
// TEST 10: Door on gable wall (no sill, but lintel exists)
// ──────────────────────────────────────────────────────────────
section('Test 10: Door on gable wall — lintel with peak');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'D01', type: 'door',
      width_mm: 1200, height_mm: 2100,
      sill_mm: 0, position_from_left_mm: 3000,
    }],
  });

  const lintel = layout.lintelPanels[0];
  assert(lintel.peakHeight != null, 'door lintel straddling peak should have peakHeight');
  // Door is taller (2100mm), so lintel height is less
  const expectedPeakH = 4890 - 2100;
  assert(lintel.peakHeight === expectedPeakH,
    `door lintel peakHeight should be ${expectedPeakH}, got ${lintel.peakHeight}`);
  // Should have no footer for door
  assert(layout.footers.length === 0, 'door should have no footer');
}

// ──────────────────────────────────────────────────────────────
// TEST 11: Lintel height includes peak (invariant)
// ──────────────────────────────────────────────────────────────
section('Test 11: lintel.height includes peak height');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 3000,
    }],
  });

  const lintel = layout.lintelPanels[0];
  assert(lintel.height >= lintel.heightLeft,
    `height (${lintel.height}) >= heightLeft (${lintel.heightLeft})`);
  assert(lintel.height >= lintel.heightRight,
    `height (${lintel.height}) >= heightRight (${lintel.heightRight})`);
  assert(lintel.height >= (lintel.peakHeight || 0),
    `height (${lintel.height}) >= peakHeight (${lintel.peakHeight})`);
  assert(lintel.height === Math.max(lintel.heightLeft, lintel.heightRight, lintel.peakHeight || 0),
    'height should be max of all three');
}

// ──────────────────────────────────────────────────────────────
// TEST 12: Magboard optimizer uses correct lintel height
// ──────────────────────────────────────────────────────────────
section('Test 12: Magboard optimizer bins lintel with peak height');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 3000,
    }],
  });

  const { cutPieces } = extractMagboardPieces(layout, 'N-W1');
  const lintelPanelPieces = cutPieces.filter(p => p.type === 'lintelPanel');
  assert(lintelPanelPieces.length === 2, `should have 2 lintel panel pieces (front+back), got ${lintelPanelPieces.length}`);

  // The lintel piece height should include the peak
  const lintel = layout.lintelPanels[0];
  for (const piece of lintelPanelPieces) {
    assert(piece.height === lintel.height,
      `lintel panel piece height (${piece.height}) should match lintel.height (${lintel.height})`);
    // With peak height ~2790, this needs a 3050mm sheet (> 2745)
    assert(piece.height > 2745,
      `lintel panel piece height (${piece.height}) > 2745 → needs 3050mm sheet`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 13: Lintel with peakHeight fitting on 2745mm sheet
// ──────────────────────────────────────────────────────────────
section('Test 13: Short gable — lintel peak fits on 2745mm sheet');
{
  const layout = calculateWallLayout({
    length_mm: 4800,
    height_mm: 2400,
    peak_height_mm: 2700,
    peak_position_mm: 2400,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 800, height_mm: 800,
      sill_mm: 600, position_from_left_mm: 2000,
    }],
  });

  const lintel = layout.lintelPanels[0];
  if (lintel.peakHeight) {
    // Peak height from opening top: 2700 - (600+800) = 1300mm → fits on 2745mm sheet
    assert(lintel.peakHeight <= 2745,
      `short gable lintel peak (${lintel.peakHeight}) fits on 2745mm sheet`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 14: Lintel with peakHeight needing 3050mm sheet
// ──────────────────────────────────────────────────────────────
section('Test 14: Tall gable — lintel peak needs 3050mm sheet');
{
  // Peak at 4890, opening top at 2100 → lintel peak = 2790mm > 2745
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 3000,
    }],
  });

  const lintel = layout.lintelPanels[0];
  assert(lintel.height > 2745,
    `lintel height (${lintel.height}) > 2745 → needs 3050mm sheet`);
  assert(lintel.height <= 3050,
    `lintel height (${lintel.height}) <= 3050 → fits on 3050mm sheet`);
}

// ──────────────────────────────────────────────────────────────
// TEST 15: Standard wall lintel backward compatibility
// ──────────────────────────────────────────────────────────────
section('Test 15: Standard wall lintel — rectangle');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2700,
    profile: WALL_PROFILES.STANDARD,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 2400,
    }],
  });

  const lintel = layout.lintelPanels[0];
  assert(lintel.peakHeight == null, 'no peakHeight on standard wall');
  assert(lintel.heightLeft === lintel.heightRight, 'heights equal on standard wall');
  assert(lintel.height === lintel.heightLeft, 'height equals heightLeft');
}

// ──────────────────────────────────────────────────────────────
// TEST 16: Raked wall lintel backward compatibility
// ──────────────────────────────────────────────────────────────
section('Test 16: Raked wall lintel — trapezoid');
{
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 2700,
    height_right_mm: 3600,
    profile: WALL_PROFILES.RAKED,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 2400,
    }],
  });

  const lintel = layout.lintelPanels[0];
  assert(lintel.peakHeight == null, 'no peakHeight on raked wall');
  assert(lintel.heightRight > lintel.heightLeft,
    `raked: heightRight (${lintel.heightRight}) > heightLeft (${lintel.heightLeft})`);
  assert(lintel.height === Math.max(lintel.heightLeft, lintel.heightRight),
    'height is max of left/right');
}

// ──────────────────────────────────────────────────────────────
// TEST 17: Multiple windows on gable wall
// ──────────────────────────────────────────────────────────────
section('Test 17: Multiple windows on gable wall');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [
      {
        ref: 'W01', type: 'window',
        width_mm: 800, height_mm: 800,
        sill_mm: 900, position_from_left_mm: 500,
      },
      {
        ref: 'W02', type: 'window',
        width_mm: 1200, height_mm: 1200,
        sill_mm: 900, position_from_left_mm: 3000,
      },
      {
        ref: 'W03', type: 'window',
        width_mm: 800, height_mm: 800,
        sill_mm: 900, position_from_left_mm: 5500,
      },
    ],
  });

  assert(layout.lintelPanels.length === 3, `should have 3 lintels, got ${layout.lintelPanels.length}`);

  // W01 (ascending, far left) — no peak
  const l1 = layout.lintelPanels.find(l => l.ref === 'W01');
  assert(l1.peakHeight == null, 'W01 lintel should NOT straddle peak');

  // W02 (straddles peak) — has peak
  const l2 = layout.lintelPanels.find(l => l.ref === 'W02');
  assert(l2.peakHeight != null, 'W02 lintel SHOULD straddle peak');

  // W03 (descending, far right) — no peak
  const l3 = layout.lintelPanels.find(l => l.ref === 'W03');
  assert(l3.peakHeight == null, 'W03 lintel should NOT straddle peak');
}

// ──────────────────────────────────────────────────────────────
// TEST 18: Lintel with zero height on one side
// ──────────────────────────────────────────────────────────────
section('Test 18: Lintel where one side has zero height');
{
  // Window opening top = sill + height = 900 + 2500 = 3400
  // Wall height at lintel edges may be < 3400 on some parts
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4000,
    peak_position_mm: 3600,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 2500,
      sill_mm: 900, position_from_left_mm: 3000,
    }],
  });

  const lintel = layout.lintelPanels[0];
  // Opening top = 3400. At edges, wall may be ~3380. Height = max(0, wallH - 3400)
  // At peak, wall is 4000. Peak lintel height = 4000 - 3400 = 600
  if (lintel.peakHeight) {
    assert(lintel.peakHeight > 0,
      `peakHeight (${lintel.peakHeight}) should be > 0`);
    // Edge heights might be very small or zero
    console.log(`  → hL=${lintel.heightLeft}, peak=${lintel.peakHeight}, hR=${lintel.heightRight}`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 19: Very short gable (peak barely above eave)
// ──────────────────────────────────────────────────────────────
section('Test 19: Short gable — small peak difference');
{
  const layout = calculateWallLayout({
    length_mm: 4800,
    height_mm: 2400,
    peak_height_mm: 2500,  // Only 100mm above eave
    peak_position_mm: 2400,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 800, height_mm: 800,
      sill_mm: 600, position_from_left_mm: 2000,
    }],
  });

  const lintel = layout.lintelPanels[0];
  if (lintel.peakHeight) {
    // Small difference between peak and edges
    const diff = lintel.peakHeight - Math.max(lintel.heightLeft, lintel.heightRight);
    assert(diff >= 0, `peak should be >= edges, diff=${diff}`);
    console.log(`  → Peak adds ${diff}mm over edge heights`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 20: Off-centre peak
// ──────────────────────────────────────────────────────────────
section('Test 20: Off-centre peak (x=1800 of 7200mm wall)');
{
  const layout = calculateWallLayout({
    length_mm: 7200,
    height_mm: 2700,
    peak_height_mm: 4890,
    peak_position_mm: 1800,
    profile: WALL_PROFILES.GABLE,
    openings: [{
      ref: 'W01', type: 'window',
      width_mm: 1200, height_mm: 1200,
      sill_mm: 900, position_from_left_mm: 1200,
    }],
  });

  const lintel = layout.lintelPanels[0];
  // Lintel left = 1200 - 121 = 1079, right = 1200 + 1200 + 121 = 2521
  // Peak at 1800 is inside [1079, 2521]
  assert(lintel.peakHeight != null, 'off-centre peak lintel should have peakHeight');
  if (lintel.peakHeight) {
    assert(lintel.peakXLocal === 1800 - (1200 - WINDOW_OVERHANG),
      `peakXLocal should reflect off-centre position, got ${lintel.peakXLocal}`);
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
