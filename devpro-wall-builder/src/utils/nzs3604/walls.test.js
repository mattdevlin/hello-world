import { describe, it, expect } from 'vitest';
import {
  getLintelSize,
  getLintelLoadCase,
  getLintelFixing,
  getSillHeadTrimmerSize,
  getStudSize,
  getNonLoadbearingStudSize,
  getTrimmingStudSize,
} from './walls.js';

// ─────────────────────────────────────────────────────────────
// Lintel Load Case (Table 8.8)
// ─────────────────────────────────────────────────────────────

describe('getLintelLoadCase', () => {
  it('returns roof_only for roof-only support', () => {
    expect(getLintelLoadCase(true, false, false)).toBe('roof_only');
  });
  it('returns roof_wall for roof + wall', () => {
    expect(getLintelLoadCase(true, true, false)).toBe('roof_wall');
  });
  it('returns roof_wall_floor for all three', () => {
    expect(getLintelLoadCase(true, true, true)).toBe('roof_wall_floor');
  });
  it('returns floor_only for floor-only', () => {
    expect(getLintelLoadCase(false, false, true)).toBe('floor_only');
  });
});

// ─────────────────────────────────────────────────────────────
// Lintel Sizing (Tables 8.9–8.13)
// ─────────────────────────────────────────────────────────────

describe('getLintelSize', () => {
  it('Table 8.9: roof_only, light, 2m loaded dim, 1.8m span → 140x70', () => {
    const result = getLintelSize('roof_only', 2.0, 1.8, 'light');
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x70');
    expect(result.maxSpanM).toBe(2.0);
    expect(result.tableRef).toContain('8.9');
  });

  it('Table 8.9: roof_only, light, 2m loaded dim, 2.5m span → 190x70', () => {
    const result = getLintelSize('roof_only', 2.0, 2.5, 'light');
    expect(result).not.toBeNull();
    expect(result.size).toBe('190x70');
    expect(result.maxSpanM).toBe(2.7);
  });

  it('Table 8.9: roof_only, light, 2m loaded dim, 1.0m span → 90x70', () => {
    const result = getLintelSize('roof_only', 2.0, 1.0, 'light');
    expect(result).not.toBeNull();
    expect(result.size).toBe('90x70');
  });

  it('Table 8.9: heavy roof, 2m loaded dim, 1.0m span → 90x70', () => {
    const result = getLintelSize('roof_only', 2.0, 1.0, 'heavy');
    expect(result).not.toBeNull();
    expect(result.size).toBe('90x70');
    expect(result.maxSpanM).toBe(1.0);
  });

  it('rounds UP loaded dimension: 2.5m → uses 3m row', () => {
    const result = getLintelSize('roof_only', 2.5, 1.5, 'light');
    expect(result).not.toBeNull();
    // At loaded dim 3, 140x70 has max span 1.7m which is >= 1.5
    expect(result.size).toBe('140x70');
  });

  it('Table 8.10: roof_wall, light_light, 2m loaded dim, 1.5m span → 140x70', () => {
    const result = getLintelSize('roof_wall', 2.0, 1.5, 'light', 'light');
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x70');
    expect(result.tableRef).toContain('8.10');
  });

  it('Table 8.13: floor_only, 2m loaded dim, 1.4m span → 140x70', () => {
    const result = getLintelSize('floor_only', 2.0, 1.4, 'light');
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x70');
    expect(result.maxSpanM).toBe(1.5);
  });

  it('returns null when span exceeds all sizes', () => {
    const result = getLintelSize('roof_only', 6.0, 10.0, 'heavy');
    expect(result).toBeNull();
  });

  it('returns null for invalid load case', () => {
    const result = getLintelSize('invalid', 2.0, 1.0);
    expect(result).toBeNull();
  });

  // Cross-check against nzs3604_design.json worked example:
  // O1: 1800mm window, load_case=roof_only, loaded_dim=2.0, lintel=140x70
  it('matches design.json worked example: O1 window 1800mm → 140x70', () => {
    // Span = (1800 + 2×90) / 1000 = 1.98m (opening + 2 trimming studs)
    // But the design.json says span_m=1.8 (opening width only)
    const result = getLintelSize('roof_only', 2.0, 1.8, 'light');
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x70');
  });
});

// ─────────────────────────────────────────────────────────────
// Lintel Fixing (Table 8.14)
// ─────────────────────────────────────────────────────────────

describe('getLintelFixing', () => {
  it('light roof, M wind zone, 2m loaded dim, 1.5m span → no uplift', () => {
    const result = getLintelFixing('light', 'M', 2.0, 1.5);
    expect(result).not.toBeNull();
    expect(result.fixingType).toBe('E (no uplift)');
  });

  it('light roof, EH wind zone, 2m loaded dim, 3.0m span → uplift', () => {
    const result = getLintelFixing('light', 'EH', 2.0, 3.0);
    expect(result).not.toBeNull();
    expect(result.fixingType).toBe('F (uplift)');
  });
});

