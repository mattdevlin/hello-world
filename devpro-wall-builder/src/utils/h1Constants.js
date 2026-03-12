/**
 * NZ Building Code H1/AS1 6th Edition — Constants and Lookup Tables
 *
 * Climate zones, reference R-values, window R-value tables,
 * minimum R-values, and slab-on-ground Appendix E lookup tables.
 */

// ── Climate Zone Lookup ──
// Territorial authority → climate zone (1–6)
// Source: H1/AS1 6th Edition, Table 1

export const TA_CLIMATE_ZONES = {
  // Zone 1
  'Far North District': 1,
  'Whangarei District': 1,
  'Kaipara District': 1,
  'Auckland Council': 1,
  'Thames-Coromandel District': 1,
  'Western Bay of Plenty District': 1,
  'Tauranga City': 1,
  'Whakatane District': 1,
  'Kawerau District': 1,
  'Opotiki District': 1,

  // Zone 2
  'Hauraki District': 2,
  'Waikato District': 2,
  'Matamata-Piako District': 2,
  'Hamilton City': 2,
  'Waipa District': 2,
  'Otorohanga District': 2,
  'South Waikato District': 2,
  'Waitomo District': 2,
  'Gisborne District': 2,
  'Wairoa District': 2,
  'Hastings District': 2,
  'Napier City': 2,
  'Central Hawke\'s Bay District': 2,
  'New Plymouth District': 2,
  'Stratford District': 2,
  'South Taranaki District': 2,
  'Whanganui District': 2,

  // Zone 3
  'Rangitikei District (south)': 3,
  'Manawatu District': 3,
  'Palmerston North City': 3,
  'Horowhenua District': 3,
  'Kapiti Coast District': 3,
  'Porirua City': 3,
  'Lower Hutt City': 3,
  'Wellington City': 3,
  'Tasman District': 3,
  'Nelson City': 3,
  'Marlborough District': 3,
  'Kaikoura District': 3,
  'Chatham Islands Territory': 3,

  // Zone 4
  'Taupo District': 4,
  'Rotorua District': 4,
  'Ruapehu District': 4,
  'Rangitikei District (north)': 4,
  'Tararua District': 4,
  'Upper Hutt City': 4,
  'Masterton District': 4,
  'Carterton District': 4,
  'South Wairarapa District': 4,
  'Buller District': 4,
  'Grey District': 4,
  'Westland District': 4,

  // Zone 5
  'Hurunui District': 5,
  'Waimakariri District': 5,
  'Christchurch City': 5,
  'Selwyn District': 5,
  'Ashburton District': 5,
  'Timaru District': 5,
  'Waimate District': 5,
  'Waitaki District (east)': 5,
  'Dunedin City': 5,
  'Clutha District': 5,

  // Zone 6
  'Mackenzie District': 6,
  'Waitaki District (west)': 6,
  'Central Otago District': 6,
  'Queenstown-Lakes District': 6,
  'Southland District': 6,
  'Gore District': 6,
  'Invercargill City': 6,
};

/** Sorted list of all territorial authorities for dropdown */
export const TERRITORIAL_AUTHORITIES = Object.keys(TA_CLIMATE_ZONES).sort();

/**
 * Get climate zone for a territorial authority.
 * Returns zone number (1-6) or null if not found.
 */
export function getClimateZone(territorialAuthority) {
  return TA_CLIMATE_ZONES[territorialAuthority] ?? null;
}


// ── Reference R-values by Climate Zone ──
// Source: H1/AS1 6th Edition, Table 2
// Used for the reference building heat loss calculation (Step 3)

export const REFERENCE_R_VALUES = {
  1: { roof: 6.6, wall: 1.6, slab: 1.5, otherFloor: 2.5, glazing: 0.46 },
  2: { roof: 6.6, wall: 1.6, slab: 1.5, otherFloor: 2.5, glazing: 0.46 },
  3: { roof: 6.6, wall: 1.6, slab: 1.5, otherFloor: 2.5, glazing: 0.46 },
  4: { roof: 6.6, wall: 1.6, slab: 1.5, otherFloor: 2.8, glazing: 0.46 },
  5: { roof: 6.6, wall: 1.6, slab: 1.6, otherFloor: 3.0, glazing: 0.50 },
  6: { roof: 6.6, wall: 1.6, slab: 1.7, otherFloor: 3.0, glazing: 0.50 },
};


