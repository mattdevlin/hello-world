import { describe, it, expect } from 'vitest';
import {
  calculateRoofLayout,
  detectRoofType,
  computeRoofPlanes,
} from './roofCalculator.js';
import { PANEL_PITCH, ROOF_TYPES, ROOF_PANEL_DIRECTIONS } from './constants.js';

// ── detectRoofType ──

describe('detectRoofType', () => {
  it('returns flat for empty walls', () => {
    expect(detectRoofType([])).toBe('flat');
    expect(detectRoofType(null)).toBe('flat');
  });

  it('returns gable when any wall has gable profile', () => {
    const walls = [
      { profile: 'standard' },
      { profile: 'gable' },
    ];
    expect(detectRoofType(walls)).toBe('gable');
  });

  it('returns skillion when any wall has raked profile', () => {
    const walls = [
      { profile: 'standard' },
      { profile: 'raked' },
    ];
    expect(detectRoofType(walls)).toBe('skillion');
  });

  it('returns flat for all standard walls', () => {
    const walls = [
      { profile: 'standard' },
      { profile: 'standard' },
    ];
    expect(detectRoofType(walls)).toBe('flat');
  });

  it('prefers gable over skillion when both present', () => {
    const walls = [
      { profile: 'raked' },
      { profile: 'gable' },
    ];
    expect(detectRoofType(walls)).toBe('gable');
  });
});

// ── computeRoofPlanes ──

describe('computeRoofPlanes', () => {
  it('produces 2 planes for gable roof', () => {
    const planes = computeRoofPlanes({
      type: 'gable',
      length_mm: 10000,
      width_mm: 8000,
      pitch_deg: 20,
      ridgeOffset_mm: 0,
      eaveOverhang_mm: 450,
      gableOverhang_mm: 300,
    });
    expect(planes).toHaveLength(2);
    expect(planes[0].label).toBe('Left Slope');
    expect(planes[1].label).toBe('Right Slope');
    // U length = length + 2*gable overhang
    expect(planes[0].uLength).toBe(10600);
    // Symmetric: both should have same vLength
    expect(planes[0].vLength).toBeCloseTo(planes[1].vLength, 0);
  });

  it('produces 1 plane for skillion roof', () => {
    const planes = computeRoofPlanes({
      type: 'skillion',
      length_mm: 6000,
      width_mm: 4000,
      pitch_deg: 10,
      eaveOverhang_mm: 450,
      gableOverhang_mm: 300,
    });
    expect(planes).toHaveLength(1);
    expect(planes[0].label).toBe('Slope');
    expect(planes[0].uLength).toBe(6600); // 6000 + 2*300
  });

  it('produces 1 plane for flat roof', () => {
    const planes = computeRoofPlanes({
      type: 'flat',
      length_mm: 6000,
      width_mm: 4000,
      pitch_deg: 0,
    });
    expect(planes).toHaveLength(1);
    expect(planes[0].label).toBe('Ceiling');
    expect(planes[0].uLength).toBe(6000);
    expect(planes[0].vLength).toBe(4000);
  });

  it('handles asymmetric gable with ridgeOffset', () => {
    const planes = computeRoofPlanes({
      type: 'gable',
      length_mm: 10000,
      width_mm: 8000,
      pitch_deg: 20,
      ridgeOffset_mm: 1000,
      eaveOverhang_mm: 450,
      gableOverhang_mm: 300,
    });
    // Left half = 4000+1000 = 5000, Right half = 4000-1000 = 3000
    expect(planes[0].planWidth).toBeGreaterThan(planes[1].planWidth);
  });

  it('slope length is longer than plan width for pitched roof', () => {
    const planes = computeRoofPlanes({
      type: 'skillion',
      length_mm: 6000,
      width_mm: 4000,
      pitch_deg: 30,
      eaveOverhang_mm: 0,
      gableOverhang_mm: 0,
    });
    expect(planes[0].vLength).toBeGreaterThan(planes[0].planWidth);
  });
});

// ── calculateRoofLayout ──

