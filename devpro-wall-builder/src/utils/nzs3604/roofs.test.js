import { describe, it, expect } from 'vitest';
import {
  getRafterSize,
  getValleyRafterSize,
  getRidgeBeamSize,
  getCeilingJoistSize,
  getCeilingRunnerSize,
  getUnderpurlinSize,
  getSteepRoofMultiplier,
  getRoofBracingRequirements,
  getDiagonalBraceMaxLength,
} from './roofs.js';

// ─────────────────────────────────────────────────────────────
// Rafters — ordinary (Table 10.1)
// ─────────────────────────────────────────────────────────────

describe('getRafterSize', () => {
  it('EH zone returns raw table spans (multiplier 1.0)', () => {
    const result = getRafterSize('EH', 600, 2.5);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x45');
    expect(result.maxSpanM).toBe(2.5);
    expect(result.fixingType).toBe('E');
    expect(result.tableRef).toContain('10.1');
  });

  it('L zone applies 1.3× multiplier', () => {
    // 140x45 at 600mm EH = 2.5m → L zone = 2.5 × 1.3 = 3.25m
    const result = getRafterSize('L', 600, 3.2);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x45');
    expect(result.maxSpanM).toBeCloseTo(3.25, 2);
  });

  it('M zone also applies 1.3× multiplier', () => {
    const result = getRafterSize('M', 600, 3.2);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x45');
    expect(result.maxSpanM).toBeCloseTo(3.25, 2);
  });

  it('selects smallest sufficient member', () => {
    // EH zone, 480mm spacing: 90x45=1.3, 140x45=2.7, need 2.0 → 140x45
    const result = getRafterSize('EH', 480, 2.0);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x45');
  });

  it('returns null when span exceeds all sizes', () => {
    const result = getRafterSize('EH', 600, 10.0);
    expect(result).toBeNull();
  });

  it('returns null for invalid wind zone', () => {
    const result = getRafterSize('XX', 600, 2.0);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Valley Rafters (Table 10.1)
// ─────────────────────────────────────────────────────────────

describe('getValleyRafterSize', () => {
  it('light roof, 2.0m span → 140x45', () => {
    const result = getValleyRafterSize('light', 2.0);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x45');
    expect(result.maxSpanM).toBe(2.3);
    expect(result.fixingType).toBe('E');
  });

  it('heavy roof needs larger member for same span', () => {
    // light: 140x45=2.3 (sufficient), heavy: 140x45=2.0 (not sufficient) → 140x70=2.3
    const light = getValleyRafterSize('light', 2.1);
    const heavy = getValleyRafterSize('heavy', 2.1);
    expect(light.size).toBe('140x45');
    expect(heavy.size).toBe('140x70');
  });

  it('selects smallest sufficient member', () => {
    const result = getValleyRafterSize('light', 1.0);
    expect(result).not.toBeNull();
    expect(result.size).toBe('90x45');
  });

  it('returns null when span exceeds all sizes', () => {
    const result = getValleyRafterSize('light', 10.0);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Ridge Beams (Table 10.2)
// ─────────────────────────────────────────────────────────────

describe('getRidgeBeamSize', () => {
  it('light roof, 1.8m loaded dim, 2.3m span → 190x70 (first in size order)', () => {
    // 190x70 at 1.8m = 2.7m span (sufficient), comes before 240x45 in MEMBER_SIZE_ORDER
    const result = getRidgeBeamSize('light', 1.8, 2.3);
    expect(result).not.toBeNull();
    expect(result.size).toBe('190x70');
    expect(result.maxSpanM).toBe(2.7);
    expect(result.fixingType).toBe('H');
    expect(result.tableRef).toContain('10.2');
  });

  it('loaded dim rounds UP to next key', () => {
    // 2.0m loaded dim rounds up to 2.7 key
    // 190x70 at 2.7m loaded dim = 2.4m span (sufficient for 1.9)
    const result = getRidgeBeamSize('light', 2.0, 1.9);
    expect(result).not.toBeNull();
    expect(result.size).toBe('190x70');
    expect(result.maxSpanM).toBe(2.4);
  });

  it('heavy roof has different spans', () => {
    // heavy 190x70 at 1.8m = 2.3m span (sufficient)
    const result = getRidgeBeamSize('heavy', 1.8, 2.3);
    expect(result).not.toBeNull();
    expect(result.size).toBe('190x70');
    expect(result.maxSpanM).toBe(2.3);
    expect(result.fixingType).toBe('G');
  });

  it('returns fixing type correctly', () => {
    // 290x70 heavy at 4.2m loaded dim → fix I
    const result = getRidgeBeamSize('heavy', 4.2, 3.3);
    expect(result).not.toBeNull();
    expect(result.size).toBe('290x70');
    expect(result.fixingType).toBe('I');
  });

  it('returns null when span exceeds all sizes', () => {
    const result = getRidgeBeamSize('light', 1.8, 10.0);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Ceiling Joists (Table 10.3)
// ─────────────────────────────────────────────────────────────

describe('getCeilingJoistSize', () => {
  it('480mm spacing, 3.8m span → 140x45', () => {
    const result = getCeilingJoistSize(480, 3.8);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x45');
    expect(result.maxSpanM).toBe(3.8);
    expect(result.tableRef).toContain('10.3');
  });

  it('selects smallest member for span', () => {
    const result = getCeilingJoistSize(600, 1.5);
    expect(result).not.toBeNull();
    expect(result.size).toBe('90x35');
  });

  it('returns null when span exceeds all sizes', () => {
    const result = getCeilingJoistSize(600, 6.0);
    expect(result).toBeNull();
  });

  it('900mm spacing gives shorter max spans', () => {
    // 140x35 at 480=3.5, 140x45 at 480=3.8; at 900: 140x35=2.8, 140x45=3.1
    const narrow = getCeilingJoistSize(480, 3.5);
    const wide = getCeilingJoistSize(900, 3.5);
    expect(narrow.size).toBe('140x35');
    expect(wide.size).toBe('190x45');
  });
});

// ─────────────────────────────────────────────────────────────
// Ceiling Runners (Table 10.4)
// ─────────────────────────────────────────────────────────────

describe('getCeilingRunnerSize', () => {
  it('1.8m spacing, 2.1m span → 140x45', () => {
    const result = getCeilingRunnerSize(1.8, 2.1);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x45');
    expect(result.maxSpanM).toBe(2.1);
    expect(result.tableRef).toContain('10.4');
  });

  it('spacing in metres (not mm)', () => {
    // 2.4m spacing: 140x45=1.9, 190x45=2.7
    const result = getCeilingRunnerSize(2.4, 2.5);
    expect(result).not.toBeNull();
    expect(result.size).toBe('190x45');
  });

  it('3.0m spacing gives shortest spans', () => {
    const result = getCeilingRunnerSize(3.0, 4.5);
    expect(result).not.toBeNull();
    expect(result.size).toBe('290x90');
  });

  it('returns null when span exceeds all sizes', () => {
    const result = getCeilingRunnerSize(3.0, 6.0);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Underpurlins (Table 10.5)
// ─────────────────────────────────────────────────────────────

describe('getUnderpurlinSize', () => {
  it('light roof, 1.5m loaded dim, 1.8m span → 140x45', () => {
    const result = getUnderpurlinSize('light', 1.5, 1.8);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x45');
    expect(result.maxSpanM).toBe(1.8);
    expect(result.fixingType).toBe('L');
    expect(result.tableRef).toContain('10.5');
  });

  it('loaded dim rounds UP to next key', () => {
    // 1.8m loaded dim rounds up to 2.1 key
    const result = getUnderpurlinSize('light', 1.8, 1.5);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x45');
    expect(result.maxSpanM).toBe(1.5);
    expect(result.fixingType).toBe('L');
  });

  it('SED fixing type is preserved', () => {
    // 190x70 at 2.7m loaded dim → span 2.4, fix SED (comes before 290x45 in size order)
    const result = getUnderpurlinSize('light', 2.7, 2.1);
    expect(result).not.toBeNull();
    expect(result.size).toBe('190x70');
    expect(result.fixingType).toBe('SED');
  });

  it('returns null for heavy roof weight (not in data)', () => {
    const result = getUnderpurlinSize('heavy', 1.5, 1.0);
    expect(result).toBeNull();
  });

  it('returns null when span exceeds all sizes', () => {
    const result = getUnderpurlinSize('light', 1.5, 10.0);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Steep Roof Multiplier (Table 8.7)
// ─────────────────────────────────────────────────────────────

describe('getSteepRoofMultiplier', () => {
  it('pitch 50°, trusses → 1.0', () => {
    const result = getSteepRoofMultiplier(50, 'trusses');
    expect(result).not.toBeNull();
    expect(result.multiplier).toBe(1);
    expect(result.tableRef).toContain('8.7');
  });

  it('pitch 55°, single_rafters → 1.2', () => {
    const result = getSteepRoofMultiplier(55, 'single_rafters');
    expect(result).not.toBeNull();
    expect(result.multiplier).toBe(1.2);
  });

  it('pitch < 50° → null (no multiplier needed)', () => {
    const result = getSteepRoofMultiplier(45, 'trusses');
    expect(result).toBeNull();
  });

  it('pitch 60°, trusses → null (SED)', () => {
    const result = getSteepRoofMultiplier(60, 'trusses');
    expect(result).toBeNull();
  });

  it('pitch 60°, single_rafters → 1.4', () => {
    const result = getSteepRoofMultiplier(60, 'single_rafters');
    expect(result).not.toBeNull();
    expect(result.multiplier).toBe(1.4);
  });
});

// ─────────────────────────────────────────────────────────────
// Roof Bracing (Table 10.16)
// ─────────────────────────────────────────────────────────────

describe('getRoofBracingRequirements', () => {
  it('light roof → one per 50m2, continuous', () => {
    const result = getRoofBracingRequirements('light');
    expect(result).not.toBeNull();
    expect(result.planeBrace).toBe('one per 50m2');
    expect(result.spaceBrace).toBe('continuous');
    expect(result.tableRef).toContain('10.16');
  });

  it('heavy roof → one per 25m2, continuous', () => {
    const result = getRoofBracingRequirements('heavy');
    expect(result).not.toBeNull();
    expect(result.planeBrace).toBe('one per 25m2');
    expect(result.spaceBrace).toBe('continuous');
  });

  it('invalid weight → null', () => {
    const result = getRoofBracingRequirements('medium');
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Diagonal Braces (Table 10.17)
// ─────────────────────────────────────────────────────────────

describe('getDiagonalBraceMaxLength', () => {
  it('90x45 → 1.85m', () => {
    const result = getDiagonalBraceMaxLength('90x45');
    expect(result).not.toBeNull();
    expect(result.maxLengthM).toBe(1.85);
    expect(result.tableRef).toContain('10.17');
  });

  it('2x90x45_spaced → 4.8m', () => {
    const result = getDiagonalBraceMaxLength('2x90x45_spaced');
    expect(result).not.toBeNull();
    expect(result.maxLengthM).toBe(4.8);
  });

  it('invalid type → null', () => {
    const result = getDiagonalBraceMaxLength('unknown');
    expect(result).toBeNull();
  });
});
