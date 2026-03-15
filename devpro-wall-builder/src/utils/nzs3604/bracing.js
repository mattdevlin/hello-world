/**
 * NZS 3604:2011 — Bracing Design
 *
 * Calculates minimum bracing units (BU) for wind and earthquake resistance.
 * The governing demand (higher of wind vs EQ) dictates braced wall panel requirements.
 *
 * References:
 *   - NZS 3604:2011 Tables 5.5–5.7   — Wind bracing demand
 *   - NZS 3604:2011 Tables 5.8–5.10  — Earthquake bracing demand
 *   - NZS 3604:2011 Table 5.11       — Subfloor bracing capacity
 */

import { tables, tableLookup } from './tables.js';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Map single-letter soil types to the grouped keys used in the JSON. */
function soilClassGroup(soilClass) {
  switch (soilClass) {
    case 'A': case 'B': return 'AB';
    case 'C': return 'C';
    case 'D': case 'E': return 'DE';
    default: return null;
  }
}

/** Map table param to JSON key and table ref for wind tables. */
const WIND_TABLE_MAP = {
  subfloor:      { key: 'wind_bracing_demand_subfloor',      ref: '5.5' },
  single_upper:  { key: 'wind_bracing_demand_single_upper',  ref: '5.6' },
  lower_two:     { key: 'wind_bracing_demand_lower_two',     ref: '5.7' },
};

/** Map table param to JSON key and table ref for EQ tables. */
const EQ_TABLE_MAP = {
  single_subfloor:      { key: 'eq_bracing_single_subfloor',      ref: '5.8' },
  two_storey_subfloor:  { key: 'eq_bracing_two_storey_subfloor',  ref: '5.9' },
  slab:                 { key: 'eq_bracing_slab',                  ref: '5.10' },
};

// ─────────────────────────────────────────────────────────────
// Tables 5.5–5.7 — Wind Bracing Demand
// ─────────────────────────────────────────────────────────────

/**
 * Get wind bracing demand per NZS 3604 Tables 5.5–5.7.
 *
 * Raw JSON values are for High wind zone. Other zones use wind_zone_multipliers.
 *
 * @param {string} windZone — 'L'|'M'|'H'|'VH'|'EH'
 * @param {string} table — 'subfloor'|'single_upper'|'lower_two'
 * @param {number} heightToApexM — height to apex in metres
 * @param {number} roofAboveEavesM — roof height above eaves in metres
 * @returns {{ acrossBuPerM: number, alongBuPerM: number, tableRef: string }|null}
 */
