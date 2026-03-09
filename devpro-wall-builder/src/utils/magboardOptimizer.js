/**
 * Magboard Sheet Optimizer
 *
 * Magboard sheets: 1200 × 2700mm or 1200 × 3000mm (10mm thick).
 *
 * Each panel face requires one full sheet (2 per panel, front + back).
 * Additional pieces (lintels, footers, splines, deductions) are smaller
 * and can share sheets via 2D bin packing.
 */

import { BOTTOM_PLATE, TOP_PLATE, PANEL_GAP, PANEL_WIDTH } from './constants.js';
import { calculateWallLayout } from './calculator.js';

export const MAGBOARD_SHEETS = {
  small: { width: 1200, height: 2700 },
  large: { width: 1200, height: 3000 },
};

const SPLINE_WIDTH = 146;

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
    height, panels, openings, lintels, footers,
    deductionLeft, deductionRight,
    courses, isMultiCourse,
  } = layout;

  // ── Panel face sheets ──
  // Each panel needs 2 sheets (front + back) per course
  if (isMultiCourse && courses.length > 1) {
    for (const panel of panels) {
      for (const course of courses) {
        // 2 sheets per panel per course
        panelSheets.push({
          sheetHeight: course.sheetHeight,
          label: `P${panel.index + 1} C${courses.indexOf(course) + 1}`,
          wallName,
        });
        panelSheets.push({
          sheetHeight: course.sheetHeight,
          label: `P${panel.index + 1} C${courses.indexOf(course) + 1}`,
          wallName,
        });
      }
    }
  } else {
    const sheetH = courses?.[0]?.sheetHeight || height;
    for (const panel of panels) {
      // 2 sheets per panel (front + back)
      panelSheets.push({ sheetHeight: sheetH, label: `P${panel.index + 1}`, wallName });
      panelSheets.push({ sheetHeight: sheetH, label: `P${panel.index + 1}`, wallName });
    }
  }

  // ── Lintels: 2 magboard pieces each ──
  for (const lintel of lintels) {
    for (let i = 0; i < 2; i++) {
      cutPieces.push({
        width: lintel.width,
        height: lintel.height,
        type: 'lintel',
        label: `${lintel.ref} Lintel`,
        wallName,
      });
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

  // ── Splines: 2 magboard pieces each ──
  const splineH = height - BOTTOM_PLATE - TOP_PLATE * 2 - 10;
  if (splineH > 0) {
    // Joint splines
    for (let i = 0; i < panels.length - 1; i++) {
      const panel = panels[i];
      const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
      const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
      const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
      if (!insideLintel && !insideFooter) {
        for (let j = 0; j < 2; j++) {
          cutPieces.push({
            width: SPLINE_WIDTH,
            height: splineH,
            type: 'spline',
            label: `Spline P${panels[i].index + 1}/P${panels[i + 1].index + 1}`,
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
      lintelCount: cutPieces.filter(p => p.type === 'lintel').length,
      footerCount: cutPieces.filter(p => p.type === 'footer').length,
      splineCount: cutPieces.filter(p => p.type === 'spline').length,
      deductionCount: cutPieces.filter(p => p.type === 'deduction').length,
    });
  }

  // Count panel sheets by size
  const sheets2700 = allPanelSheets.filter(s => s.sheetHeight === 2700).length;
  const sheets3000 = allPanelSheets.filter(s => s.sheetHeight === 3000).length;

  // Pack cut pieces onto sheets — try 2700 first, overflow to 3000
  // Separate pieces by whether they fit on 2700mm sheets
  const fitsSmall = allCutPieces.filter(p =>
    (p.width <= 1200 && p.height <= 2700) || (p.height <= 1200 && p.width <= 2700)
  );
  const needsLarge = allCutPieces.filter(p =>
    !(p.width <= 1200 && p.height <= 2700) && !(p.height <= 1200 && p.width <= 2700)
  );

  // Pack small-fitting pieces onto 2700 sheets
  const packedSmall = shelfPack(fitsSmall, 1200, 2700);
  // Pack large pieces onto 3000 sheets
  const packedLarge = shelfPack(needsLarge, 1200, 3000);

  const extraSheets2700 = packedSmall.length;
  const extraSheets3000 = packedLarge.length;

  const total2700 = sheets2700 + extraSheets2700;
  const total3000 = sheets3000 + extraSheets3000;
  const totalSheets = total2700 + total3000;

  // Utilization for cut piece sheets
  const sheetArea2700 = 1200 * 2700;
  const sheetArea3000 = 1200 * 3000;
  const cutPieceArea = allCutPieces.reduce((s, p) => s + p.width * p.height, 0);
  const cutSheetTotalArea = extraSheets2700 * sheetArea2700 + extraSheets3000 * sheetArea3000;
  const cutUtilization = cutSheetTotalArea > 0 ? cutPieceArea / cutSheetTotalArea : 0;

  return {
    // Panel sheets (full sheets, 1:1 with panel faces)
    panelSheetCount: allPanelSheets.length,
    panelSheets2700: sheets2700,
    panelSheets3000: sheets3000,

    // Cut piece sheets (bin-packed)
    cutPieceCount: allCutPieces.length,
    cutSheets2700: extraSheets2700,
    cutSheets3000: extraSheets3000,
    cutUtilization,

    // Totals
    total2700,
    total3000,
    totalSheets,

    // Breakdown
    totalLintels: allCutPieces.filter(p => p.type === 'lintel').length,
    totalFooters: allCutPieces.filter(p => p.type === 'footer').length,
    totalSplines: allCutPieces.filter(p => p.type === 'spline').length,
    totalDeductions: allCutPieces.filter(p => p.type === 'deduction').length,

    perWall,
  };
}