// ── Minimum Construction R-values (Hard Floors) ──
// Source: H1/AS1 6th Edition
// These must be met regardless of overall heat loss comparison

export const MINIMUM_R_VALUES = {
  roof: 2.6,
  wall: 1.0,
  floorOther: 1.3,
  // Slab-on-ground: no minimum (6th edition removed it)
};

// Heated element minimums (only for rooms with heated ceilings/walls/floors,
// excluding rooms containing only shower/bath/toilet)
export const HEATED_MINIMUM_R_VALUES = {
  ceiling: { 1: 6.6, 2: 6.6, 3: 6.6, 4: 6.6, 5: 6.6, 6: 6.6 },
  wall:    { 1: 2.9, 2: 2.9, 3: 2.9, 4: 2.9, 5: 2.9, 6: 2.9 },
  floor:   { 1: 2.5, 2: 2.5, 3: 2.5, 4: 2.8, 5: 3.0, 6: 3.0 },
};


// ── Default R-values for Unknown Constructions ──

export const DEFAULT_R_UNKNOWN_OPAQUE = 0.18;
export const DEFAULT_R_UNKNOWN_WINDOW = 0.15;


// ── Glazing Ratio Constants ──

export const REFERENCE_GLAZING_RATIO = 0.30;
export const MAX_GLAZING_RATIO = 0.40;


// ── Window R-value Lookup Table ──
// Source: H1/AS1 6th Edition, Appendix D
// Keyed by Ug value, then by frame type
// If actual Ug falls between rows, use the next higher Ug row (conservative)

export const WINDOW_R_TABLE = [
  // { ug, aluminium, aluminiumThermal, upvcTimber }
  // Double glazed
  { ug: 2.9, glazingType: 'double', aluminium: 0.24, aluminiumThermal: 0.30, upvcTimber: 0.37 },
  { ug: 1.9, glazingType: 'double', aluminium: 0.30, aluminiumThermal: 0.39, upvcTimber: 0.50 },
  { ug: 1.3, glazingType: 'double', aluminium: 0.35, aluminiumThermal: 0.46, upvcTimber: 0.63 },
  { ug: 1.0, glazingType: 'double', aluminium: 0.39, aluminiumThermal: 0.52, upvcTimber: 0.73 },
  // Triple glazed
  { ug: 1.0, glazingType: 'triple', aluminium: null, aluminiumThermal: 0.52, upvcTimber: 0.73 },
  { ug: 0.7, glazingType: 'triple', aluminium: null, aluminiumThermal: 0.59, upvcTimber: 0.86 },
];

export const GLAZING_TYPES = [
  { value: 'double', label: 'Double glazed' },
  { value: 'triple', label: 'Triple glazed' },
];

export const FRAME_TYPES = [
  { value: 'aluminium', label: 'Aluminium (no break)' },
  { value: 'aluminiumThermal', label: 'Aluminium (thermal break)' },
  { value: 'upvcTimber', label: 'uPVC / Timber' },
];

/**
 * Look up window R-value from the Appendix D table.
 * Uses conservative approach: if Ug falls between rows, uses the next higher Ug (lower R).
 *
 * @param {string} glazingType - 'double' or 'triple'
 * @param {number} ug - glazing unit Ug value (W/m2K)
 * @param {string} frameType - 'aluminium', 'aluminiumThermal', or 'upvcTimber'
 * @returns {number|null} R-value or null if not found
 */
export function lookupWindowR(glazingType, ug, frameType) {
  // Filter to matching glazing type, sort by Ug descending (highest first)
  const rows = WINDOW_R_TABLE
    .filter(r => r.glazingType === glazingType)
    .sort((a, b) => b.ug - a.ug);

  if (rows.length === 0) return null;

  // Find the row with the smallest Ug that is >= the input Ug (conservative)
  // If input Ug is higher than all rows, use the highest Ug row
  let matchRow = rows[0]; // default to highest Ug (most conservative)
  for (const row of rows) {
    if (row.ug >= ug) {
      matchRow = row;
    }
  }

  const rValue = matchRow[frameType];
  return rValue ?? null;
}


