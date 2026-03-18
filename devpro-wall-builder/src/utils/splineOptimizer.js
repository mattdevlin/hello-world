/**
 * Spline Panel Optimizer
 *
 * Splines are manufactured as composite "spline panels" (2400×1200mm),
 * then rip-cut into 146mm-wide strips.
 *
 * Spline panel sandwich (bottom to top):
 *   - 10mm magboard (2400×1200)
 *   - EPS to correct depth (2400×1200) — varies by system
 *   - 12mm ply (2400×1200) — roof long splines only
 *   - 10mm magboard (2400×1200)
 *
 * From one 1200mm-wide panel: floor(1200/146) = 8 strips, with 32mm waste.
 */

import {
  PLY_SHEET_HEIGHT, PLY_SHEET_WIDTH, SPLINE_WIDTH, MAGBOARD,
  WALL_SPLINE_EPS_DEPTH, FLOOR_SPLINE_EPS_DEPTH,
  BOTTOM_PLATE, TOP_PLATE, PANEL_GAP, HSPLINE_CLEARANCE,
  buildHSplineSegments,
} from './constants.js';

const STRIP_LENGTH = PLY_SHEET_HEIGHT;  // 2400mm
const PANEL_WIDTH = PLY_SHEET_WIDTH;    // 1200mm
const STRIPS_PER_PANEL = Math.floor(PANEL_WIDTH / SPLINE_WIDTH); // 8
const WASTE_WIDTH = PANEL_WIDTH - STRIPS_PER_PANEL * SPLINE_WIDTH; // 32mm

// ─────────────────────────────────────────────────────────────
// Piece splitting — no single piece may exceed 2400mm
// ─────────────────────────────────────────────────────────────

function splitPiece(piece) {
  if (piece.length <= STRIP_LENGTH) return [piece];

  const MIN_OVERLAP = 600;
  let numSegments = Math.ceil(piece.length / STRIP_LENGTH);

  // Build per-segment lengths to maximize full-length pieces
  const segLengths = [];
  if (numSegments === 1) {
    segLengths.push(piece.length);
  } else {
    const remainder = piece.length - (numSegments - 1) * STRIP_LENGTH;
    if (remainder >= MIN_OVERLAP) {
      for (let s = 0; s < numSegments - 1; s++) segLengths.push(STRIP_LENGTH);
      segLengths.push(remainder);
    } else {
      for (let s = 0; s < numSegments - 2; s++) segLengths.push(STRIP_LENGTH);
      segLengths.push(piece.length - (numSegments - 2) * STRIP_LENGTH - MIN_OVERLAP);
      segLengths.push(MIN_OVERLAP);
    }
  }

  const parts = [];
  for (let i = 0; i < numSegments; i++) {
    parts.push({
      ...piece,
      label: `${piece.label} (${i + 1}/${numSegments})`,
      length: segLengths[i],
    });
  }
  return parts;
}

// ─────────────────────────────────────────────────────────────
// Wall spline piece extraction
// ─────────────────────────────────────────────────────────────

export function extractWallSplinePieces(layout) {
  const pieces = [];
  if (!layout) return pieces;

  const {
    height, panels = [], openings = [], lintelPanels = [], footerPanels = [],
    isMultiCourse, courses = [],
  } = layout;

  const splineH = height - BOTTOM_PLATE - TOP_PLATE * 2 - 10;
  if (splineH <= 0) return pieces;

  // Vertical joint splines
  for (let i = 0; i < panels.length - 1; i++) {
    const panel = panels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintelPanel && !insideFooterPanel) {
      pieces.push({
        label: `Joint P${panels[i].index + 1}/P${panels[i + 1].index + 1}`,
        length: splineH,
        epsDepth: WALL_SPLINE_EPS_DEPTH,
        hasPly: false,
      });
    }
  }

  // Opening splines (windows with sills)
  for (const op of openings) {
    if (op.y > 0) {
      pieces.push({ label: `${op.ref} Left`, length: splineH, epsDepth: WALL_SPLINE_EPS_DEPTH, hasPly: false });
      pieces.push({ label: `${op.ref} Right`, length: splineH, epsDepth: WALL_SPLINE_EPS_DEPTH, hasPly: false });
    }
  }

  // Horizontal splines (multi-course only)
  if (isMultiCourse && courses.length > 1) {
    const jointHasSpline = [];
    for (let i = 0; i < panels.length - 1; i++) {
      const gapCentre = panels[i].x + panels[i].width + PANEL_GAP / 2;
      const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
      const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
      jointHasSpline.push(!insideLintelPanel && !insideFooterPanel);
    }

    for (let ci = 0; ci < courses.length - 1; ci++) {
      for (let pi = 0; pi < panels.length; pi++) {
        const panel = panels[pi];
        const halfSpline = SPLINE_WIDTH / 2;
        let leftEdge = panel.x;
        if (pi > 0 && jointHasSpline[pi - 1]) {
          leftEdge = panels[pi - 1].x + panels[pi - 1].width + PANEL_GAP / 2 + halfSpline;
        }
        let rightEdge = panel.x + panel.width;
        if (pi < panels.length - 1 && jointHasSpline[pi]) {
          rightEdge = panel.x + panel.width + PANEL_GAP / 2 - halfSpline;
        }

        // Build segments excluding openings/lintels
        const splineLeft = leftEdge + HSPLINE_CLEARANCE;
        const splineRight = rightEdge - HSPLINE_CLEARANCE;
        const segs = buildHSplineSegments(splineLeft, splineRight, lintelPanels, openings);

        for (const [segL, segR] of segs) {
          const w = Math.round(segR - segL);
          if (w > 0) {
            pieces.push({
              label: `H-Spline P${panel.index + 1} C${ci + 1}/${ci + 2}`,
              length: w,
              epsDepth: WALL_SPLINE_EPS_DEPTH,
              hasPly: false,
            });
          }
        }
      }
    }
  }

  // Split any pieces > 2400mm
  return pieces.flatMap(splitPiece);
}

