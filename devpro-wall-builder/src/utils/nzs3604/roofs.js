/**
 * NZS 3604:2011 — Roof Framing Rules
 *
 * Prescriptive sizing for timber-framed roof members per NZS 3604.
 *
 * References:
 *   - NZS 3604:2011 Table 10.1  — Rafters (ordinary + valley)
 *   - NZS 3604:2011 Table 10.2  — Ridge beams
 *   - NZS 3604:2011 Table 10.3  — Ceiling joists
 *   - NZS 3604:2011 Table 10.4  — Ceiling runners
 *   - NZS 3604:2011 Table 10.5  — Underpurlins
 *   - NZS 3604:2011 Table 8.7   — Steep roof multiplier
 *   - NZS 3604:2011 Table 10.16 — Roof bracing systems
 *   - NZS 3604:2011 Table 10.17 — Roof space diagonal braces
 */

import { tables, tableLookup, MEMBER_SIZE_ORDER } from './tables.js';

// ─────────────────────────────────────────────────────────────
// Table 10.1 — Rafters (ordinary)
// ─────────────────────────────────────────────────────────────

/**
 * Get ordinary rafter size per NZS 3604 Table 10.1.
 *
 * Raw table spans are for EH wind zone. Other zones get a bonus multiplier.
 *
 * @param {string} windZone — 'L'|'M'|'H'|'VH'|'EH'
 * @param {number} spacingMm — rafter spacing in mm (480, 600, 900, 1200)
 * @param {number} requiredSpanM — required span in metres
 * @returns {{ size: string, maxSpanM: number, fixingType: string, tableRef: string }|null}
 */
