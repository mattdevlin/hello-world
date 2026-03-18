/**
 * NZS 3604:2011 — Floor Framing Rules
 *
 * Prescriptive sizing for timber-framed floor members per NZS 3604.
 *
 * References:
 *   - NZS 3604:2011 Table 7.1  — Floor joists
 *   - NZS 3604:2011 Table 7.3  — Strip flooring
 *   - NZS 3604:2011 Table 7.4  — Plywood flooring
 *   - NZS 3604:2011 Table 6.4  — Bearers
 *   - NZS 3604:2011 Table 6.1  — Pile footings
 */

import { tables, tableLookup, findSmallestMember } from './tables.js';

// ─────────────────────────────────────────────────────────────
// Table 7.1 — Floor Joists
// ─────────────────────────────────────────────────────────────

/**
 * Get floor joist size per NZS 3604 Table 7.1.
 *
 * @param {number} loadKpa — floor live load (1.5 or 2.0 kPa)
 * @param {number} spacingMm — joist spacing in mm (400, 450, or 600)
 * @param {number} requiredSpanM — required span in metres
 * @returns {{ size: string, maxSpanM: number, tableRef: string }|null}
 */
export function getFloorJoistSize(loadKpa, spacingMm, requiredSpanM) {
  const joistData = tables.floor_joists;
  if (!joistData) return null;

  const loadKey = `${Number(loadKpa).toFixed(1)}_kpa`;
  const loadTable = joistData[loadKey];
  if (!loadTable) return null;

  // Build a size→maxSpan map for the given spacing
  const sizeSpanMap = {};
  for (const [size, spacings] of Object.entries(loadTable)) {
    if (size.startsWith('_')) continue;
    // Use tableLookup to round UP spacing
    const spacingResult = tableLookup(spacings, spacingMm);
    if (spacingResult) {
      sizeSpanMap[size] = spacingResult.value;
    }
  }

  const member = findSmallestMember(sizeSpanMap, requiredSpanM);
  if (!member) return null;

  return {
    size: member.size,
    maxSpanM: member.maxSpanM,
    tableRef: `Table ${joistData._ref || '7.1'}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Table 6.4 — Bearers
// ─────────────────────────────────────────────────────────────

/**
 * Get bearer size per NZS 3604 Table 6.4.
 *
 * @param {number} loadKpa — floor live load (1.5 or 2.0 kPa)
 * @param {number} bearerSpanM — bearer span in metres
 * @param {number} loadedDimM — loaded dimension (joist span) in metres
 * @returns {{ size: string, maxLoadedDimM: number, tableRef: string }|null}
 */
export function getBearerSize(loadKpa, bearerSpanM, loadedDimM) {
  const bearerData = tables.bearers;
  if (!bearerData) return null;

  const loadKey = `${Number(loadKpa).toFixed(1)}_kpa`;
  const loadTable = bearerData[loadKey];
  if (!loadTable) return null;

  // Round UP bearer span to next table key
  const spanResult = tableLookup(loadTable, bearerSpanM);
  if (!spanResult) return null;

  // spanResult.value is a size → max_loaded_dim map
  const sizeLoadedMap = spanResult.value;
  const member = findSmallestMember(sizeLoadedMap, loadedDimM);
  if (!member) return null;

  return {
    size: member.size,
    maxLoadedDimM: member.maxSpanM,
    tableRef: `Table ${bearerData._ref || '6.4'}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Table 6.1 — Pile Footings
// ─────────────────────────────────────────────────────────────

/**
 * Get pile footing size per NZS 3604 Table 6.1.
 *
 * @param {number} bearerSpanM — bearer span in metres
 * @param {number} joistSpanM — joist span in metres
 * @param {string} loadType — 'floor_only'|'1_storey'|'2_storey'|'3_storey'
 * @returns {{ squareMm: number, circularMm: number, tableRef: string }|null}
 */
export function getPileFootingSize(bearerSpanM, joistSpanM, loadType) {
  const pileData = tables.pile_footings;
  if (!pileData) return null;

  // Round UP bearer span
  const bearerResult = tableLookup(pileData, bearerSpanM);
  if (!bearerResult) return null;

  // Round UP joist span
  const joistResult = tableLookup(bearerResult.value, joistSpanM);
  if (!joistResult) return null;

  const loadEntry = joistResult.value[loadType];
  if (!loadEntry) return null;

  return {
    squareMm: loadEntry.sq,
    circularMm: loadEntry.circ,
    tableRef: `Table ${pileData._ref || '6.1'}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Tables 7.3/7.4 — Flooring Thickness
// ─────────────────────────────────────────────────────────────

/**
 * Get flooring thickness per NZS 3604 Table 7.3 (strip) or 7.4 (plywood).
 *
 * @param {number} joistSpacingMm — joist spacing in mm (400, 450, or 600)
 * @param {'strip'|'plywood'} type — flooring type
 * @returns {{ minThicknessMm: object|number, tableRef: string }|null}
 *   For strip: minThicknessMm is { A: mm, B: mm } (timber types)
 *   For plywood: minThicknessMm is a number
 */
export function getFlooringThickness(joistSpacingMm, type) {
  if (type === 'strip') {
    const stripData = tables.flooring_strip;
    if (!stripData) return null;

    const result = tableLookup(stripData, joistSpacingMm);
    if (!result) return null;

    return {
      minThicknessMm: result.value,
      tableRef: `Table ${stripData._ref || '7.3'}`,
    };
  }

  if (type === 'plywood') {
    const plyData = tables.plywood_flooring;
    if (!plyData) return null;

    const result = tableLookup(plyData, joistSpacingMm);
    if (!result) return null;

    return {
      minThicknessMm: result.value,
      tableRef: `Table ${plyData._ref || '7.4'}`,
    };
  }

  return null;
}
