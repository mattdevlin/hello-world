import { describe, it, expect } from 'vitest';
import { calculateQuotePrice } from '../services/quoteCalculator.js';

const defaultPricing = {
  magboard: { unit_cost: 85 },
  eps: { unit_cost: 45 },
  glue: { unit_cost: 18 },
  timber: { unit_cost: 6.5 },
};

const defaultMargins = {
  magboard_markup: 0.3,
  eps_markup: 0.25,
  glue_markup: 0.2,
  timber_markup: 0.2,
  global_overhead: 0.1,
};

describe('calculateQuotePrice', () => {
  it('calculates correct totals for known quantities', () => {
    const materials = {
      magboard: { totalSheets: 10 },
      eps: { totalBlocks: 20 },
      glue: { totalLitres: 30 },
      timber: { totalLinealMetres: 100 },
    };

    const result = calculateQuotePrice(materials, defaultPricing, defaultMargins);

    // magboard: 10 * 85 = 850 * 1.3 = 1105
    expect(result.subtotals.magboard.baseCost).toBe(850);
    expect(result.subtotals.magboard.markedUpCost).toBe(1105);

    // eps: 20 * 45 = 900 * 1.25 = 1125
    expect(result.subtotals.eps.baseCost).toBe(900);
    expect(result.subtotals.eps.markedUpCost).toBe(1125);

    // glue: 30 * 18 = 540 * 1.2 = 648
    expect(result.subtotals.glue.baseCost).toBe(540);
    expect(result.subtotals.glue.markedUpCost).toBe(648);

    // timber: 100 * 6.5 = 650 * 1.2 = 780
    expect(result.subtotals.timber.baseCost).toBe(650);
    expect(result.subtotals.timber.markedUpCost).toBe(780);

    // total before overhead: 1105 + 1125 + 648 + 780 = 3658
    expect(result.totalBeforeOverhead).toBe(3658);

    // overhead: 3658 * 0.1 = 365.8
    expect(result.overheadAmount).toBe(365.8);

    // total: 3658 + 365.8 = 4023.8
    expect(result.totalPrice).toBe(4023.8);
  });

  it('handles zero quantities', () => {
    const materials = {
      magboard: { totalSheets: 0 },
      eps: { totalBlocks: 0 },
      glue: { totalLitres: 0 },
      timber: { totalLinealMetres: 0 },
    };

    const result = calculateQuotePrice(materials, defaultPricing, defaultMargins);

    expect(result.totalPrice).toBe(0);
    expect(result.totalBeforeOverhead).toBe(0);
    expect(result.overheadAmount).toBe(0);
  });

  it('handles missing material categories gracefully', () => {
    const materials = {
      magboard: { totalSheets: 10 },
      // eps, glue, timber missing
    };

    const result = calculateQuotePrice(materials, defaultPricing, defaultMargins);

    expect(result.subtotals.magboard.markedUpCost).toBe(1105);
    expect(result.subtotals.eps.markedUpCost).toBe(0);
    expect(result.subtotals.glue.markedUpCost).toBe(0);
    expect(result.subtotals.timber.markedUpCost).toBe(0);
    expect(result.totalBeforeOverhead).toBe(1105);
  });

  it('rounds to nearest cent', () => {
    const materials = {
      magboard: { totalSheets: 3 },
      eps: { totalBlocks: 7 },
      glue: { totalLitres: 0 },
      timber: { totalLinealMetres: 0 },
    };

    const pricing = {
      magboard: { unit_cost: 33.33 },
      eps: { unit_cost: 11.11 },
      glue: { unit_cost: 0 },
      timber: { unit_cost: 0 },
    };

    const margins = {
      magboard_markup: 0.33,
      eps_markup: 0.17,
      global_overhead: 0.05,
    };

    const result = calculateQuotePrice(materials, pricing, margins);

    // All values should have at most 2 decimal places
    const checkDecimals = (val) => {
      const str = String(val);
      const parts = str.split('.');
      if (parts.length === 2) {
        expect(parts[1].length).toBeLessThanOrEqual(2);
      }
    };

    checkDecimals(result.totalBeforeOverhead);
    checkDecimals(result.overheadAmount);
    checkDecimals(result.totalPrice);
  });

  it('applies zero overhead correctly', () => {
    const materials = {
      magboard: { totalSheets: 10 },
      eps: { totalBlocks: 0 },
      glue: { totalLitres: 0 },
      timber: { totalLinealMetres: 0 },
    };

    const margins = { ...defaultMargins, global_overhead: 0 };
    const result = calculateQuotePrice(materials, defaultPricing, margins);

    expect(result.overheadAmount).toBe(0);
    expect(result.totalPrice).toBe(result.totalBeforeOverhead);
  });
});