// ── Slab-on-Ground Appendix E Lookup Tables ──
// Source: H1/AS1 6th Edition, Appendix E
//
// Structure: keyed by insulation configuration string
// Each table has:
//   areaPerimeterBands: number[] - area/perimeter ratio values (ascending)
//   wallThicknessBands: number[] - effective wall thickness in mm (ascending)
//   values: number[][] - R-values [row=A/P ratio][col=wall thickness]
//
// For initial implementation, including key tables for common NZ builds:
// - Concrete raft, no masonry veneer, uninsulated
// - Concrete raft, no masonry veneer, underslab full cover

// Insulation position options for the UI dropdown
export const SLAB_INSULATION_POSITIONS = [
  { value: 'uninsulated', label: 'Uninsulated' },
  { value: 'vertical_edge_R1.0', label: 'Vertical edge R1.0' },
  { value: 'underslab_strip_R1.2', label: 'Underslab strip R1.2' },
  { value: 'underslab_strip_R2.4', label: 'Underslab strip R2.4' },
  { value: 'underslab_full_R1.2', label: 'Underslab full cover R1.2' },
  { value: 'underslab_full_R2.4', label: 'Underslab full cover R2.4' },
  { value: 'vertical_edge_R1.0_underslab_R1.2', label: 'Vertical edge R1.0 + Underslab R1.2' },
  { value: 'vertical_edge_R1.0_underslab_R2.4', label: 'Vertical edge R1.0 + Underslab R2.4' },
];

export const SLAB_FLOOR_TYPES = [
  { value: 'raft_no_masonry', label: 'Concrete raft, no masonry veneer' },
  { value: 'raft_masonry', label: 'Concrete raft, masonry veneer' },
  { value: 'slab_no_masonry', label: 'Slab floor, no masonry veneer' },
  { value: 'slab_masonry', label: 'Slab floor, masonry veneer' },
];

// Table E.1.2.1B - Concrete raft foundation, no masonry veneer cladding, uninsulated
// Rows: area/perimeter ratio, Columns: effective wall thickness (mm)
const TABLE_RAFT_NO_MASONRY_UNINSULATED = {
  areaPerimeterBands: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 7.0, 8.0, 10.0, 15.0, 20.0],
  wallThicknessBands: [90, 140, 190, 240, 290],
  values: [
    [0.52, 0.57, 0.62, 0.66, 0.70],
    [0.58, 0.64, 0.69, 0.74, 0.78],
    [0.65, 0.71, 0.76, 0.81, 0.86],
    [0.71, 0.77, 0.83, 0.88, 0.93],
    [0.77, 0.83, 0.89, 0.95, 1.00],
    [0.82, 0.89, 0.96, 1.01, 1.07],
    [0.93, 1.00, 1.07, 1.13, 1.19],
    [1.03, 1.11, 1.18, 1.25, 1.31],
    [1.13, 1.21, 1.29, 1.36, 1.42],
    [1.22, 1.31, 1.39, 1.46, 1.53],
    [1.31, 1.40, 1.49, 1.56, 1.63],
    [1.52, 1.62, 1.71, 1.79, 1.87],
    [1.71, 1.82, 1.92, 2.01, 2.09],
    [1.89, 2.01, 2.12, 2.21, 2.30],
    [2.06, 2.19, 2.30, 2.40, 2.49],
    [2.38, 2.52, 2.65, 2.76, 2.86],
    [2.67, 2.83, 2.97, 3.09, 3.20],
    [2.94, 3.11, 3.27, 3.40, 3.52],
    [3.19, 3.38, 3.55, 3.69, 3.82],
    [3.66, 3.88, 4.07, 4.23, 4.38],
    [4.72, 5.01, 5.26, 5.47, 5.66],
    [5.66, 6.01, 6.31, 6.56, 6.79],
  ],
};

