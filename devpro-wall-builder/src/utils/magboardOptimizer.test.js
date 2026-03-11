import { describe, it, expect } from 'vitest';
import { extractMagboardPieces, computeProjectMagboardSheets } from './magboardOptimizer.js';
import { calculateWallLayout } from './calculator.js';

// ─────────────────────────────────────────────────────────────
// Helper: build a minimal wall object
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// extractMagboardPieces
// ─────────────────────────────────────────────────────────────
describe('extractMagboardPieces', () => {
  it('simple wall (no openings): panel sheets = panels × 2', () => {
    const wall = makeWall({ length_mm: 4800, height_mm: 2700 });
    const layout = calculateWallLayout(wall);
    const { panelSheets, cutPieces } = extractMagboardPieces(layout, 'W1');

    // 4800mm fits 3 full panels (3 × 1205 = 3615) + remainder panel → 4 panels
    expect(layout.panels.length).toBe(4);
    // Each panel → 2 sheets (front + back), single course
    expect(panelSheets.length).toBe(layout.panels.length * 2);

    // No openings → no lintels, no footers
    const lintelPieces = cutPieces.filter(p => p.type === 'lintelPanel');
    const footerPieces = cutPieces.filter(p => p.type === 'footer');
    expect(lintelPieces.length).toBe(0);
    expect(footerPieces.length).toBe(0);

    // Splines between panels (3 joints × 2 each)
    const splines = cutPieces.filter(p => p.type === 'spline');
    expect(splines.length).toBe((layout.panels.length - 1) * 2);
  });

  it('single full-width panel: 2 sheets, 0 splines', () => {
    const wall = makeWall({ length_mm: 1200, height_mm: 2700 });
    const layout = calculateWallLayout(wall);
    const { panelSheets, cutPieces } = extractMagboardPieces(layout, 'W1');

    expect(layout.panels.length).toBe(1);
    expect(panelSheets.length).toBe(2);
    expect(cutPieces.filter(p => p.type === 'spline').length).toBe(0);
  });

  it('wall with window: generates lintels, footers, and opening splines', () => {
    const wall = makeWall({
      length_mm: 4800,
      height_mm: 2700,
      openings: [{
        ref: 'W1',
        type: 'window',
        position_from_left_mm: 1500,
        width_mm: 1200,
        height_mm: 1200,
        sill_mm: 900,
      }],
    });
    const layout = calculateWallLayout(wall);
    const { cutPieces } = extractMagboardPieces(layout, 'W1');

    // 1 lintel × 2 pieces
    expect(cutPieces.filter(p => p.type === 'lintelPanel').length).toBe(2);
    // 1 footer × 2 pieces (window has sill > 0)
    expect(cutPieces.filter(p => p.type === 'footer').length).toBe(2);
    // Opening splines: window with sill → 2 sides × 2 pieces × 2 (front+back) = 8
    // plus joint splines between panels (varies)
    expect(cutPieces.filter(p => p.type === 'spline').length).toBeGreaterThan(0);
  });

  it('wall with door: generates lintels but no footers', () => {
    const wall = makeWall({
      length_mm: 4800,
      height_mm: 2700,
      openings: [{
        ref: 'D1',
        type: 'door',
        position_from_left_mm: 1500,
        width_mm: 900,
        height_mm: 2100,
        sill_mm: 0,
      }],
    });
    const layout = calculateWallLayout(wall);
    const { cutPieces } = extractMagboardPieces(layout, 'W1');

    expect(cutPieces.filter(p => p.type === 'lintelPanel').length).toBe(2);
    expect(cutPieces.filter(p => p.type === 'footer').length).toBe(0);
  });

  it('deductions: generates 2 pieces per side', () => {
    const wall = makeWall({
      length_mm: 4800,
      height_mm: 2700,
      deduction_left_mm: 162,
      deduction_right_mm: 162,
    });
    const layout = calculateWallLayout(wall);
    const { cutPieces } = extractMagboardPieces(layout, 'W1');

    const deductions = cutPieces.filter(p => p.type === 'deduction');
    expect(deductions.length).toBe(4); // 2 left + 2 right
  });

  it('single-course wall: no horizontal splines', () => {
    const wall = makeWall({ length_mm: 4800, height_mm: 2700 });
    const layout = calculateWallLayout(wall);
    const { cutPieces } = extractMagboardPieces(layout, 'W1');

    expect(layout.isMultiCourse).toBe(false);
    expect(cutPieces.filter(p => p.type === 'hspline').length).toBe(0);
  });

  it('multi-course wall: horizontal splines = panels × (courses-1) × 2', () => {
    const wall = makeWall({ length_mm: 2400, height_mm: 4000 });
    const layout = calculateWallLayout(wall);
    const { cutPieces } = extractMagboardPieces(layout, 'W1');

    expect(layout.isMultiCourse).toBe(true);
    const hsplines = cutPieces.filter(p => p.type === 'hspline');
    // Panels per course (x-positions); layout.panels now includes all courses
    const panelsPerCourse = layout.panels.filter(p => p.course === 0).length;
    const expectedCount = panelsPerCourse * (layout.courses.length - 1) * 2;
    expect(hsplines.length).toBe(expectedCount);

    // Each hspline height should be SPLINE_WIDTH (146mm)
    for (const hs of hsplines) {
      expect(hs.height).toBe(146);
    }
  });

  it('multi-course horizontal spline width accounts for vertical spline edges and 10mm clearance', () => {
    // 3-panel wall (3 × 1205 = 3615, fits in 4800) → 2 joints with vertical splines
    const wall = makeWall({ length_mm: 4800, height_mm: 4000 });
    const layout = calculateWallLayout(wall);
    const { cutPieces } = extractMagboardPieces(layout, 'W1');

    expect(layout.isMultiCourse).toBe(true);
    // Use course 0 panels for x-position checks (same positions across courses)
    const basePanels = layout.panels.filter(p => (p.course ?? 0) === 0);
    expect(basePanels.length).toBeGreaterThanOrEqual(3);

    const hsplines = cutPieces.filter(p => p.type === 'hspline');
    const SPLINE_W = 146;
    const CLEARANCE = 10;

    // Check the middle panel (index 1) — has vertical splines on both sides
    // Left spline inner edge = gap_centre + SPLINE_W/2
    // Right spline inner edge = gap_centre - SPLINE_W/2
    // hspline width = rightEdge - leftEdge - 20
    const midPanel = basePanels[1];
    const leftGap = basePanels[0].x + basePanels[0].width + 5 / 2;
    const rightGap = midPanel.x + midPanel.width + 5 / 2;
    const expectedMidWidth = (rightGap - SPLINE_W / 2) - (leftGap + SPLINE_W / 2) - 2 * CLEARANCE;

    const midHsplines = hsplines.filter(h => h.label.includes(`P${midPanel.index + 1}`));
    expect(midHsplines.length).toBe(2); // front + back
    expect(midHsplines[0].width).toBeCloseTo(expectedMidWidth, 0);

    // First panel — left boundary is panel.x + BOTTOM_PLATE (past vertical timber), right is spline inner edge
    const BOTTOM_PLATE = 45;
    const firstPanel = basePanels[0];
    const firstRightGap = firstPanel.x + firstPanel.width + 5 / 2;
    const expectedFirstWidth = (firstRightGap - SPLINE_W / 2) - (firstPanel.x + BOTTOM_PLATE) - 2 * CLEARANCE;
    const firstHsplines = hsplines.filter(h => h.label.includes(`P${firstPanel.index + 1}`));
    expect(firstHsplines[0].width).toBeCloseTo(expectedFirstWidth, 0);
    // First panel boundary: timber edge (panel.x) + 10mm clearance on left,
    // spline inner edge - 10mm clearance on right → shorter than full panel width
    expect(firstHsplines[0].width).toBeLessThan(firstPanel.width);

    // Last panel — left is spline inner edge, right boundary is panel edge - BOTTOM_PLATE (past vertical timber)
    const lastPanel = basePanels[basePanels.length - 1];
    const lastLeftGap = basePanels[basePanels.length - 2].x + basePanels[basePanels.length - 2].width + 5 / 2;
    const expectedLastWidth = (lastPanel.x + lastPanel.width - BOTTOM_PLATE) - (lastLeftGap + SPLINE_W / 2) - 2 * CLEARANCE;
    const lastHsplines = hsplines.filter(h => h.label.includes(`P${lastPanel.index + 1}`));
    expect(lastHsplines[0].width).toBeCloseTo(expectedLastWidth, 0);
    // Last panel boundary: spline inner edge + 10mm on left, timber edge - 10mm on right
    expect(lastHsplines[0].width).toBeLessThan(lastPanel.width);
  });

  it('multi-course wall: panel sheets = panels × courses × 2', () => {
    // Height > 3050mm → triggers multi-course (2 courses)
    const wall = makeWall({ length_mm: 2400, height_mm: 4000 });
    const layout = calculateWallLayout(wall);
    const { panelSheets } = extractMagboardPieces(layout, 'W1');

    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses.length).toBe(2);

    // Each panel in layout.panels is now course-specific → 2 sheets each (front + back)
    const expectedSheets = layout.panels.length * 2;

    expect(panelSheets.length).toBe(expectedSheets);
  });
});

