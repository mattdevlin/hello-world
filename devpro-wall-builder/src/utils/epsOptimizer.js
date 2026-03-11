/**
 * EPS Block Optimizer
 *
 * Raw EPS blocks: 4900 × 1220 × 630 mm
 * Panel EPS thickness: 142mm  → 4 slabs per block (4 × 142 = 568, 62mm waste)
 * Spline EPS thickness: 120mm → 5 slabs per block (5 × 120 = 600, 30mm waste)
 *
 * Each slab is 4900 × 1220. Pieces are cut from slabs using guillotine cuts.
 * Uses shelf-based bin packing with rotation to minimize slab count → block count.
 */

import { BOTTOM_PLATE, TOP_PLATE, PANEL_GAP } from './constants.js';
import { calculateWallLayout } from './calculator.js';

// ── Block dimensions ──
export const EPS_BLOCK = {
  length: 4900,   // mm
  width: 1220,    // mm
  depth: 630,     // mm
};

// ── EPS thicknesses ──
const PANEL_EPS_DEPTH = 142;
const SPLINE_EPS_DEPTH = 120;
const EPS_INSET = 10;
const SPLINE_WIDTH = 146;
const HALF_SPLINE = SPLINE_WIDTH / 2;
const MAGBOARD = 10;

export const PANEL_SLABS_PER_BLOCK = Math.floor(EPS_BLOCK.depth / PANEL_EPS_DEPTH);  // 4
export const SPLINE_SLABS_PER_BLOCK = Math.floor(EPS_BLOCK.depth / SPLINE_EPS_DEPTH); // 5

// ─────────────────────────────────────────────────────────────
// Piece extraction — mirrors EpsCutPlans logic
// ─────────────────────────────────────────────────────────────

/**
 * Extract all EPS cut pieces from a single wall layout.
 * @returns {Array<{width: number, height: number, depth: number, label: string, wallName: string}>}
 */