export function getWindBracingDemand(windZone, table, heightToApexM, roofAboveEavesM) {
  const mapping = WIND_TABLE_MAP[table];
  if (!mapping) return null;

  const tableData = tables[mapping.key];
  if (!tableData) return null;

  const multiplier = tables.wind_zone_multipliers?.[windZone];
  if (multiplier === undefined) return null;

  // First lookup: apex height → row of roof-above-eaves entries
  const apexResult = tableLookup(tableData, heightToApexM);
  if (!apexResult) return null;

  // Second lookup: roof above eaves → {across, along}
  const eavesResult = tableLookup(apexResult.value, roofAboveEavesM);
  if (!eavesResult) return null;

  return {
    acrossBuPerM: eavesResult.value.across * multiplier,
    alongBuPerM: eavesResult.value.along * multiplier,
    tableRef: `Table ${mapping.ref}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Tables 5.8–5.10 — Earthquake Bracing Demand
// ─────────────────────────────────────────────────────────────

/**
 * Get earthquake bracing demand per NZS 3604 Tables 5.8–5.10.
 *
 * Base JSON values are for zone 3, soil D/E. Other combos use eq_multiplication_factors.
 *
 * @param {string} eqZone — '1'|'2'|'3'|'4' (as string)
 * @param {string} soilClass — 'A'|'B'|'C'|'D'|'E'
 * @param {string} table — 'single_subfloor'|'two_storey_subfloor'|'slab'
 * @param {string} weightKey — composite key e.g. 'light_light_light_medium'
 * @param {string} pitchRange — '0-25'|'25-45'|'45-60'
 * @returns {{ buPerM2: Object, tableRef: string }|null}
 */
export function getEqBracingDemand(eqZone, soilClass, table, weightKey, pitchRange) {
  const mapping = EQ_TABLE_MAP[table];
  if (!mapping) return null;

  const tableData = tables[mapping.key];
  if (!tableData) return null;

  const soilGroup = soilClassGroup(soilClass);
  if (!soilGroup) return null;

  const zone = String(eqZone);
  const factor = tables.eq_multiplication_factors?.[zone]?.[soilGroup];
  if (factor === undefined) return null;

  // Direct key access (not tableLookup — keys are composite strings)
  const weightEntry = tableData[weightKey];
  if (!weightEntry) return null;

  const pitchEntry = weightEntry[pitchRange];
  if (!pitchEntry) return null;

  // Apply multiplication factor to all level values
  const levels = {};
  for (const [level, baseValue] of Object.entries(pitchEntry)) {
    if (baseValue === null) {
      levels[level] = null;
    } else {
      levels[level] = baseValue * factor;
    }
  }

  return {
    buPerM2: levels,
    tableRef: `Table ${mapping.ref}`,
  };
}

// ─────────────────────────────────────────────────────────────
// Table 5.11 — Subfloor Bracing Capacity
// ─────────────────────────────────────────────────────────────

/**
 * Get subfloor bracing element capacity per NZS 3604 Table 5.11.
 *
 * @param {string} elementType — 'masonry_wall'|'braced_pile_system'|'cantilever_pile'|'anchor_pile'
 * @param {number} [wallLengthM] — wall length in metres (only for masonry_wall)
 * @returns {{ earthquakeBU: number, windBU: number, tableRef: string }|null}
 */
export function getSubfloorBracingCapacity(elementType, wallLengthM) {
  const capacityData = tables.subfloor_bracing_capacity;
  if (!capacityData) return null;

  const elementData = capacityData[elementType];
  if (!elementData) return null;

  if (elementType === 'masonry_wall') {
    if (wallLengthM === undefined || wallLengthM === null) return null;

    // Determine which bucket the wall length falls into
    let bu;
    if (wallLengthM < 0.75) {
      bu = elementData['lt_0.75'];
    } else if (wallLengthM < 1.5) {
      bu = elementData['0.75_to_1.5'];
    } else if (wallLengthM < 3.0) {
      bu = elementData['1.5_to_3.0'];
    } else if (wallLengthM < 4.5) {
      bu = elementData['3.0_to_4.5'];
    } else {
      bu = elementData['gt_4.5'];
    }

    // Masonry walls: same capacity for both earthquake and wind
    return {
      earthquakeBU: bu,
      windBU: bu,
      tableRef: 'Table 5.11',
    };
  }

  // Non-masonry elements have separate earthquake and wind values
  return {
    earthquakeBU: elementData.earthquake,
    windBU: elementData.wind,
    tableRef: 'Table 5.11',
  };
}

// ─────────────────────────────────────────────────────────────
// Orchestrator — Calculate Bracing Demand
// ─────────────────────────────────────────────────────────────

/**
 * Calculate governing bracing demand for a building.
 *
 * Computes both wind and earthquake demand, returns the governing (higher)
 * value per direction per storey.
 *
 * @param {Object} siteParams — { windZone, eqZone, soilClass }
 * @param {Object} buildingGeometry — {
 *   storeys: 1|2,
 *   heightToApexM, roofAboveEavesM, pitchDeg,
 *   planLengthM, planWidthM,
 *   foundationType: 'slab'|'subfloor',
 *   roofWeight, wallWeight, subfloorWeight (for weight key construction)
 * }
 * @returns {{ wind: Object, eq: Object, governing: Object, tableRefs: string[] }|null}
 */
export function calculateBracingDemand(siteParams, buildingGeometry) {
  const { windZone, eqZone, soilClass } = siteParams;
  const {
    storeys = 1,
    heightToApexM,
    roofAboveEavesM,
    planLengthM,
    planWidthM,
    foundationType = 'slab',
  } = buildingGeometry;

  if (!windZone || !eqZone || !planLengthM || !planWidthM) return null;

  const tableRefs = [];

  // ── Wind demand ──
  // Select wind table based on storey configuration
  let windTable;
  if (storeys === 1) {
    windTable = 'single_upper';
  } else {
    windTable = 'lower_two';
  }

  const windResult = getWindBracingDemand(windZone, windTable, heightToApexM, roofAboveEavesM);
  if (!windResult) return null;

  tableRefs.push(windResult.tableRef);

  // Wind demand: BU/m × plan dimension in that direction
  const windDemand = {
    across: windResult.acrossBuPerM * planWidthM,
    along: windResult.alongBuPerM * planLengthM,
  };

  // ── EQ demand ──
  const pitchRange = buildingGeometry.pitchDeg <= 25 ? '0-25'
    : buildingGeometry.pitchDeg <= 45 ? '25-45'
    : '45-60';

  // Select EQ table based on foundation and storey
  let eqTable;
  if (foundationType === 'slab') {
    eqTable = 'slab';
  } else if (storeys === 1) {
    eqTable = 'single_subfloor';
  } else {
    eqTable = 'two_storey_subfloor';
  }

  // Construct weight key from building geometry
  const weightKey = buildingGeometry.weightKey;
  if (!weightKey) return null;

  const eqResult = getEqBracingDemand(eqZone, soilClass, eqTable, weightKey, pitchRange);
  if (!eqResult) return null;

  tableRefs.push(eqResult.tableRef);

  // EQ demand: BU/m² × floor area (same in both directions)
  const floorArea = planLengthM * planWidthM;
  const eqDemand = {};
  for (const [level, buPerM2] of Object.entries(eqResult.buPerM2)) {
    eqDemand[level] = buPerM2 !== null ? buPerM2 * floorArea : null;
  }

  // ── Governing demand ──
  // For single-storey slab: compare wind across/along vs EQ single × area
  const eqSingleKey = eqResult.buPerM2.single !== undefined ? 'single' : 'walls';
  const eqTotal = eqDemand[eqSingleKey];

  const governing = {
    across: Math.max(windDemand.across, eqTotal || 0),
    along: Math.max(windDemand.along, eqTotal || 0),
    governedBy: {
      across: windDemand.across >= (eqTotal || 0) ? 'wind' : 'earthquake',
      along: windDemand.along >= (eqTotal || 0) ? 'wind' : 'earthquake',
    },
  };

  return {
    wind: windDemand,
    eq: eqDemand,
    governing,
    tableRefs,
  };
}
