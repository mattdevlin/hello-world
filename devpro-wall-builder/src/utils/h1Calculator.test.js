import { describe, it, expect } from 'vitest';
import { checkH1Compliance, computeWeightedR } from './h1Calculator.js';
import { lookupSlabR, lookupWindowR, getClimateZone } from './h1Constants.js';

// ─────────────────────────────────────────────────────────────
// Climate zone lookup
// ─────────────────────────────────────────────────────────────

describe('getClimateZone', () => {
  it('returns zone 1 for Auckland', () => {
    expect(getClimateZone('Auckland Council')).toBe(1);
  });

  it('returns zone 2 for Hamilton', () => {
    expect(getClimateZone('Hamilton City')).toBe(2);
  });

  it('returns zone 5 for Christchurch', () => {
    expect(getClimateZone('Christchurch City')).toBe(5);
  });

  it('returns zone 6 for Queenstown-Lakes', () => {
    expect(getClimateZone('Queenstown-Lakes District')).toBe(6);
  });

  it('returns null for unknown TA', () => {
    expect(getClimateZone('Nonexistent District')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// computeWeightedR
// ─────────────────────────────────────────────────────────────

describe('computeWeightedR', () => {
  it('returns single R-value for one construction', () => {
    expect(computeWeightedR([{ area: 100, rValue: 4.0 }])).toBeCloseTo(4.0);
  });

  it('computes area-weighted R for mixed constructions', () => {
    // 50m2 at R4.0 + 50m2 at R2.0
    // Heat loss = 50/4 + 50/2 = 12.5 + 25 = 37.5
    // Weighted R = 100 / 37.5 = 2.667
    const result = computeWeightedR([
      { area: 50, rValue: 4.0 },
      { area: 50, rValue: 2.0 },
    ]);
    expect(result).toBeCloseTo(2.667, 2);
  });

  it('returns 0 for empty constructions', () => {
    expect(computeWeightedR([])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Window R-value lookup
// ─────────────────────────────────────────────────────────────

describe('lookupWindowR', () => {
  it('looks up exact Ug match for double glazed aluminium', () => {
    expect(lookupWindowR('double', 2.9, 'aluminium')).toBe(0.24);
  });

  it('looks up double glazed thermal break', () => {
    expect(lookupWindowR('double', 1.9, 'aluminiumThermal')).toBe(0.39);
  });

  it('looks up double glazed uPVC/timber', () => {
    expect(lookupWindowR('double', 1.3, 'upvcTimber')).toBe(0.63);
  });

  it('uses conservative (higher Ug) row for between-values', () => {
    // Ug 2.0 is between 2.9 and 1.9 — should use 2.9 row (conservative)
    expect(lookupWindowR('double', 2.0, 'aluminium')).toBe(0.24);
  });

  it('returns null for aluminium triple glazed (not available)', () => {
    expect(lookupWindowR('triple', 1.0, 'aluminium')).toBeNull();
  });

  it('looks up triple glazed thermal break', () => {
    expect(lookupWindowR('triple', 0.7, 'aluminiumThermal')).toBe(0.59);
  });
});

// ─────────────────────────────────────────────────────────────
// Slab R-value lookup
// ─────────────────────────────────────────────────────────────

describe('lookupSlabR', () => {
  it('looks up exact table value', () => {
    // A/P = 2.0, wall thickness = 140mm, uninsulated raft no masonry
    const r = lookupSlabR('raft_no_masonry', 'uninsulated', 2.0, 140);
    expect(r).toBeCloseTo(1.40, 1);
  });

  it('interpolates between A/P bands', () => {
    // A/P = 1.5 (between 1.4 and 1.6), wall = 140mm
    const r = lookupSlabR('raft_no_masonry', 'uninsulated', 1.5, 140);
    // Should be between 1.11 and 1.21
    expect(r).toBeGreaterThan(1.10);
    expect(r).toBeLessThan(1.22);
  });

  it('returns null for missing table', () => {
    expect(lookupSlabR('raft_masonry', 'uninsulated', 2.0, 140)).toBeNull();
  });

  it('clamps to table bounds', () => {
    // A/P = 0.1 (below minimum 0.5), should clamp to 0.5
    const r = lookupSlabR('raft_no_masonry', 'uninsulated', 0.1, 140);
    expect(r).toBeCloseTo(0.57, 1);
  });

  it('returns higher R for insulated slab', () => {
    const rUninsulated = lookupSlabR('raft_no_masonry', 'uninsulated', 2.0, 140);
    const rInsulated = lookupSlabR('raft_no_masonry', 'underslab_full_R1.2', 2.0, 140);
    expect(rInsulated).toBeGreaterThan(rUninsulated);
  });
});

// ─────────────────────────────────────────────────────────────
// checkH1Compliance — main calculator
// ─────────────────────────────────────────────────────────────

describe('checkH1Compliance', () => {
  // Helper: typical small house in Zone 1
  function makeTypicalInput(overrides = {}) {
    return {
      climateZone: 1,
      grossWallArea: 120, // 120m2 gross wall
      constructions: {
        roof: [{ area: 100, rValue: 6.6 }],
        wall: [{ area: 78, rValue: 4.14 }],    // net wall = 120 - 36 - 6
        glazing: [{ area: 36, rValue: 0.50 }],  // 30% of gross wall, uPVC double low-E
        doorOpaque: [{ area: 6, rValue: 1.5 }],
        skylight: [],
        floorSlab: [{ area: 100, rValue: 1.5 }],
        floorOther: [],
      },
      ...overrides,
    };
  }

  it('returns error for invalid climate zone', () => {
    const result = checkH1Compliance({ ...makeTypicalInput(), climateZone: 0 });
    expect(result.error).toBeDefined();
  });

  it('passes compliance for a well-insulated Zone 1 house', () => {
    const result = checkH1Compliance(makeTypicalInput());
    expect(result.compliant).toBe(true);
    expect(result.glazingRatioOk).toBe(true);
    expect(result.minimumsMet).toBe(true);
    expect(result.hlProposed).toBeLessThanOrEqual(result.hlReference);
  });

  it('computes correct glazing ratio', () => {
    const result = checkH1Compliance(makeTypicalInput());
    // 36 / 120 = 30%
    expect(result.glazingRatio).toBeCloseTo(30.0, 0);
  });

  it('fails when glazing exceeds 40%', () => {
    const result = checkH1Compliance(makeTypicalInput({
      constructions: {
        roof: [{ area: 100, rValue: 6.6 }],
        wall: [{ area: 66, rValue: 4.14 }],
        glazing: [{ area: 50, rValue: 0.26 }], // 50/120 = 41.7%
        doorOpaque: [{ area: 4, rValue: 1.5 }],
        skylight: [],
        floorSlab: [{ area: 100, rValue: 1.3 }],
        floorOther: [],
      },
    }));
    expect(result.glazingRatioOk).toBe(false);
    expect(result.compliant).toBe(false);
  });

  it('fails when wall R-value is below minimum R1.0', () => {
    const result = checkH1Compliance(makeTypicalInput({
      constructions: {
        roof: [{ area: 100, rValue: 6.6 }],
        wall: [{ area: 78, rValue: 0.9 }], // below minimum R1.0
        glazing: [{ area: 36, rValue: 0.26 }],
        doorOpaque: [{ area: 6, rValue: 1.5 }],
        skylight: [],
        floorSlab: [{ area: 100, rValue: 1.3 }],
        floorOther: [],
      },
    }));
    expect(result.minimumsMet).toBe(false);
    expect(result.minimumChecks.wall.met).toBe(false);
    expect(result.compliant).toBe(false);
  });

  it('fails when roof R-value is below minimum R2.6', () => {
    const result = checkH1Compliance(makeTypicalInput({
      constructions: {
        roof: [{ area: 100, rValue: 2.5 }], // below minimum R2.6
        wall: [{ area: 78, rValue: 4.14 }],
        glazing: [{ area: 36, rValue: 0.26 }],
        doorOpaque: [{ area: 6, rValue: 1.5 }],
        skylight: [],
        floorSlab: [{ area: 100, rValue: 1.3 }],
        floorOther: [],
      },
    }));
    expect(result.minimumChecks.roof.met).toBe(false);
    expect(result.compliant).toBe(false);
  });

  it('fails when suspended floor R-value is below minimum R1.3', () => {
    const result = checkH1Compliance(makeTypicalInput({
      constructions: {
        roof: [{ area: 100, rValue: 6.6 }],
        wall: [{ area: 78, rValue: 4.14 }],
        glazing: [{ area: 36, rValue: 0.26 }],
        doorOpaque: [{ area: 6, rValue: 1.5 }],
        skylight: [],
        floorSlab: [],
        floorOther: [{ area: 100, rValue: 1.2 }], // below minimum R1.3
      },
    }));
    expect(result.minimumChecks.floorOther.met).toBe(false);
    expect(result.compliant).toBe(false);
  });

  it('handles multiple construction types per element', () => {
    const result = checkH1Compliance(makeTypicalInput({
      constructions: {
        roof: [{ area: 60, rValue: 6.6 }, { area: 40, rValue: 4.0 }],
        wall: [{ area: 40, rValue: 4.14 }, { area: 38, rValue: 2.0 }],
        glazing: [{ area: 20, rValue: 0.26 }, { area: 16, rValue: 0.50 }],
        doorOpaque: [{ area: 6, rValue: 1.5 }],
        skylight: [],
        floorSlab: [{ area: 100, rValue: 1.3 }],
        floorOther: [],
      },
    }));
    // Should compute without error and have breakdown for each
    expect(result.breakdown.roof.area).toBe(100);
    expect(result.breakdown.wall.area).toBe(78);
    expect(result.breakdown.glazing.area).toBe(36);
    expect(result.hlProposed).toBeGreaterThan(0);
  });

  it('returns positive margin for compliant building', () => {
    const result = checkH1Compliance(makeTypicalInput());
    expect(result.margin).toBeGreaterThan(0);
    expect(result.marginPercent).toBeGreaterThan(0);
  });

  it('returns reference breakdown with correct areas', () => {
    const result = checkH1Compliance(makeTypicalInput());
    // Reference uses 30% glazing of gross wall
    expect(result.referenceBreakdown.glazing.area).toBeCloseTo(120 * 0.30);
    expect(result.referenceBreakdown.wall.area).toBeCloseTo(120 * 0.70);
  });

  it('produces higher reference HL for zone 5 vs zone 1 (stricter glazing R)', () => {
    // Zone 5 has stricter glazing R (0.50 vs 0.46), so reference HL should differ
    const zone1 = checkH1Compliance(makeTypicalInput({ climateZone: 1 }));
    const zone5 = checkH1Compliance(makeTypicalInput({ climateZone: 5 }));
    // Zone 5 has higher R for glazing → lower reference HL for glazing component
    expect(zone5.referenceBreakdown.glazing.heatLoss).toBeLessThan(zone1.referenceBreakdown.glazing.heatLoss);
  });

  it('handles zero-area elements gracefully', () => {
    const result = checkH1Compliance(makeTypicalInput({
      constructions: {
        roof: [{ area: 100, rValue: 6.6 }],
        wall: [{ area: 78, rValue: 4.14 }],
        glazing: [{ area: 36, rValue: 0.50 }],
        doorOpaque: [],
        skylight: [],
        floorSlab: [{ area: 100, rValue: 1.5 }],
        floorOther: [],
      },
    }));
    expect(result.breakdown.doorOpaque.area).toBe(0);
    expect(result.breakdown.doorOpaque.heatLoss).toBe(0);
    expect(result.compliant).toBe(true);
  });

  it('applies default R-values for zero R-value entries', () => {
    const result = checkH1Compliance({
      climateZone: 1,
      grossWallArea: 120,
      constructions: {
        roof: [{ area: 100, rValue: 6.6 }],
        wall: [{ area: 78, rValue: 0 }], // should use default R0.18
        glazing: [{ area: 36, rValue: 0.26 }],
        doorOpaque: [{ area: 6, rValue: 1.5 }],
        skylight: [],
        floorSlab: [{ area: 100, rValue: 1.3 }],
        floorOther: [],
      },
    });
    // With R0.18 for wall, heat loss will be very high
    expect(result.breakdown.wall.heatLoss).toBeGreaterThan(400);
    expect(result.compliant).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Invalid input handling
// ─────────────────────────────────────────────────────────────

describe('computeWeightedR — invalid input', () => {
  it('throws for zero R-value', () => {
    expect(() => computeWeightedR([{ area: 100, rValue: 0 }])).toThrow();
  });

  it('throws for negative R-value', () => {
    expect(() => computeWeightedR([{ area: 50, rValue: -1 }])).toThrow();
  });

  it('returns 0 for constructions with only zero-area entries', () => {
    expect(computeWeightedR([{ area: 0, rValue: 4.0 }])).toBe(0);
  });
});

describe('checkH1Compliance — invalid input', () => {
  it('returns error for climate zone 0', () => {
    const result = checkH1Compliance({ climateZone: 0, grossWallArea: 100, constructions: {} });
    expect(result.error).toBeDefined();
  });

  it('returns error for climate zone 7', () => {
    const result = checkH1Compliance({ climateZone: 7, grossWallArea: 100, constructions: {} });
    expect(result.error).toBeDefined();
  });

  it('returns error for negative climate zone', () => {
    const result = checkH1Compliance({ climateZone: -1, grossWallArea: 100, constructions: {} });
    expect(result.error).toBeDefined();
  });

  it('handles empty constructions object gracefully', () => {
    const result = checkH1Compliance({ climateZone: 1, grossWallArea: 100, constructions: {} });
    expect(result.compliant).toBeDefined();
    expect(result.hlProposed).toBe(0);
  });
});