export function extractEpsPieces(layout, wallName = '') {
  const pieces = [];
  const {
    height, panels, openings, footers, lintelPanels,
    deductionLeft, deductionRight, grossLength,
    isRaked, courses, isMultiCourse,
  } = layout;

  // ── Build exclusion zones (x-ranges with no panel EPS) ──
  const exclusions = [];

  if (deductionLeft > 0) {
    exclusions.push([deductionLeft, deductionLeft + BOTTOM_PLATE]);
  }
  if (deductionRight > 0) {
    exclusions.push([grossLength - deductionRight - BOTTOM_PLATE, grossLength - deductionRight]);
  }

  for (let i = 0; i < panels.length - 1; i++) {
    const panel = panels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    const insideLintel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintel && !insideFooter) {
      exclusions.push([gapCentre - HALF_SPLINE, gapCentre + HALF_SPLINE]);
    }
  }

  for (const op of openings) {
    const hasSill = op.y > 0;
    exclusions.push([op.x - BOTTOM_PLATE, op.x]);
    if (hasSill) exclusions.push([op.x - BOTTOM_PLATE - SPLINE_WIDTH, op.x - BOTTOM_PLATE]);
    exclusions.push([op.x + op.drawWidth, op.x + op.drawWidth + BOTTOM_PLATE]);
    if (hasSill) exclusions.push([op.x + op.drawWidth + BOTTOM_PLATE, op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH]);
    exclusions.push([op.x, op.x + op.drawWidth]);
  }

  for (const p of panels) {
    if (p.type === 'end') exclusions.push([p.x + p.width - BOTTOM_PLATE, p.x + p.width]);
    if (deductionRight === 0 && Math.abs(p.x + p.width - grossLength) < 1) exclusions.push([grossLength - BOTTOM_PLATE, grossLength]);
    if (deductionLeft === 0 && Math.abs(p.x) < 1) exclusions.push([0, BOTTOM_PLATE]);
  }

  for (const l of lintelPanels) exclusions.push([l.x, l.x + l.width]);

  exclusions.sort((a, b) => a[0] - b[0]);

  const getEpsSegments = (panelLeft, panelRight) => {
    const clipped = [];
    for (const [eL, eR] of exclusions) {
      const cL = Math.max(eL, panelLeft);
      const cR = Math.min(eR, panelRight);
      if (cL < cR) clipped.push([cL, cR]);
    }
    const merged = [];
    for (const zone of clipped) {
      if (merged.length > 0 && zone[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], zone[1]);
      } else {
        merged.push([...zone]);
      }
    }
    const segs = [];
    let cursor = panelLeft + EPS_INSET;
    for (const [eL, eR] of merged) {
      const segRight = eL - EPS_INSET;
      if (cursor < segRight) segs.push([cursor, segRight]);
      cursor = eR + EPS_INSET;
    }
    const segRight = panelRight - EPS_INSET;
    if (cursor < segRight) segs.push([cursor, segRight]);
    return segs;
  };

  // EPS height bounds
  const epsTop = TOP_PLATE * 2 + EPS_INSET;
  const epsBottom = height - BOTTOM_PLATE - EPS_INSET;
  const epsHeight = epsBottom - epsTop;

  // ── Panel EPS pieces ──
  panels.forEach((panel) => {
    const segments = getEpsSegments(panel.x, panel.x + panel.width);
    const panelEpsH = isRaked
      ? Math.round(((panel.heightLeft + panel.heightRight) / 2) - BOTTOM_PLATE - TOP_PLATE * 2 - EPS_INSET * 2)
      : epsHeight;

    if (isMultiCourse && courses && courses.length > 1) {
      segments.forEach((seg) => {
        const w = Math.round(seg[1] - seg[0]);
        if (w <= 0) return;
        courses.forEach((course, ci) => {
          const plateAbove = ci === 0 ? TOP_PLATE * 2 : TOP_PLATE;
          const plateBelow = ci === courses.length - 1 ? BOTTOM_PLATE : TOP_PLATE;
          const courseEpsH = course.height - plateAbove - plateBelow - EPS_INSET * 2;
          if (courseEpsH <= 0) return;
          pieces.push({
            width: w,
            height: Math.round(courseEpsH),
            depth: PANEL_EPS_DEPTH,
            label: `P${panel.index + 1} C${ci + 1}`,
            wallName,
          });
        });
      });
    } else {
      segments.forEach((seg) => {
        const w = Math.round(seg[1] - seg[0]);
        if (w > 0 && panelEpsH > 0) {
          pieces.push({
            width: w,
            height: Math.round(panelEpsH),
            depth: PANEL_EPS_DEPTH,
            label: `P${panel.index + 1}`,
            wallName,
          });
        }
      });
    }
  });

  // ── Footer EPS ──
  footers.forEach((f) => {
    const op = openings.find(o => o.ref === f.ref);
    if (!op) return;
    const fEpsTop = height - op.y + BOTTOM_PLATE + EPS_INSET;
    const fEpsBot = height - BOTTOM_PLATE - EPS_INSET;
    if (fEpsBot <= fEpsTop) return;
    const leftSplineRight = op.x - BOTTOM_PLATE;
    const fEpsLeft = f.x < leftSplineRight ? leftSplineRight + EPS_INSET : f.x + EPS_INSET;
    const rightSplineLeft = op.x + op.drawWidth + BOTTOM_PLATE;
    const fEpsRight = f.x + f.width > rightSplineLeft ? rightSplineLeft - EPS_INSET : f.x + f.width - EPS_INSET;
    if (fEpsRight <= fEpsLeft) return;
    pieces.push({
      width: Math.round(fEpsRight - fEpsLeft),
      height: Math.round(fEpsBot - fEpsTop),
      depth: PANEL_EPS_DEPTH,
      label: `Footer ${f.ref}`,
      wallName,
    });
  });

  // ── Spline EPS pieces ──
  const splineEpsW = SPLINE_WIDTH - MAGBOARD * 2; // 126mm
  const splineH = height - BOTTOM_PLATE - TOP_PLATE * 2 - 10;
  if (splineH > 0) {
    // Joint splines
    for (let i = 0; i < panels.length - 1; i++) {
      const panel = panels[i];
      const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
      const insideLintel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
      const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
      if (!insideLintel && !insideFooter) {
        pieces.push({
          width: splineEpsW,
          height: splineH,
          depth: SPLINE_EPS_DEPTH,
          label: `Spline P${panels[i].index + 1}/P${panels[i + 1].index + 1}`,
          wallName,
        });
      }
    }

    // Opening splines (windows with sills only)
    for (const op of openings) {
      if (op.y > 0) {
        pieces.push({ width: splineEpsW, height: splineH, depth: SPLINE_EPS_DEPTH, label: `Spline ${op.ref} L`, wallName });
        pieces.push({ width: splineEpsW, height: splineH, depth: SPLINE_EPS_DEPTH, label: `Spline ${op.ref} R`, wallName });
      }
    }
  }

  return pieces;
}

// ─────────────────────────────────────────────────────────────
// Shelf-based 2D bin packing with rotation
// ─────────────────────────────────────────────────────────────

/**
 * Pack rectangular pieces onto slabs (4900 × 1220) using shelf algorithm.
 * Pieces may be rotated 90° if it helps.
 *
 * @param {Array} pieces - {width, height, ...}
 * @param {number} slabW - slab width (4900)
 * @param {number} slabH - slab height (1220)
 * @returns {Array} slabs, each { shelves: [{height, pieces, usedWidth}] }
 */
