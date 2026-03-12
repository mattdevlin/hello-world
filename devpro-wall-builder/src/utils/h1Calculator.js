/**
 * NZ Building Code H1/AS1 6th Edition — Compliance Calculator
 *
 * Pure calculation engine. No DOM or React dependencies.
 * Compares proposed building heat loss against a reference building
 * and enforces minimum R-value requirements.
 */

import {
  REFERENCE_R_VALUES,
  MINIMUM_R_VALUES,
  HEATED_MINIMUM_R_VALUES,
  REFERENCE_GLAZING_RATIO,
  MAX_GLAZING_RATIO,
  DEFAULT_R_UNKNOWN_OPAQUE,
  DEFAULT_R_UNKNOWN_WINDOW,
} from './h1Constants.js';


/**
 * Compute area-weighted average R-value for a list of constructions.
 * @param {{ area: number, rValue: number }[]} constructions
 * @returns {number} weighted R-value, or 0 if total area is 0
 */
export function computeWeightedR(constructions) {
  const totalArea = constructions.reduce((sum, c) => sum + c.area, 0);
  if (totalArea === 0) return 0;
  // Weighted by heat flow: 1/R_weighted = sum(area_i / R_i) / totalArea
  const totalHeatLoss = constructions.reduce((sum, c) => sum + c.area / c.rValue, 0);
  return totalArea / totalHeatLoss;
}


/**
 * Sum heat loss (W/K) for a list of constructions: sum(area / rValue)
 * @param {{ area: number, rValue: number }[]} constructions
 * @returns {number}
 */
function sumHeatLoss(constructions) {
  return constructions.reduce((sum, c) => {
    if (c.area <= 0 || c.rValue <= 0) return sum;
    return sum + c.area / c.rValue;
  }, 0);
}


/**
 * Compute the reference building heat loss (HL_reference).
 * The reference building assumes 30% glazing ratio.
 *
 * @param {number} zone - climate zone (1-6)
 * @param {object} areas - building envelope areas
 * @returns {{ total: number, breakdown: object }}
 */
function computeReferenceHL(zone, areas) {
  const ref = REFERENCE_R_VALUES[zone];
  if (!ref) throw new Error(`Invalid climate zone: ${zone}`);

  const roofArea = (areas.roof || 0) + (areas.skylight || 0);
  const grossWall = areas.grossWall || 0;
  const wallArea = grossWall * (1 - REFERENCE_GLAZING_RATIO);
  const glazingArea = grossWall * REFERENCE_GLAZING_RATIO;
  const slabArea = areas.floorSlab || 0;
  const otherFloorArea = areas.floorOther || 0;

  const roofHL = roofArea / ref.roof;
  const wallHL = wallArea / ref.wall;
  const slabHL = slabArea / ref.slab;
  const otherFloorHL = otherFloorArea / ref.otherFloor;
  const glazingHL = glazingArea / ref.glazing;

  return {
    total: roofHL + wallHL + slabHL + otherFloorHL + glazingHL,
    breakdown: {
      roof:       { area: roofArea, rValue: ref.roof, heatLoss: roofHL },
      wall:       { area: wallArea, rValue: ref.wall, heatLoss: wallHL },
      glazing:    { area: glazingArea, rValue: ref.glazing, heatLoss: glazingHL },
      floorSlab:  { area: slabArea, rValue: ref.slab, heatLoss: slabHL },
      floorOther: { area: otherFloorArea, rValue: ref.otherFloor, heatLoss: otherFloorHL },
    },
  };
}


/**
 * Check minimum R-value requirements for each building element.
 * Returns per-element check results.
 *
 * @param {object} constructions
 * @param {number} zone - climate zone (1-6)
 * @param {object} heatedElements - { ceiling, wall, floor, bathroomOnly }
 * @returns {{ met: boolean, checks: object }}
 */
function checkMinimums(constructions, zone, heatedElements = {}) {
  const checks = {};
  let allMet = true;

  // Standard minimums
  const elementMap = {
    roof: constructions.roof || [],
    wall: constructions.wall || [],
    floorOther: constructions.floorOther || [],
  };

  for (const [element, entries] of Object.entries(elementMap)) {
    const minRequired = MINIMUM_R_VALUES[element];
    if (minRequired === undefined) continue;

    const failures = [];
    for (const c of entries) {
      if (c.area > 0 && c.rValue < minRequired) {
        failures.push({ area: c.area, rValue: c.rValue });
      }
    }

    const met = failures.length === 0;
    if (!met) allMet = false;

    checks[element] = {
      met,
      required: minRequired,
      actual: entries.length > 0 ? Math.min(...entries.filter(c => c.area > 0).map(c => c.rValue)) : null,
      failures,
    };
  }

  // Heated element minimums (if applicable and not bathroom-only)
  if (heatedElements && !heatedElements.bathroomOnly) {
    if (heatedElements.ceiling) {
      const minR = HEATED_MINIMUM_R_VALUES.ceiling[zone];
      const roofEntries = constructions.roof || [];
      const minActual = roofEntries.length > 0 ? Math.min(...roofEntries.filter(c => c.area > 0).map(c => c.rValue)) : null;
      const met = minActual === null || minActual >= minR;
      if (!met) allMet = false;
      checks.heatedCeiling = { met, required: minR, actual: minActual };
    }
    if (heatedElements.wall) {
      const minR = HEATED_MINIMUM_R_VALUES.wall[zone];
      const wallEntries = constructions.wall || [];
      const minActual = wallEntries.length > 0 ? Math.min(...wallEntries.filter(c => c.area > 0).map(c => c.rValue)) : null;
      const met = minActual === null || minActual >= minR;
      if (!met) allMet = false;
      checks.heatedWall = { met, required: minR, actual: minActual };
    }
    if (heatedElements.floor) {
      const minR = HEATED_MINIMUM_R_VALUES.floor[zone];
      const floorEntries = [...(constructions.floorSlab || []), ...(constructions.floorOther || [])];
      const minActual = floorEntries.length > 0 ? Math.min(...floorEntries.filter(c => c.area > 0).map(c => c.rValue)) : null;
      const met = minActual === null || minActual >= minR;
      if (!met) allMet = false;
      checks.heatedFloor = { met, required: minR, actual: minActual };
    }
  }

  return { met: allMet, checks };
}