// Table E.1.2.2B - Concrete raft foundation, no masonry veneer, underslab full cover R1.2
const TABLE_RAFT_NO_MASONRY_UNDERSLAB_FULL_R1_2 = {
  areaPerimeterBands: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 7.0, 8.0, 10.0, 15.0, 20.0],
  wallThicknessBands: [90, 140, 190, 240, 290],
  values: [
    [1.28, 1.32, 1.35, 1.38, 1.41],
    [1.38, 1.42, 1.46, 1.49, 1.52],
    [1.47, 1.52, 1.56, 1.59, 1.63],
    [1.56, 1.61, 1.66, 1.70, 1.73],
    [1.65, 1.70, 1.75, 1.79, 1.83],
    [1.73, 1.79, 1.84, 1.89, 1.93],
    [1.89, 1.96, 2.02, 2.07, 2.11],
    [2.05, 2.12, 2.18, 2.24, 2.29],
    [2.19, 2.27, 2.34, 2.40, 2.45],
    [2.33, 2.41, 2.49, 2.55, 2.61],
    [2.46, 2.55, 2.63, 2.70, 2.76],
    [2.77, 2.87, 2.96, 3.04, 3.11],
    [3.05, 3.17, 3.27, 3.36, 3.43],
    [3.31, 3.44, 3.55, 3.64, 3.72],
    [3.55, 3.69, 3.81, 3.91, 4.00],
    [3.99, 4.15, 4.29, 4.41, 4.51],
    [4.39, 4.57, 4.72, 4.85, 4.96],
    [4.75, 4.95, 5.12, 5.26, 5.38],
    [5.09, 5.30, 5.49, 5.64, 5.77],
    [5.70, 5.94, 6.15, 6.32, 6.47],
    [7.10, 7.41, 7.67, 7.89, 8.07],
    [8.30, 8.67, 8.98, 9.24, 9.45],
  ],
};

// Table E.1.2.3B - Concrete raft foundation, no masonry veneer, underslab full cover R2.4
const TABLE_RAFT_NO_MASONRY_UNDERSLAB_FULL_R2_4 = {
  areaPerimeterBands: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 7.0, 8.0, 10.0, 15.0, 20.0],
  wallThicknessBands: [90, 140, 190, 240, 290],
  values: [
    [1.93, 1.96, 1.99, 2.01, 2.03],
    [2.06, 2.09, 2.12, 2.15, 2.17],
    [2.18, 2.22, 2.25, 2.28, 2.31],
    [2.30, 2.34, 2.38, 2.41, 2.44],
    [2.41, 2.46, 2.50, 2.54, 2.57],
    [2.53, 2.57, 2.62, 2.66, 2.70],
    [2.74, 2.79, 2.85, 2.89, 2.93],
    [2.94, 3.00, 3.06, 3.11, 3.16],
    [3.13, 3.20, 3.27, 3.33, 3.38],
    [3.32, 3.39, 3.47, 3.53, 3.58],
    [3.49, 3.57, 3.66, 3.72, 3.78],
    [3.91, 4.01, 4.11, 4.19, 4.26],
    [4.30, 4.41, 4.52, 4.61, 4.69],
    [4.65, 4.78, 4.90, 5.00, 5.09],
    [4.98, 5.12, 5.25, 5.36, 5.46],
    [5.58, 5.74, 5.89, 6.01, 6.12],
    [6.12, 6.30, 6.47, 6.61, 6.73],
    [6.61, 6.82, 7.00, 7.16, 7.29],
    [7.07, 7.29, 7.49, 7.66, 7.80],
    [7.91, 8.17, 8.40, 8.59, 8.75],
    [9.86, 10.19, 10.48, 10.72, 10.92],
    [11.53, 11.92, 12.26, 12.54, 12.78],
  ],
};

// Table E.1.2.4B - Concrete raft, no masonry veneer, vertical edge insulation R1.0
const TABLE_RAFT_NO_MASONRY_VERTICAL_EDGE_R1_0 = {
  areaPerimeterBands: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0, 7.0, 8.0, 10.0, 15.0, 20.0],
  wallThicknessBands: [90, 140, 190, 240, 290],
  values: [
    [0.76, 0.82, 0.88, 0.93, 0.98],
    [0.83, 0.90, 0.96, 1.02, 1.07],
    [0.90, 0.97, 1.04, 1.10, 1.15],
    [0.97, 1.04, 1.11, 1.17, 1.23],
    [1.03, 1.11, 1.18, 1.25, 1.31],
    [1.09, 1.17, 1.25, 1.32, 1.38],
    [1.20, 1.29, 1.37, 1.45, 1.52],
    [1.31, 1.40, 1.49, 1.57, 1.64],
    [1.41, 1.51, 1.60, 1.69, 1.76],
    [1.50, 1.61, 1.71, 1.80, 1.88],
    [1.59, 1.70, 1.81, 1.90, 1.98],
    [1.80, 1.93, 2.04, 2.14, 2.23],
    [2.00, 2.13, 2.26, 2.37, 2.46],
    [2.17, 2.32, 2.46, 2.57, 2.67],
    [2.34, 2.50, 2.64, 2.76, 2.87],
    [2.65, 2.82, 2.98, 3.12, 3.24],
    [2.93, 3.12, 3.29, 3.44, 3.57],
    [3.18, 3.39, 3.58, 3.73, 3.88],
    [3.42, 3.64, 3.84, 4.01, 4.16],
    [3.85, 4.11, 4.33, 4.52, 4.69],
    [4.86, 5.19, 5.48, 5.72, 5.93],
    [5.75, 6.14, 6.48, 6.77, 7.02],
  ],
};