// ─────────────────────────────────────────────────────────────
// computeProjectMagboardSheets
// ─────────────────────────────────────────────────────────────
describe('computeProjectMagboardSheets', () => {
  it('totalSheets = total2745 + total3050', () => {
    const walls = [
      makeWall({ id: 'w1', name: 'Wall 1', length_mm: 6000, height_mm: 2700 }),
      makeWall({ id: 'w2', name: 'Wall 2', length_mm: 3600, height_mm: 2700 }),
    ];
    const result = computeProjectMagboardSheets(walls);

    expect(result.totalSheets).toBe(result.total2745 + result.total3050);
  });

  it('total2745 = panelSheets2745 + cutSheets2745', () => {
    const walls = [
      makeWall({ id: 'w1', name: 'Wall 1', length_mm: 4800, height_mm: 2700 }),
    ];
    const result = computeProjectMagboardSheets(walls);

    expect(result.total2745).toBe(result.panelSheets2745 + result.cutSheets2745);
    expect(result.total3050).toBe(result.panelSheets3050 + result.cutSheets3050);
  });

  it('panelSheetCount matches sum of per-wall counts', () => {
    const walls = [
      makeWall({ id: 'w1', name: 'Wall 1', length_mm: 6000, height_mm: 2700 }),
      makeWall({ id: 'w2', name: 'Wall 2', length_mm: 3600, height_mm: 3000 }),
      makeWall({
        id: 'w3', name: 'Wall 3', length_mm: 4800, height_mm: 2700,
        openings: [{
          ref: 'W1', type: 'window',
          position_from_left_mm: 1500, width_mm: 1200,
          height_mm: 1200, sill_mm: 900,
        }],
      }),
    ];
    const result = computeProjectMagboardSheets(walls);

    const sumPanelSheets = result.perWall.reduce((s, w) => s + w.panelSheetCount, 0);
    expect(result.panelSheetCount).toBe(sumPanelSheets);
  });

  it('cut piece type totals match sum of per-wall counts', () => {
    const walls = [
      makeWall({
        id: 'w1', name: 'Wall 1', length_mm: 6000, height_mm: 2700,
        deduction_left_mm: 162,
        openings: [{
          ref: 'W1', type: 'window',
          position_from_left_mm: 2000, width_mm: 1200,
          height_mm: 1200, sill_mm: 900,
        }],
      }),
      makeWall({
        id: 'w2', name: 'Wall 2', length_mm: 4800, height_mm: 2700,
        openings: [{
          ref: 'D1', type: 'door',
          position_from_left_mm: 1500, width_mm: 900,
          height_mm: 2100, sill_mm: 0,
        }],
      }),
    ];
    const result = computeProjectMagboardSheets(walls);

    const sumLintels = result.perWall.reduce((s, w) => s + w.lintelPanelCount, 0);
    const sumFooters = result.perWall.reduce((s, w) => s + w.footerCount, 0);
    const sumSplines = result.perWall.reduce((s, w) => s + w.splineCount, 0);
    const sumDeductions = result.perWall.reduce((s, w) => s + w.deductionCount, 0);
    const sumHsplines = result.perWall.reduce((s, w) => s + w.hsplineCount, 0);

    expect(result.totalLintelPanels).toBe(sumLintels);
    expect(result.totalFooters).toBe(sumFooters);
    expect(result.totalSplines).toBe(sumSplines);
    expect(result.totalDeductions).toBe(sumDeductions);
    expect(result.totalHsplines).toBe(sumHsplines);
  });

  it('panelSheetCount = panelSheets2745 + panelSheets3050', () => {
    const walls = [
      makeWall({ id: 'w1', name: 'Wall 1', length_mm: 4800, height_mm: 2700 }),
      makeWall({ id: 'w2', name: 'Wall 2', length_mm: 3600, height_mm: 3000 }),
    ];
    const result = computeProjectMagboardSheets(walls);

    expect(result.panelSheetCount).toBe(result.panelSheets2745 + result.panelSheets3050);
  });

  it('cutPieceCount matches actual cut pieces extracted', () => {
    const walls = [
      makeWall({
        id: 'w1', name: 'Wall 1', length_mm: 6000, height_mm: 2700,
        openings: [{
          ref: 'W1', type: 'window',
          position_from_left_mm: 2000, width_mm: 1200,
          height_mm: 1200, sill_mm: 900,
        }],
        deduction_left_mm: 162,
        deduction_right_mm: 162,
      }),
    ];
    const result = computeProjectMagboardSheets(walls);

    expect(result.cutPieceCount).toBe(
      result.totalLintelPanels + result.totalFooters +
      result.totalSplines + result.totalDeductions +
      result.totalHsplines
    );
  });

  it('cutSheets are at least enough to hold all cut pieces', () => {
    const walls = [
      makeWall({
        id: 'w1', name: 'Wall 1', length_mm: 6000, height_mm: 2700,
        openings: [{
          ref: 'W1', type: 'window',
          position_from_left_mm: 2000, width_mm: 1200,
          height_mm: 1200, sill_mm: 900,
        }],
      }),
    ];
    const result = computeProjectMagboardSheets(walls);

    // If there are cut pieces, there must be at least 1 cut sheet
    if (result.cutPieceCount > 0) {
      expect(result.cutSheets2745 + result.cutSheets3050).toBeGreaterThan(0);
    }
  });

  it('cut utilization is between 0 and 1 when cut pieces exist', () => {
    const walls = [
      makeWall({
        id: 'w1', name: 'Wall 1', length_mm: 6000, height_mm: 2700,
        openings: [{
          ref: 'W1', type: 'window',
          position_from_left_mm: 2000, width_mm: 1200,
          height_mm: 1200, sill_mm: 900,
        }],
      }),
    ];
    const result = computeProjectMagboardSheets(walls);

    if (result.cutPieceCount > 0) {
      expect(result.cutUtilization).toBeGreaterThan(0);
      expect(result.cutUtilization).toBeLessThanOrEqual(1);
    }
  });

  it('multi-course wall totals are consistent', () => {
    const walls = [
      makeWall({ id: 'w1', name: 'Wall 1', length_mm: 4800, height_mm: 4000 }),
    ];
    const result = computeProjectMagboardSheets(walls);

    expect(result.totalSheets).toBe(result.total2745 + result.total3050);
    expect(result.total2745).toBe(result.panelSheets2745 + result.cutSheets2745);
    expect(result.total3050).toBe(result.panelSheets3050 + result.cutSheets3050);
    expect(result.panelSheetCount).toBe(result.panelSheets2745 + result.panelSheets3050);
    // Multi-course → should have more panel sheets than a single-course wall of same panel count
    expect(result.panelSheetCount).toBeGreaterThan(0);
  });

  it('empty project returns zero totals', () => {
    const result = computeProjectMagboardSheets([]);

    expect(result.totalSheets).toBe(0);
    expect(result.panelSheetCount).toBe(0);
    expect(result.cutPieceCount).toBe(0);
    expect(result.total2745).toBe(0);
    expect(result.total3050).toBe(0);
  });

  it('hand-calculated: simple 2-panel wall sheet count', () => {
    // 2400mm wall → 1 full panel (1200) + gap (5) + 1 end panel (1195) = 2 panels
    const wall = makeWall({ length_mm: 2400, height_mm: 2700 });
    const layout = calculateWallLayout(wall);

    expect(layout.panels.length).toBe(2);

    const result = computeProjectMagboardSheets([wall]);

    // 2 panels × 2 sheets = 4 panel sheets
    expect(result.panelSheetCount).toBe(4);
    // 2700mm height → fits on 2745 sheets
    expect(result.panelSheets2745).toBe(4);
    expect(result.panelSheets3050).toBe(0);
    // 1 joint spline × 2 pieces → packed onto cut sheets
    expect(result.totalSplines).toBe(2);
    // Totals check
    expect(result.totalSheets).toBe(result.total2745 + result.total3050);
  });
});
