import { FLOOR_EPS_RECESS, EPS_GAP } from './constants.js';

/**
 * Compute per-edge EPS deductions for a floor panel.
 *
 * Perimeter edges (bounded by boundary joists) get:
 *   boundaryJoistCount * perimeterPlateWidth + EPS_GAP
 *
 * Spline edges (between panels) get:
 *   FLOOR_EPS_RECESS (= SPLINE_WIDTH/2 + EPS_GAP = 83mm)
 *
 * Returns { left, right, bottom, top } in mm.
 */
export function computeFloorEpsDeductions(panel, layout) {
  const {
    columnPositions, spanBreaks, panelDirection,
    boundaryJoistCount = 1, perimeterPlateWidth = 45,
  } = layout;

  const splineDed = FLOOR_EPS_RECESS;  // 83mm
  const perimDed = boundaryJoistCount * perimeterPlateWidth + EPS_GAP;

  const colIdx = panel.columnIndex;
  const lastColIdx = columnPositions.length - 1;

  if (panelDirection === 0) {
    // width = column axis (X), length = span axis (Y)
    const left  = colIdx === 0          ? perimDed : splineDed;
    const right = colIdx === lastColIdx ? perimDed : splineDed;

    let spanIdx = spanBreaks.findIndex((b, i) =>
      i < spanBreaks.length - 1 && Math.abs(b - panel.y) < 1);
    // Fallback: find closest span break if exact match fails
    if (spanIdx === -1) {
      let minDist = Infinity;
      for (let i = 0; i < spanBreaks.length - 1; i++) {
        const dist = Math.abs(spanBreaks[i] - panel.y);
        if (dist < minDist) { minDist = dist; spanIdx = i; }
      }
    }
    const bottom = spanIdx === 0                     ? perimDed : splineDed;
    const top    = spanIdx === spanBreaks.length - 2 ? perimDed : splineDed;

    return { left, right, bottom, top };
  } else {
    // width = span axis (X), length = column axis (Y)
    let spanIdx = spanBreaks.findIndex((b, i) =>
      i < spanBreaks.length - 1 && Math.abs(b - panel.x) < 1);
    // Fallback: find closest span break if exact match fails
    if (spanIdx === -1) {
      let minDist = Infinity;
      for (let i = 0; i < spanBreaks.length - 1; i++) {
        const dist = Math.abs(spanBreaks[i] - panel.x);
        if (dist < minDist) { minDist = dist; spanIdx = i; }
      }
    }
    const left  = spanIdx === 0                     ? perimDed : splineDed;
    const right = spanIdx === spanBreaks.length - 2 ? perimDed : splineDed;

    const bottom = colIdx === 0          ? perimDed : splineDed;
    const top    = colIdx === lastColIdx ? perimDed : splineDed;

    return { left, right, bottom, top };
  }
}