/** Maps UI selection to the appropriate lookup table */
export const SLAB_TABLES = {
  'raft_no_masonry__uninsulated': TABLE_RAFT_NO_MASONRY_UNINSULATED,
  'raft_no_masonry__underslab_full_R1.2': TABLE_RAFT_NO_MASONRY_UNDERSLAB_FULL_R1_2,
  'raft_no_masonry__underslab_full_R2.4': TABLE_RAFT_NO_MASONRY_UNDERSLAB_FULL_R2_4,
  'raft_no_masonry__vertical_edge_R1.0': TABLE_RAFT_NO_MASONRY_VERTICAL_EDGE_R1_0,
  // Additional tables can be added incrementally
};

/**
 * Look up slab-on-ground R-value from Appendix E tables.
 * Uses bilinear interpolation between nearest table entries.
 *
 * @param {string} floorType - e.g. 'raft_no_masonry'
 * @param {string} insulationPosition - e.g. 'uninsulated', 'underslab_full_R1.2'
 * @param {number} areaPerimeterRatio - slab area / perimeter (m)
 * @param {number} wallThickness - effective external wall thickness (mm)
 * @returns {number|null} R-value or null if table not available
 */
export function lookupSlabR(floorType, insulationPosition, areaPerimeterRatio, wallThickness) {
  const tableKey = `${floorType}__${insulationPosition}`;
  const table = SLAB_TABLES[tableKey];
  if (!table) return null;

  const { areaPerimeterBands, wallThicknessBands, values } = table;

  // Clamp to table bounds
  const apClamped = Math.max(areaPerimeterBands[0], Math.min(areaPerimeterRatio, areaPerimeterBands[areaPerimeterBands.length - 1]));
  const wtClamped = Math.max(wallThicknessBands[0], Math.min(wallThickness, wallThicknessBands[wallThicknessBands.length - 1]));

  // Find surrounding indices for area/perimeter ratio
  const rowIdx = findSurroundingIndex(areaPerimeterBands, apClamped);
  const colIdx = findSurroundingIndex(wallThicknessBands, wtClamped);

  // Bilinear interpolation
  return bilinearInterpolate(
    areaPerimeterBands, wallThicknessBands, values,
    rowIdx, colIdx, apClamped, wtClamped
  );
}

/**
 * Find the index of the lower bound for interpolation.
 * Returns { lo, hi, t } where t is the interpolation fraction.
 */
function findSurroundingIndex(bands, value) {
  if (value <= bands[0]) return { lo: 0, hi: 0, t: 0 };
  if (value >= bands[bands.length - 1]) {
    const last = bands.length - 1;
    return { lo: last, hi: last, t: 0 };
  }
  for (let i = 0; i < bands.length - 1; i++) {
    if (value >= bands[i] && value <= bands[i + 1]) {
      const t = (value - bands[i]) / (bands[i + 1] - bands[i]);
      return { lo: i, hi: i + 1, t };
    }
  }
  return { lo: 0, hi: 0, t: 0 };
}

/**
 * Bilinear interpolation on a 2D grid.
 */
function bilinearInterpolate(_rowBands, _colBands, values, rowIdx, colIdx) {
  const { lo: r0, hi: r1, t: rt } = rowIdx;
  const { lo: c0, hi: c1, t: ct } = colIdx;

  const v00 = values[r0][c0];
  const v01 = values[r0][c1];
  const v10 = values[r1][c0];
  const v11 = values[r1][c1];

  // Interpolate along columns for each row, then between rows
  const top = v00 + (v01 - v00) * ct;
  const bottom = v10 + (v11 - v10) * ct;
  return top + (bottom - top) * rt;
}
