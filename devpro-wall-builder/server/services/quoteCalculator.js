/**
 * Pure pricing engine. No side effects — easy to test.
 *
 * @param {Object} materials - Quantities keyed by category
 *   { magboard: { totalSheets }, eps: { totalBlocks }, glue: { totalLitres }, timber: { totalLinealMetres } }
 * @param {Object} pricing - Unit costs keyed by category
 *   { magboard: { unit_cost }, eps: { unit_cost }, glue: { unit_cost }, timber: { unit_cost } }
 * @param {Object} margins - Markup values keyed by key
 *   { magboard_markup, eps_markup, glue_markup, timber_markup, global_overhead }
 * @returns {Object} Full price breakdown
 */
export function calculateQuotePrice(materials, pricing, margins) {
  const categories = [
    { key: 'magboard', qtyField: 'totalSheets', markupKey: 'magboard_markup' },
    { key: 'eps', qtyField: 'totalBlocks', markupKey: 'eps_markup' },
    { key: 'glue', qtyField: 'totalLitres', markupKey: 'glue_markup' },
    { key: 'timber', qtyField: 'totalLinealMetres', markupKey: 'timber_markup' },
  ];

  const subtotals = {};
  let totalBeforeOverhead = 0;

  for (const { key, qtyField, markupKey } of categories) {
    const quantity = materials[key]?.[qtyField] || 0;
    const unitCost = pricing[key]?.unit_cost || 0;
    const markup = margins[markupKey] || 0;

    const baseCost = quantity * unitCost;
    const markedUpCost = baseCost * (1 + markup);

    subtotals[key] = {
      quantity,
      unitCost,
      baseCost: round2(baseCost),
      markup,
      markedUpCost: round2(markedUpCost),
    };

    totalBeforeOverhead += markedUpCost;
  }

  totalBeforeOverhead = round2(totalBeforeOverhead);
  const overheadRate = margins.global_overhead || 0;
  const overheadAmount = round2(totalBeforeOverhead * overheadRate);
  const totalPrice = round2(totalBeforeOverhead + overheadAmount);

  return {
    subtotals,
    totalBeforeOverhead,
    overheadRate,
    overheadAmount,
    totalPrice,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
