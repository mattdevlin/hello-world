import { describe, it, expect } from 'vitest';
import { splitPlate, computeWallTimber, computeProjectTimber, computeWallTimberRatio, computeProjectTimberRatio } from './timberCalculator.js';
import { MAX_PLATE_LENGTH, WALL_PLATE_WIDTH, WALL_PLATE_DEPTH, LINTEL_WIDTH, TOP_PLATE_STAGGER } from './constants.js';

// ─────────────────────────────────────────────────────────────
// splitPlate
// ─────────────────────────────────────────────────────────────

describe('splitPlate', () => {
  it('returns single piece when under max length', () => {
    expect(splitPlate(3000)).toEqual([3000]);
  });

  it('returns single piece when exactly max length', () => {
    expect(splitPlate(MAX_PLATE_LENGTH)).toEqual([MAX_PLATE_LENGTH]);
  });

  it('splits into two pieces when slightly over max', () => {
    const pieces = splitPlate(MAX_PLATE_LENGTH + 100);
    expect(pieces).toHaveLength(2);
    expect(pieces[0]).toBe(MAX_PLATE_LENGTH);
    expect(pieces[1]).toBe(100);
    expect(pieces.reduce((a, b) => a + b, 0)).toBe(MAX_PLATE_LENGTH + 100);
  });

  it('splits long plate into multiple pieces', () => {
    const total = 12000;
    const pieces = splitPlate(total);
    expect(pieces).toHaveLength(3); // 4800 + 4800 + 2400
    expect(pieces.reduce((a, b) => a + b, 0)).toBe(total);
    expect(pieces.every(p => p <= MAX_PLATE_LENGTH)).toBe(true);
  });

  it('returns empty array for zero length', () => {
    expect(splitPlate(0)).toEqual([]);
  });

  it('returns empty array for negative length', () => {
    expect(splitPlate(-100)).toEqual([]);
  });

  it('applies stagger offset to first piece', () => {
    const total = 10000;
    const pieces = splitPlate(total, MAX_PLATE_LENGTH, TOP_PLATE_STAGGER);
    expect(pieces[0]).toBe(TOP_PLATE_STAGGER); // 600mm first piece
    expect(pieces.reduce((a, b) => a + b, 0)).toBe(total);
    expect(pieces.every(p => p <= MAX_PLATE_LENGTH)).toBe(true);
  });

  it('stagger has no effect when total fits in one piece', () => {
    // When total <= maxLength, no splitting occurs regardless of stagger
    const pieces = splitPlate(3000, MAX_PLATE_LENGTH, TOP_PLATE_STAGGER);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toBe(3000);
  });
});

// ─────────────────────────────────────────────────────────────
// computeWallTimber — simple wall (no openings)
// ─────────────────────────────────────────────────────────────

