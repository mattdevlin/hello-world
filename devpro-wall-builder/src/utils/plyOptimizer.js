/**
 * Ply Sheet Optimizer
 *
 * Long roof/ceiling splines include a 12mm plywood layer.
 * Ply sheets: 2400 × 1200mm.
 * Each long spline produces one ply piece: SPLINE_WIDTH (146mm) × spline.length.
 *
 * Uses the same shelf-based bin packing as EPS to minimize sheet count.
 */

import { PLY_SHEET_WIDTH, PLY_SHEET_HEIGHT, SPLINE_WIDTH } from './constants.js';
import { calculateRoofLayout } from './roofCalculator.js';
import { shelfPack } from './binPacking.js';

/**
 * Extract ply pieces from a single roof layout.
 * Only long (vertical) splines have a ply layer.
 */
export function extractRoofPlyPieces(layout, roofName = '') {
  const pieces = [];
  const { splines = [] } = layout;

  for (const s of splines) {
    if (s.splineType === 'long' && s.length > 0) {
      pieces.push({
        width: SPLINE_WIDTH,
        height: Math.round(s.length),
        label: 'Long Spline Ply',
        roofName,
      });
    }
  }

  return pieces;
}

/**
 * Compute ply sheet requirements for a set of roofs.
 *
 * @param {Array} roofs - roof definition objects
 * @returns {Object} { sheets, sheetCount, utilization, pieces }
 */
export function computeProjectPlySheetsWithRoofs(roofs) {
  if (!roofs || roofs.length === 0) {
    return { pieces: [], sheets: [], sheetCount: 0, utilization: 0 };
  }

  const allPieces = [];

  for (const roof of roofs) {
    const layout = calculateRoofLayout(roof);
    if (layout.error) continue;
    const pieces = extractRoofPlyPieces(layout, roof.name);
    allPieces.push(...pieces);
  }

  if (allPieces.length === 0) {
    return { pieces: [], sheets: [], sheetCount: 0, utilization: 0 };
  }

  const sheets = shelfPack(allPieces, PLY_SHEET_HEIGHT, PLY_SHEET_WIDTH);
  const sheetArea = PLY_SHEET_WIDTH * PLY_SHEET_HEIGHT;
  const usedArea = allPieces.reduce((s, p) => s + p.width * p.height, 0);
  const totalArea = sheets.length * sheetArea;

  return {
    pieces: allPieces,
    sheets,
    sheetCount: sheets.length,
    utilization: totalArea > 0 ? usedArea / totalArea : 0,
  };
}