function shelfPack(pieces, slabW, slabH) {
  // Sort by tallest dimension descending — packs shelves more tightly
  const sorted = [...pieces].sort((a, b) => {
    const aMax = Math.max(a.width, a.height);
    const bMax = Math.max(b.width, b.height);
    return bMax - aMax;
  });

  const slabs = [];

  for (const piece of sorted) {
    // Build candidate orientations
    const orients = [{ w: piece.width, h: piece.height }];
    if (piece.width !== piece.height) {
      orients.push({ w: piece.height, h: piece.width });
    }
    // Prefer the orientation where width (placed along shelf) is larger
    // and height is smaller, so shelves stay short and more fit vertically
    orients.sort((a, b) => a.h - b.h);

    let placed = false;

    for (const o of orients) {
      if (o.w > slabW || o.h > slabH) continue;

      // Try to fit on an existing slab's existing shelf
      for (const slab of slabs) {
        for (const shelf of slab.shelves) {
          if (shelf.remainingW >= o.w && shelf.h >= o.h) {
            shelf.pieces.push({ ...piece, placedW: o.w, placedH: o.h });
            shelf.remainingW -= o.w;
            placed = true;
            break;
          }
        }
        if (placed) break;

        // Try a new shelf on this slab
        const usedH = slab.shelves.reduce((s, sh) => s + sh.h, 0);
        if (usedH + o.h <= slabH) {
          slab.shelves.push({
            h: o.h,
            remainingW: slabW - o.w,
            pieces: [{ ...piece, placedW: o.w, placedH: o.h }],
          });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      // Open a new slab
      const o = orients.find(o => o.w <= slabW && o.h <= slabH) || orients[0];
      slabs.push({
        shelves: [{
          h: o.h,
          remainingW: slabW - o.w,
          pieces: [{ ...piece, placedW: o.w, placedH: o.h }],
        }],
      });
    }
  }

  return slabs;
}

// ─────────────────────────────────────────────────────────────
// Project-level EPS block computation
// ─────────────────────────────────────────────────────────────

/**
 * Compute EPS block requirements for a set of walls.
 *
 * @param {Array} walls - wall objects from storage (with openings, dimensions, etc.)
 * @returns {Object} block requirements and breakdown
 */
export function computeProjectEpsBlocks(walls) {
  const allPieces = [];
  const perWall = [];

  for (const wall of walls) {
    const layout = calculateWallLayout(wall);
    const pieces = extractEpsPieces(layout, wall.name);
    allPieces.push(...pieces);
    perWall.push({
      wallName: wall.name,
      wallId: wall.id,
      panelCount: pieces.filter(p => p.depth === PANEL_EPS_DEPTH).length,
      splineCount: pieces.filter(p => p.depth === SPLINE_EPS_DEPTH).length,
      panelArea: pieces.filter(p => p.depth === PANEL_EPS_DEPTH).reduce((s, p) => s + p.width * p.height, 0),
      splineArea: pieces.filter(p => p.depth === SPLINE_EPS_DEPTH).reduce((s, p) => s + p.width * p.height, 0),
    });
  }

  const panelPieces = allPieces.filter(p => p.depth === PANEL_EPS_DEPTH);
  const splinePieces = allPieces.filter(p => p.depth === SPLINE_EPS_DEPTH);

  const slabW = EPS_BLOCK.length;
  const slabH = EPS_BLOCK.width;

  const panelSlabs = shelfPack(panelPieces, slabW, slabH);
  const splineSlabs = shelfPack(splinePieces, slabW, slabH);

  const panelBlocks = Math.ceil(panelSlabs.length / PANEL_SLABS_PER_BLOCK);
  const splineBlocks = Math.ceil(splineSlabs.length / SPLINE_SLABS_PER_BLOCK);

  // Utilization: how much slab area is actually used vs. total slab area
  const slabArea = slabW * slabH;
  const panelUsedArea = panelPieces.reduce((s, p) => s + p.width * p.height, 0);
  const splineUsedArea = splinePieces.reduce((s, p) => s + p.width * p.height, 0);
  const panelTotalArea = panelSlabs.length * slabArea;
  const splineTotalArea = splineSlabs.length * slabArea;

  // Volume
  const panelVolume = panelUsedArea * PANEL_EPS_DEPTH;  // mm³
  const splineVolume = splineUsedArea * SPLINE_EPS_DEPTH;
  const totalVolume = panelVolume + splineVolume;

  return {
    panelPieces,
    splinePieces,
    panelSlabs,
    splineSlabs,
    panelSlabCount: panelSlabs.length,
    splineSlabCount: splineSlabs.length,
    panelBlocks,
    splineBlocks,
    totalBlocks: panelBlocks + splineBlocks,
    panelUtilization: panelTotalArea > 0 ? panelUsedArea / panelTotalArea : 0,
    splineUtilization: splineTotalArea > 0 ? splineUsedArea / splineTotalArea : 0,
    totalPieces: allPieces.length,
    totalVolumeM3: (totalVolume / 1e9).toFixed(3),
    perWall,
    block: EPS_BLOCK,
  };
}