describe('computeWallTimber', () => {
  const simpleWall = {
    id: 'w1',
    name: 'W1',
    length_mm: 6000,
    height_mm: 2745,
    profile: 'standard',
    deduction_left_mm: 0,
    deduction_right_mm: 0,
    openings: [],
  };

  it('generates bottom plate, two top plates, and two end plates for simple wall', () => {
    const pieces = computeWallTimber(simpleWall);
    const types = pieces.map(p => p.type);

    expect(types).toContain('bottom_plate');
    expect(types).toContain('top_plate_1');
    expect(types).toContain('top_plate_2');
    expect(types).toContain('end_plate');
    expect(types).not.toContain('lintel');

    const endPlates = pieces.filter(p => p.type === 'end_plate');
    expect(endPlates).toHaveLength(2);
    expect(endPlates[0].label).toContain('Left');
    expect(endPlates[1].label).toContain('Right');
    expect(endPlates[0].length).toBe(2745);
    expect(endPlates[1].length).toBe(2745);
  });

  it('all plates have correct dimensions', () => {
    const pieces = computeWallTimber(simpleWall);
    const plates = pieces.filter(p => p.type !== 'lintel');
    for (const p of plates) {
      expect(p.width).toBe(WALL_PLATE_WIDTH);
      expect(p.depth).toBe(WALL_PLATE_DEPTH);
    }
  });

  it('bottom plate total length equals netLength', () => {
    const pieces = computeWallTimber(simpleWall);
    const bottomTotal = pieces
      .filter(p => p.type === 'bottom_plate')
      .reduce((sum, p) => sum + p.length, 0);
    expect(bottomTotal).toBe(6000);
  });

  it('generates end plates regardless of deductions', () => {
    // With deductions
    const wall = { ...simpleWall, deduction_left_mm: 162, deduction_right_mm: 162 };
    const pieces = computeWallTimber(wall);
    const endPlates = pieces.filter(p => p.type === 'end_plate');
    expect(endPlates).toHaveLength(2);

    // Without deductions (same wall as simpleWall)
    const pieces2 = computeWallTimber(simpleWall);
    const endPlates2 = pieces2.filter(p => p.type === 'end_plate');
    expect(endPlates2).toHaveLength(2);
  });

  it('splits long plates at max length', () => {
    const longWall = { ...simpleWall, length_mm: 10000 };
    const pieces = computeWallTimber(longWall);
    const bottomPieces = pieces.filter(p => p.type === 'bottom_plate');
    expect(bottomPieces.length).toBeGreaterThan(1);
    expect(bottomPieces.every(p => p.length <= MAX_PLATE_LENGTH)).toBe(true);
    expect(bottomPieces.reduce((s, p) => s + p.length, 0)).toBe(10000);
  });

  it('top plate 2 has staggered joins', () => {
    const longWall = { ...simpleWall, length_mm: 10000 };
    const pieces = computeWallTimber(longWall);
    const top1 = pieces.filter(p => p.type === 'top_plate_1');
    const top2 = pieces.filter(p => p.type === 'top_plate_2');
    // Top plate 2 should have stagger offset so first piece differs
    expect(top2[0].length).toBe(TOP_PLATE_STAGGER);
    // Both should sum to same total
    const sum1 = top1.reduce((s, p) => s + p.length, 0);
    const sum2 = top2.reduce((s, p) => s + p.length, 0);
    expect(sum1).toBe(sum2);
  });
});

// ─────────────────────────────────────────────────────────────
// computeWallTimber — wall with openings
// ─────────────────────────────────────────────────────────────