/**
 * Main compliance check function.
 *
 * @param {object} input
 * @param {number} input.climateZone - 1 to 6
 * @param {number} input.grossWallArea - gross wall area m² (net wall + glazing + opaque doors)
 * @param {object} input.constructions - keyed by element type, each an array of { area, rValue }
 *   roof, wall, glazing, doorOpaque, skylight, floorSlab, floorOther
 * @param {object} [input.heatedElements] - { ceiling, wall, floor, bathroomOnly }
 * @returns {object} compliance result
 */
export function checkH1Compliance(input) {
  const { climateZone, grossWallArea, constructions, heatedElements } = input;

  // Validate climate zone
  if (!climateZone || climateZone < 1 || climateZone > 6) {
    return { error: 'Invalid climate zone. Must be 1-6.' };
  }

  // Sum areas per element
  const sumArea = (entries) => (entries || []).reduce((s, c) => s + (c.area || 0), 0);

  const areas = {
    roof: sumArea(constructions.roof),
    skylight: sumArea(constructions.skylight),
    grossWall: grossWallArea || 0,
    glazing: sumArea(constructions.glazing),
    doorOpaque: sumArea(constructions.doorOpaque),
    floorSlab: sumArea(constructions.floorSlab),
    floorOther: sumArea(constructions.floorOther),
  };

  // Net wall area = gross wall - glazing - opaque doors
  areas.wallNet = areas.grossWall - areas.glazing - areas.doorOpaque;

  // ── Glazing ratio gate ──
  const glazingRatio = areas.grossWall > 0 ? areas.glazing / areas.grossWall : 0;
  const glazingRatioOk = glazingRatio <= MAX_GLAZING_RATIO;

  // ── Reference building heat loss ──
  const reference = computeReferenceHL(climateZone, areas);

  // ── Proposed building heat loss ──
  const applyDefaults = (entries, defaultR) =>
    (entries || []).map(c => ({
      ...c,
      rValue: c.rValue > 0 ? c.rValue : defaultR,
    }));

  const proposedConstructions = {
    roof: applyDefaults(constructions.roof, DEFAULT_R_UNKNOWN_OPAQUE),
    wall: applyDefaults(constructions.wall, DEFAULT_R_UNKNOWN_OPAQUE),
    glazing: applyDefaults(constructions.glazing, DEFAULT_R_UNKNOWN_WINDOW),
    doorOpaque: applyDefaults(constructions.doorOpaque, DEFAULT_R_UNKNOWN_OPAQUE),
    skylight: applyDefaults(constructions.skylight, DEFAULT_R_UNKNOWN_WINDOW),
    floorSlab: applyDefaults(constructions.floorSlab, DEFAULT_R_UNKNOWN_OPAQUE),
    floorOther: applyDefaults(constructions.floorOther, DEFAULT_R_UNKNOWN_OPAQUE),
  };

  const proposedBreakdown = {};
  let hlProposed = 0;

  for (const [element, entries] of Object.entries(proposedConstructions)) {
    const hl = sumHeatLoss(entries);
    const area = sumArea(entries);
    const weightedR = area > 0 ? computeWeightedR(entries) : 0;
    proposedBreakdown[element] = { area, weightedR, heatLoss: hl };
    hlProposed += hl;
  }

  // ── Minimum R-value checks ──
  const minimums = checkMinimums(proposedConstructions, climateZone, heatedElements);

  // ── Overall compliance ──
  const hlReference = reference.total;
  const margin = hlReference - hlProposed;
  const marginPercent = hlReference > 0 ? (margin / hlReference) * 100 : 0;

  const compliant = glazingRatioOk
    && hlProposed <= hlReference
    && minimums.met;

  return {
    compliant,

    // Glazing ratio
    glazingRatio: Math.round(glazingRatio * 1000) / 10, // percentage with 1dp
    glazingRatioOk,

    // Heat loss comparison
    hlReference: Math.round(hlReference * 100) / 100,
    hlProposed: Math.round(hlProposed * 100) / 100,
    margin: Math.round(margin * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,

    // Minimum R-value checks
    minimumsMet: minimums.met,
    minimumChecks: minimums.checks,

    // Detailed breakdowns
    breakdown: proposedBreakdown,
    referenceBreakdown: reference.breakdown,

    // Areas summary
    areas,
  };
}
