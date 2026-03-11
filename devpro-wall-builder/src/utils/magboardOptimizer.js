/**
 * Magboard Sheet Optimizer
 *
 * Magboard sheets: 1200 × 2745mm or 1200 × 3050mm (10mm thick).
 * (2440mm sheets not stocked — panels use 2745 or 3050 stock sheets.)
 *
 * Each panel face requires one full sheet (2 per panel, front + back).
 * Additional pieces (lintel panels, footers, splines, deductions) are smaller
 * and can share sheets via 2D bin packing.
 */

import { BOTTOM_PLATE, TOP_PLATE, PANEL_GAP, PANEL_WIDTH, SPLINE_WIDTH, HSPLINE_CLEARANCE, buildHSplineSegments } from './constants.js';
import { calculateWallLayout } from './calculator.js';

export const MAGBOARD_SHEETS = {
  medium: { width: 1200, height: 2745 },
  large:  { width: 1200, height: 3050 },
};



// ─────────────────────────────────────────────────────────────
// Piece extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract all magboard pieces from a single wall layout.
 * Returns panel pieces (each uses a full sheet) and additional pieces
 * (lintels, footers, splines, deductions) that can share sheets.
 */
export function extractMagboardPieces(layout, wallName = '') {
  const panelSheets = [];   // each entry = one full sheet consumed
  const cutPieces = [];     // smaller pieces to bin-pack

  const {
    height, panels, openings, lintelPanels, footers,
    deductionLeft, deductionRight,
    courses, isMultiCourse,
  } = layout;

  // ── Panel face sheets ──
  // Each panel in the array is already course-specific (tagged with panel.course).
  // 2 sheets per panel (front + back).
  for (const panel of panels) {
    const sheetH = panel.sheetHeight || courses?.[panel.course ?? 0]?.sheetHeight || height;
    const courseLabel = isMultiCourse ? ` C${(panel.course ?? 0) + 1}` : '';
    panelSheets.push({ sheetHeight: sheetH, label: `P${panel.index + 1}${courseLabel}`, wallName });
    panelSheets.push({ sheetHeight: sheetH, label: `P${panel.index + 1}${courseLabel}`, wallName });
  }

  // ── Lintel panels: 2 magboard pieces each (EPS area above timber lintel) ──
  for (const lintel of lintelPanels) {
    const lintelH = lintel.lintelHeight || 200;
    const epsHeight = lintel.height - lintelH;
    if (epsHeight > 0) {
      for (let i = 0; i < 2; i++) {
        cutPieces.push({
          width: lintel.width,
          height: epsHeight,
          type: 'lintelPanel',
          label: `${lintel.ref} Lintel Panel`,
          wallName,
        });
      }
    }
  }

  // ── Footers: 2 magboard pieces each ──
  for (const footer of footers) {
    for (let i = 0; i < 2; i++) {
      cutPieces.push({
        width: footer.width,
        height: footer.height,
        type: 'footer',
        label: `${footer.ref} Footer`,
        wallName,
      });
    }
  }

  // ── Vertical splines: 2 magboard pieces each ──
  // Track which joints have vertical splines (needed for horizontal spline sizing)
  // Use course 0 panels for joint detection (x-positions are identical across courses)
  const basePanels = panels.filter(p => (p.course ?? 0) === 0);
  const jointHasSpline = new Array(basePanels.length - 1).fill(false);
  const splineH = height - BOTTOM_PLATE - TOP_PLATE * 2 - 10;
  if (splineH > 0) {
    // Joint splines
    for (let i = 0; i < basePanels.length - 1; i++) {
      const panel = basePanels[i];
      const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
      const insideLintel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
      const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
      if (!insideLintel && !insideFooter) {
        jointHasSpline[i] = true;
        for (let j = 0; j < 2; j++) {
          cutPieces.push({
            width: SPLINE_WIDTH,
            height: splineH,
            type: 'spline',
            label: `Spline P${basePanels[i].index + 1}/P${basePanels[i + 1].index + 1}`,
            wallName,
          });
        }
      }
    }

    // Opening splines (windows with sills)
    for (const op of openings) {
      if (op.y > 0) {
        for (let j = 0; j < 2; j++) {
          cutPieces.push({ width: SPLINE_WIDTH, height: splineH, type: 'spline', label: `Spline ${op.ref} L`, wallName });
          cutPieces.push({ width: SPLINE_WIDTH, height: splineH, type: 'spline', label: `Spline ${op.ref} R`, wallName });
        }
      }
    }
  }

  // ── Horizontal splines at course joints (multi-course only) ──
  // Width = distance between inner edges of adjacent vertical splines, less 10mm each end.
  // First/last panels (or joints without a vertical spline) use the vertical timber
  // edge (panel edge) as the boundary, still less 10mm clearance.
  // Use basePanels (course 0) for x-positions since they are the same across courses.
  if (isMultiCourse && courses.length > 1) {
    for (let ci = 0; ci < courses.length - 1; ci++) {
      for (let pi = 0; pi < basePanels.length; pi++) {
        const panel = basePanels[pi];

        // Left boundary
        let leftEdge;
        if (pi > 0 && jointHasSpline[pi - 1]) {
          const gapCentre = basePanels[pi - 1].x + basePanels[pi - 1].width + PANEL_GAP / 2;
          leftEdge = gapCentre + SPLINE_WIDTH / 2;
        } else {
          leftEdge = panel.x + BOTTOM_PLATE;
        }

        // Right boundary
        let rightEdge;
        if (pi < basePanels.length - 1 && jointHasSpline[pi]) {
          const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
          rightEdge = gapCentre - SPLINE_WIDTH / 2;
        } else {
          rightEdge = panel.x + panel.width - BOTTOM_PLATE;
        }

        // Split around lintels, openings, opening plates & splines
        const splineLeft = leftEdge + HSPLINE_CLEARANCE;
        const splineRight = rightEdge - HSPLINE_CLEARANCE;
        const segs = buildHSplineSegments(splineLeft, splineRight, lintelPanels, openings);

        for (const [segL, segR] of segs) {
          const hsplineWidth = segR - segL;
          if (hsplineWidth > 0) {
            for (let j = 0; j < 2; j++) {
              cutPieces.push({
                width: hsplineWidth,
                height: SPLINE_WIDTH,
                type: 'hspline',
                label: `H-Spline P${panel.index + 1} C${ci + 1}/${ci + 2}`,
                wallName,
              });
            }
          }
        }
      }
    }
  }

  // ── Deduction end-wall pieces: 2 each side ──
  if (deductionLeft > 0) {
    for (let i = 0; i < 2; i++) {
      cutPieces.push({
        width: deductionLeft,
        height: height,
        type: 'deduction',
        label: 'End Wall (left)',
        wallName,
      });
    }
  }
  if (deductionRight > 0) {
    for (let i = 0; i < 2; i++) {
      cutPieces.push({
        width: deductionRight,
        height: height,
        type: 'deduction',
        label: 'End Wall (right)',
        wallName,
      });
    }
  }

  return { panelSheets, cutPieces };
}

