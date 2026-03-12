/**
 * Combined DXF export — renders all project walls side-by-side in one file.
 *
 * Replicates the drawing logic from externalElevationDxf.js but applies an
 * xOffset to each wall so they tile left-to-right.
 */
import Drawing from 'dxf-writer';
import { calculateWallLayout } from './calculator.js';
import { wallOutlinePoints, downloadDxf } from './dxfExporter.js';

const WALL_SPACING = 1000; // mm gap between walls

// Layer prefix for combined exports
const P = 'DP-';

// DXF layer definitions with DP- prefix
const LAYERS = {
  [`${P}OUTLINE`]:    { color: Drawing.ACI.WHITE,   line: 'CONTINUOUS' },
  [`${P}OPENINGS`]:   { color: Drawing.ACI.RED,     line: 'CONTINUOUS' },
  [`${P}FRAMING`]:    { color: Drawing.ACI.BLUE,    line: 'DASHED' },
  [`${P}DIMENSIONS`]: { color: Drawing.ACI.YELLOW,  line: 'CONTINUOUS' },
  [`${P}LABELS`]:     { color: Drawing.ACI.MAGENTA, line: 'CONTINUOUS' },
};

function createCombinedDrawing() {
  const d = new Drawing();
  d.setUnits('Millimeters');
  d.addLineType('DASHED', '_ _ _ ', [5, -5]);
  for (const [name, def] of Object.entries(LAYERS)) {
    d.addLayer(name, def.color, def.line);
  }
  return d;
}

/**
 * Draw a single wall's external elevation at the given xOffset.
 */
