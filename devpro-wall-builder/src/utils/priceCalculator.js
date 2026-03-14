/**
 * Client-side price calculator.
 *
 * Mirrors server/services/quoteCalculator.js logic using default pricing
 * from server/seeds/defaultPricing.js. Tries to fetch live pricing from
 * the admin API; falls back to defaults if the backend is unavailable.
 */

import { computeProjectMagboardSheetsWithRoofs } from './magboardOptimizer.js';
import { computeProjectEpsBlocksWithRoofs } from './epsOptimizer.js';
import { computeProjectGlueWithRoofs } from './glueCalculator.js';
import { computeProjectTimber } from './timberCalculator.js';

// ── Default pricing (matches server/seeds/defaultPricing.js) ──

const DEFAULT_PRICING = {
  magboard: { unit_cost: 85.0 },
  eps:      { unit_cost: 45.0 },
  glue:     { unit_cost: 18.0 },
  timber:   { unit_cost: 6.5 },
};

const DEFAULT_MARGINS = {
  magboard_markup: 0.30,
  eps_markup: 0.25,
  glue_markup: 0.20,
  timber_markup: 0.20,
  global_overhead: 0.10,
};

const DEFAULT_GST_RATE = 0.15;

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Aggregate material quantities from walls, floors, and roofs.
 */
function aggregateMaterials(walls, floors, roofs) {
  const magboard = computeProjectMagboardSheetsWithRoofs(walls, floors || [], roofs || []);
  const eps = computeProjectEpsBlocksWithRoofs(walls, floors || [], roofs || []);
  const glue = computeProjectGlueWithRoofs(walls, floors || [], roofs || []);
  const timber = computeProjectTimber(walls, floors || []);

  return {
    magboard: { totalSheets: magboard.totalSheets },
    eps: { totalBlocks: eps.totalBlocks },
    glue: { totalLitres: glue.totalLitres },
    timber: { totalLinealMetres: timber.totalLinealMetres },
  };
}

/**
 * Calculate price from materials using pricing and margins.
 * Same logic as server/services/quoteCalculator.js.
 */
function calculatePrice(materials, pricing, margins) {
  const categories = [
    { key: 'magboard', qtyField: 'totalSheets', markupKey: 'magboard_markup' },
    { key: 'eps', qtyField: 'totalBlocks', markupKey: 'eps_markup' },
    { key: 'glue', qtyField: 'totalLitres', markupKey: 'glue_markup' },
    { key: 'timber', qtyField: 'totalLinealMetres', markupKey: 'timber_markup' },
  ];

  let totalBeforeOverhead = 0;

  for (const { key, qtyField, markupKey } of categories) {
    const quantity = Math.max(0, materials[key]?.[qtyField] || 0);
    const unitCost = pricing[key]?.unit_cost || 0;
    const markup = margins[markupKey] || 0;
    const baseCost = quantity * unitCost;
    const markedUpCost = baseCost * (1 + markup);
    totalBeforeOverhead += markedUpCost;
  }

  totalBeforeOverhead = round2(totalBeforeOverhead);
  const overheadRate = margins.global_overhead || 0;
  const overheadAmount = round2(totalBeforeOverhead * overheadRate);
  const totalExGst = round2(totalBeforeOverhead + overheadAmount);
  const gstRate = DEFAULT_GST_RATE;
  const gst = round2(totalExGst * gstRate);
  const totalIncGst = round2(totalExGst + gst);

  return { totalExGst, gst, totalIncGst };
}

/**
 * Try to fetch live pricing/margins from the admin API.
 * Returns { pricing, margins } or null on failure.
 */
async function fetchLivePricing() {
  try {
    const [pricingRes, marginsRes] = await Promise.all([
      fetch('/api/pricing'),
      fetch('/api/margins'),
    ]);
    if (!pricingRes.ok || !marginsRes.ok) return null;

    const pricingRows = await pricingRes.json();
    const marginRows = await marginsRes.json();

    const pricing = {};
    for (const row of pricingRows) {
      pricing[row.category] = { unit_cost: row.unit_cost };
    }

    const margins = {};
    for (const row of marginRows) {
      margins[row.key] = row.value;
    }

    return { pricing, margins };
  } catch {
    return null;
  }
}

/**
 * Calculate the project price from walls, floors, and roofs.
 *
 * Tries live pricing from the API first, falls back to defaults.
 *
 * @param {Array} walls
 * @param {Array} floors
 * @param {Array} roofs
 * @returns {Promise<{ totalExGst: number, gst: number, totalIncGst: number, isLive: boolean }>}
 */
export async function calculateProjectPrice(walls, floors, roofs) {
  if ((!walls || walls.length === 0) && (!floors || floors.length === 0) && (!roofs || roofs.length === 0)) {
    return { totalExGst: 0, gst: 0, totalIncGst: 0, isLive: false };
  }

  const materials = aggregateMaterials(walls || [], floors || [], roofs || []);

  const live = await fetchLivePricing();
  const pricing = live?.pricing || DEFAULT_PRICING;
  const margins = live?.margins || DEFAULT_MARGINS;
  const isLive = !!live;

  const result = calculatePrice(materials, pricing, margins);
  return { ...result, isLive };
}