// ─────────────────────────────────────────────────────────────
// Floor spline piece extraction
// ─────────────────────────────────────────────────────────────

export function extractFloorSplinePieces(layout) {
  const pieces = [];
  if (!layout) return pieces;

  const { reinforcedSplines = [], unreinforcedSplines = [] } = layout;

  let idx = 0;
  for (const s of reinforcedSplines) {
    if (s.length > 0) {
      idx++;
      pieces.push({
        label: `Reinforced ${idx}`,
        length: Math.round(s.length),
        epsDepth: FLOOR_SPLINE_EPS_DEPTH,
        hasPly: false,
      });
    }
  }

  idx = 0;
  for (const s of unreinforcedSplines) {
    if (s.length > 0) {
      idx++;
      pieces.push({
        label: `Unreinforced ${idx}`,
        length: Math.round(s.length),
        epsDepth: FLOOR_SPLINE_EPS_DEPTH,
        hasPly: false,
      });
    }
  }

  return pieces.flatMap(splitPiece);
}

// ─────────────────────────────────────────────────────────────
// Roof spline piece extraction
// ─────────────────────────────────────────────────────────────

export function extractRoofSplinePieces(layout) {
  const pieces = [];
  if (!layout) return pieces;

  const { splines = [] } = layout;

  let longIdx = 0;
  let shortIdx = 0;
  for (const s of splines) {
    if (s.length <= 0) continue;
    const isLong = s.splineType !== 'short';
    if (isLong) longIdx++; else shortIdx++;
    pieces.push({
      label: isLong ? `Long ${longIdx}` : `Short ${shortIdx}`,
      length: Math.round(s.length),
      epsDepth: s.epsDepth,
      hasPly: isLong,
    });
  }

  return pieces.flatMap(splitPiece);
}

// ─────────────────────────────────────────────────────────────
// Bin-packing: group pieces into 2400×1200 spline panels
// ─────────────────────────────────────────────────────────────

/**
 * Group spline pieces into manufacturing panels.
 *
 * 1. Group by (epsDepth, hasPly) — can't mix compositions.
 * 2. 1D first-fit-decreasing bin-pack along 2400mm strip length.
 * 3. Pack strips into panels, 8 strips per panel.
 */
export function groupSplinePanels(pieces) {
  if (!pieces || pieces.length === 0) return [];

  // Group by composition key
  const groups = new Map();
  for (const p of pieces) {
    const key = `${p.epsDepth}_${p.hasPly ? 1 : 0}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const panels = [];
  let panelIndex = 0;

  for (const [_key, group] of groups) {
    const { epsDepth, hasPly } = group[0];

    // 1D FFD bin-pack into strips of STRIP_LENGTH (2400mm)
    const sorted = [...group].sort((a, b) => b.length - a.length);
    const strips = []; // each strip: { pieces: [{ label, length, offset }], remaining }

    for (const piece of sorted) {
      let placed = false;
      for (const strip of strips) {
        if (strip.remaining >= piece.length) {
          const offset = STRIP_LENGTH - strip.remaining;
          strip.pieces.push({ label: piece.label, length: piece.length, offset });
          strip.remaining -= piece.length;
          placed = true;
          break;
        }
      }
      if (!placed) {
        strips.push({
          pieces: [{ label: piece.label, length: piece.length, offset: 0 }],
          remaining: STRIP_LENGTH - piece.length,
        });
      }
    }

    // Pack strips into panels (8 per panel)
    for (let i = 0; i < strips.length; i += STRIPS_PER_PANEL) {
      const panelStrips = strips.slice(i, i + STRIPS_PER_PANEL).map(s => ({
        pieces: s.pieces,
        waste: s.remaining,
      }));

      panels.push({
        panelIndex: panelIndex++,
        epsDepth,
        hasPly,
        strips: panelStrips,
        wasteWidth: WASTE_WIDTH,
      });
    }
  }

  return panels;
}