function drawWallElevationAt(d, layout, wallName, xOffset) {
  const {
    grossLength, height, maxHeight, panels, openings, footerPanels, lintelPanels,
    deductionLeft, deductionRight, isRaked, heightAt, profile,
    courses, isMultiCourse,
  } = layout;

  const hAt = (x) => heightAt ? heightAt(x) : height;
  const ox = xOffset; // shorthand

  // ── Wall outline ──
  d.setActiveLayer(`${P}OUTLINE`);
  const pts = wallOutlinePoints(layout);
  d.drawPolyline(pts.map(([x, y]) => [x + ox, y]), true);

  // ── Wall name label below the wall ──
  d.setActiveLayer(`${P}LABELS`);
  d.drawText(ox + grossLength / 2 - 100, -300, 60, 0, wallName || 'Wall');

  // ── Corner deductions ──
  if (deductionLeft > 0) {
    d.setActiveLayer(`${P}OUTLINE`);
    d.drawPolyline([
      [ox, 0], [ox + deductionLeft, 0],
      [ox + deductionLeft, hAt(deductionLeft)], [ox, hAt(0)],
    ], true);
    d.setActiveLayer(`${P}LABELS`);
    d.drawText(ox + deductionLeft / 2 - 20, -40, 30, 0, `-${deductionLeft}`);
  }
  if (deductionRight > 0) {
    d.setActiveLayer(`${P}OUTLINE`);
    const x = grossLength - deductionRight;
    d.drawPolyline([
      [ox + x, 0], [ox + grossLength, 0],
      [ox + grossLength, hAt(grossLength)], [ox + x, hAt(x)],
    ], true);
    d.setActiveLayer(`${P}LABELS`);
    d.drawText(ox + grossLength - deductionRight / 2 - 20, -40, 30, 0, `-${deductionRight}`);
  }

  // ── Panels ──
  const basePanels = panels.filter(p => (p.course ?? 0) === 0);
  const posMap = new Map(basePanels.map((p, idx) => [p.x, idx]));

  panels.forEach((panel) => {
    const pLeft = panel.x;
    const pRight = panel.x + panel.width;
    const courseIdx = panel.course ?? 0;
    const course = courses?.[courseIdx];
    const cY = course?.y ?? 0;
    const cTop = cY + (course?.height ?? height);

    const pBot = cY;
    const pTopL = Math.max(Math.min(hAt(pLeft), cTop), cY);
    const pTopR = Math.max(Math.min(hAt(pRight), cTop), cY);

    d.setActiveLayer(`${P}OUTLINE`);
    const panelPts = [[pLeft + ox, pBot], [pLeft + ox, pTopL]];
    if (panel.peakHeight && panel.peakXLocal != null) {
      const peakX = panel.x + panel.peakXLocal;
      const peakH = Math.max(Math.min(hAt(peakX), cTop), cY);
      panelPts.push([peakX + ox, peakH]);
    }
    panelPts.push([pRight + ox, pTopR], [pRight + ox, pBot]);
    d.drawPolyline(panelPts, true);

    d.setActiveLayer(`${P}LABELS`);
    const posIdx = posMap.get(panel.x) ?? 0;
    const label = isMultiCourse ? `P${posIdx + 1}.C${courseIdx + 1}` : `P${posIdx + 1}`;
    const midY = (pBot + Math.min(pTopL, pTopR)) / 2;
    d.drawText(pLeft + ox + panel.width / 2 - 30, midY, 35, 0, label);

    if (courseIdx === 0) {
      d.drawText(pLeft + ox + panel.width / 2 - 30, -40, 30, 0, `${panel.width}`);
    }
  });

  // Panel divider lines
  d.setActiveLayer(`${P}OUTLINE`);
  basePanels.forEach((panel, i) => {
    if (i < basePanels.length - 1) {
      const xR = panel.x + panel.width;
      d.drawLine(xR + ox, 0, xR + ox, hAt(xR));
    }
  });

  // ── Openings ──
  d.setActiveLayer(`${P}OPENINGS`);
  for (const op of openings) {
    const x1 = op.x + ox;
    const y1 = op.y;
    const x2 = op.x + op.drawWidth + ox;
    const y2 = op.y + op.drawHeight;
    d.drawPolyline([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], true);
    d.drawLine(x1, y1, x2, y2);
    d.drawLine(x2, y1, x1, y2);

    d.setActiveLayer(`${P}LABELS`);
    d.drawText(op.x + ox + op.drawWidth / 2 - 30, op.y + op.drawHeight / 2 + 20, 40, 0, op.ref);
    d.drawText(op.x + ox + op.drawWidth / 2 - 60, op.y + op.drawHeight / 2 - 30, 28, 0, `${op.width_mm}w x ${op.height_mm}h`);
    d.setActiveLayer(`${P}OPENINGS`);
  }

  // ── Footer panels ──
  for (const f of footerPanels) {
    d.setActiveLayer(`${P}FRAMING`);
    d.drawPolyline([
      [f.x + ox, 0], [f.x + f.width + ox, 0],
      [f.x + f.width + ox, f.height], [f.x + ox, f.height],
    ], true);
    d.setActiveLayer(`${P}LABELS`);
    d.drawText(f.x + ox + f.width / 2 - 40, f.height / 2, 28, 0, `Footer Panel ${f.ref}`);
    d.drawText(f.x + ox + f.width / 2 - 20, -40, 30, 0, `${f.width}`);
  }

  // ── Lintel panels ──
  for (const l of lintelPanels) {
    const hL = l.heightLeft != null ? l.heightLeft : l.height;
    const hR = l.heightRight != null ? l.heightRight : l.height;
    const yBase = l.y;
    const yTopL = l.y + hL;
    const yTopR = l.y + hR;

    d.setActiveLayer(`${P}FRAMING`);
    const lPts = l.peakHeight
      ? [[l.x + ox, yBase], [l.x + ox, yTopL], [l.x + l.peakXLocal + ox, l.y + l.peakHeight], [l.x + l.width + ox, yTopR], [l.x + l.width + ox, yBase]]
      : [[l.x + ox, yBase], [l.x + ox, yTopL], [l.x + l.width + ox, yTopR], [l.x + l.width + ox, yBase]];
    d.drawPolyline(lPts, true);

    d.setActiveLayer(`${P}LABELS`);
    const midH = Math.max(hL, hR, l.peakHeight || 0) / 2;
    d.drawText(l.x + ox + l.width / 2 - 40, l.y + midH / 2, 28, 0, `Lintel Panel ${l.ref}`);
  }

  // ── Course join lines ──
  if (isMultiCourse && courses.length > 1) {
    d.setActiveLayer(`${P}DIMENSIONS`);
    courses.slice(1).forEach((course) => {
      const hAtX = heightAt || (() => height);
      const breakpoints = [0, grossLength];
      if (layout.peakPosition != null && layout.peakPosition > 0 && layout.peakPosition < grossLength) {
        breakpoints.push(layout.peakPosition);
      }
      breakpoints.sort((a, b) => a - b);

      let x0 = null, x1 = null;
      for (let k = 0; k < breakpoints.length - 1; k++) {
        const bL = breakpoints[k], bR = breakpoints[k + 1];
        const hL = hAtX(bL), hR = hAtX(bR);
        if (hL < course.y && hR < course.y) continue;
        let segL = bL, segR = bR;
        if (hL < course.y) segL = bL + (course.y - hL) / (hR - hL) * (bR - bL);
        if (hR < course.y) segR = bL + (course.y - hL) / (hR - hL) * (bR - bL);
        if (x0 === null || segL < x0) x0 = segL;
        if (x1 === null || segR > x1) x1 = segR;
      }
      if (x0 !== null) {
        d.drawLine(x0 + ox, course.y, x1 + ox, course.y);
        d.setActiveLayer(`${P}LABELS`);
        d.drawText(x1 + ox + 30, course.y, 30, 0, `${course.y}`);
    d.setActiveLayer(`${P}DIMENSIONS`);
      }
    });
  }

  // ── Peak height label (gable) ──
  if (profile === 'gable' && layout.peakPosition != null) {
    d.setActiveLayer(`${P}DIMENSIONS`);
    const px = layout.peakPosition;
    d.drawText(px + ox - 60, hAt(px) + 60, 35, 0, `Peak ${layout.peakHeight}mm`);
  }

  // ── Inline dimensions (per-wall) ──
  d.setActiveLayer(`${P}DIMENSIONS`);
  const dimOffset = 150;

  // Bottom width
  const yDim = -dimOffset;
  d.drawLine(ox, yDim, ox + grossLength, yDim);
  d.drawLine(ox, yDim - 30, ox, yDim + 30);
  d.drawLine(ox + grossLength, yDim - 30, ox + grossLength, yDim + 30);
  d.drawText(ox + grossLength / 2 - 100, yDim - 80, 50, 0, `${grossLength} mm`);

  // Left height
  const leftH = layout.heightLeft || height;
  const xDim = ox - dimOffset;
  d.drawLine(xDim, 0, xDim, leftH);
  d.drawLine(xDim - 30, 0, xDim + 30, 0);
  d.drawLine(xDim - 30, leftH, xDim + 30, leftH);
  d.drawText(xDim - 80, leftH / 2, 50, 90, `${leftH} mm`);

  // Right height (raked/gable)
  if (isRaked) {
    const rightH = layout.heightRight || height;
    const rxDim = ox + grossLength + dimOffset;
    d.drawLine(rxDim, 0, rxDim, rightH);
    d.drawLine(rxDim - 30, 0, rxDim + 30, 0);
    d.drawLine(rxDim - 30, rightH, rxDim + 30, rightH);
    d.drawText(rxDim + 40, rightH / 2, 50, 90, `${rightH} mm`);
  }

  // Running measurement ticks
  const points = new Set([0, grossLength]);
  if (deductionLeft > 0) points.add(deductionLeft);
  if (deductionRight > 0) points.add(grossLength - deductionRight);
  basePanels.forEach(p => points.add(Math.round(p.x + p.width)));
  footerPanels.forEach(f => points.add(Math.round(f.x + f.width)));

  const tickY = -60;
  const sorted = [...points].sort((a, b) => a - b);
  for (const pt of sorted) {
    d.drawLine(pt + ox, tickY - 20, pt + ox, tickY + 20);
    d.drawText(pt + ox - 30, tickY - 60, 30, 0, `${pt}`);
  }
}

/**
 * Export combined elevation DXF for all walls in a project.
 */
export function exportCombinedElevationDxf(walls, projectName) {
  const d = createCombinedDrawing();

  let xOffset = 0;
  let totalWidth = 0;

  for (const wall of walls) {
    const layout = calculateWallLayout(wall);
    drawWallElevationAt(d, layout, wall.name, xOffset);
    xOffset += layout.grossLength + WALL_SPACING;
    totalWidth = xOffset - WALL_SPACING;
  }

  // Overall title at top-center
  d.setActiveLayer(`${P}LABELS`);
  d.drawText(totalWidth / 2 - 300, 400, 70, 0, `${projectName} — Combined External Elevation`);

  const filename = `${projectName} Combined External Elevation.dxf`;
  downloadDxf(d, filename);
}
