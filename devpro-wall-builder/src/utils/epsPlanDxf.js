/**
 * DXF export for EPS Cut Plans.
 *
 * Generates individual EPS block cutting diagrams, laid out in a grid.
 * Each piece is drawn as a dimensioned rectangle at 1:1 mm scale.
 */
import { BOTTOM_PLATE, TOP_PLATE, PANEL_GAP, SPLINE_WIDTH } from './constants.js';
import { createDrawing, downloadDxf } from './dxfExporter.js';

const HALF_SPLINE = SPLINE_WIDTH / 2;
const EPS_INSET = 10;

/**
 * Build cut piece lists from layout (mirrors EpsCutPlans.jsx logic).
 */
function buildCutPieces(layout) {
  const { height, panels, openings, footerPanels, lintelPanels, deductionLeft, deductionRight, grossLength, courses, isMultiCourse, isRaked } = layout;

  const epsTop = TOP_PLATE * 2 + EPS_INSET;
  const epsBottom = height - BOTTOM_PLATE - EPS_INSET;
  const epsHeight = epsBottom - epsTop;

  // Build exclusion zones
  const exclusions = [];
  if (deductionLeft > 0) exclusions.push([deductionLeft, deductionLeft + BOTTOM_PLATE]);
  if (deductionRight > 0) exclusions.push([grossLength - deductionRight - BOTTOM_PLATE, grossLength - deductionRight]);

  for (let i = 0; i < panels.length - 1; i++) {
    const panel = panels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintelPanel && !insideFooterPanel) exclusions.push([gapCentre - HALF_SPLINE, gapCentre + HALF_SPLINE]);
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

  // Panel EPS pieces
  const pieces = [];
  panels.forEach((panel) => {
    const segments = getEpsSegments(panel.x, panel.x + panel.width);
    const panelEpsH = isRaked
      ? Math.round(((panel.heightLeft + panel.heightRight) / 2) - BOTTOM_PLATE - TOP_PLATE * 2 - EPS_INSET * 2)
      : epsHeight;

    if (isMultiCourse && courses.length > 1) {
      segments.forEach((seg, j) => {
        const w = Math.round(seg[1] - seg[0]);
        if (w <= 0) return;
        courses.forEach((course, ci) => {
          const plateAbove = ci === 0 ? TOP_PLATE * 2 : TOP_PLATE;
          const plateBelow = ci === courses.length - 1 ? BOTTOM_PLATE : TOP_PLATE;
          const courseEpsH = course.height - plateAbove - plateBelow - EPS_INSET * 2;
          if (courseEpsH <= 0) return;
          const suffix = segments.length > 1 ? ` (${String.fromCharCode(97 + j)})` : '';
          pieces.push({ label: `P${panel.index + 1}${suffix} C${ci + 1}`, width: w, height: Math.round(courseEpsH) });
        });
      });
    } else {
      segments.forEach((seg, j) => {
        const w = Math.round(seg[1] - seg[0]);
        if (w > 0 && panelEpsH > 0) {
          const label = segments.length > 1 ? `P${panel.index + 1} (${String.fromCharCode(97 + j)})` : `P${panel.index + 1}`;
          pieces.push({ label, width: w, height: panelEpsH });
        }
      });
    }
  });

  // Footer panel EPS pieces
  footerPanels.forEach((f) => {
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
    pieces.push({ label: `Footer Panel ${f.ref}`, width: Math.round(fEpsRight - fEpsLeft), height: Math.round(fEpsBot - fEpsTop) });
  });

  // Spline EPS pieces
  const splineH = height - BOTTOM_PLATE - TOP_PLATE * 2 - 10;
  const splinePieces = [];
  for (let i = 0; i < panels.length - 1; i++) {
    const panel = panels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintelPanel && !insideFooterPanel) {
      splinePieces.push({ label: `Joint P${panels[i].index + 1}/P${panels[i + 1].index + 1}`, width: SPLINE_WIDTH, height: splineH });
    }
  }
  for (const op of openings) {
    if (op.y > 0) {
      splinePieces.push({ label: `${op.ref} Left`, width: SPLINE_WIDTH, height: splineH });
      splinePieces.push({ label: `${op.ref} Right`, width: SPLINE_WIDTH, height: splineH });
    }
  }

  return { pieces, splinePieces };
}

/**
 * Draw a single dimensioned cut piece at position (ox, oy).
 */