export function getRafterSize(windZone, spacingMm, requiredSpanM) {
  const rafterData = tables.rafters;
  if (!rafterData) return null;

  const ordinary = rafterData.ordinary;
  if (!ordinary) return null;

  const multiplier = rafterData.rafter_zone_multipliers?.[windZone];
  if (multiplier === undefined) return null;

  for (const size of MEMBER_SIZE_ORDER) {
    const spacings = ordinary[size];
    if (!spacings) continue;

    const spacingResult = tableLookup(spacings, spacingMm);
    if (!spacingResult) continue;

    const entry = spacingResult.value;
    const adjustedSpan = entry.span * multiplier;

    if (adjustedSpan >= requiredSpanM) {
      return {
        size,
        maxSpanM: adjustedSpan,
        fixingType: entry.fix,
        tableRef: `Table ${rafterData._ref || '10.1'}`,
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Table 10.1 — Valley Rafters
// ─────────────────────────────────────────────────────────────

/**
 * Get valley rafter size per NZS 3604 Table 10.1.
 *
 * Valley rafters are single members sized by roof weight only (no spacing, no wind zone multiplier).
 *
 * @param {'light'|'heavy'} roofWeight — roof weight class
 * @param {number} requiredSpanM — required span in metres
 * @returns {{ size: string, maxSpanM: number, fixingType: string, tableRef: string }|null}
 */
export function getValleyRafterSize(roofWeight, requiredSpanM) {
  const rafterData = tables.rafters;
  if (!rafterData) return null;

  const valleyData = rafterData.valley?.[roofWeight];
  if (!valleyData) return null;

  for (const size of MEMBER_SIZE_ORDER) {
    const entry = valleyData[size];
    if (!entry) continue;

    if (entry.span >= requiredSpanM) {
      return {
        size,
        maxSpanM: entry.span,
        fixingType: entry.fix,
        tableRef: `Table ${rafterData._ref || '10.1'}`,
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Table 10.2 — Ridge Beams
// ─────────────────────────────────────────────────────────────

/**
 * Get ridge beam size per NZS 3604 Table 10.2.
 *
 * @param {'light'|'heavy'} roofWeight — roof weight class
 * @param {number} loadedDimM — loaded dimension in metres
 * @param {number} requiredSpanM — required span in metres
 * @returns {{ size: string, maxSpanM: number, fixingType: string, tableRef: string }|null}
 */
export function getRidgeBeamSize(roofWeight, loadedDimM, requiredSpanM) {
  const ridgeData = tables.ridge_beams;
  if (!ridgeData) return null;

  const weightData = ridgeData[roofWeight];
  if (!weightData) return null;

  for (const size of MEMBER_SIZE_ORDER) {
    const dims = weightData[size];
    if (!dims) continue;

    const dimResult = tableLookup(dims, loadedDimM);
    if (!dimResult) continue;

    const entry = dimResult.value;
    if (entry.span >= requiredSpanM) {
      return {
        size,
        maxSpanM: entry.span,
        fixingType: entry.fix,
        tableRef: `Table ${ridgeData._ref || '10.2'}`,
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Table 10.3 — Ceiling Joists
// ─────────────────────────────────────────────────────────────

/**
 * Get ceiling joist size per NZS 3604 Table 10.3.
 *
 * @param {number} spacingMm — joist spacing in mm (480, 600, 900)
 * @param {number} requiredSpanM — required span in metres
 * @returns {{ size: string, maxSpanM: number, tableRef: string }|null}
 */
export function getCeilingJoistSize(spacingMm, requiredSpanM) {
  const joistData = tables.ceiling_joists;
  if (!joistData) return null;

  // Build size→maxSpan map for the given spacing
  const sizeSpanMap = {};
  for (const [size, spacings] of Object.entries(joistData)) {
    if (size.startsWith('_')) continue;
    const spacingResult = tableLookup(spacings, spacingMm);
    if (spacingResult) {
      sizeSpanMap[size] = spacingResult.value;
    }
  }

  // Use MEMBER_SIZE_ORDER to find smallest sufficient member
  for (const size of MEMBER_SIZE_ORDER) {
    const maxSpan = sizeSpanMap[size];
    if (maxSpan !== undefined && maxSpan >= requiredSpanM) {
      return {
        size,
        maxSpanM: maxSpan,
        tableRef: `Table ${joistData._ref || '10.3'}`,
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Table 10.4 — Ceiling Runners
// ─────────────────────────────────────────────────────────────

/**
 * Get ceiling runner size per NZS 3604 Table 10.4.
 *
 * Note: spacing keys are in metres (not mm).
 *
 * @param {number} spacingM — runner spacing in metres (1.8, 2.4, 3.0)
 * @param {number} requiredSpanM — required span in metres
 * @returns {{ size: string, maxSpanM: number, tableRef: string }|null}
 */
export function getCeilingRunnerSize(spacingM, requiredSpanM) {
  const runnerData = tables.ceiling_runners;
  if (!runnerData) return null;

  // Build size→maxSpan map for the given spacing
  const sizeSpanMap = {};
  for (const [size, spacings] of Object.entries(runnerData)) {
    if (size.startsWith('_')) continue;
    const spacingResult = tableLookup(spacings, spacingM);
    if (spacingResult) {
      sizeSpanMap[size] = spacingResult.value;
    }
  }

  for (const size of MEMBER_SIZE_ORDER) {
    const maxSpan = sizeSpanMap[size];
    if (maxSpan !== undefined && maxSpan >= requiredSpanM) {
      return {
        size,
        maxSpanM: maxSpan,
        tableRef: `Table ${runnerData._ref || '10.4'}`,
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Table 10.5 — Underpurlins
// ─────────────────────────────────────────────────────────────

/**
 * Get underpurlin size per NZS 3604 Table 10.5.
 *
 * Only "light" weight data exists in the table. Returns null for "heavy".
 *
 * @param {'light'|'heavy'} roofWeight — roof weight class
 * @param {number} loadedDimM — loaded dimension in metres
 * @param {number} requiredSpanM — required span in metres
 * @returns {{ size: string, maxSpanM: number, fixingType: string, tableRef: string }|null}
 */
export function getUnderpurlinSize(roofWeight, loadedDimM, requiredSpanM) {
  const purlinData = tables.underpurlins;
  if (!purlinData) return null;

  const weightData = purlinData[roofWeight];
  if (!weightData) return null;

  for (const size of MEMBER_SIZE_ORDER) {
    const dims = weightData[size];
    if (!dims) continue;

    const dimResult = tableLookup(dims, loadedDimM);
    if (!dimResult) continue;

    const entry = dimResult.value;
    if (entry.span >= requiredSpanM) {
      return {
        size,
        maxSpanM: entry.span,
        fixingType: entry.fix,
        tableRef: `Table ${purlinData._ref || '10.5'}`,
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Table 8.7 — Steep Roof Multiplier
// ─────────────────────────────────────────────────────────────

/**
 * Get steep roof bracing multiplier per NZS 3604 Table 8.7.
 *
 * Only applies to pitches >= 50°. Returns null for lower pitches (no multiplier needed).
 *
 * @param {number} pitchDeg — roof pitch in degrees
 * @param {'trusses'|'single_rafters'} roofType — roof framing type
 * @returns {{ multiplier: number, tableRef: string }|null}
 */
export function getSteepRoofMultiplier(pitchDeg, roofType) {
  if (pitchDeg < 50) return null;

  const steepData = tables.steep_roof_multiplier;
  if (!steepData) return null;

  const pitchResult = tableLookup(steepData, pitchDeg);
  if (!pitchResult) return null;

  const value = pitchResult.value[roofType];
  if (value === undefined || value === 'SED') return null;

  return {
    multiplier: value,
    tableRef: `Table ${steepData._ref || '8.7'}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Table 10.16 — Roof Bracing Systems
// ─────────────────────────────────────────────────────────────

/**
 * Get roof bracing requirements per NZS 3604 Table 10.16.
 *
 * @param {'light'|'heavy'} roofWeight — roof weight class
 * @returns {{ planeBrace: string, spaceBrace: string, tableRef: string }|null}
 */
export function getRoofBracingRequirements(roofWeight) {
  const bracingData = tables.roof_bracing_systems;
  if (!bracingData) return null;

  const entry = bracingData[roofWeight];
  if (!entry) return null;

  return {
    planeBrace: entry.roof_plane_brace,
    spaceBrace: entry.roof_space_brace,
    tableRef: `Table ${bracingData._ref || '10.16'}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Table 10.17 — Roof Space Diagonal Braces
// ─────────────────────────────────────────────────────────────

/**
 * Get diagonal brace max length per NZS 3604 Table 10.17.
 *
 * @param {'90x45'|'2x90x45_spaced'} braceType — brace configuration
 * @returns {{ maxLengthM: number, tableRef: string }|null}
 */
export function getDiagonalBraceMaxLength(braceType) {
  const braceData = tables.roof_space_diagonal_braces;
  if (!braceData) return null;

  const entry = braceData[braceType];
  if (!entry) return null;

  return {
    maxLengthM: entry.max_length_m,
    tableRef: `Table ${braceData._ref || '10.17'}`,
  };
}
