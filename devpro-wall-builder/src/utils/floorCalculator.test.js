import { describe, it, expect } from 'vitest';
import { calculateFloorLayout } from './floorCalculator.js';

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

  it('handles bearer lines', () => {
    const withBearers = {
      ...simpleRect,
      bearerLines: [{ position: 2410 }, { position: 3615 }],
    };
    const result = calculateFloorLayout(withBearers);
    expect(result.bearerLines).toHaveLength(2);
    expect(result.bearerLines[0].segments.length).toBeGreaterThan(0);
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
});