function drawCutPiece(d, ox, oy, piece) {
  const { width: w, height: h, label } = piece;
  const dimOffset = 80;

  // Rectangle
  d.setActiveLayer('EPS');
  d.drawPolyline([[ox, oy], [ox + w, oy], [ox + w, oy + h], [ox, oy + h]], true);

  // Label
  d.setActiveLayer('LABELS');
  const textSize = Math.min(40, w / 4, h / 4);
  d.drawText(ox + w / 2 - textSize * label.length / 4, oy + h / 2 + textSize / 3, textSize, 0, label);
  d.drawText(ox + w / 2 - textSize * 3, oy + h / 2 - textSize, textSize * 0.7, 0, `${w} x ${h} mm`);

  // Width dimension (top)
  d.setActiveLayer('DIMENSIONS');
  d.drawLine(ox, oy + h + dimOffset / 2, ox + w, oy + h + dimOffset / 2);
  d.drawLine(ox, oy + h + dimOffset / 2 - 15, ox, oy + h + dimOffset / 2 + 15);
  d.drawLine(ox + w, oy + h + dimOffset / 2 - 15, ox + w, oy + h + dimOffset / 2 + 15);
  d.drawText(ox + w / 2 - 40, oy + h + dimOffset / 2 + 20, 30, 0, `${w}`);

  // Height dimension (right)
  d.drawLine(ox + w + dimOffset / 2, oy, ox + w + dimOffset / 2, oy + h);
  d.drawLine(ox + w + dimOffset / 2 - 15, oy, ox + w + dimOffset / 2 + 15, oy);
  d.drawLine(ox + w + dimOffset / 2 - 15, oy + h, ox + w + dimOffset / 2 + 15, oy + h);
  d.drawText(ox + w + dimOffset / 2 + 20, oy + h / 2, 30, 90, `${h}`);
}

/**
 * Build the DXF drawing for EPS cut plans.
 */
export function buildEpsPlanDxf(layout, wallName) {
  const d = createDrawing();
  const { pieces, splinePieces } = buildCutPieces(layout);

  if (pieces.length === 0 && splinePieces.length === 0) return d;

  const spacing = 200; // gap between pieces
  const maxRowWidth = 8000; // max width before wrapping to next row

  // Title
  d.setActiveLayer('LABELS');
  d.drawText(0, -200, 60, 0, `${wallName || 'Wall'} — EPS Cut Plans`);

  // Layout panel EPS pieces in a grid
  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;

  if (pieces.length > 0) {
    d.setActiveLayer('LABELS');
    d.drawText(0, cursorY - 100, 45, 0, 'Panel EPS — 142mm thick');
    cursorY -= 200;
    cursorX = 0;
    rowMaxH = 0;

    for (const piece of pieces) {
      if (cursorX > 0 && cursorX + piece.width > maxRowWidth) {
        cursorX = 0;
        cursorY -= rowMaxH + spacing + 200;
        rowMaxH = 0;
      }
      drawCutPiece(d, cursorX, cursorY - piece.height, piece);
      rowMaxH = Math.max(rowMaxH, piece.height);
      cursorX += piece.width + spacing;
    }
  }

  // Spline EPS pieces
  if (splinePieces.length > 0) {
    cursorY -= rowMaxH + spacing + 400;
    cursorX = 0;
    rowMaxH = 0;

    d.setActiveLayer('LABELS');
    d.drawText(0, cursorY, 45, 0, 'Spline EPS — 120mm thick');
    cursorY -= 200;

    for (const piece of splinePieces) {
      if (cursorX > 0 && cursorX + piece.width > maxRowWidth) {
        cursorX = 0;
        cursorY -= rowMaxH + spacing + 200;
        rowMaxH = 0;
      }
      drawCutPiece(d, cursorX, cursorY - piece.height, piece);
      rowMaxH = Math.max(rowMaxH, piece.height);
      cursorX += piece.width + spacing;
    }
  }

  return d;
}

/**
 * Export EPS cut plans as a DXF file download.
 */
export function exportEpsPlanDxf(layout, wallName, projectName) {
  const d = buildEpsPlanDxf(layout, wallName);
  const parts = [projectName, wallName, 'EPS Cut Plans'].filter(Boolean);
  const filename = parts.join(' ').replace(/\s+/g, ' ').trim() + '.dxf';
  downloadDxf(d, filename);
}
