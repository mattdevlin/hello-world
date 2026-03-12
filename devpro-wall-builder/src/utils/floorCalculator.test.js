import { describe, it, expect } from 'vitest';
import { calculateFloorLayout, computeColumnPositions, computeSpanBreaks } from './floorCalculator.js';
import { MIN_FLOOR_PANEL_WIDTH, PANEL_PITCH, PANEL_WIDTH, PANEL_GAP, SPLINE_WIDTH, MAX_SHEET_HEIGHT, FLOOR_EPS_RECESS } from './constants.js';

const simpleRect = {
  name: 'F1',
  polygon: [
    { x: 0, y: 0 }, { x: 6000, y: 0 },
    { x: 6000, y: 4000 }, { x: 0, y: 4000 },
  ],
  panelDirection: 0,
  perimeterPlateWidth: 45,
  bearerLines: [],
  openings: [],
  recesses: [],
};

const lShaped = {
  name: 'F2',
  polygon: [
    { x: 0, y: 0 }, { x: 8000, y: 0 },
    { x: 8000, y: 3000 }, { x: 4000, y: 3000 },
    { x: 4000, y: 6000 }, { x: 0, y: 6000 },
  ],
  panelDirection: 0,
  perimeterPlateWidth: 45,
  bearerLines: [],
  openings: [],
  recesses: [],
};

const withOpenings = {
  ...simpleRect,
  name: 'F3',
  openings: [
    { ref: 'P1', type: 'circular', diameter: 200, x: 1500, y: 2000 },
    { ref: 'P2', type: 'rectangular', width: 400, length: 300, x: 3500, y: 1500 },
  ],
};

const withRecess = {
  ...simpleRect,
  name: 'F4',
  recesses: [
    { ref: 'SH1', type: 'shower', width: 1200, length: 1200, depth: 30, x: 500, y: 500, plateWidth: 45 },
  ],
};

