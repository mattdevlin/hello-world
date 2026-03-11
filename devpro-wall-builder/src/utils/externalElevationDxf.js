/**
 * DXF export for External Elevation View.
 *
 * Ports the geometry logic from WallDrawing.jsx into DXF entities.
 * All coordinates in mm, Y=0 at floor line, positive up.
 */
import { BOTTOM_PLATE, TOP_PLATE, PANEL_GAP } from './constants.js';
import {
  createDrawing, drawWallOutline, drawDimensions,
  drawRunningMeasurement, drawTitle, downloadDxf,
} from './dxfExporter.js';

/**
 * Build the DXF drawing for an external elevation view.
 */
export function buildExternalElevationDxf(layout, wallName) {
  const d = createDrawing();
  const {
    grossLength, height, maxHeight, panels, openings, footers, lintelPanels,
    deductionLeft, deductionRight, isRaked, heightAt, profile,
    courses, isMultiCourse,
  } = layout;

  const useHeight = maxHeight || height;
  const hAt = (x) => heightAt ? heightAt(x) : height;

  // Title
  drawTitle(d, `${wallName || 'Wall'} — External Elevation View${isRaked ? ` (${profile})` : ''}`,
    `${grossLength}mm x ${isRaked ? `${layout.heightLeft}-${layout.heightRight}mm` : `${height}mm`} | ${layout.totalPanels} panels`,
    grossLength);

  // Wall outline
  drawWallOutline(d, layout);

  // ── Corner deductions ──
  if (deductionLeft > 0) {
    d.setActiveLayer('OUTLINE');
    const topY = hAt(0);
    d.drawPolyline([[0, 0], [deductionLeft, 0], [deductionLeft, hAt(deductionLeft)], [0, topY]], true);
    d.setActiveLayer('LABELS');
    d.drawText(deductionLeft / 2 - 20, -40, 30, 0, `-${deductionLeft}`);
  }
  if (deductionRight > 0) {
    d.setActiveLayer('OUTLINE');
    const x = grossLength - deductionRight;
    d.drawPolyline([[x, 0], [grossLength, 0], [grossLength, hAt(grossLength)], [x, hAt(x)]], true);
    d.setActiveLayer('LABELS');
    d.drawText(grossLength - deductionRight / 2 - 20, -40, 30, 0, `-${deductionRight}`);
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

    // Panel outline
    d.setActiveLayer('OUTLINE');
    const pts = [[pLeft, pBot], [pLeft, pTopL]];
    if (panel.peakHeight && panel.peakXLocal != null) {
      const peakX = panel.x + panel.peakXLocal;
      const peakH = Math.max(Math.min(hAt(peakX), cTop), cY);
      pts.push([peakX, peakH]);
    }
    pts.push([pRight, pTopR], [pRight, pBot]);
    d.drawPolyline(pts, true);

    // Panel label
    d.setActiveLayer('LABELS');
    const posIdx = posMap.get(panel.x) ?? 0;
    const label = isMultiCourse ? `P${posIdx + 1}.C${courseIdx + 1}` : `P${posIdx + 1}`;
    const midY = (pBot + Math.min(pTopL, pTopR)) / 2;
    d.drawText(pLeft + panel.width / 2 - 30, midY, 35, 0, label);

    // Width label (course 0 only)
    if (courseIdx === 0) {
      d.drawText(pLeft + panel.width / 2 - 30, -40, 30, 0, `${panel.width}`);
    }
  });

  // Panel divider lines (course 0 only)
  d.setActiveLayer('OUTLINE');
  basePanels.forEach((panel, i) => {
    if (i < basePanels.length - 1) {
      const xR = panel.x + panel.width;
      d.drawLine(xR, 0, xR, hAt(xR));
    }
  });

  // ── Openings ──
  d.setActiveLayer('OPENINGS');
  for (const op of openings) {
    const x1 = op.x;
    const y1 = op.y;
    const x2 = op.x + op.drawWidth;
    const y2 = op.y + op.drawHeight;
    d.drawPolyline([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], true);
    d.drawLine(x1, y1, x2, y2);
    d.drawLine(x2, y1, x1, y2);

    d.setActiveLayer('LABELS');
    d.drawText(op.x + op.drawWidth / 2 - 30, op.y + op.drawHeight / 2 + 20, 40, 0, op.ref);
    d.drawText(op.x + op.drawWidth / 2 - 60, op.y + op.drawHeight / 2 - 30, 28, 0, `${op.width_mm}w x ${op.height_mm}h`);
    d.setActiveLayer('OPENINGS');
  }

  // ── Footers ──
  for (const f of footers) {
    d.setActiveLayer('FRAMING');
    d.drawPolyline([[f.x, 0], [f.x + f.width, 0], [f.x + f.width, f.height], [f.x, f.height]], true);
    d.setActiveLayer('LABELS');
    d.drawText(f.x + f.width / 2 - 40, f.height / 2, 28, 0, `Footer ${f.ref}`);
    d.drawText(f.x + f.width / 2 - 20, -40, 30, 0, `${f.width}`);
  }

  // ── Lintel panels ──
  for (const l of lintelPanels) {
    const hL = l.heightLeft != null ? l.heightLeft : l.height;
    const hR = l.heightRight != null ? l.heightRight : l.height;
    const yBase = l.y;
    const yTopL = l.y + hL;
    const yTopR = l.y + hR;

    d.setActiveLayer('FRAMING');
    const pts = l.peakHeight
      ? [[l.x, yBase], [l.x, yTopL], [l.x + l.peakXLocal, l.y + l.peakHeight], [l.x + l.width, yTopR], [l.x + l.width, yBase]]
      : [[l.x, yBase], [l.x, yTopL], [l.x + l.width, yTopR], [l.x + l.width, yBase]];
    d.drawPolyline(pts, true);

    d.setActiveLayer('LABELS');
    const midH = Math.max(hL, hR, l.peakHeight || 0) / 2;
    d.drawText(l.x + l.width / 2 - 40, l.y + midH / 2, 28, 0, `Lintel ${l.ref}`);
  }

  // ── Course join lines ──
  if (isMultiCourse && courses.length > 1) {
    d.setActiveLayer('DIMENSIONS');
    courses.slice(1).forEach((course) => {
      // Find x-range where wall height >= course.y
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
        d.drawLine(x0, course.y, x1, course.y);
        d.setActiveLayer('LABELS');
        d.drawText(x1 + 30, course.y, 30, 0, `${course.y}`);
        d.setActiveLayer('DIMENSIONS');
      }
    });
  }

  // ── Peak height label (gable) ──
  if (profile === 'gable' && layout.peakPosition != null) {
    d.setActiveLayer('DIMENSIONS');
    const px = layout.peakPosition;
    const ph = layout.peakHeight;
    d.drawText(px - 60, hAt(px) + 60, 35, 0, `Peak ${ph}mm`);
  }

  // Dimensions
  drawDimensions(d, layout);
  drawRunningMeasurement(d, layout);

  return d;
}

/**
 * Export external elevation view as a DXF file download.
 */
export function exportExternalElevationDxf(layout, wallName, projectName) {
  const d = buildExternalElevationDxf(layout, wallName);
  const parts = [projectName, wallName, 'External Elevation'].filter(Boolean);
  const filename = parts.join(' ').replace(/\s+/g, ' ').trim() + '.dxf';
  downloadDxf(d, filename);
}
