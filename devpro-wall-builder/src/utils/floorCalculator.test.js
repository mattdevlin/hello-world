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
});
