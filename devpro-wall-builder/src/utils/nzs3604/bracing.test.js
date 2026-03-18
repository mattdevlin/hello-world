import { describe, it, expect } from 'vitest';
import {
  getWindBracingDemand,
  getEqBracingDemand,
  getSubfloorBracingCapacity,
  calculateBracingDemand,
} from './bracing.js';

// ─────────────────────────────────────────────────────────────
// Wind Bracing Demand (Tables 5.5–5.7)
// ─────────────────────────────────────────────────────────────

describe('getWindBracingDemand', () => {
  it('High zone, single/upper, 6m apex, 1m eaves → raw values (×1.0)', () => {
    const result = getWindBracingDemand('H', 'single_upper', 6, 1);
    expect(result).not.toBeNull();
    expect(result.acrossBuPerM).toBe(60);
    expect(result.alongBuPerM).toBe(65);
    expect(result.tableRef).toContain('5.6');
  });

  it('Medium zone applies 0.7 multiplier', () => {
    const result = getWindBracingDemand('M', 'single_upper', 6, 1);
    expect(result).not.toBeNull();
    expect(result.acrossBuPerM).toBe(60 * 0.7);
    expect(result.alongBuPerM).toBe(65 * 0.7);
  });

  it('Low zone applies 0.5 multiplier', () => {
    const result = getWindBracingDemand('L', 'subfloor', 6, 0);
    expect(result).not.toBeNull();
    expect(result.acrossBuPerM).toBe(120 * 0.5);
    expect(result.alongBuPerM).toBe(120 * 0.5);
  });

  it('VH zone applies 1.3 multiplier', () => {
    const result = getWindBracingDemand('VH', 'single_upper', 5, 0);
    expect(result).not.toBeNull();
    expect(result.acrossBuPerM).toBe(55 * 1.3);
    expect(result.alongBuPerM).toBe(55 * 1.3);
  });

  it('EH zone applies 1.6 multiplier', () => {
    const result = getWindBracingDemand('EH', 'single_upper', 5, 0);
    expect(result).not.toBeNull();
    expect(result.acrossBuPerM).toBe(55 * 1.6);
    expect(result.alongBuPerM).toBe(55 * 1.6);
  });

  it('subfloor table returns Table 5.5 ref', () => {
    const result = getWindBracingDemand('H', 'subfloor', 4, 0);
    expect(result).not.toBeNull();
    expect(result.acrossBuPerM).toBe(80);
    expect(result.alongBuPerM).toBe(80);
    expect(result.tableRef).toContain('5.5');
  });

  it('lower_two table returns Table 5.7 ref', () => {
    const result = getWindBracingDemand('H', 'lower_two', 6, 0);
    expect(result).not.toBeNull();
    expect(result.acrossBuPerM).toBe(100);
    expect(result.alongBuPerM).toBe(100);
    expect(result.tableRef).toContain('5.7');
  });

  it('rounds UP apex height: 5.5m → uses 6m row', () => {
    const result = getWindBracingDemand('H', 'single_upper', 5.5, 1);
    expect(result).not.toBeNull();
    // 5.5 rounds up to 6m row, eaves 1m
    expect(result.acrossBuPerM).toBe(60);
    expect(result.alongBuPerM).toBe(65);
  });

  it('returns null when apex height exceeds table max (10m)', () => {
    const result = getWindBracingDemand('H', 'single_upper', 11, 1);
    expect(result).toBeNull();
  });

  it('returns null when roof above eaves exceeds row max', () => {
    const result = getWindBracingDemand('H', 'single_upper', 3, 2);
    // 3m apex row only has eaves keys 0 and 1
    expect(result).toBeNull();
  });

  it('returns null for invalid wind zone', () => {
    const result = getWindBracingDemand('X', 'single_upper', 5, 0);
    expect(result).toBeNull();
  });

  it('returns null for invalid table name', () => {
    const result = getWindBracingDemand('H', 'invalid', 5, 0);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Earthquake Bracing Demand (Tables 5.8–5.10)
// ─────────────────────────────────────────────────────────────

describe('getEqBracingDemand', () => {
  it('zone 3, soil D/E → base values (×1.0)', () => {
    const result = getEqBracingDemand('3', 'D', 'single_subfloor', 'light_light_light_medium', '0-25');
    expect(result).not.toBeNull();
    expect(result.buPerM2.subfloor).toBe(15);
    expect(result.buPerM2.walls).toBe(11);
    expect(result.tableRef).toContain('5.8');
  });

  it('zone 2, soil C applies 0.6 factor', () => {
    const result = getEqBracingDemand('2', 'C', 'single_subfloor', 'light_light_light_medium', '0-25');
    expect(result).not.toBeNull();
    expect(result.buPerM2.subfloor).toBe(15 * 0.6);
    expect(result.buPerM2.walls).toBe(11 * 0.6);
  });

  it('zone 1, soil A applies 0.3 factor', () => {
    const result = getEqBracingDemand('1', 'A', 'single_subfloor', 'light_light_light_medium', '0-25');
    expect(result).not.toBeNull();
    expect(result.buPerM2.subfloor).toBeCloseTo(15 * 0.3);
    expect(result.buPerM2.walls).toBeCloseTo(11 * 0.3);
  });

  it('zone 4, soil E applies 1.5 factor', () => {
    const result = getEqBracingDemand('4', 'E', 'single_subfloor', 'light_light_light_medium', '25-45');
    expect(result).not.toBeNull();
    expect(result.buPerM2.subfloor).toBe(16 * 1.5);
    expect(result.buPerM2.walls).toBe(11 * 1.5);
  });

  it('soil B maps to AB group', () => {
    const result = getEqBracingDemand('3', 'B', 'single_subfloor', 'light_light_light_medium', '0-25');
    expect(result).not.toBeNull();
    // Zone 3, AB = 0.6
    expect(result.buPerM2.subfloor).toBe(15 * 0.6);
  });

  it('two_storey_subfloor table returns subfloor/lower/upper levels', () => {
    const result = getEqBracingDemand('3', 'D', 'two_storey_subfloor', 'light_light_light_light_heavy', '0-25');
    expect(result).not.toBeNull();
    expect(result.buPerM2.subfloor).toBe(23);
    expect(result.buPerM2.lower).toBe(21);
    expect(result.buPerM2.upper).toBe(11);
    expect(result.tableRef).toContain('5.9');
  });

  it('slab table returns single/lower/upper levels', () => {
    const result = getEqBracingDemand('3', 'D', 'slab', 'light_light_light', '0-25');
    expect(result).not.toBeNull();
    expect(result.buPerM2.single).toBe(6);
    expect(result.buPerM2.lower).toBe(15);
    expect(result.buPerM2.upper).toBe(9);
    expect(result.tableRef).toContain('5.10');
  });

  it('slab table: null single value preserved', () => {
    const result = getEqBracingDemand('3', 'D', 'slab', 'light_light_medium', '0-25');
    expect(result).not.toBeNull();
    expect(result.buPerM2.single).toBeNull();
    expect(result.buPerM2.lower).toBe(17);
  });

  it('pitch range 45-60 returns higher values', () => {
    const result = getEqBracingDemand('3', 'D', 'single_subfloor', 'light_light_light_medium', '45-60');
    expect(result).not.toBeNull();
    expect(result.buPerM2.subfloor).toBe(17);
    expect(result.buPerM2.walls).toBe(13);
  });

  it('heavy roof/wall combo returns higher values', () => {
    const result = getEqBracingDemand('3', 'D', 'single_subfloor', 'heavy_heavy_heavy', '0-25');
    expect(result).not.toBeNull();
    expect(result.buPerM2.subfloor).toBe(31);
    expect(result.buPerM2.walls).toBe(23);
  });

  it('returns null for invalid weight key', () => {
    const result = getEqBracingDemand('3', 'D', 'single_subfloor', 'invalid_key', '0-25');
    expect(result).toBeNull();
  });

  it('returns null for invalid soil class', () => {
    const result = getEqBracingDemand('3', 'X', 'single_subfloor', 'light_light_light_medium', '0-25');
    expect(result).toBeNull();
  });

  it('returns null for invalid table name', () => {
    const result = getEqBracingDemand('3', 'D', 'invalid', 'light_light_light_medium', '0-25');
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Subfloor Bracing Capacity (Table 5.11)
// ─────────────────────────────────────────────────────────────

describe('getSubfloorBracingCapacity', () => {
  it('masonry wall < 0.75m → 0 BU', () => {
    const result = getSubfloorBracingCapacity('masonry_wall', 0.5);
    expect(result).not.toBeNull();
    expect(result.earthquakeBU).toBe(0);
    expect(result.windBU).toBe(0);
    expect(result.tableRef).toContain('5.11');
  });

  it('masonry wall 0.75–1.5m → 42 BU', () => {
    const result = getSubfloorBracingCapacity('masonry_wall', 1.0);
    expect(result.earthquakeBU).toBe(42);
    expect(result.windBU).toBe(42);
  });

  it('masonry wall 1.5–3.0m → 100 BU', () => {
    const result = getSubfloorBracingCapacity('masonry_wall', 2.0);
    expect(result.earthquakeBU).toBe(100);
  });

  it('masonry wall 3.0–4.5m → 200 BU', () => {
    const result = getSubfloorBracingCapacity('masonry_wall', 3.5);
    expect(result.earthquakeBU).toBe(200);
  });

  it('masonry wall >= 4.5m → 300 BU', () => {
    const result = getSubfloorBracingCapacity('masonry_wall', 5.0);
    expect(result.earthquakeBU).toBe(300);
  });

  it('braced pile system → 120 EQ, 160 wind', () => {
    const result = getSubfloorBracingCapacity('braced_pile_system');
    expect(result).not.toBeNull();
    expect(result.earthquakeBU).toBe(120);
    expect(result.windBU).toBe(160);
  });

  it('cantilever pile → 30 EQ, 70 wind', () => {
    const result = getSubfloorBracingCapacity('cantilever_pile');
    expect(result.earthquakeBU).toBe(30);
    expect(result.windBU).toBe(70);
  });

  it('anchor pile → 120 EQ, 160 wind', () => {
    const result = getSubfloorBracingCapacity('anchor_pile');
    expect(result.earthquakeBU).toBe(120);
    expect(result.windBU).toBe(160);
  });

  it('returns null for masonry wall without length', () => {
    const result = getSubfloorBracingCapacity('masonry_wall');
    expect(result).toBeNull();
  });

  it('returns null for invalid element type', () => {
    const result = getSubfloorBracingCapacity('invalid_type');
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Orchestrator — calculateBracingDemand
// ─────────────────────────────────────────────────────────────

describe('calculateBracingDemand', () => {
  it('single-storey slab: returns wind and EQ demand with governing', () => {
    const result = calculateBracingDemand(
      { windZone: 'H', eqZone: '2', soilClass: 'C' },
      {
        storeys: 1,
        heightToApexM: 5,
        roofAboveEavesM: 1,
        pitchDeg: 20,
        planLengthM: 12,
        planWidthM: 10,
        foundationType: 'slab',
        weightKey: 'light_light_light',
      }
    );
    expect(result).not.toBeNull();
    // Wind: single_upper, 5m apex, 1m eaves → across=50, along=55 (High)
    expect(result.wind.across).toBe(50 * 10);  // 50 BU/m × 10m width
    expect(result.wind.along).toBe(55 * 12);   // 55 BU/m × 12m length
    // EQ: slab, light_light_light, 0-25, zone 2 C = 0.6
    // single = 6 × 0.6 = 3.6 BU/m² × 120m² = 432
    expect(result.eq.single).toBeCloseTo(6 * 0.6 * 120);
    // Governing: wind across = 500, EQ = 432 → wind governs across
    expect(result.governing.across).toBe(500);
    expect(result.governing.governedBy.across).toBe('wind');
    // Along: wind = 660, EQ = 432 → wind governs
    expect(result.governing.along).toBe(660);
    expect(result.governing.governedBy.along).toBe('wind');
    expect(result.tableRefs).toContain('Table 5.6');
    expect(result.tableRefs).toContain('Table 5.10');
  });

  it('EQ governs when wind is low and EQ zone is high', () => {
    const result = calculateBracingDemand(
      { windZone: 'L', eqZone: '4', soilClass: 'E' },
      {
        storeys: 1,
        heightToApexM: 4,
        roofAboveEavesM: 0,
        pitchDeg: 10,
        planLengthM: 10,
        planWidthM: 10,
        foundationType: 'slab',
        weightKey: 'heavy_heavy_heavy',
      }
    );
    expect(result).not.toBeNull();
    // Wind: L zone → 35 × 0.5 = 17.5 BU/m
    // EQ: heavy_heavy_heavy, 0-25, single=13, zone 4 DE = 1.5 → 13 × 1.5 = 19.5 BU/m²
    // Wind across = 17.5 × 10 = 175
    // EQ = 19.5 × 100 = 1950
    expect(result.governing.governedBy.across).toBe('earthquake');
    expect(result.governing.governedBy.along).toBe('earthquake');
  });

  it('returns null when missing required params', () => {
    expect(calculateBracingDemand({}, {})).toBeNull();
    expect(calculateBracingDemand(
      { windZone: 'H', eqZone: '2', soilClass: 'C' },
      { storeys: 1, heightToApexM: 5, roofAboveEavesM: 1, pitchDeg: 20, planLengthM: 10, planWidthM: 10, foundationType: 'slab' }
    )).toBeNull(); // missing weightKey
  });
});
