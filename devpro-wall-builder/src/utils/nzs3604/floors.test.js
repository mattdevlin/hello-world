import { describe, it, expect } from 'vitest';
import {
  getFloorJoistSize,
  getBearerSize,
  getPileFootingSize,
  getFlooringThickness,
} from './floors.js';

// ─────────────────────────────────────────────────────────────
// Floor Joists (Table 7.1)
// ─────────────────────────────────────────────────────────────

describe('getFloorJoistSize', () => {
  it('2.0 kPa, 450mm spacing, 4.0m span → 240x45', () => {
    const result = getFloorJoistSize(2.0, 450, 4.0);
    expect(result).not.toBeNull();
    expect(result.size).toBe('240x45');
    expect(result.maxSpanM).toBe(4.05);
    expect(result.tableRef).toContain('7.1');
  });

  it('1.5 kPa, 600mm spacing, 3.0m span → 190x45', () => {
    const result = getFloorJoistSize(1.5, 600, 3.0);
    expect(result).not.toBeNull();
    expect(result.size).toBe('190x45');
    expect(result.maxSpanM).toBe(3.15);
  });

  it('1.5 kPa, 400mm spacing, 1.0m span → 90x45 (smallest available)', () => {
    const result = getFloorJoistSize(1.5, 400, 1.0);
    expect(result).not.toBeNull();
    expect(result.size).toBe('90x45');
  });

  it('2.0 kPa, 600mm spacing, 5.0m span → null (exceeds all sizes)', () => {
    const result = getFloorJoistSize(2.0, 600, 5.0);
    expect(result).toBeNull();
  });

  it('1.5 kPa vs 2.0 kPa: lower load allows longer span for same size', () => {
    const light = getFloorJoistSize(1.5, 450, 4.2);
    const heavy = getFloorJoistSize(2.0, 450, 4.2);
    // 1.5 kPa: 240x45 at 450 = 4.3m (sufficient)
    expect(light.size).toBe('240x45');
    // 2.0 kPa: 240x45 at 450 = 4.05m (not sufficient), needs 290x45
    expect(heavy.size).toBe('290x45');
  });

  it('returns null for invalid load', () => {
    const result = getFloorJoistSize(3.0, 450, 2.0);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Bearers (Table 6.4)
// ─────────────────────────────────────────────────────────────

describe('getBearerSize', () => {
  it('1.5 kPa, 1.65m bearer span, 2.0m loaded dim → 140x70', () => {
    const result = getBearerSize(1.5, 1.65, 2.0);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x70');
    expect(result.maxLoadedDimM).toBe(2.2);
    expect(result.tableRef).toContain('6.4');
  });

  it('2.0 kPa, 1.30m bearer span, 2.0m loaded dim → 140x70', () => {
    const result = getBearerSize(2.0, 1.30, 2.0);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x70');
    expect(result.maxLoadedDimM).toBe(2.3);
  });

  it('rounds UP bearer span: 1.5m → uses 1.65 row', () => {
    const result = getBearerSize(1.5, 1.5, 2.0);
    expect(result).not.toBeNull();
    // At bearer span 1.65, 140x70 has max loaded dim 2.2 >= 2.0
    expect(result.size).toBe('140x70');
  });

  it('returns null when loaded dim exceeds all sizes', () => {
    const result = getBearerSize(2.0, 2.0, 10.0);
    expect(result).toBeNull();
  });

  it('returns null when bearer span exceeds table', () => {
    const result = getBearerSize(1.5, 5.0, 1.0);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Pile Footings (Table 6.1)
// ─────────────────────────────────────────────────────────────

describe('getPileFootingSize', () => {
  it('1.65m bearer span, 2.0m joist span, 1_storey → 300mm sq, 340mm circ', () => {
    const result = getPileFootingSize(1.65, 2.0, '1_storey');
    expect(result).not.toBeNull();
    expect(result.squareMm).toBe(300);
    expect(result.circularMm).toBe(340);
    expect(result.tableRef).toContain('6.1');
  });

  it('1.3m bearer, 3.5m joist, floor_only → 225mm sq', () => {
    const result = getPileFootingSize(1.3, 3.5, 'floor_only');
    expect(result).not.toBeNull();
    expect(result.squareMm).toBe(225);
    expect(result.circularMm).toBe(260);
  });

  it('2.0m bearer, 3.5m joist, 3_storey → 575mm sq', () => {
    const result = getPileFootingSize(2.0, 3.5, '3_storey');
    expect(result).not.toBeNull();
    expect(result.squareMm).toBe(575);
    expect(result.circularMm).toBe(650);
  });

  it('rounds UP bearer span: 1.5m → uses 1.65 row', () => {
    const result = getPileFootingSize(1.5, 2.0, 'floor_only');
    expect(result).not.toBeNull();
    // 1.5 rounds up to 1.65 row
    expect(result.squareMm).toBe(200);
  });

  it('rounds UP joist span: 2.5m → uses 3.5 row', () => {
    const result = getPileFootingSize(1.3, 2.5, 'floor_only');
    expect(result).not.toBeNull();
    // 2.5 rounds up to 3.5 row
    expect(result.squareMm).toBe(225);
  });

  it('returns null for invalid load type', () => {
    const result = getPileFootingSize(1.3, 2.0, 'invalid');
    expect(result).toBeNull();
  });

  it('returns null when spans exceed table', () => {
    const result = getPileFootingSize(5.0, 2.0, 'floor_only');
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Flooring Thickness (Tables 7.3/7.4)
// ─────────────────────────────────────────────────────────────

describe('getFlooringThickness', () => {
  it('450mm spacing, strip → {A: 19, B: 16}', () => {
    const result = getFlooringThickness(450, 'strip');
    expect(result).not.toBeNull();
    expect(result.minThicknessMm).toEqual({ A: 19, B: 16 });
    expect(result.tableRef).toContain('7.3');
  });

  it('450mm spacing, plywood → 15mm', () => {
    const result = getFlooringThickness(450, 'plywood');
    expect(result).not.toBeNull();
    expect(result.minThicknessMm).toBe(15);
    expect(result.tableRef).toContain('7.4');
  });

  it('600mm spacing, strip → {A: 22, B: 19}', () => {
    const result = getFlooringThickness(600, 'strip');
    expect(result.minThicknessMm).toEqual({ A: 22, B: 19 });
  });

  it('600mm spacing, plywood → 19mm', () => {
    const result = getFlooringThickness(600, 'plywood');
    expect(result.minThicknessMm).toBe(19);
  });

  it('400mm spacing, strip → {A: 16, B: 16}', () => {
    const result = getFlooringThickness(400, 'strip');
    expect(result.minThicknessMm).toEqual({ A: 16, B: 16 });
  });

  it('returns null for invalid type', () => {
    const result = getFlooringThickness(450, 'concrete');
    expect(result).toBeNull();
  });
});
