/**
 * NZS 3604:2011 — Wall Framing Rules
 *
 * Prescriptive sizing for timber-framed wall members per NZS 3604
 * with supplementary rules from BRANZ Build 141 (Oct/Nov 2014).
 *
 * References:
 *   - NZS 3604:2011 Table 8.2  — Studs in loadbearing walls
 *   - NZS 3604:2011 Table 8.4  — Studs in non-loadbearing walls
 *   - NZS 3604:2011 Table 8.5  — Trimming studs
 *   - NZS 3604:2011 Table 8.8  — Lintel load cases
 *   - NZS 3604:2011 Tables 8.9–8.13 — Lintels
 *   - NZS 3604:2011 Table 8.14 — Lintel fixing
 *   - NZS 3604:2011 Table 8.15 — Sill/head trimmers
 *   - BRANZ Build 141, Oct/Nov 2014 — "Getting trimmer studs right"
 */

import { tables, tableLookup, findSmallestMember } from './tables.js';

// ─────────────────────────────────────────────────────────────
// NZ Member Terminology
// ─────────────────────────────────────────────────────────────

/**
 * Maps internal member type strings to NZ display labels.
 * Per NZS 3604 and BRANZ terminology:
 *   - Trimming stud: full-height stud at each side of an opening
 *   - Doubling stud (understud): shorter stud beside trimming stud, supports lintel
 *   - Jack stud: short stud above lintel or below sill
 *   - Sill trimmer: horizontal member under window sill
 *   - Dwang (nog): horizontal bracing between studs
 */
export const NZ_MEMBER_LABELS = {
  bottom_plate:   'Bottom Plate',
  top_plate_1:    'Top Plate 1',
  top_plate_2:    'Top Plate 2',
  stud:           'Stud',
  end_stud:       'End Stud',
  trimming_stud:  'Trimming Stud',
  doubling_stud:  'Doubling Stud',
  jack_stud:      'Jack Stud',
  lintel:         'Lintel',
  sill_trimmer:   'Sill Trimmer',
  dwang:          'Dwang',
};

// ─────────────────────────────────────────────────────────────
// BRANZ Build 141 Rules
// ─────────────────────────────────────────────────────────────

/**
 * Key rules from BRANZ Build 141 (Oct/Nov 2014) for trimming stud sizing.
 * These are prescriptive constraints that apply in addition to Table 8.5.
 *
 * Reference: BRANZ Build 141, Oct/Nov 2014 — "Getting trimmer studs right"
 */