describe('computeWallTimber with openings', () => {
  const wallWithWindow = {
    id: 'w2',
    name: 'W2',
    length_mm: 8000,
    height_mm: 2745,
    profile: 'standard',
    deduction_left_mm: 0,
    deduction_right_mm: 0,
    openings: [
      {
        ref: 'W01',
        type: 'window',
        width_mm: 1200,
        height_mm: 1200,
        position_from_left_mm: 2000,
        sill_mm: 900,
        lintel_height_mm: 200,
      },
    ],
  };

  it('generates window sill plate', () => {
    const pieces = computeWallTimber(wallWithWindow);
    const sills = pieces.filter(p => p.type === 'window_sill');
    expect(sills).toHaveLength(1);
    expect(sills[0].openingRef).toBe('W01');
    expect(sills[0].length).toBeGreaterThan(0);
  });

  it('generates two window jamb plates', () => {
    const pieces = computeWallTimber(wallWithWindow);
    const jambs = pieces.filter(p => p.type === 'window_jamb');
    expect(jambs).toHaveLength(2);
    expect(jambs[0].openingRef).toBe('W01');
  });

  it('generates lintel for opening', () => {
    const pieces = computeWallTimber(wallWithWindow);
    const lintels = pieces.filter(p => p.type === 'lintel');
    expect(lintels).toHaveLength(1);
    expect(lintels[0].width).toBe(LINTEL_WIDTH);
    expect(lintels[0].depth).toBe(200);
    expect(lintels[0].openingRef).toBe('W01');
  });

  it('generates door jambs for door opening', () => {
    const wallWithDoor = {
      id: 'w3',
      name: 'W3',
      length_mm: 6000,
      height_mm: 2745,
      profile: 'standard',
      deduction_left_mm: 0,
      deduction_right_mm: 0,
      openings: [
        {
          ref: 'D01',
          type: 'door',
          width_mm: 900,
          height_mm: 2100,
          position_from_left_mm: 2000,
          sill_mm: 0,
          lintel_height_mm: 300,
        },
      ],
    };
    const pieces = computeWallTimber(wallWithDoor);
    const doorJambs = pieces.filter(p => p.type === 'door_jamb');
    expect(doorJambs).toHaveLength(2);
    expect(doorJambs[0].openingRef).toBe('D01');
    // No sill plate for doors
    const sills = pieces.filter(p => p.type === 'window_sill');
    expect(sills).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// computeProjectTimber
// ─────────────────────────────────────────────────────────────

describe('computeProjectTimber', () => {
  it('aggregates multiple walls', () => {
    const walls = [
      { id: 'w1', name: 'W1', length_mm: 4000, height_mm: 2745, profile: 'standard', deduction_left_mm: 0, deduction_right_mm: 0, openings: [] },
      { id: 'w2', name: 'W2', length_mm: 3000, height_mm: 2745, profile: 'standard', deduction_left_mm: 0, deduction_right_mm: 0, openings: [] },
    ];
    const result = computeProjectTimber(walls, []);
    expect(result.perWall).toHaveLength(2);
    expect(result.totalPieces).toBeGreaterThan(0);
    expect(result.totalLinealMetres).toBeGreaterThan(0);
    expect(result.wallLinealMetres).toBeGreaterThan(0);
    expect(result.floorLinealMetres).toBe(0);
  });

  it('handles empty inputs gracefully', () => {
    const result = computeProjectTimber([], []);
    expect(result.totalPieces).toBe(0);
    expect(result.totalLinealMetres).toBe(0);
  });

  it('piece labels include wall name', () => {
    const walls = [
      { id: 'w1', name: 'Test Wall', length_mm: 3000, height_mm: 2745, profile: 'standard', deduction_left_mm: 0, deduction_right_mm: 0, openings: [] },
    ];
    const result = computeProjectTimber(walls, []);
    expect(result.wallPieces.every(p => p.label.includes('Test Wall'))).toBe(true);
  });

  it('section strings are formatted correctly', () => {
    const walls = [
      { id: 'w1', name: 'W1', length_mm: 3000, height_mm: 2745, profile: 'standard', deduction_left_mm: 0, deduction_right_mm: 0, openings: [] },
    ];
    const result = computeProjectTimber(walls, []);
    const plates = result.wallPieces.filter(p => p.type !== 'lintel');
    expect(plates.every(p => p.section === '140\u00D745')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// computeWallTimberRatio — timber fraction / thermal bridging
// ─────────────────────────────────────────────────────────────

describe('computeWallTimberRatio', () => {
  const simpleWall = {
    id: 'w1',
    name: 'Simple',
    length_mm: 6000,
    height_mm: 2440,
    profile: 'standard',
    deduction_left_mm: 0,
    deduction_right_mm: 0,
    openings: [],
  };

  it('returns correct structure for simple wall', () => {
    const r = computeWallTimberRatio(simpleWall);
    expect(r.wallName).toBe('Simple');
    expect(r.grossWallArea).toBeGreaterThan(0);
    expect(r.openingArea).toBe(0);
    expect(r.effectiveWallArea).toBe(r.grossWallArea);
    expect(r.timberFaceArea).toBeGreaterThan(0);
    expect(r.timberPercentage).toBeGreaterThan(0);
    expect(r.timberPercentage).toBeLessThan(100);
    expect(r.timberPercentage + r.insulationPercentage).toBeCloseTo(100, 1);
  });

  it('breakdown adds up to total timber area', () => {
    const r = computeWallTimberRatio(simpleWall);
    const { bottomPlate, topPlates, endPlates, sillPlates, jambPlates, lintels } = r.breakdown;
    const sum = bottomPlate + topPlates + endPlates + sillPlates + jambPlates + lintels;
    expect(sum).toBe(r.timberFaceArea);
  });

  it('simple wall has no sill/jamb/lintel timber', () => {
    const r = computeWallTimberRatio(simpleWall);
    expect(r.breakdown.sillPlates).toBe(0);
    expect(r.breakdown.jambPlates).toBe(0);
    expect(r.breakdown.lintels).toBe(0);
  });

  it('subtracts opening area for wall with window', () => {
    const wall = {
      ...simpleWall,
      name: 'With Window',
      length_mm: 7225,
      height_mm: 2440,
      openings: [{
        ref: 'W01',
        type: 'window',
        width_mm: 2000,
        height_mm: 1000,
        position_from_left_mm: 3000,
        sill_mm: 900,
        lintel_height_mm: 200,
      }],
    };
    const r = computeWallTimberRatio(wall);
    expect(r.openingArea).toBe(2000 * 1000);
    expect(r.effectiveWallArea).toBe(r.grossWallArea - r.openingArea);
    // Should have sill, jamb, and lintel timber
    expect(r.breakdown.sillPlates).toBeGreaterThan(0);
    expect(r.breakdown.jambPlates).toBeGreaterThan(0);
    expect(r.breakdown.lintels).toBeGreaterThan(0);
  });

  it('counts door jambs correctly (no sill for doors)', () => {
    const wall = {
      ...simpleWall,
      name: 'With Door',
      openings: [{
        ref: 'D01',
        type: 'door',
        width_mm: 900,
        height_mm: 2100,
        position_from_left_mm: 2000,
        sill_mm: 0,
        lintel_height_mm: 300,
      }],
    };
    const r = computeWallTimberRatio(wall);
    expect(r.breakdown.sillPlates).toBe(0);
    expect(r.breakdown.jambPlates).toBeGreaterThan(0);
    expect(r.breakdown.lintels).toBeGreaterThan(0);
    // Breakdown must still sum to total
    const { bottomPlate, topPlates, endPlates, sillPlates, jambPlates, lintels } = r.breakdown;
    expect(bottomPlate + topPlates + endPlates + sillPlates + jambPlates + lintels).toBe(r.timberFaceArea);
  });

  it('timber percentage is reasonable (5-20%) for typical wall', () => {
    // West Wall scenario: 7225 × 2440 with one 2000×1000 window
    const wall = {
      ...simpleWall,
      length_mm: 7225,
      height_mm: 2440,
      openings: [{
        ref: 'W01',
        type: 'window',
        width_mm: 2000,
        height_mm: 1000,
        position_from_left_mm: 3000,
        sill_mm: 900,
        lintel_height_mm: 200,
      }],
    };
    const r = computeWallTimberRatio(wall);
    expect(r.timberPercentage).toBeGreaterThan(5);
    expect(r.timberPercentage).toBeLessThan(20);
  });
});

// ─────────────────────────────────────────────────────────────
// computeProjectTimberRatio
// ─────────────────────────────────────────────────────────────

describe('computeProjectTimberRatio', () => {
  it('aggregates multiple walls into weighted average', () => {
    const walls = [
      { id: 'w1', name: 'W1', length_mm: 6000, height_mm: 2440, profile: 'standard', deduction_left_mm: 0, deduction_right_mm: 0, openings: [] },
      { id: 'w2', name: 'W2', length_mm: 4000, height_mm: 2440, profile: 'standard', deduction_left_mm: 0, deduction_right_mm: 0, openings: [] },
    ];
    const r = computeProjectTimberRatio(walls);
    expect(r.perWall).toHaveLength(2);
    expect(r.totalEffectiveArea).toBeGreaterThan(0);
    expect(r.totalTimberArea).toBeGreaterThan(0);
    expect(r.projectTimberPercentage).toBeGreaterThan(0);
    expect(r.projectTimberPercentage + r.projectInsulationPercentage).toBeCloseTo(100, 1);
  });

  it('handles empty walls array', () => {
    const r = computeProjectTimberRatio([]);
    expect(r.perWall).toHaveLength(0);
    expect(r.projectTimberPercentage).toBe(0);
  });
});