// ─────────────────────────────────────────────────────────────
// Shelf-based 2D bin packing for cut pieces onto sheets
// ─────────────────────────────────────────────────────────────

function shelfPack(pieces, sheetW, sheetH) {
  const sorted = [...pieces].sort((a, b) => {
    const aMax = Math.max(a.width, a.height);
    const bMax = Math.max(b.width, b.height);
    return bMax - aMax;
  });

  const sheets = [];

  for (const piece of sorted) {
    const orients = [{ w: piece.width, h: piece.height }];
    if (piece.width !== piece.height) {
      orients.push({ w: piece.height, h: piece.width });
    }
    orients.sort((a, b) => a.h - b.h);

    let placed = false;

    for (const o of orients) {
      if (o.w > sheetW || o.h > sheetH) continue;

      for (const sheet of sheets) {
        for (const shelf of sheet.shelves) {
          if (shelf.remainingW >= o.w && shelf.h >= o.h) {
            shelf.pieces.push({ ...piece, placedW: o.w, placedH: o.h });
            shelf.remainingW -= o.w;
            placed = true;
            break;
          }
        }
        if (placed) break;

        const usedH = sheet.shelves.reduce((s, sh) => s + sh.h, 0);
        if (usedH + o.h <= sheetH) {
          sheet.shelves.push({
            h: o.h,
            remainingW: sheetW - o.w,
            pieces: [{ ...piece, placedW: o.w, placedH: o.h }],
          });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      const o = orients.find(o => o.w <= sheetW && o.h <= sheetH) || orients[0];
      sheets.push({
        shelves: [{
          h: o.h,
          remainingW: sheetW - o.w,
          pieces: [{ ...piece, placedW: o.w, placedH: o.h }],
        }],
      });
    }
  }

  return sheets;
}

// ─────────────────────────────────────────────────────────────
// Project-level magboard sheet computation
// ─────────────────────────────────────────────────────────────

export function computeProjectMagboardSheets(walls) {
  const allPanelSheets = [];
  const allCutPieces = [];
  const perWall = [];

  for (const wall of walls) {
    const layout = calculateWallLayout(wall);
    const { panelSheets, cutPieces } = extractMagboardPieces(layout, wall.name);
    allPanelSheets.push(...panelSheets);
    allCutPieces.push(...cutPieces);
    perWall.push({
      wallName: wall.name,
      wallId: wall.id,
      panelSheetCount: panelSheets.length,
      cutPieceCount: cutPieces.length,
      lintelPanelCount: cutPieces.filter(p => p.type === 'lintelPanel').length,
      footerCount: cutPieces.filter(p => p.type === 'footer').length,
      splineCount: cutPieces.filter(p => p.type === 'spline').length,
      deductionCount: cutPieces.filter(p => p.type === 'deduction').length,
      hsplineCount: cutPieces.filter(p => p.type === 'hspline').length,
    });
  }

  // Count panel sheets by size (only 2745 and 3050 stocked)
  const sheets2745 = allPanelSheets.filter(s => s.sheetHeight === 2745).length;
  const sheets3050 = allPanelSheets.filter(s => s.sheetHeight === 3050).length;

  // Pack cut pieces onto sheets — try 2745 first, overflow to 3050
  const fitsOnSheet = (p, maxH) =>
    (p.width <= 1200 && p.height <= maxH) || (p.height <= 1200 && p.width <= maxH);

  const fitsMedium = allCutPieces.filter(p => fitsOnSheet(p, 2745));
  const needsLarge = allCutPieces.filter(p => !fitsOnSheet(p, 2745));

  const packedMedium = shelfPack(fitsMedium, 1200, 2745);
  const packedLarge = shelfPack(needsLarge, 1200, 3050);

  const extraSheets2745 = packedMedium.length;
  const extraSheets3050 = packedLarge.length;

  const total2745 = sheets2745 + extraSheets2745;
  const total3050 = sheets3050 + extraSheets3050;
  const totalSheets = total2745 + total3050;

  // Utilization for cut piece sheets
  const sheetArea2745 = 1200 * 2745;
  const sheetArea3050 = 1200 * 3050;
  const cutPieceArea = allCutPieces.reduce((s, p) => s + p.width * p.height, 0);
  const cutSheetTotalArea =
    extraSheets2745 * sheetArea2745 +
    extraSheets3050 * sheetArea3050;
  const cutUtilization = cutSheetTotalArea > 0 ? cutPieceArea / cutSheetTotalArea : 0;

  return {
    // Panel sheets (full sheets, 1:1 with panel faces)
    panelSheetCount: allPanelSheets.length,
    panelSheets2745: sheets2745,
    panelSheets3050: sheets3050,

    // Cut piece sheets (bin-packed)
    cutPieceCount: allCutPieces.length,
    cutSheets2745: extraSheets2745,
    cutSheets3050: extraSheets3050,
    cutUtilization,

    // Totals
    total2745,
    total3050,
    totalSheets,

    // Breakdown
    totalLintelPanels: allCutPieces.filter(p => p.type === 'lintelPanel').length,
    totalFooters: allCutPieces.filter(p => p.type === 'footer').length,
    totalSplines: allCutPieces.filter(p => p.type === 'spline').length,
    totalDeductions: allCutPieces.filter(p => p.type === 'deduction').length,
    totalHsplines: allCutPieces.filter(p => p.type === 'hspline').length,

    perWall,
  };
}
