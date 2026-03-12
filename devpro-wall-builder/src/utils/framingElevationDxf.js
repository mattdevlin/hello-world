/**
 * DXF export for Framing Elevation Plan.
 *
 * Ports the geometry logic from FramingElevation.jsx into DXF entities.
 * All coordinates in mm, Y=0 at floor line, positive up.
 */
import { BOTTOM_PLATE, TOP_PLATE, PANEL_GAP, SPLINE_WIDTH, HSPLINE_CLEARANCE, WINDOW_OVERHANG, EPS_GAP, buildHSplineSegments } from './constants.js';
import {
  createDrawing, drawWallOutline, drawDimensions,
  drawRunningMeasurement, drawTitle, downloadDxf,
} from './dxfExporter.js';

const HALF_SPLINE = SPLINE_WIDTH / 2;

/**
 * Build the DXF drawing for a framing elevation plan.
 */
export function buildFramingElevationDxf(layout, wallName) {
  const d = createDrawing();
  const {
    grossLength, height, maxHeight, panels, openings, footerPanels, lintelPanels,
    deductionLeft, deductionRight, isRaked, heightAt, courses, isMultiCourse,
  } = layout;

  const useHeight = maxHeight || height;
  const hAt = (x) => heightAt ? heightAt(x) : height;
  const plateLeft = deductionLeft;
  const plateRight = grossLength - deductionRight;

  // Title
  drawTitle(d, `${wallName || 'Wall'} — Framing Elevation`,
    `${grossLength}mm x ${height}mm${isRaked ? ` (max ${useHeight}mm)` : ''} | Bottom plate ${BOTTOM_PLATE}mm, 2x top plate ${TOP_PLATE}mm`,
    grossLength);

  // Wall outline
  drawWallOutline(d, layout);

  // ── Bottom plate line ──
  d.setActiveLayer('FRAMING');
  d.drawLine(plateLeft, BOTTOM_PLATE, plateRight, BOTTOM_PLATE);

  // ── Top plate lines (follow slope) ──
  if (!isRaked) {
    d.drawLine(plateLeft, hAt(plateLeft) - TOP_PLATE, plateRight, hAt(plateRight) - TOP_PLATE);
    d.drawLine(plateLeft, hAt(plateLeft) - TOP_PLATE * 2, plateRight, hAt(plateRight) - TOP_PLATE * 2);
  } else {
    const steps = Math.max(20, Math.round(grossLength / 100));
    const buildPlatePts = (offset) => {
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const x = plateLeft + (i / steps) * (plateRight - plateLeft);
        pts.push([x, hAt(x) - offset]);
      }
      return pts;
    };
    const tp1 = buildPlatePts(TOP_PLATE);
    const tp2 = buildPlatePts(TOP_PLATE * 2);
    for (let i = 0; i < tp1.length - 1; i++) {
      d.drawLine(tp1[i][0], tp1[i][1], tp1[i + 1][0], tp1[i + 1][1]);
    }
    for (let i = 0; i < tp2.length - 1; i++) {
      d.drawLine(tp2[i][0], tp2[i][1], tp2[i + 1][0], tp2[i + 1][1]);
    }
  }

  // ── Corner deductions ──
  if (deductionLeft > 0) {
    d.setActiveLayer('OUTLINE');
    const topY = hAt(0);
    d.drawPolyline([[0, 0], [deductionLeft, 0], [deductionLeft, topY], [0, topY]], true);

    d.setActiveLayer('LABELS');
    d.drawText(deductionLeft / 2 - 20, -40, 30, 0, `-${deductionLeft}`);

    // Vertical plate at deduction edge
    d.setActiveLayer('FRAMING');
    const pTop = hAt(deductionLeft) - TOP_PLATE * 2;
    const pH = pTop - BOTTOM_PLATE;
    if (pH > 0) {
      d.drawPolyline([
        [deductionLeft, BOTTOM_PLATE], [deductionLeft + BOTTOM_PLATE, BOTTOM_PLATE],
        [deductionLeft + BOTTOM_PLATE, pTop], [deductionLeft, pTop],
      ], true);
    }
  }

  if (deductionRight > 0) {
    d.setActiveLayer('OUTLINE');
    const x = grossLength - deductionRight;
    const topY = hAt(grossLength);
    d.drawPolyline([[x, 0], [grossLength, 0], [grossLength, topY], [x, topY]], true);

    d.setActiveLayer('LABELS');
    d.drawText(grossLength - deductionRight / 2 - 20, -40, 30, 0, `-${deductionRight}`);

    // Vertical plate at deduction edge
    d.setActiveLayer('FRAMING');
    const pTop = hAt(x) - TOP_PLATE * 2;
    const pH = pTop - BOTTOM_PLATE;
    if (pH > 0) {
      d.drawPolyline([
        [x - BOTTOM_PLATE, BOTTOM_PLATE], [x, BOTTOM_PLATE],
        [x, pTop], [x - BOTTOM_PLATE, pTop],
      ], true);
    }
  }

  // ── Panel edges ──
  const basePanels = panels.filter(p => (p.course ?? 0) === 0);

  basePanels.forEach((panel) => {
    const leftX = panel.x;
    const rightX = panel.x + panel.width;

    d.setActiveLayer('FRAMING');

    // Vertical edge helper: compute segments excluding lintel panel/footer panel zones
    const getExclusions = (xEdge) => {
      const zones = [];
      for (const l of lintelPanels) {
        if (l.x < xEdge && xEdge < l.x + l.width) {
          const hL = l.heightLeft != null ? l.heightLeft : l.height;
          const hR = l.heightRight != null ? l.heightRight : l.height;
          const t = l.width > 0 ? (xEdge - l.x) / l.width : 0;
          const hAtX = hL + (hR - hL) * t;
          zones.push([l.y, l.y + hAtX]); // DXF Y
        }
      }
      for (const f of footerPanels) {
        if (f.x < xEdge && xEdge < f.x + f.width) {
          zones.push([0, f.height]);
        }
      }
      zones.sort((a, b) => a[0] - b[0]);
      return zones;
    };

    const vertSegments = (xEdge) => {
      const excl = getExclusions(xEdge);
      const topY = hAt(xEdge);
      const segs = [];
      let cursor = 0;
      for (const [eBot, eTop] of excl) {
        if (cursor < eBot) segs.push([cursor, eBot]);
        cursor = Math.max(cursor, eTop);
      }
      if (cursor < topY) segs.push([cursor, topY]);
      return segs;
    };

    // Top edge
    if (panel.peakHeight) {
      const peakX = panel.x + panel.peakXLocal;
      d.drawLine(leftX, hAt(leftX), peakX, hAt(peakX));
      d.drawLine(peakX, hAt(peakX), rightX, hAt(rightX));
    } else {
      d.drawLine(leftX, hAt(leftX), rightX, hAt(rightX));
    }
    // Bottom edge
    d.drawLine(leftX, 0, rightX, 0);
    // Left vertical segments
    for (const [y1, y2] of vertSegments(leftX)) d.drawLine(leftX, y1, leftX, y2);
    // Right vertical segments
    for (const [y1, y2] of vertSegments(rightX)) d.drawLine(rightX, y1, rightX, y2);
  });

  // ── Panel labels ──
  d.setActiveLayer('LABELS');
  const posMap = new Map(basePanels.map((p, idx) => [p.x, idx]));
  panels.forEach((panel) => {
    const courseIdx = panel.course ?? 0;
    const posIdx = posMap.get(panel.x) ?? 0;
    const label = isMultiCourse ? `P${posIdx + 1}.C${courseIdx + 1}` : `P${posIdx + 1}`;
    const cx = panel.x + panel.width / 2;
    const midY = hAt(cx) / 2;
    d.drawText(cx - 30, midY, 35, 0, label);
  });

  // Panel base width labels
  basePanels.forEach((panel) => {
    d.drawText(panel.x + panel.width / 2 - 30, -40, 30, 0, `${panel.width}`);
  });

  // ── Vertical plates at panel outer edges (45mm) ──
  d.setActiveLayer('FRAMING');
  const plates = [];
  for (const panel of basePanels) {
    if (panel.type === 'end') plates.push(panel.x + panel.width - BOTTOM_PLATE);
    if (deductionRight === 0 && Math.abs(panel.x + panel.width - grossLength) < 1) plates.push(grossLength - BOTTOM_PLATE);
    if (deductionLeft === 0 && Math.abs(panel.x) < 1) plates.push(0);
  }
  const uniquePlates = [...new Set(plates)];
  for (const plateX of uniquePlates) {
    const pTop = hAt(plateX) - TOP_PLATE * 2;
    const pBot = BOTTOM_PLATE;
    if (pTop > pBot) {
      d.drawPolyline([
        [plateX, pBot], [plateX + BOTTOM_PLATE, pBot],
        [plateX + BOTTOM_PLATE, pTop], [plateX, pTop],
      ], true);
    }
  }

  // ── Panel joint splines (146mm centred on 5mm gap) ──
  for (let i = 0; i < basePanels.length - 1; i++) {
    const panel = basePanels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (insideLintelPanel || insideFooterPanel) continue;

    const spXL = gapCentre - HALF_SPLINE;
    const spXR = gapCentre + HALF_SPLINE;
    const spBot = BOTTOM_PLATE;
    const spTopL = hAt(spXL) - TOP_PLATE * 2;
    const spTopR = hAt(spXR) - TOP_PLATE * 2;

    if (spTopL <= spBot && spTopR <= spBot) continue;

    if (!isRaked || Math.abs(spTopL - spTopR) < 0.5) {
      const spTop = Math.max(spTopL, spTopR);
      if (spTop > spBot) {
        d.drawPolyline([[spXL, spBot], [spXR, spBot], [spXR, spTop], [spXL, spTop]], true);
      }
    } else {
      const pts = [[spXL, spBot], [spXR, spBot]];
      if (spTopR > spBot) pts.push([spXR, spTopR]);
      if (spTopL > spBot) pts.push([spXL, spTopL]);
      if (pts.length >= 3) d.drawPolyline(pts, true);
    }
  }

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
    d.drawText(op.x + op.drawWidth / 2 - 30, op.y + op.drawHeight / 2, 35, 0, op.ref);
    d.drawText(op.x + op.drawWidth / 2 - 60, op.y + op.drawHeight / 2 - 50, 28, 0, `${op.width_mm}w x ${op.height_mm}h`);
    d.setActiveLayer('OPENINGS');
  }

  // ── Plates around openings ──
  d.setActiveLayer('FRAMING');
  for (const op of openings) {
    const hasSill = op.y > 0;
    const opBot = op.y;
    const opTop = op.y + op.drawHeight;

    // Sill plate
    if (hasSill) {
      d.drawPolyline([
        [op.x - BOTTOM_PLATE, opBot - BOTTOM_PLATE],
        [op.x + op.drawWidth + BOTTOM_PLATE, opBot - BOTTOM_PLATE],
        [op.x + op.drawWidth + BOTTOM_PLATE, opBot],
        [op.x - BOTTOM_PLATE, opBot],
      ], true);
    }

    // Left vertical plate
    d.drawPolyline([
      [op.x - BOTTOM_PLATE, opBot], [op.x, opBot],
      [op.x, opTop], [op.x - BOTTOM_PLATE, opTop],
    ], true);

    // Right vertical plate
    d.drawPolyline([
      [op.x + op.drawWidth, opBot], [op.x + op.drawWidth + BOTTOM_PLATE, opBot],
      [op.x + op.drawWidth + BOTTOM_PLATE, opTop], [op.x + op.drawWidth, opTop],
    ], true);

    // Opening splines
    const spBot = BOTTOM_PLATE;
    // Left spline
    const lSpXL = op.x - BOTTOM_PLATE - SPLINE_WIDTH;
    const lSpXR = op.x - BOTTOM_PLATE;
    const lSpTopL = hAt(lSpXL) - TOP_PLATE * 2;
    const lSpTopR = hAt(lSpXR) - TOP_PLATE * 2;
    if (!isRaked || Math.abs(lSpTopL - lSpTopR) < 0.5) {
      const spTop = Math.max(lSpTopL, lSpTopR);
      if (spTop > spBot) d.drawPolyline([[lSpXL, spBot], [lSpXR, spBot], [lSpXR, spTop], [lSpXL, spTop]], true);
    } else {
      const pts = [[lSpXL, spBot], [lSpXR, spBot]];
      if (lSpTopR > spBot) pts.push([lSpXR, lSpTopR]);
      if (lSpTopL > spBot) pts.push([lSpXL, lSpTopL]);
      if (pts.length >= 3) d.drawPolyline(pts, true);
    }

    // Right spline
    const rSpXL = op.x + op.drawWidth + BOTTOM_PLATE;
    const rSpXR = rSpXL + SPLINE_WIDTH;
    const rSpTopL = hAt(rSpXL) - TOP_PLATE * 2;
    const rSpTopR = hAt(rSpXR) - TOP_PLATE * 2;
    if (!isRaked || Math.abs(rSpTopL - rSpTopR) < 0.5) {
      const spTop = Math.max(rSpTopL, rSpTopR);
      if (spTop > spBot) d.drawPolyline([[rSpXL, spBot], [rSpXR, spBot], [rSpXR, spTop], [rSpXL, spTop]], true);
    } else {
      const pts = [[rSpXL, spBot], [rSpXR, spBot]];
      if (rSpTopR > spBot) pts.push([rSpXR, rSpTopR]);
      if (rSpTopL > spBot) pts.push([rSpXL, rSpTopL]);
      if (pts.length >= 3) d.drawPolyline(pts, true);
    }
  }

  // ── Footer panels ──
  for (const f of footerPanels) {
    d.setActiveLayer('FRAMING');
    d.drawPolyline([[f.x, 0], [f.x + f.width, 0], [f.x + f.width, f.height], [f.x, f.height]], true);
    d.setActiveLayer('LABELS');
    d.drawText(f.x + f.width / 2 - 40, f.height / 2, 28, 0, `Footer Panel ${f.ref}`);
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

    // Timber lintel
    const op = openings.find(o => o.ref === l.ref);
    if (op) {
      const lintelH = l.lintelHeight || 200;
      const lintelLeft = op.x - BOTTOM_PLATE - SPLINE_WIDTH + EPS_GAP;
      const lintelRight = op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH - EPS_GAP;
      const lintelBot = l.y;
      const lintelTop = l.y + lintelH;
      d.drawPolyline([
        [lintelLeft, lintelBot], [lintelRight, lintelBot],
        [lintelRight, lintelTop], [lintelLeft, lintelTop],
      ], true);
    }

    d.setActiveLayer('LABELS');
    const midH = Math.max(hL, hR, l.peakHeight || 0) / 2;
    d.drawText(l.x + l.width / 2 - 40, l.y + midH / 2, 28, 0, `Lintel Panel ${l.ref}`);
  }

  // ── Horizontal splines at course joints ──
  if (isMultiCourse && courses.length > 1) {
    d.setActiveLayer('FRAMING');
    const jointHasSpline = [];
    for (let i = 0; i < basePanels.length - 1; i++) {
      const gapCentre = basePanels[i].x + basePanels[i].width + PANEL_GAP / 2;
      const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
      const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
      jointHasSpline.push(!insideLintelPanel && !insideFooterPanel);
    }

    courses.slice(1).forEach((course) => {
      const joinY = course.y; // DXF Y
      const spBotY = joinY - HALF_SPLINE;
      const spTopY = joinY + HALF_SPLINE;

      basePanels.forEach((panel, pi) => {
        let leftEdge;
        if (pi > 0 && jointHasSpline[pi - 1]) {
          const gc = basePanels[pi - 1].x + basePanels[pi - 1].width + PANEL_GAP / 2;
          leftEdge = gc + HALF_SPLINE;
        } else {
          leftEdge = panel.x + BOTTOM_PLATE;
        }
        let rightEdge;
        if (pi < basePanels.length - 1 && jointHasSpline[pi]) {
          const gc = panel.x + panel.width + PANEL_GAP / 2;
          rightEdge = gc - HALF_SPLINE;
        } else {
          rightEdge = panel.x + panel.width - BOTTOM_PLATE;
        }

        const splineLeft = leftEdge + HSPLINE_CLEARANCE;
        const splineRight = rightEdge - HSPLINE_CLEARANCE;
        const segs = buildHSplineSegments(splineLeft, splineRight, lintelPanels, openings);

        segs.forEach(([segL, segR]) => {
          if (segR <= segL) return;
          d.drawPolyline([
            [segL, spBotY], [segR, spBotY],
            [segR, spTopY], [segL, spTopY],
          ], true);
        });
      });
    });
  }

  // Dimensions
  drawDimensions(d, layout);
  drawRunningMeasurement(d, layout);

  return d;
}

/**
 * Export framing elevation plan as a DXF file download.
 */
export function exportFramingElevationDxf(layout, wallName, projectName) {
  const d = buildFramingElevationDxf(layout, wallName);
  const parts = [projectName, wallName, 'Framing Elevation'].filter(Boolean);
  const filename = parts.join(' ').replace(/\s+/g, ' ').trim() + '.dxf';
  downloadDxf(d, filename);
}
