/**
 * DXF export for External (EPS) Elevation Plan.
 *
 * Ports the geometry logic from EpsElevation.jsx into DXF entities.
 * All coordinates in mm, Y=0 at floor line, positive up.
 */
import { BOTTOM_PLATE, TOP_PLATE, PANEL_GAP, SPLINE_WIDTH, HSPLINE_CLEARANCE, buildHSplineSegments } from './constants.js';
import {
  createDrawing, drawWallOutline, drawOpenings, drawOpeningLabels,
  drawDimensions, drawRunningMeasurement, drawTitle, downloadDxf,
} from './dxfExporter.js';

const HALF_SPLINE = SPLINE_WIDTH / 2;
const EPS_INSET = 10;
const MAGBOARD = 10;

/**
 * Build the DXF drawing for an EPS elevation plan.
 * @param {object} layout - Wall layout from calculateWallLayout()
 * @param {string} wallName - Wall name for title
 * @returns {Drawing} dxf-writer Drawing instance
 */
export function buildEpsElevationDxf(layout, wallName) {
  const d = createDrawing();
  const {
    grossLength, height, maxHeight, panels, openings, footers, lintelPanels,
    deductionLeft, deductionRight, isRaked, heightAt, courses, isMultiCourse,
  } = layout;

  const useHeight = maxHeight || height;
  // In DXF, Y=0 is floor. heightAt returns height from floor at position x.
  // SVG had yTopAt(x) = useHeight - heightAt(x), yBottom = useHeight.
  // DXF: floor = 0, top at x = heightAt(x).

  const hAt = (x) => heightAt ? heightAt(x) : height;

  // Title
  const titleHeight = hAt(0);
  drawTitle(d, `${wallName || 'Wall'} — EPS Elevation`,
    `${grossLength}mm x ${height}mm${isRaked ? ` (max ${useHeight}mm)` : ''} | EPS inset ${EPS_INSET}mm`,
    grossLength);

  // Wall outline
  drawWallOutline(d, layout);

  // Corner deductions
  d.setActiveLayer('OUTLINE');
  if (deductionLeft > 0) {
    const topY = hAt(0);
    d.drawPolyline([[0, 0], [deductionLeft, 0], [deductionLeft, topY], [0, topY]], true);
  }
  if (deductionRight > 0) {
    const x = grossLength - deductionRight;
    const topY = hAt(grossLength);
    d.drawPolyline([[x, 0], [grossLength, 0], [grossLength, topY], [x, topY]], true);
  }

  // ── Build exclusion zones (same as EpsElevation.jsx) ──
  const basePanels = panels.filter(p => (p.course ?? 0) === 0);
  const exclusions = [];

  if (deductionLeft > 0) exclusions.push([deductionLeft, deductionLeft + BOTTOM_PLATE]);
  if (deductionRight > 0) exclusions.push([grossLength - deductionRight - BOTTOM_PLATE, grossLength - deductionRight]);

  for (let i = 0; i < basePanels.length - 1; i++) {
    const panel = basePanels[i];
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

  for (const p of basePanels) {
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

  // ── Draw panel outlines and EPS cores ──
  basePanels.forEach((panel) => {
    const leftX = panel.x;
    const rightX = panel.x + panel.width;

    // Panel outline
    d.setActiveLayer('OUTLINE');
    if (panel.peakHeight && panel.peakXLocal != null) {
      const peakX = panel.x + panel.peakXLocal;
      d.drawLine(leftX, hAt(leftX), peakX, hAt(peakX));
      d.drawLine(peakX, hAt(peakX), rightX, hAt(rightX));
    } else {
      d.drawLine(leftX, hAt(leftX), rightX, hAt(rightX));
    }
    d.drawLine(leftX, 0, rightX, 0);
    d.drawLine(leftX, 0, leftX, hAt(leftX));
    d.drawLine(rightX, 0, rightX, hAt(rightX));

    // EPS core segments
    const segments = getEpsSegments(leftX, rightX);
    d.setActiveLayer('EPS');

    segments.forEach(([segL, segR]) => {
      const w = segR - segL;
      if (w <= 0) return;

      if (isMultiCourse && courses.length > 1) {
        courses.forEach((course, ci) => {
          const isBottomCourse = ci === 0;
          const isTopCourse = ci === courses.length - 1;
          const plateBelow = isBottomCourse ? BOTTOM_PLATE : (HALF_SPLINE - EPS_INSET);
          const plateAbove = isTopCourse ? TOP_PLATE * 2 : (HALF_SPLINE - EPS_INSET);
          const cEpsBot = course.y + plateBelow + EPS_INSET; // DXF Y from floor

          if (isRaked) {
            const courseTopDxf = isTopCourse
              ? Infinity
              : course.y + course.height - plateAbove - EPS_INSET;
            const epsTopAtX = (x) => {
              const wallTop = hAt(x) - TOP_PLATE * 2 - EPS_INSET;
              return isTopCourse ? wallTop : Math.min(courseTopDxf, wallTop);
            };
            const epsTopL = epsTopAtX(segL);
            const epsTopR = epsTopAtX(segR);
            if (epsTopL <= cEpsBot && epsTopR <= cEpsBot) return;

            const pts = [];
            pts.push([segL, cEpsBot]);
            pts.push([segR, cEpsBot]);
            if (epsTopR > cEpsBot) pts.push([segR, epsTopR]);
            if (isTopCourse && panel.peakHeight && panel.peakXLocal != null) {
              const peakGX = panel.x + panel.peakXLocal;
              if (peakGX > segL && peakGX < segR) pts.push([peakGX, epsTopAtX(peakGX)]);
            }
            if (epsTopL > cEpsBot) pts.push([segL, epsTopL]);
            if (pts.length >= 3) d.drawPolyline(pts, true);
          } else {
            const cEpsTop = isTopCourse
              ? hAt(leftX) - TOP_PLATE * 2 - EPS_INSET
              : Math.min(course.y + course.height - plateAbove - EPS_INSET, hAt(leftX) - TOP_PLATE * 2 - EPS_INSET);
            const cH = cEpsTop - cEpsBot;
            if (cH > 0) {
              d.drawPolyline([[segL, cEpsBot], [segR, cEpsBot], [segR, cEpsTop], [segL, cEpsTop]], true);
            }
          }
        });
      } else if (isRaked) {
        const epsBot = BOTTOM_PLATE + EPS_INSET;
        const epsTopL = hAt(segL) - TOP_PLATE * 2 - EPS_INSET;
        const epsTopR = hAt(segR) - TOP_PLATE * 2 - EPS_INSET;
        if (epsTopL <= epsBot && epsTopR <= epsBot) return;
        const pts = [[segL, epsBot], [segR, epsBot]];
        if (epsTopR > epsBot) pts.push([segR, epsTopR]);
        if (panel.peakHeight && panel.peakXLocal != null) {
          const peakGX = panel.x + panel.peakXLocal;
          if (peakGX > segL && peakGX < segR) {
            pts.push([peakGX, hAt(peakGX) - TOP_PLATE * 2 - EPS_INSET]);
          }
        }
        if (epsTopL > epsBot) pts.push([segL, epsTopL]);
        if (pts.length >= 3) d.drawPolyline(pts, true);
      } else {
        const epsBot = BOTTOM_PLATE + EPS_INSET;
        const epsTop = height - TOP_PLATE * 2 - EPS_INSET;
        if (epsTop > epsBot) {
          d.drawPolyline([[segL, epsBot], [segR, epsBot], [segR, epsTop], [segL, epsTop]], true);
        }
      }
    });
  });

  // ── Panel labels ──
  d.setActiveLayer('LABELS');
  basePanels.forEach((panel, i) => {
    const cx = panel.x + panel.width / 2;
    const midY = hAt(cx) / 2;
    d.drawText(cx - 30, midY, 40, 0, `P${i + 1}`);
  });

  // ── Openings ──
  drawOpenings(d, openings);
  drawOpeningLabels(d, openings);

  // ── Footer panels with EPS ──
  footers.forEach((f) => {
    d.setActiveLayer('OUTLINE');
    d.drawPolyline([[f.x, 0], [f.x + f.width, 0], [f.x + f.width, f.height], [f.x, f.height]], true);

    const op = openings.find(o => o.ref === f.ref);
    if (op) {
      const fEpsBot = BOTTOM_PLATE + EPS_INSET;
      const fEpsTop = op.y - BOTTOM_PLATE - EPS_INSET;
      if (fEpsTop > fEpsBot) {
        const leftSplineRight = op.x - BOTTOM_PLATE;
        const fEpsLeft = f.x < leftSplineRight ? leftSplineRight + EPS_INSET : f.x + EPS_INSET;
        const rightSplineLeft = op.x + op.drawWidth + BOTTOM_PLATE;
        const fEpsRight = f.x + f.width > rightSplineLeft ? rightSplineLeft - EPS_INSET : f.x + f.width - EPS_INSET;
        if (fEpsRight > fEpsLeft) {
          d.setActiveLayer('EPS');
          d.drawPolyline([
            [fEpsLeft, fEpsBot], [fEpsRight, fEpsBot],
            [fEpsRight, fEpsTop], [fEpsLeft, fEpsTop],
          ], true);
        }
      }
    }

    d.setActiveLayer('LABELS');
    d.drawText(f.x + f.width / 2 - 40, f.height / 2, 30, 0, `Footer ${f.ref}`);
  });

  // ── Lintel panels ──
  lintelPanels.forEach((l) => {
    const hL = l.heightLeft != null ? l.heightLeft : l.height;
    const hR = l.heightRight != null ? l.heightRight : l.height;
    const yBase = l.y;
    const yTopL = l.y + hL;
    const yTopR = l.y + hR;

    d.setActiveLayer('OUTLINE');
    const pts = l.peakHeight
      ? [[l.x, yBase], [l.x, yTopL], [l.x + l.peakXLocal, l.y + l.peakHeight], [l.x + l.width, yTopR], [l.x + l.width, yBase]]
      : [[l.x, yBase], [l.x, yTopL], [l.x + l.width, yTopR], [l.x + l.width, yBase]];
    d.drawPolyline(pts, true);

    // Timber lintel
    const op = openings.find(o => o.ref === l.ref);
    if (op) {
      const hasSill = op.y > 0;
      const lintelH = l.lintelHeight || 200;
      const lintelLeft = hasSill ? op.x - BOTTOM_PLATE - SPLINE_WIDTH + EPS_INSET : op.x - BOTTOM_PLATE + EPS_INSET;
      const lintelRight = hasSill ? op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH - EPS_INSET : op.x + op.drawWidth + BOTTOM_PLATE - EPS_INSET;
      const lintelBot = l.y;
      const lintelTop = l.y + lintelH;
      d.drawPolyline([
        [lintelLeft, lintelBot], [lintelRight, lintelBot],
        [lintelRight, lintelTop], [lintelLeft, lintelTop],
      ], true);

      // EPS above timber lintel
      const epsBot = lintelTop + EPS_INSET;
      const epsLeft = lintelLeft;
      const epsRight = lintelRight;
      const epsTopAtX = (x) => hAt(x) - TOP_PLATE * 2 - EPS_INSET;
      const epsTopL = epsTopAtX(epsLeft);
      const epsTopR = epsTopAtX(epsRight);

      if (epsTopL > epsBot || epsTopR > epsBot) {
        d.setActiveLayer('EPS');
        if (isRaked && Math.abs(epsTopL - epsTopR) > 0.5) {
          const epsPts = [[epsLeft, epsBot], [epsRight, epsBot]];
          if (epsTopR > epsBot) epsPts.push([epsRight, epsTopR]);
          if (l.peakHeight && l.peakXLocal != null) {
            const peakGX = l.x + l.peakXLocal;
            if (peakGX > epsLeft && peakGX < epsRight) epsPts.push([peakGX, epsTopAtX(peakGX)]);
          }
          if (epsTopL > epsBot) epsPts.push([epsLeft, epsTopL]);
          if (epsPts.length >= 3) d.drawPolyline(epsPts, true);
        } else {
          const epsTop = Math.max(epsTopL, epsTopR);
          if (epsTop > epsBot) {
            d.drawPolyline([
              [epsLeft, epsBot], [epsRight, epsBot],
              [epsRight, epsTop], [epsLeft, epsTop],
            ], true);
          }
        }
      }
    }

    d.setActiveLayer('LABELS');
    const midH = Math.max(hL, hR, l.peakHeight || 0) / 2;
    d.drawText(l.x + l.width / 2 - 40, l.y + midH / 2, 30, 0, `Lintel ${l.ref}`);
  });

  // ── Spline EPS (120mm inside 146mm splines) ──
  const splineEpsX = MAGBOARD;
  const splineEpsW = SPLINE_WIDTH - MAGBOARD * 2;
  d.setActiveLayer('EPS_SPLINE');

  // Joint splines
  for (let i = 0; i < basePanels.length - 1; i++) {
    const panel = basePanels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    const insideLintel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (insideLintel || insideFooter) continue;

    const epsXL = gapCentre - HALF_SPLINE + splineEpsX;
    const epsXR = epsXL + splineEpsW;
    const spBot = BOTTOM_PLATE + EPS_INSET;
    const spTopL = hAt(epsXL) - TOP_PLATE * 2 - EPS_INSET;
    const spTopR = hAt(epsXR) - TOP_PLATE * 2 - EPS_INSET;

    if (spTopL <= spBot && spTopR <= spBot) continue;

    if (!isRaked || Math.abs(spTopL - spTopR) < 0.5) {
      const spTop = Math.max(spTopL, spTopR);
      if (spTop > spBot) {
        d.drawPolyline([[epsXL, spBot], [epsXR, spBot], [epsXR, spTop], [epsXL, spTop]], true);
      }
    } else {
      const pts = [[epsXL, spBot], [epsXR, spBot]];
      if (spTopR > spBot) pts.push([epsXR, spTopR]);
      if (spTopL > spBot) pts.push([epsXL, spTopL]);
      if (pts.length >= 3) d.drawPolyline(pts, true);
    }
  }

  // Opening splines
  for (const op of openings) {
    if (op.y <= 0) continue;
    const positions = [
      op.x - BOTTOM_PLATE - SPLINE_WIDTH,
      op.x + op.drawWidth + BOTTOM_PLATE,
    ];
    for (const spXPos of positions) {
      const epsXL = spXPos + splineEpsX;
      const epsXR = epsXL + splineEpsW;
      const spBot = BOTTOM_PLATE + EPS_INSET;
      const spTopL = hAt(epsXL) - TOP_PLATE * 2 - EPS_INSET;
      const spTopR = hAt(epsXR) - TOP_PLATE * 2 - EPS_INSET;
      if (spTopL <= spBot && spTopR <= spBot) continue;

      if (!isRaked || Math.abs(spTopL - spTopR) < 0.5) {
        const spTop = Math.max(spTopL, spTopR);
        if (spTop > spBot) {
          d.drawPolyline([[epsXL, spBot], [epsXR, spBot], [epsXR, spTop], [epsXL, spTop]], true);
        }
      } else {
        const pts = [[epsXL, spBot], [epsXR, spBot]];
        if (spTopR > spBot) pts.push([epsXR, spTopR]);
        if (spTopL > spBot) pts.push([epsXL, spTopL]);
        if (pts.length >= 3) d.drawPolyline(pts, true);
      }
    }
  }

  // Dimensions
  drawDimensions(d, layout);
  drawRunningMeasurement(d, layout);

  return d;
}

/**
 * Export EPS elevation plan as a DXF file download.
 */
export function exportEpsElevationDxf(layout, wallName, projectName) {
  const d = buildEpsElevationDxf(layout, wallName);
  const parts = [projectName, wallName, 'EPS Elevation'].filter(Boolean);
  const filename = parts.join(' ').replace(/\s+/g, ' ').trim() + '.dxf';
  downloadDxf(d, filename);
}
