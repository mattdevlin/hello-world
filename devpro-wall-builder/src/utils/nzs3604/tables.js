/**
 * NZS 3604:2011 — Generic Table Lookup Helpers
 *
 * All NZS 3604 prescriptive tables follow the same "round UP to next row" rule:
 * if your input falls between two table row keys, you must use the higher key.
 * This module encodes that rule once and exports the table data for all domain modules.
 */

import tables from '../../../nzs3604_tables.json';

export { tables };

// ─────────────────────────────────────────────────────────────
// Structural member size ordering (smallest → largest)
// ─────────────────────────────────────────────────────────────

export const MEMBER_SIZE_ORDER = [
  '70x45',
  '90x35', '90x45', '90x70', '90x90',
  '140x35', '140x45', '140x70', '140x90',
  '190x45', '190x70', '190x90',
  '240x45', '240x70', '240x90',
  '290x45', '290x70', '290x90',
];

/**
 * NZS 3604 conservative lookup: round input UP to the next table key.
 *
 * Table keys are numeric strings (e.g., "2", "3", "4", "6" for loaded dimensions).
 * If inputValue falls between keys, the next higher key is used.
 * If inputValue exceeds all keys, returns null (SED required).
 *
 * @param {Object} entries — object keyed by numeric strings, e.g. {"2": {...}, "3": {...}}
 * @param {number} inputValue — the value to look up
 * @returns {{ key: string, value: any }|null}
 */
export function tableLookup(entries, inputValue) {
  // Build array of { originalKey, numericValue } preserving original JSON key strings
  const keys = Object.keys(entries)
    .filter(k => !k.startsWith('_'))
    .map(k => ({ original: k, num: Number(k) }))
    .filter(k => !isNaN(k.num))
    .sort((a, b) => a.num - b.num);

  for (const k of keys) {
    if (inputValue <= k.num) {
      return { key: k.original, value: entries[k.original] };
    }
  }
  // Input exceeds all table rows
  return null;
}

/**
 * Find the smallest member size whose max span >= required span.
 *
 * @param {Object} sizeSpanMap — e.g. {"90x70": 1.2, "140x70": 2.0, ...}
 * @param {number} requiredSpan — required span in metres
 * @returns {{ size: string, maxSpanM: number }|null} — null if no size sufficient (SED)
 */
export function findSmallestMember(sizeSpanMap, requiredSpan) {
  for (const size of MEMBER_SIZE_ORDER) {
    const maxSpan = sizeSpanMap[size];
    if (maxSpan !== undefined && maxSpan !== null && maxSpan >= requiredSpan) {
      return { size, maxSpanM: maxSpan };
    }
  }
  return null;
}