describe('calculateFloorLayout', () => {
  it('returns error for insufficient polygon points', () => {
    const result = calculateFloorLayout({ polygon: [{ x: 0, y: 0 }] });
    expect(result.error).toBeDefined();
  });

  it('calculates simple rectangle layout', () => {
    const result = calculateFloorLayout(simpleRect);
    expect(result.error).toBeUndefined();
    expect(result.panels.length).toBeGreaterThan(0);
    expect(result.totalArea).toBeCloseTo(24000000, -3);
    expect(result.perimeterLength).toBeCloseTo(20000, 0);
    expect(result.perimeterPlates.length).toBe(4);
  });

  it('has correct panel types for rectangle', () => {
    const result = calculateFloorLayout(simpleRect);
    expect(result.fullPanels).toBeGreaterThan(0);
    // All panels should be either full or edge
    for (const p of result.panels) {
      expect(['full', 'edge']).toContain(p.type);
    }
  });

  it('generates splines between panels', () => {
    const result = calculateFloorLayout(simpleRect);
    // With 6000mm width and 1205mm pitch, ~5 panels → 4 splines
    expect(result.reinforcedSplines.length + result.unreinforcedSplines.length).toBeGreaterThan(0);
  });

  it('handles L-shaped polygon', () => {
    const result = calculateFloorLayout(lShaped);
    expect(result.error).toBeUndefined();
    expect(result.panels.length).toBeGreaterThan(0);
    // Area should be 8000*3000 + 4000*3000 = 36,000,000
    expect(result.totalArea).toBeCloseTo(36000000, -3);
  });

  it('processes circular and rectangular openings', () => {
    const result = calculateFloorLayout(withOpenings);
    expect(result.openings).toHaveLength(2);
    expect(result.openings[0].cutoutPolygon.length).toBeGreaterThan(4); // circle approx
    expect(result.openings[1].cutoutPolygon).toHaveLength(4); // rectangle
    // At least some panels should be affected
    const totalAffected = result.openings.reduce((s, o) => s + o.affectedPanels.length, 0);
    expect(totalAffected).toBeGreaterThan(0);
  });

  it('processes shower recess', () => {
    const result = calculateFloorLayout(withRecess);
    expect(result.recesses).toHaveLength(1);
    expect(result.recesses[0].recessPanelThickness).toBe(192 - 30);
    expect(result.recesses[0].recessPlates).toHaveLength(4);
  });

  it('supports 90-degree panel direction', () => {
    const floor90 = { ...simpleRect, panelDirection: 90 };
    const result = calculateFloorLayout(floor90);
    expect(result.error).toBeUndefined();
    expect(result.panels.length).toBeGreaterThan(0);
  });

  it('handles vertical bearer lines', () => {
    const withBearers = {
      ...simpleRect,
      bearerLines: [
        { position: 2410, orientation: 'vertical' },
        { position: 3615, orientation: 'vertical' },
      ],
    };
    const result = calculateFloorLayout(withBearers);
    expect(result.bearerLines).toHaveLength(2);
    expect(result.bearerLines[0].segments.length).toBeGreaterThan(0);
    // Vertical: x1=x2=position
    expect(result.bearerLines[0].segments[0].x1).toBe(2410);
    expect(result.bearerLines[0].segments[0].x2).toBe(2410);
  });

  it('handles horizontal bearer lines', () => {
    const withBearers = {
      ...simpleRect,
      bearerLines: [{ position: 2000, orientation: 'horizontal' }],
    };
    const result = calculateFloorLayout(withBearers);
    expect(result.bearerLines).toHaveLength(1);
    expect(result.bearerLines[0].segments.length).toBeGreaterThan(0);
    // Horizontal: y1=y2=position
    const seg = result.bearerLines[0].segments[0];
    expect(seg.y1).toBe(2000);
    expect(seg.y2).toBe(2000);
    expect(seg.x1).toBeCloseTo(0, 0);
    expect(seg.x2).toBeCloseTo(6000, 0);
  });

  it('defaults bearer orientation to vertical for legacy data', () => {
    const withBearers = {
      ...simpleRect,
      bearerLines: [{ position: 2410 }],
    };
    const result = calculateFloorLayout(withBearers);
    expect(result.bearerLines[0].orientation).toBe('vertical');
    expect(result.bearerLines[0].segments[0].x1).toBe(2410);
  });

  it('splits panels at MAX_SHEET_HEIGHT intervals', () => {
    // 6000x4000, dir=0 → 5 columns, each split at Y=3050 → 10 panels
    const result = calculateFloorLayout(simpleRect);
    expect(result.panels.length).toBe(10);
    // Each column has 2 rows
    const colXs = [...new Set(result.panels.map(p => p.x))];
    expect(colXs.length).toBe(5);
    for (const cx of colXs) {
      const colPanels = result.panels.filter(p => p.x === cx);
      expect(colPanels.length).toBe(2);
      // First segment: Y=0 to Y=3050, second: Y=3050 to Y=4000
      expect(colPanels[0].y).toBe(0);
      expect(colPanels[0].length).toBe(3050);
      expect(colPanels[1].y).toBe(3050);
      expect(colPanels[1].length).toBe(950);
    }
  });

  it('does not split panels when span < MAX_SHEET_HEIGHT', () => {
    const smallRect = {
      ...simpleRect,
      polygon: [
        { x: 0, y: 0 }, { x: 2000, y: 0 },
        { x: 2000, y: 2000 }, { x: 0, y: 2000 },
      ],
    };
    const result = calculateFloorLayout(smallRect);
    // 2000/1205 → 2 columns, each 1 row (2000 < 3050) → 2 panels
    expect(result.panels.length).toBe(2);
  });

  it('generates unreinforced splines between reinforced splines at join positions', () => {
    // 6000x4000, dir=0 → 5 columns, 4 reinforced splines between them
    // At Y=3050 join, each column gets one unreinforced spline segment
    const result = calculateFloorLayout(simpleRect);
    expect(result.unreinforcedSplines.length).toBe(5); // one per column
    // Each unreinforced spline should be horizontal (width > length)
    for (const us of result.unreinforcedSplines) {
      expect(us.length).toBe(146); // SPLINE_WIDTH
      expect(us.width).toBeLessThanOrEqual(1200); // bounded by panel width
      expect(us.width).toBeGreaterThan(0);
      // Y centered on join position 3050
      expect(us.y + us.length / 2).toBeCloseTo(3050, 0);
    }
    // First column has no left spline → starts at polygon edge + joistRecess (55mm)
    const sorted = [...result.unreinforcedSplines].sort((a, b) => a.x - b.x);
    expect(sorted[0].x).toBeCloseTo(55, 0);
    // Middle columns start at right edge of reinforced spline
    expect(sorted[1].x).toBeGreaterThan(1200);
    // Interior column unreinforced spline width matches EPS panel width
    const interiorSpline = sorted[1];
    expect(interiorSpline.width).toBeCloseTo(PANEL_WIDTH - 2 * FLOOR_EPS_RECESS, 0);
  });

  it('generates short-edge joins for rectangle exceeding MAX_SHEET_HEIGHT', () => {
    // 6000x4000, dir=0 → panels span Y=4000 > 3050 → 1 join at Y=3050
    const result = calculateFloorLayout(simpleRect);
    expect(result.shortEdgeJoins).toBeDefined();
    expect(result.shortEdgeJoins.length).toBe(1);
    expect(result.shortEdgeJoins[0].position).toBe(3050);
    // Segment should span the full X width (0 to 6000)
    expect(result.shortEdgeJoins[0].segments.length).toBe(1);
    const seg = result.shortEdgeJoins[0].segments[0];
    expect(seg.x1).toBeCloseTo(0, 0);
    expect(seg.x2).toBeCloseTo(6000, 0);
    expect(seg.y1).toBe(3050);
    expect(seg.y2).toBe(3050);
  });

  it('generates no short-edge joins when span < MAX_SHEET_HEIGHT', () => {
    const smallRect = {
      ...simpleRect,
      polygon: [
        { x: 0, y: 0 }, { x: 2000, y: 0 },
        { x: 2000, y: 2000 }, { x: 0, y: 2000 },
      ],
    };
    const result = calculateFloorLayout(smallRect);
    expect(result.shortEdgeJoins).toBeDefined();
    expect(result.shortEdgeJoins.length).toBe(0);
  });

  it('clips short-edge joins to L-shaped polygon', () => {
    // L-shape: bottom arm 8000x3000, left arm extends to 4000x6000
    // dir=0 → panels span Y → join at Y=3050
    // At Y=3050: bottom arm (x:0-8000) is below y=3000, left arm (x:0-4000) extends to y=6000
    // So the join at Y=3050 should only be in the left arm (x:0 to x:4000)
    const result = calculateFloorLayout(lShaped);
    expect(result.shortEdgeJoins.length).toBeGreaterThan(0);
    const joinAt3050 = result.shortEdgeJoins.find(j => j.position === 3050);
    expect(joinAt3050).toBeDefined();
    // Should have 1 segment spanning x:0 to x:4000 (left arm only)
    expect(joinAt3050.segments.length).toBe(1);
    expect(joinAt3050.segments[0].x1).toBeCloseTo(0, 0);
    expect(joinAt3050.segments[0].x2).toBeCloseTo(4000, 0);
  });

  it('clips spline lengths to polygon boundary for L-shape', () => {
    const result = calculateFloorLayout(lShaped);
    const allSplines = [...result.reinforcedSplines, ...result.unreinforcedSplines];
    expect(allSplines.length).toBeGreaterThan(0);

    // Every spline segment must be fully inside the polygon bounds.
    // For the L-shape, the notch starts at x=4000, y=3000.
    // Splines with center x > 4000 should have length ≤ 3000 (only bottom arm).
    for (const s of allSplines) {
      const splineCenterX = s.x + s.width / 2;
      if (splineCenterX > 4000) {
        // In the narrow arm: spline must not exceed y=3000
        expect(s.y + s.length).toBeLessThanOrEqual(3000 + 1);
        expect(s.length).toBeLessThanOrEqual(3000 + 1);
      }
      // No spline should extend beyond the polygon bounding box
      expect(s.y).toBeGreaterThanOrEqual(-1);
      expect(s.y + s.length).toBeLessThanOrEqual(6000 + 1);
    }
  });

  // ── Penetration logic tests ──

  it('backward compat — no penetrations produces identical grid', () => {
    const result = calculateFloorLayout(simpleRect);
    // Same as before: 5 cols × 2 rows = 10 panels
    expect(result.panels.length).toBe(10);
    const colXs = [...new Set(result.panels.map(p => p.x))].sort((a, b) => a - b);
    expect(colXs.length).toBe(5);
    // Column positions match uniform PANEL_PITCH
    expect(colXs[0]).toBe(0);
    expect(colXs[1]).toBe(PANEL_PITCH);
    expect(colXs[2]).toBe(2 * PANEL_PITCH);
    expect(colXs[3]).toBe(3 * PANEL_PITCH);
    expect(colXs[4]).toBe(4 * PANEL_PITCH);
    // columnPositions returned in layout
    expect(result.columnPositions).toBeDefined();
    expect(result.columnPositions.length).toBe(5);
  });

  it('small penetration within one column — no spline conflict, grid unchanged', () => {
    // ∅110mm at x=600 → center of first panel (0–1200). Spline at ~1202.5.
    // Exclusion zone: [600-55-45, 600+55+45] = [500, 700] → entirely within col 0–1200
    const withSmallPipe = {
      ...simpleRect,
      openings: [
        { ref: 'P1', type: 'circular', diameter: 110, x: 600, y: 2000 },
      ],
    };
    const result = calculateFloorLayout(withSmallPipe);
    // Grid should be unchanged: 5 cols × 2 rows = 10 panels
    expect(result.panels.length).toBe(10);
    const colXs = [...new Set(result.panels.map(p => p.x))].sort((a, b) => a - b);
    expect(colXs.length).toBe(5);
    // Panel should be marked with opening cut
    const affectedPanels = result.panels.filter(p => p.openingCuts.length > 0);
    expect(affectedPanels.length).toBeGreaterThan(0);
  });

  it('penetration spanning spline — repositions columns', () => {
    // Rect 200mm wide at x=1100 → exclusion zone crosses spline at ~1202.5
    // Zone: [1100-45, 1100+200+45] = [1055, 1345]
    const withSplinePen = {
      ...simpleRect,
      openings: [
        { ref: 'P1', type: 'rectangular', width: 200, length: 200, x: 1100, y: 2000 },
      ],
    };
    const result = calculateFloorLayout(withSplinePen);
    // Should have a penetration column
    const penCols = result.columnPositions.filter(c => c.isPenetration);
    expect(penCols.length).toBe(1);
    // All columns must be >= MIN_FLOOR_PANEL_WIDTH
    for (const col of result.columnPositions) {
      expect(col.width).toBeGreaterThanOrEqual(MIN_FLOOR_PANEL_WIDTH - 1);
    }
  });

  it('no column narrower than MIN_FLOOR_PANEL_WIDTH', () => {
    // Large opening that forces tight redistribution
    const withLargePen = {
      ...simpleRect,
      openings: [
        { ref: 'P1', type: 'rectangular', width: 600, length: 300, x: 1000, y: 2000 },
      ],
    };
    const result = calculateFloorLayout(withLargePen);
    for (const col of result.columnPositions) {
      expect(col.width).toBeGreaterThanOrEqual(MIN_FLOOR_PANEL_WIDTH - 1);
    }
  });

  it('remainder redistribution produces columns >= MIN_FLOOR_PANEL_WIDTH', () => {
    // Create a scenario where clear span remainder < MIN_FLOOR_PANEL_WIDTH
    const bb = { minX: 0, maxX: 6000, minY: 0, maxY: 4000 };
    // Opening that creates a clear span with awkward remainder
    const openings = [
      { ref: 'P1', type: 'rectangular', width: 300, length: 200, x: 1100, y: 2000 },
    ];
    const cols = computeColumnPositions(bb, 0, openings);
    for (const col of cols) {
      if (!col.isPenetration) {
        expect(col.width).toBeGreaterThanOrEqual(MIN_FLOOR_PANEL_WIDTH - 1);
      }
    }
  });

  it('multiple adjacent penetrations — zones merge', () => {
    // Two openings with overlapping exclusion zones
    const withTwoPens = {
      ...simpleRect,
      openings: [
        { ref: 'P1', type: 'rectangular', width: 200, length: 200, x: 1100, y: 2000 },
        { ref: 'P2', type: 'rectangular', width: 200, length: 200, x: 1250, y: 2000 },
      ],
    };
    const result = calculateFloorLayout(withTwoPens);
    // Overlapping zones should merge into one penetration column
    const penCols = result.columnPositions.filter(c => c.isPenetration);
    expect(penCols.length).toBe(1);
    // Merged column should reference both openings
    expect(penCols[0].openingIndices.length).toBe(2);
  });

  it('dir=90 penetration — repositions Y-axis columns', () => {
    const floor90pen = {
      ...simpleRect,
      panelDirection: 90,
      openings: [
        { ref: 'P1', type: 'rectangular', width: 200, length: 200, x: 2000, y: 1100 },
      ],
    };
    const result = calculateFloorLayout(floor90pen);
    // Should have a penetration column along Y axis
    const penCols = result.columnPositions.filter(c => c.isPenetration);
    expect(penCols.length).toBe(1);
    // All columns must be >= MIN_FLOOR_PANEL_WIDTH
    for (const col of result.columnPositions) {
      expect(col.width).toBeGreaterThanOrEqual(MIN_FLOOR_PANEL_WIDTH - 1);
    }
  });

  // ── Span-break penetration tests ──

  it('backward compat — no span-axis conflicts produces standard breaks', () => {
    const result = calculateFloorLayout(simpleRect);
    // 6000x4000, dir=0 → span axis Y: break at 3050
    expect(result.spanBreaks).toEqual([0, 3050, 4000]);
    // Still 10 panels, short-edge join at 3050
    expect(result.panels.length).toBe(10);
    expect(result.shortEdgeJoins.length).toBe(1);
    expect(result.shortEdgeJoins[0].position).toBe(3050);
  });

  it('penetration at span break — shifts break to clear opening', () => {
    // Opening at Y=3000 with length=100 → exclusion zone [2955, 3145]
    // Spline band at 3050 ± 73 = [2977, 3123] overlaps → break must shift
    const withSpanPen = {
      ...simpleRect,
      openings: [
        { ref: 'P1', type: 'rectangular', width: 200, length: 100, x: 1500, y: 3000 },
      ],
    };
    const result = calculateFloorLayout(withSpanPen);
    // Break should have moved away from 3050
    const shifted = result.spanBreaks.filter(b => b > 0 && b < 4000);
    expect(shifted.length).toBeGreaterThanOrEqual(1);
    expect(shifted.includes(3050)).toBe(false);
    // All segments must be >= MIN_FLOOR_PANEL_WIDTH and <= MAX_SHEET_HEIGHT
    for (let i = 0; i < result.spanBreaks.length - 1; i++) {
      const seg = result.spanBreaks[i + 1] - result.spanBreaks[i];
      expect(seg).toBeGreaterThanOrEqual(MIN_FLOOR_PANEL_WIDTH);
      expect(seg).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
    }
    // Short-edge joins should match interior breaks
    const interiorBreaks = result.spanBreaks.slice(1, -1);
    expect(result.shortEdgeJoins.length).toBe(interiorBreaks.length);
  });

  it('small penetration not near span break — breaks unchanged', () => {
    // Opening at Y=1500, well away from break at 3050
    const withFarPen = {
      ...simpleRect,
      openings: [
        { ref: 'P1', type: 'circular', diameter: 110, x: 3000, y: 1500 },
      ],
    };
    const result = calculateFloorLayout(withFarPen);
    expect(result.spanBreaks).toEqual([0, 3050, 4000]);
  });

  it('dir=90 span break conflict — shifts X-break and keeps all segments <= MAX_SHEET_HEIGHT', () => {
    // 6000x4000, dir=90 → span axis is X, break at X=3050
    // Opening near X=3050
    const floor90spanPen = {
      ...simpleRect,
      panelDirection: 90,
      openings: [
        { ref: 'P1', type: 'rectangular', width: 100, length: 200, x: 3000, y: 1500 },
      ],
    };
    const result = calculateFloorLayout(floor90spanPen);
    // Break should have shifted away from 3050
    expect(result.spanBreaks.includes(3050)).toBe(false);
    // All segments must be >= MIN_FLOOR_PANEL_WIDTH and <= MAX_SHEET_HEIGHT
    for (let i = 0; i < result.spanBreaks.length - 1; i++) {
      const seg = result.spanBreaks[i + 1] - result.spanBreaks[i];
      expect(seg).toBeGreaterThanOrEqual(MIN_FLOOR_PANEL_WIDTH);
      expect(seg).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
    }
    // No panel should exceed MAX_SHEET_HEIGHT
    for (const p of result.panels) {
      expect(p.width).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
      expect(p.length).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
    }
  });

  it('no panel dimension exceeds MAX_SHEET_HEIGHT (simple rect)', () => {
    const result = calculateFloorLayout(simpleRect);
    for (const p of result.panels) {
      expect(p.width).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
      expect(p.length).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
    }
  });

  it('no panel dimension exceeds MAX_SHEET_HEIGHT (tall rect)', () => {
    const tallRect = {
      ...simpleRect,
      polygon: [
        { x: 0, y: 0 }, { x: 6000, y: 0 },
        { x: 6000, y: 7000 }, { x: 0, y: 7000 },
      ],
    };
    const result = calculateFloorLayout(tallRect);
    for (const p of result.panels) {
      expect(p.width).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
      expect(p.length).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
    }
  });

  it('no panel dimension exceeds MAX_SHEET_HEIGHT (dir=90)', () => {
    const floor90 = { ...simpleRect, panelDirection: 90 };
    const result = calculateFloorLayout(floor90);
    for (const p of result.panels) {
      expect(p.width).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
      expect(p.length).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
    }
  });

  it('opening conflicts with both column spline and span break — both adjust', () => {
    // Place opening at intersection of first spline (~1202.5) and span break (3050)
    const withBothConflict = {
      ...simpleRect,
      openings: [
        { ref: 'P1', type: 'rectangular', width: 200, length: 200, x: 1100, y: 2960 },
      ],
    };
    const result = calculateFloorLayout(withBothConflict);
    // Column spline should have been repositioned
    const penCols = result.columnPositions.filter(c => c.isPenetration);
    expect(penCols.length).toBe(1);
    // Span break should have shifted
    expect(result.spanBreaks.includes(3050)).toBe(false);
    // All segments must be <= MAX_SHEET_HEIGHT
    for (let i = 0; i < result.spanBreaks.length - 1; i++) {
      const seg = result.spanBreaks[i + 1] - result.spanBreaks[i];
      expect(seg).toBeGreaterThanOrEqual(MIN_FLOOR_PANEL_WIDTH);
      expect(seg).toBeLessThanOrEqual(MAX_SHEET_HEIGHT);
    }
  });
});
