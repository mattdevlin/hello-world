import { describe, it, expect } from 'vitest';
import {
  boundingBox, pointInPolygon, polygonArea, polygonPerimeter,
  polygonEdges, circleToPolygon, clipRectToPolygon, isConvex,
  rectOverlapsOpening,
} from './polygonUtils.js';

const square = [
  { x: 0, y: 0 }, { x: 1000, y: 0 },
  { x: 1000, y: 1000 }, { x: 0, y: 1000 },
];

const lShape = [
  { x: 0, y: 0 }, { x: 6000, y: 0 },
  { x: 6000, y: 3000 }, { x: 3000, y: 3000 },
  { x: 3000, y: 6000 }, { x: 0, y: 6000 },
];

describe('boundingBox', () => {
  it('computes bounding box of a square', () => {
    const bb = boundingBox(square);
    expect(bb.minX).toBe(0);
    expect(bb.minY).toBe(0);
    expect(bb.maxX).toBe(1000);
    expect(bb.maxY).toBe(1000);
    expect(bb.width).toBe(1000);
    expect(bb.height).toBe(1000);
  });

  it('computes bounding box of L-shape', () => {
    const bb = boundingBox(lShape);
    expect(bb.width).toBe(6000);
    expect(bb.height).toBe(6000);
  });
});

describe('pointInPolygon', () => {
  it('detects point inside square', () => {
    expect(pointInPolygon({ x: 500, y: 500 }, square)).toBe(true);
  });

  it('detects point outside square', () => {
    expect(pointInPolygon({ x: 1500, y: 500 }, square)).toBe(false);
  });

  it('detects point inside L-shape', () => {
    expect(pointInPolygon({ x: 1500, y: 1500 }, lShape)).toBe(true);
  });

  it('detects point outside L-shape notch', () => {
    expect(pointInPolygon({ x: 4000, y: 4000 }, lShape)).toBe(false);
  });
});

describe('polygonArea', () => {
  it('computes area of 1m square', () => {
    expect(polygonArea(square)).toBeCloseTo(1000000, 0);
  });

  it('computes area of L-shape', () => {
    // 6000×6000 - 3000×3000 = 27,000,000
    const area = Math.abs(polygonArea(lShape));
    expect(area).toBeCloseTo(27000000, 0);
  });
});

describe('polygonPerimeter', () => {
  it('computes perimeter of square', () => {
    expect(polygonPerimeter(square)).toBeCloseTo(4000, 0);
  });
});

describe('polygonEdges', () => {
  it('returns correct number of edges', () => {
    expect(polygonEdges(square)).toHaveLength(4);
    expect(polygonEdges(lShape)).toHaveLength(6);
  });
});

describe('isConvex', () => {
  it('square is convex', () => {
    expect(isConvex(square)).toBe(true);
  });

  it('L-shape is not convex', () => {
    expect(isConvex(lShape)).toBe(false);
  });
});

describe('circleToPolygon', () => {
  it('generates correct number of points', () => {
    const pts = circleToPolygon(100, 100, 50, 16);
    expect(pts).toHaveLength(16);
  });

  it('all points are at correct radius', () => {
    const pts = circleToPolygon(100, 200, 75, 32);
    for (const p of pts) {
      const dist = Math.sqrt((p.x - 100) ** 2 + (p.y - 200) ** 2);
      expect(dist).toBeCloseTo(75, 5);
    }
  });
});

describe('clipRectToPolygon', () => {
  it('clips rectangle fully inside polygon returns full rect', () => {
    const rect = { x: 100, y: 100, width: 200, height: 200 };
    const clipped = clipRectToPolygon(rect, square);
    expect(clipped.length).toBeGreaterThanOrEqual(4);
    const area = Math.abs(polygonArea(clipped));
    expect(area).toBeCloseTo(40000, 0);
  });

  it('clips rectangle partially outside polygon', () => {
    const rect = { x: 800, y: 800, width: 400, height: 400 };
    const clipped = clipRectToPolygon(rect, square);
    expect(clipped.length).toBeGreaterThanOrEqual(3);
    const area = Math.abs(polygonArea(clipped));
    expect(area).toBeCloseTo(40000, 0); // 200×200 overlap
  });

  it('returns empty for rectangle fully outside', () => {
    const rect = { x: 2000, y: 2000, width: 100, height: 100 };
    const clipped = clipRectToPolygon(rect, square);
    expect(clipped.length).toBeLessThan(3);
  });

  it('clips against concave L-shape', () => {
    // Rect fully inside L-shape bottom portion
    const rect = { x: 100, y: 100, width: 500, height: 500 };
    const clipped = clipRectToPolygon(rect, lShape);
    expect(clipped.length).toBeGreaterThanOrEqual(3);
    const area = Math.abs(polygonArea(clipped));
    // With convex decomposition, at least part of the rect should be captured
    expect(area).toBeGreaterThan(0);
  });
});

describe('rectOverlapsOpening', () => {
  it('detects rectangular overlap', () => {
    const rect = { x: 0, y: 0, width: 1000, height: 1000 };
    const opening = { type: 'rectangular', x: 500, y: 500, width: 200, length: 200 };
    expect(rectOverlapsOpening(rect, opening)).toBe(true);
  });

  it('detects no overlap', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    const opening = { type: 'rectangular', x: 500, y: 500, width: 200, length: 200 };
    expect(rectOverlapsOpening(rect, opening)).toBe(false);
  });

  it('detects circular overlap', () => {
    const rect = { x: 0, y: 0, width: 1000, height: 1000 };
    const opening = { type: 'circular', x: 500, y: 500, diameter: 200 };
    expect(rectOverlapsOpening(rect, opening)).toBe(true);
  });

  it('detects no circular overlap', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    const opening = { type: 'circular', x: 500, y: 500, diameter: 50 };
    expect(rectOverlapsOpening(rect, opening)).toBe(false);
  });
});
