/**
 * NZS 3604:2011 — Site Parameters & Classification
 *
 * Determines wind zone and earthquake zone from project location
 * and site conditions per NZS 3604 Section 5.
 *
 * References:
 *   - NZS 3604:2011 Table 5.4  — Wind zones
 *   - NZS 3604:2011 Figure 5.4 — Earthquake zones
 */

import { tables } from './tables.js';

// ─────────────────────────────────────────────────────────────
// Wind Zone (Table 5.4)
// ─────────────────────────────────────────────────────────────

/**
 * Determine wind zone from site parameters per NZS 3604 Table 5.4.
 *
 * @param {'A'|'W'} windRegion — Wind region
 * @param {'urban'|'open'} groundRoughness — Ground roughness category
 * @param {'T1'|'T2'|'T3'|'T4'} topoClass — Topographic classification
 * @param {'sheltered'|'exposed'} exposure — Exposure category
 * @param {boolean} leeZone — Whether site is in a lee zone
 * @returns {'L'|'M'|'H'|'VH'|'EH'|'SED'} Wind zone
 */
export function determineWindZone(windRegion, groundRoughness, topoClass, exposure, leeZone) {
  const regionData = tables.wind_zones[windRegion];
  if (!regionData) return 'SED';

  const roughnessData = regionData[groundRoughness];
  if (!roughnessData) return 'SED';

  const key = `${topoClass}_${exposure}`;
  let zone = roughnessData[key];
  if (!zone) return 'SED';

  // Apply lee zone upgrade if applicable
  if (leeZone && tables.wind_zones.lee_zone_upgrade) {
    const upgraded = tables.wind_zones.lee_zone_upgrade[zone];
    if (upgraded) zone = upgraded;
  }

  return zone;
}

// ─────────────────────────────────────────────────────────────
// Earthquake Zone (Figure 5.4)
// ─────────────────────────────────────────────────────────────

/**
 * Determine earthquake zone from territorial authority per NZS 3604 Figure 5.4.
 *
 * @param {string} territorialAuthority — e.g. "Whangarei District"
 * @returns {number|null} Earthquake zone (1-4), or null if TA not found
 */
export function determineEqZone(territorialAuthority) {
  if (!territorialAuthority) return null;
  const zone = tables.eq_zones[territorialAuthority];
  return typeof zone === 'number' ? zone : null;
}

// ─────────────────────────────────────────────────────────────
// Site Classification (Orchestrator)
// ─────────────────────────────────────────────────────────────

/**
 * Default site parameters (Northland residential).
 */
export const SITE_PARAM_DEFAULTS = {
  windRegion: 'A',
  groundRoughness: 'open',
  topoClass: 'T1',
  exposure: 'sheltered',
  leeZone: false,
  soilType: 'C',
  roofWeight: 'light',
  claddingWeight: 'light',
};

/**
 * Get full site classification from site parameters.
 *
 * @param {Object} siteParams
 * @param {string} siteParams.windRegion
 * @param {string} siteParams.groundRoughness
 * @param {string} siteParams.topoClass
 * @param {string} siteParams.exposure
 * @param {boolean} siteParams.leeZone
 * @param {string} [siteParams.territorialAuthority]
 * @returns {{ windZone: string, eqZone: number|null }}
 */
export function getSiteClassification(siteParams) {
  const p = { ...SITE_PARAM_DEFAULTS, ...siteParams };

  const windZone = determineWindZone(
    p.windRegion,
    p.groundRoughness,
    p.topoClass,
    p.exposure,
    p.leeZone
  );

  const eqZone = determineEqZone(p.territorialAuthority);

  return { windZone, eqZone };
}

// ─────────────────────────────────────────────────────────────
// Option lists for UI
// ─────────────────────────────────────────────────────────────

export const WIND_REGIONS = [
  { value: 'A', label: 'A (most of NZ)' },
  { value: 'W', label: 'W (Wellington / Cook Strait)' },
];

export const GROUND_ROUGHNESS_OPTIONS = [
  { value: 'urban', label: 'Urban (suburban, built-up)' },
  { value: 'open', label: 'Open (rural, coastal, hilltop)' },
];

export const EXPOSURE_OPTIONS = [
  { value: 'sheltered', label: 'Sheltered' },
  { value: 'exposed', label: 'Exposed' },
];

export const TOPO_CLASS_OPTIONS = [
  { value: 'T1', label: 'T1 (flat / gentle)' },
  { value: 'T2', label: 'T2 (low hills)' },
  { value: 'T3', label: 'T3 (moderate hills)' },
  { value: 'T4', label: 'T4 (steep / valley)' },
];

export const SOIL_TYPE_OPTIONS = [
  { value: 'A', label: 'A (strong rock)' },
  { value: 'B', label: 'B (rock)' },
  { value: 'C', label: 'C (shallow soil)' },
  { value: 'D', label: 'D (deep / soft soil)' },
  { value: 'E', label: 'E (very soft soil)' },
];

export const ROOF_WEIGHT_OPTIONS = [
  { value: 'light', label: 'Light (steel / membrane)' },
  { value: 'heavy', label: 'Heavy (concrete tile)' },
];

export const CLADDING_WEIGHT_OPTIONS = [
  { value: 'light', label: 'Light (weatherboard / sheet)' },
  { value: 'medium', label: 'Medium (brick veneer)' },
  { value: 'heavy', label: 'Heavy (stone / concrete)' },
];