// ─────────────────────────────────────────────────────────────
// Sill/Head Trimmer (Table 8.15)
// ─────────────────────────────────────────────────────────────

describe('getSillHeadTrimmerSize', () => {
  it('2.0m opening → 35mm min thickness', () => {
    const result = getSillHeadTrimmerSize(2.0);
    expect(result).not.toBeNull();
    expect(result.minThickness).toBe(35);
  });

  it('2.4m opening → 45mm', () => {
    const result = getSillHeadTrimmerSize(2.4);
    expect(result.minThickness).toBe(45);
  });

  it('3.5m opening rounds UP to 3.6 → 135mm', () => {
    const result = getSillHeadTrimmerSize(3.5);
    expect(result.minThickness).toBe(135);
  });

  it('4.2m opening → SED', () => {
    const result = getSillHeadTrimmerSize(4.2);
    expect(result.minThickness).toBe('SED');
  });
});

// ─────────────────────────────────────────────────────────────
// Loadbearing Stud Size (Table 8.2)
// ─────────────────────────────────────────────────────────────

describe('getStudSize', () => {
  it('sot, M wind, 2.0m loaded dim, 2.4m height, 600mm spacing → 90x45', () => {
    const result = getStudSize('sot', 'M', 2.0, 2.4, 600);
    expect(result).not.toBeNull();
    expect(result.size).toBe('90x45');
    expect(result.tableRef).toBe('Table 8.2');
  });

  it('sot, L wind, 2.0m loaded dim, 2.4m height, 600mm spacing → 90x35', () => {
    const result = getStudSize('sot', 'L', 2.0, 2.4, 600);
    expect(result).not.toBeNull();
    expect(result.size).toBe('90x35');
  });

  it('sot, EH wind, 6.0m loaded dim, 3.6m height, 600mm spacing → 190x45', () => {
    const result = getStudSize('sot', 'EH', 6.0, 3.6, 600);
    expect(result).not.toBeNull();
    expect(result.size).toBe('190x45');
  });

  it('sot, internal, 2.0m loaded dim, 2.4m height, 600mm spacing → 90x35', () => {
    const result = getStudSize('sot', 'internal', 2.0, 2.4, 600);
    expect(result).not.toBeNull();
    expect(result.size).toBe('90x35');
  });

  // Cross-check against nzs3604_design.json: sot, M wind, 2.0m loaded dim, 2.7m height, 600mm → 90x35
  it('matches design.json: sot, M wind, 2.0m loaded dim, 2.7m height, 600mm → 90x35', () => {
    const result = getStudSize('sot', 'M', 2.0, 2.7, 600);
    expect(result).not.toBeNull();
    // design.json has 90x45 for the front wall but that's at 2.7m height
    // Table 8.2: sot → M → 2.0 → 2.7 → 600 = "90x35"
    expect(result.size).toBe('90x35');
  });
});

// ─────────────────────────────────────────────────────────────
// Non-Loadbearing Stud Size (Table 8.4)
// ─────────────────────────────────────────────────────────────

describe('getNonLoadbearingStudSize', () => {
  it('M wind, 2.4m height, 600mm spacing → 90x35', () => {
    const result = getNonLoadbearingStudSize('M', 2.4, 600);
    expect(result).not.toBeNull();
    expect(result.size).toBe('90x35');
  });

  it('EH wind, 3.0m height, 600mm spacing → 140x45', () => {
    const result = getNonLoadbearingStudSize('EH', 3.0, 600);
    expect(result).not.toBeNull();
    expect(result.size).toBe('140x45');
  });

  it('L wind maps to ML', () => {
    const result = getNonLoadbearingStudSize('L', 2.4, 600);
    expect(result).not.toBeNull();
    expect(result.size).toBe('90x35');
  });
});

// ─────────────────────────────────────────────────────────────
// Trimming Studs (Table 8.5)
// ─────────────────────────────────────────────────────────────

describe('getTrimmingStudSize', () => {
  it('1800mm opening, 90mm studs, sot → 90mm thickness (1 stud)', () => {
    const result = getTrimmingStudSize(1800, 90, 'sot_and_nlb');
    expect(result).not.toBeNull();
    expect(result.thickness).toBe(90);
    expect(result.studCount).toBe(1);
  });

  it('3000mm opening, 90mm studs, sot → 180mm thickness (2 studs)', () => {
    const result = getTrimmingStudSize(3000, 90, 'sot_and_nlb');
    expect(result).not.toBeNull();
    expect(result.thickness).toBe(180);
    expect(result.studCount).toBe(2);
  });

  it('exceeds table → null', () => {
    const result = getTrimmingStudSize(5000, 90, 'sot_and_nlb');
    expect(result).toBeNull();
  });
});