export const BRANZ_RULES = {
  reference: 'BRANZ Build 141, Oct/Nov 2014 — Getting trimmer studs right',

  rules: [
    {
      id: 'trimming_stud_width',
      description: 'Trimming studs must be the same width as the wall studs',
      detail: 'If wall studs are 90mm wide, trimming studs must also be 90mm wide.',
    },
    {
      id: 'no_holes_middle_third',
      description: 'No holes or notches in the middle third of trimming stud height',
      detail: 'Services must not penetrate the middle third of a trimming stud. Route pipes and cables around or use alternative framing.',
    },
    {
      id: 'doubling_max_shorter',
      description: 'Doubling stud cannot be more than 400mm shorter than wall studs',
      detail: 'The doubling (understud) that supports the lintel must not be more than 400mm shorter than the full-height wall studs. If the lintel drop exceeds 400mm, additional support is required.',
    },
    {
      id: 'sizing_process',
      description: 'Four-step sizing process for trimming studs',
      detail: '1) Determine lintel size (Table 8.9). 2) Determine wall stud thickness (Table 8.2). 3) Determine max clear opening width (Table 8.5). 4) Determine trimming stud size from Table 8.5.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// Table 8.5 — Trimming Studs
// ─────────────────────────────────────────────────────────────

// Table 8.5 data: position → stud_thickness → [{ maxOpeningWidth, trimmingThickness }]
const TABLE_8_5 = {
  sot_and_nlb: {
    35: [
      { maxWidth: 1800, thickness: 45 },
      { maxWidth: 3000, thickness: 70 },
    ],
    45: [
      { maxWidth: 1800, thickness: 45 },
      { maxWidth: 3000, thickness: 90 },
    ],
    70: [
      { maxWidth: 1800, thickness: 90 },
      { maxWidth: 3000, thickness: 140 },
      { maxWidth: 3600, thickness: 180 },
    ],
    90: [
      { maxWidth: 1800, thickness: 90 },
      { maxWidth: 3000, thickness: 180 },
      { maxWidth: 3600, thickness: 180 },
      { maxWidth: 4200, thickness: 270 },
    ],
  },
  other: {
    35: [
      { maxWidth: 900, thickness: 45 },
      { maxWidth: 1800, thickness: 70 },
    ],
    45: [
      { maxWidth: 900, thickness: 45 },
      { maxWidth: 1800, thickness: 90 },
      { maxWidth: 3000, thickness: 90 },
    ],
    70: [
      { maxWidth: 900, thickness: 70 },
      { maxWidth: 1800, thickness: 90 },
      { maxWidth: 3000, thickness: 180 },
    ],
    90: [
      { maxWidth: 900, thickness: 90 },
      { maxWidth: 1800, thickness: 90 },
      { maxWidth: 3000, thickness: 180 },
    ],
  },
};

/**
 * Look up the required trimming stud thickness from NZS 3604 Table 8.5.
 *
 * @param {number} openingWidth  — clear opening width in mm
 * @param {number} studThickness — wall stud thickness in mm (35, 45, 70, or 90)
 * @param {'sot_and_nlb'|'other'} position — wall position category
 * @returns {{ thickness: number, studCount: number, note: string }|null}
 */
export function getTrimmingStudSize(openingWidth, studThickness = 90, position = 'sot_and_nlb') {
  const positionData = TABLE_8_5[position];
  if (!positionData) return null;

  // Find closest stud thickness in table (round down to nearest available)
  const availableThicknesses = Object.keys(positionData).map(Number).sort((a, b) => a - b);
  let matchedThickness = availableThicknesses[0];
  for (const t of availableThicknesses) {
    if (t <= studThickness) matchedThickness = t;
  }

  const entries = positionData[matchedThickness];
  if (!entries) return null;

  // Find the first entry where opening width fits
  for (const entry of entries) {
    if (openingWidth <= entry.maxWidth) {
      const studCount = Math.ceil(entry.thickness / studThickness);
      return {
        thickness: entry.thickness,
        studCount,
        note: `Table 8.5: ${openingWidth}mm opening, ${studThickness}mm studs → ${entry.thickness}mm trimming (${studCount}× ${studThickness}mm)`,
      };
    }
  }

  // Opening exceeds table limits
  return null;
}

/**
 * Validate a doubling stud against BRANZ rules.
 *
 * @param {number} doublingHeight — height of the doubling stud (mm)
 * @param {number} wallStudHeight — height of full wall studs (mm)
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateDoublingStud(doublingHeight, wallStudHeight) {
  const warnings = [];
  const heightDiff = wallStudHeight - doublingHeight;

  if (heightDiff > 400) {
    warnings.push(
      `Doubling stud is ${heightDiff}mm shorter than wall studs (max 400mm per BRANZ Build 141). ` +
      `Additional support or engineering design required.`
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// Table 8.8 — Lintel Load Cases
// ─────────────────────────────────────────────────────────────

/**
 * Lintel load case table names, mapping load case to JSON key.
 */
const LINTEL_TABLE_MAP = {
  roof_only:       'lintel_roof_only',
  roof_wall:       'lintel_roof_wall',
  roof_wall_floor: 'lintel_roof_wall_floor',
  wall_floor:      'lintel_wall_floor',
  floor_only:      'lintel_floor_only',
};

/**
 * Determine lintel load case from what the lintel supports.
 *
 * @param {boolean} supportsRoof
 * @param {boolean} supportsWall — supports upper-storey wall
 * @param {boolean} supportsFloor — supports upper-storey floor
 * @returns {string} Load case key (e.g. 'roof_only')
 */
export function getLintelLoadCase(supportsRoof, supportsWall, supportsFloor) {
  if (supportsRoof && !supportsWall && !supportsFloor) return 'roof_only';
  if (supportsRoof && supportsWall && !supportsFloor) return 'roof_wall';
  if (supportsRoof && supportsWall && supportsFloor) return 'roof_wall_floor';
  if (!supportsRoof && supportsWall && supportsFloor) return 'wall_floor';
  if (!supportsRoof && !supportsWall && supportsFloor) return 'floor_only';
  // Default for single-storey external wall
  return 'roof_only';
}

// ─────────────────────────────────────────────────────────────
// Tables 8.9–8.13 — Lintel Sizing
// ─────────────────────────────────────────────────────────────

/**
 * Get the weight key for lintel table lookup.
 * Tables 8.9, 8.10, 8.11 use roof+wall weight combos.
 * Table 8.12 uses wall weight only.
 * Table 8.13 has no weight key (keyed by loaded dim only).
 */
function getLintelWeightKey(loadCase, roofWeight, wallWeight) {
  switch (loadCase) {
    case 'roof_only':
      return roofWeight || 'light';
    case 'roof_wall':
    case 'roof_wall_floor':
      return `${roofWeight || 'light'}_${wallWeight || 'light'}`;
    case 'wall_floor':
      return wallWeight || 'light';
    case 'floor_only':
      return null; // No weight sub-key
    default:
      return roofWeight || 'light';
  }
}

/**
 * Look up lintel size from NZS 3604 Tables 8.9–8.13.
 *
 * @param {string} loadCase — 'roof_only'|'roof_wall'|'roof_wall_floor'|'wall_floor'|'floor_only'
 * @param {number} loadedDimM — loaded dimension in metres (typically half span to each side)
 * @param {number} spanM — lintel span in metres
 * @param {string} [roofWeight='light'] — 'light'|'heavy'
 * @param {string} [wallWeight='light'] — 'light'|'medium'|'heavy'
 * @returns {{ size: string, maxSpanM: number, tableRef: string }|null}
 */
export function getLintelSize(loadCase, loadedDimM, spanM, roofWeight = 'light', wallWeight = 'light') {
  const tableKey = LINTEL_TABLE_MAP[loadCase];
  if (!tableKey) return null;

  const tableData = tables[tableKey];
  if (!tableData) return null;

  const tableRef = `Table ${tableData._ref || tableKey}`;

  // Get the weight sub-table (or use tableData directly for floor_only)
  let weightData;
  if (loadCase === 'floor_only') {
    weightData = tableData;
  } else {
    const weightKey = getLintelWeightKey(loadCase, roofWeight, wallWeight);
    weightData = tableData[weightKey];
    if (!weightData) return null;
  }

  // Round UP loaded dimension to next table key
  const dimResult = tableLookup(weightData, loadedDimM);
  if (!dimResult) return null;

  // dimResult.value is the size→maxSpan map
  const sizeSpanMap = dimResult.value;
  if (!sizeSpanMap || typeof sizeSpanMap !== 'object') return null;

  // Find smallest member whose max span >= required span
  const member = findSmallestMember(sizeSpanMap, spanM);
  if (!member) return null;

  return {
    size: member.size,
    maxSpanM: member.maxSpanM,
    tableRef,
  };
}

// ─────────────────────────────────────────────────────────────
// Table 8.14 — Lintel Fixing
// ─────────────────────────────────────────────────────────────

/**
 * Determine lintel fixing type per NZS 3604 Table 8.14.
 *
 * @param {string} roofWeight — 'light'|'heavy'
 * @param {string} windZone — 'L'|'M'|'H'|'VH'|'EH'
 * @param {number} loadedDimM — loaded dimension in metres
 * @param {number} spanM — lintel span in metres
 * @returns {{ fixingType: string, noUpliftMaxSpan: number|null, upliftMaxSpan: number|null, tableRef: string }|null}
 */
export function getLintelFixing(roofWeight, windZone, loadedDimM, spanM) {
  const fixingData = tables.lintel_fixing;
  if (!fixingData) return null;

  const weightData = fixingData[roofWeight || 'light'];
  if (!weightData) return null;

  const zoneData = weightData[windZone];
  if (!zoneData) return null;

  const dimResult = tableLookup(zoneData, loadedDimM);
  if (!dimResult) return null;

  const entry = dimResult.value;
  const noUplift = entry.no_uplift;
  const uplift = entry.uplift;

  let fixingType;
  if (noUplift !== null && spanM <= noUplift) {
    fixingType = 'E (no uplift)';
  } else if (uplift !== null && spanM <= uplift) {
    fixingType = 'F (uplift)';
  } else {
    fixingType = 'SED';
  }

  return {
    fixingType,
    noUpliftMaxSpan: noUplift,
    upliftMaxSpan: uplift,
    tableRef: 'Table 8.14',
  };
}

// ─────────────────────────────────────────────────────────────
// Table 8.15 — Sill/Head Trimmer Size
// ─────────────────────────────────────────────────────────────

/**
 * Get sill/head trimmer member size per NZS 3604 Table 8.15.
 *
 * @param {number} openingWidthM — opening width in metres
 * @returns {{ minThickness: number|string, tableRef: string }|null}
 */
export function getSillHeadTrimmerSize(openingWidthM) {
  const trimmerData = tables.sill_head_trimmers;
  if (!trimmerData) return null;

  const result = tableLookup(trimmerData, openingWidthM);
  if (!result) return { minThickness: 'SED', tableRef: 'Table 8.15' };

  return {
    minThickness: result.value,
    tableRef: 'Table 8.15',
  };
}

// ─────────────────────────────────────────────────────────────
// Table 8.2 — Loadbearing Stud Size
// ─────────────────────────────────────────────────────────────

/**
 * Get loadbearing stud size per NZS 3604 Table 8.2.
 *
 * @param {'sot'|'lot'|'sub'} position — sot=single/top storey, lot=lower of two, sub=subfloor beneath two
 * @param {string} windZone — 'L'|'M'|'H'|'VH'|'EH' or 'internal'
 * @param {number} loadedDimM — loaded dimension in metres
 * @param {number} heightM — wall height in metres
 * @param {number} spacingMm — stud spacing in mm (300, 400, or 600)
 * @returns {{ size: string, tableRef: string }|null}
 */
export function getStudSize(position, windZone, loadedDimM, heightM, spacingMm) {
  const studData = tables.studs_loadbearing;
  if (!studData) return null;

  const posData = studData[position];
  if (!posData) return null;

  const zoneData = posData[windZone];
  if (!zoneData) return null;

  // Round UP loaded dimension
  const dimResult = tableLookup(zoneData, loadedDimM);
  if (!dimResult) return null;

  // Round UP height
  const heightResult = tableLookup(dimResult.value, heightM);
  if (!heightResult) return null;

  // Round UP spacing
  const spacingResult = tableLookup(heightResult.value, spacingMm);
  if (!spacingResult) return null;

  return {
    size: spacingResult.value,
    tableRef: 'Table 8.2',
  };
}

// ─────────────────────────────────────────────────────────────
// Table 8.4 — Non-Loadbearing Stud Size
// ─────────────────────────────────────────────────────────────

/**
 * Get non-loadbearing stud size per NZS 3604 Table 8.4.
 *
 * @param {string} windZone — 'EH'|'VH'|'H'|'ML' or 'internal'
 * @param {number} heightM — wall height in metres
 * @param {number} spacingMm — stud spacing in mm (300, 400, or 600)
 * @returns {{ size: string|null, tableRef: string }|null}
 */
export function getNonLoadbearingStudSize(windZone, heightM, spacingMm) {
  const studData = tables.studs_nonloadbearing;
  if (!studData) return null;

  // Map L and M zones to ML (Table 8.4 combines them)
  const mappedZone = (windZone === 'L' || windZone === 'M') ? 'ML' : windZone;

  const zoneData = studData[mappedZone];
  if (!zoneData) return null;

  const heightResult = tableLookup(zoneData, heightM);
  if (!heightResult) return null;

  const spacingResult = tableLookup(heightResult.value, spacingMm);
  if (!spacingResult) return null;

  return {
    size: spacingResult.value, // null means SED required
    tableRef: 'Table 8.4',
  };
}
