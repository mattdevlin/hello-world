/**
 * Import design data from project walls and floors to pre-populate H1 calculator inputs.
 *
 * Derives: grossWallArea, wall constructions, glazing, opaque doors, slab floor area + perimeter.
 * Preserves: roof, skylight, floorOther, heatedElements, slab config (type, insulation, wallThickness).
 */

import { getProjectWalls, getProjectFloors, getProjectRoofs } from './storage.js';
import { computeWallTimberRatio } from './timberCalculator.js';
import { calculateFloorLayout } from './floorCalculator.js';
import { calculateRoofLayout } from './roofCalculator.js';
import { DEVPRO_WALL_R, DEVPRO_FLOOR_R, DEVPRO_ROOF_R } from './h1Constants.js';

/**
 * Build H1 input fields from project design data.
 *
 * @param {string} projectId
 * @param {object} existing - current H1 form input (to preserve non-derivable fields)
 * @returns {{ input: object, summary: object }} merged input + import summary
 */
export function buildH1FromDesign(projectId, existing) {
  const walls = getProjectWalls(projectId);
  const floors = getProjectFloors(projectId);
  const roofs = getProjectRoofs(projectId);

  // ── Walls ──
  let grossWallAreaMM2 = 0;
  const wallConstructions = [];
  const glazingEntries = [];
  const doorEntries = [];

  for (const wall of walls) {
    let tr;
    try {
      tr = computeWallTimberRatio(wall);
    } catch {
      continue; // skip walls that can't be computed
    }

    grossWallAreaMM2 += tr.grossWallArea; // mm²

    // Wall construction entry (net wall area for this wall)
    const wallAreaM2 = tr.effectiveWallArea / 1e6;
    if (wallAreaM2 > 0) {
      wallConstructions.push({ area: round2(wallAreaM2), rValue: DEVPRO_WALL_R });
    }

    // Openings → glazing or opaque door
    for (const op of (wall.openings || [])) {
      const areaM2 = (op.width_mm * op.height_mm) / 1e6;
      if (areaM2 <= 0) continue;

      if (op.type === 'window') {
        glazingEntries.push({
          area: round2(areaM2),
          glazingType: 'double',
          ug: 2.9,
          frameType: 'aluminiumThermal',
          rValue: 0.30,
        });
      } else {
        // door, single_garage, double_garage → opaque door
        doorEntries.push({ area: round2(areaM2), rValue: 0.50 });
      }
    }
  }

  const grossWallAreaM2 = round2(grossWallAreaMM2 / 1e6);

  // ── Floors ──
  let totalFloorAreaMM2 = 0;
  let totalPerimeterMM = 0;

  for (const floor of floors) {
    try {
      const layout = calculateFloorLayout(floor);
      totalFloorAreaMM2 += layout.totalArea;
      totalPerimeterMM += layout.perimeterLength;
    } catch {
      continue;
    }
  }

  const floorAreaM2 = round2(totalFloorAreaMM2 / 1e6);
  const perimeterM = round2(totalPerimeterMM / 1e3);

  // ── Roofs ──
  const roofEntries = [];
  for (const roof of roofs) {
    try {
      const layout = calculateRoofLayout(roof);
      if (layout.error) continue;
      // internalRoofArea = ceiling surface bounded by inside face of walls,
      // excluding overhangs, with wall thickness deducted from all sides
      const areaM2 = round2(layout.internalRoofArea / 1e6);
      if (areaM2 > 0) {
        roofEntries.push({ area: areaM2, rValue: DEVPRO_ROOF_R });
      }
    } catch {
      continue;
    }
  }

  // ── Merge with existing input ──
  // DEVPRO floors are suspended (not slab-on-ground) → populate floorOther
  const floorOtherEntries = floorAreaM2 > 0
    ? [{ area: floorAreaM2, rValue: DEVPRO_FLOOR_R }]
    : existing?.constructions?.floorOther || [];

  const input = {
    grossWallArea: grossWallAreaM2,
    constructions: {
      roof: roofEntries.length > 0 ? roofEntries : existing?.constructions?.roof || [{ area: 0, rValue: 6.6 }],
      wall: wallConstructions.length > 0 ? wallConstructions : [{ area: 0, rValue: DEVPRO_WALL_R }],
      glazing: glazingEntries.length > 0 ? glazingEntries : [{ area: 0, glazingType: 'double', ug: 2.9, frameType: 'aluminiumThermal', rValue: 0.30 }],
      doorOpaque: doorEntries,
      skylight: existing?.constructions?.skylight || [],
      floorSlab: existing?.constructions?.floorSlab || [{ area: 0, rValue: 0 }],
      floorOther: floorOtherEntries,
    },
    slab: existing?.slab || {
      perimeter: 0, floorArea: 0,
      floorType: 'raft_no_masonry', insulationPosition: 'uninsulated', wallThickness: 162,
    },
    heatedElements: existing?.heatedElements || { ceiling: false, wall: false, floor: false, bathroomOnly: false },
  };

  const roofAreaM2 = round2(roofEntries.reduce((s, r) => s + r.area, 0));

  const summary = {
    wallCount: walls.length,
    wallsImported: wallConstructions.length,
    grossWallAreaM2,
    glazingCount: glazingEntries.length,
    doorCount: doorEntries.length,
    floorCount: floors.length,
    floorAreaM2,
    perimeterM,
    roofCount: roofs.length,
    roofsImported: roofEntries.length,
    roofAreaM2,
  };

  return { input, summary };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
