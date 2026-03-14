import { polygonArea, polygonPerimeter } from './polygonUtils.js';

const MM2_TO_M2 = 1e-6;
const MM_TO_M = 1e-3;

/**
 * Compute gross envelope area of a single wall in mm², accounting for profile shape
 * and corner deductions.
 */
function wallGrossAreaMm2(wall) {
  const grossLen = wall.length_mm || 0;
  const dedL = wall.deduction_left_mm || 0;
  const dedR = wall.deduction_right_mm || 0;
  const netStart = dedL;
  const netEnd = grossLen - dedR;
  const span = netEnd - netStart;
  if (span <= 0) return 0;

  const profile = (wall.profile || 'standard').toLowerCase();
  const hLeft = wall.height_mm || 0;

  if (profile === 'raked') {
    const hRight = wall.height_right_mm || hLeft;
    // Height at any x along the gross length: linear interpolation
    const hAtStart = grossLen > 0 ? hLeft + (hRight - hLeft) * (netStart / grossLen) : hLeft;
    const hAtEnd = grossLen > 0 ? hLeft + (hRight - hLeft) * (netEnd / grossLen) : hLeft;
    return span * (hAtStart + hAtEnd) / 2;
  }

  if (profile === 'gable') {
    const peakH = wall.peak_height_mm || hLeft;
    const peakX = wall.peak_position_mm ?? Math.round(grossLen / 2);

    // Height function
    const heightAt = (x) => {
      if (x <= peakX) {
        return peakX > 0 ? hLeft + (peakH - hLeft) * (x / peakX) : peakH;
      }
      const remaining = grossLen - peakX;
      return remaining > 0 ? peakH - (peakH - hLeft) * ((x - peakX) / remaining) : peakH;
    };

    // Integrate piecewise: split at peak if it falls within [netStart, netEnd]
    let area = 0;
    const breakpoints = [netStart];
    if (peakX > netStart && peakX < netEnd) breakpoints.push(peakX);
    breakpoints.push(netEnd);

    for (let i = 0; i < breakpoints.length - 1; i++) {
      const a = breakpoints[i];
      const b = breakpoints[i + 1];
      // Each segment is a trapezoid (linear height function within segment)
      area += (b - a) * (heightAt(a) + heightAt(b)) / 2;
    }
    return area;
  }

  // Standard: constant height
  return span * hLeft;
}

/**
 * Compute total opening area in mm² for a wall, classified by type.
 */
function classifyOpenings(openings) {
  let windowArea = 0;
  let doorArea = 0;

  for (const op of openings || []) {
    const area = (op.width_mm || 0) * (op.height_mm || 0);
    if (op.type === 'window') {
      windowArea += area;
    } else {
      // door, single_garage, double_garage → opaque door
      doorArea += area;
    }
  }

  return { windowArea, doorArea };
}

/**
 * Aggregate design data from project walls and floors for H1/AS1 compliance.
 *
 * @param {Array} walls - Array of wall definition objects
 * @param {Array} floors - Array of floor definition objects with polygon arrays
 * @returns {Object} Aggregated areas in m² and perimeters in m
 */
export function aggregateDesignData(walls = [], floors = []) {
  let grossWallArea = 0;
  let totalWindowArea = 0;
  let totalDoorArea = 0;
  let windowCount = 0;
  let doorCount = 0;
  const perWall = [];

  for (const wall of walls) {
    const gross = wallGrossAreaMm2(wall) * MM2_TO_M2;
    const { windowArea, doorArea } = classifyOpenings(wall.openings);
    const winM2 = windowArea * MM2_TO_M2;
    const doorM2 = doorArea * MM2_TO_M2;

    grossWallArea += gross;
    totalWindowArea += winM2;
    totalDoorArea += doorM2;

    for (const op of wall.openings || []) {
      if (op.type === 'window') windowCount++;
      else doorCount++;
    }

    perWall.push({
      name: wall.name || 'Unnamed',
      grossArea: Math.round(gross * 100) / 100,
      windowArea: Math.round(winM2 * 100) / 100,
      doorArea: Math.round(doorM2 * 100) / 100,
    });
  }

  // Floors
  let floorArea = 0;
  let floorPerimeter = 0;
  for (const floor of floors) {
    if (floor.polygon && floor.polygon.length >= 3) {
      floorArea += Math.abs(polygonArea(floor.polygon)) * MM2_TO_M2;
      floorPerimeter += polygonPerimeter(floor.polygon) * MM_TO_M;
    }
  }

  return {
    wallCount: walls.length,
    floorCount: floors.length,
    windowCount,
    doorCount,
    grossWallArea: Math.round(grossWallArea * 100) / 100,
    netOpaqueWallArea: Math.round((grossWallArea - totalWindowArea - totalDoorArea) * 100) / 100,
    windowArea: Math.round(totalWindowArea * 100) / 100,
    doorArea: Math.round(totalDoorArea * 100) / 100,
    floorArea: Math.round(floorArea * 100) / 100,
    floorPerimeter: Math.round(floorPerimeter * 100) / 100,
    perWall,
  };
}