describe('calculateRoofLayout', () => {
  it('returns error for invalid dimensions', () => {
    const result = calculateRoofLayout({ length_mm: 0, width_mm: 5000 });
    expect(result.error).toBeTruthy();
  });

  it('calculates flat roof layout', () => {
    const result = calculateRoofLayout({
      type: 'flat',
      length_mm: 6000,
      width_mm: 4000,
      pitch_deg: 0,
      panelDirection: 'along_ridge',
      thickness: 'roof',
      eaveOverhang_mm: 0,
      gableOverhang_mm: 0,
      penetrations: [],
    });
    expect(result.error).toBeUndefined();
    expect(result.panels.length).toBeGreaterThan(0);
    expect(result.type).toBe('flat');
    expect(result.epsDepth).toBe(222);
    // 6000/1205 = 4.98 → 4 full + remainder
    expect(result.totalPanels).toBeGreaterThanOrEqual(4);
  });

  it('calculates gable roof layout with two planes', () => {
    const result = calculateRoofLayout({
      type: 'gable',
      length_mm: 10000,
      width_mm: 8000,
      pitch_deg: 20,
      ridgeOffset_mm: 0,
      panelDirection: 'along_ridge',
      thickness: 'roof',
      eaveOverhang_mm: 450,
      gableOverhang_mm: 300,
      penetrations: [],
    });
    expect(result.error).toBeUndefined();
    expect(result.planes).toHaveLength(2);
    expect(result.planeLayouts).toHaveLength(2);
    // Panels from both planes
    const leftPanels = result.panels.filter(p => p.planeIndex === 0);
    const rightPanels = result.panels.filter(p => p.planeIndex === 1);
    expect(leftPanels.length).toBeGreaterThan(0);
    expect(rightPanels.length).toBeGreaterThan(0);
    expect(result.ridgeLength).toBe(10600);
    expect(result.ridgeHeight).toBeGreaterThan(0);
  });

  it('calculates skillion roof layout', () => {
    const result = calculateRoofLayout({
      type: 'skillion',
      length_mm: 8000,
      width_mm: 5000,
      pitch_deg: 10,
      highEdge: 'left',
      panelDirection: 'along_ridge',
      thickness: 'floor',
      eaveOverhang_mm: 450,
      gableOverhang_mm: 300,
      penetrations: [],
    });
    expect(result.error).toBeUndefined();
    expect(result.planes).toHaveLength(1);
    expect(result.thickness).toBe('floor');
    expect(result.epsDepth).toBe(172);
    expect(result.ridgeLength).toBe(0);
  });

  it('handles penetrations on roof', () => {
    const result = calculateRoofLayout({
      type: 'flat',
      length_mm: 6000,
      width_mm: 4000,
      pitch_deg: 0,
      panelDirection: 'along_ridge',
      thickness: 'roof',
      eaveOverhang_mm: 0,
      gableOverhang_mm: 0,
      penetrations: [
        {
          id: 'sky1',
          ref: 'SKY1',
          type: 'skylight',
          width_mm: 800,
          length_mm: 1200,
          position_x_mm: 1000,
          position_y_mm: 1000,
          plane: 0,
        },
      ],
    });
    expect(result.error).toBeUndefined();
    // At least one panel should have a penetration cut
    const panelsWithCuts = result.panels.filter(p => p.penetrationCuts.length > 0);
    expect(panelsWithCuts.length).toBeGreaterThan(0);
    expect(panelsWithCuts[0].penetrationCuts).toContain('SKY1');
  });

  it('handles eave-to-ridge panel direction', () => {
    const result = calculateRoofLayout({
      type: 'flat',
      length_mm: 6000,
      width_mm: 4000,
      pitch_deg: 0,
      panelDirection: 'eave_to_ridge',
      thickness: 'roof',
      eaveOverhang_mm: 0,
      gableOverhang_mm: 0,
      penetrations: [],
    });
    expect(result.error).toBeUndefined();
    expect(result.panels.length).toBeGreaterThan(0);
  });

  it('creates multi-course layout when slope exceeds max sheet height', () => {
    const result = calculateRoofLayout({
      type: 'flat',
      length_mm: 3000,
      width_mm: 7000,   // exceeds MAX_SHEET_HEIGHT=3050
      pitch_deg: 0,
      panelDirection: 'along_ridge',
      thickness: 'roof',
      eaveOverhang_mm: 0,
      gableOverhang_mm: 0,
      penetrations: [],
    });
    expect(result.error).toBeUndefined();
    expect(result.planeLayouts[0].courses.length).toBeGreaterThan(1);
  });

  it('generates splines between panels', () => {
    const result = calculateRoofLayout({
      type: 'flat',
      length_mm: 6000,
      width_mm: 3000,
      pitch_deg: 0,
      panelDirection: 'along_ridge',
      thickness: 'roof',
      eaveOverhang_mm: 0,
      gableOverhang_mm: 0,
      penetrations: [],
    });
    expect(result.error).toBeUndefined();
    expect(result.splines.length).toBeGreaterThan(0);
  });

  it('uses wall thickness option correctly', () => {
    const result = calculateRoofLayout({
      type: 'flat',
      length_mm: 6000,
      width_mm: 3000,
      pitch_deg: 0,
      thickness: 'wall',
      eaveOverhang_mm: 0,
      gableOverhang_mm: 0,
    });
    expect(result.epsDepth).toBe(142);
    expect(result.totalThickness).toBe(162);
  });

  it('pipe penetration detection works', () => {
    const result = calculateRoofLayout({
      type: 'flat',
      length_mm: 3000,
      width_mm: 3000,
      pitch_deg: 0,
      panelDirection: 'along_ridge',
      thickness: 'roof',
      eaveOverhang_mm: 0,
      gableOverhang_mm: 0,
      penetrations: [
        {
          id: 'pipe1',
          ref: 'P1',
          type: 'pipe',
          diameter_mm: 150,
          position_x_mm: 600,
          position_y_mm: 1500,
          plane: 0,
        },
      ],
    });
    expect(result.error).toBeUndefined();
    const panelsWithCuts = result.panels.filter(p => p.penetrationCuts.length > 0);
    expect(panelsWithCuts.length).toBeGreaterThan(0);
  });
});
