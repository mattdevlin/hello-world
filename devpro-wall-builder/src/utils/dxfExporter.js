/**
 * Shared DXF export utilities for DEVPRO Wall Builder.
 *
 * All coordinates use real mm values (1:1 scale).
 * DXF Y-axis: 0 = bottom of wall (floor line), positive = up.
 * SVG Y-axis was inverted (0 = top), so we flip: dxfY = maxHeight - svgY
 */
import Drawing from 'dxf-writer';

// DXF layer definitions
const LAYERS = {
  OUTLINE:    { color: Drawing.ACI.WHITE,   line: 'CONTINUOUS' },
  OPENINGS:   { color: Drawing.ACI.RED,     line: 'CONTINUOUS' },
  FRAMING:    { color: Drawing.ACI.BLUE,    line: 'DASHED' },
  EPS:        { color: Drawing.ACI.CYAN,    line: 'CONTINUOUS' },
  EPS_SPLINE: { color: Drawing.ACI.GREEN,   line: 'CONTINUOUS' },
  DIMENSIONS: { color: Drawing.ACI.YELLOW,  line: 'CONTINUOUS' },
  LABELS:     { color: Drawing.ACI.MAGENTA, line: 'CONTINUOUS' },
};

/**
 * Create a new DXF Drawing pre-configured with standard layers and mm units.
 */
export function createDrawing() {
  const d = new Drawing();
  d.setUnits('Millimeters');
  d.addLineType('DASHED', '_ _ _ ', [5, -5]);
  for (const [name, def] of Object.entries(LAYERS)) {
    d.addLayer(name, def.color, def.line);
  }
  return d;
}

/**
 * Build the wall outline polygon points in DXF coordinates (Y=0 at bottom).
 * Returns array of [x, y] pairs.
 */
export function wallOutlinePoints(layout) {
  const { grossLength, height, maxHeight, isRaked, heightAt } = layout;
  const useHeight = maxHeight || height;
  const pts = [];

  // Bottom edge (left to right)
  pts.push([0, 0]);
  pts.push([grossLength, 0]);

  // Right side up to top-right
  const topRightY = heightAt ? heightAt(grossLength) : height;
  pts.push([grossLength, topRightY]);

  // Top edge (right to left, follow slope for raked/gable)
  if (isRaked) {
    const steps = Math.max(40, Math.round(grossLength / 50));
    for (let i = steps - 1; i >= 0; i--) {
      const x = (i / steps) * grossLength;
      const y = heightAt ? heightAt(x) : height;
      pts.push([x, y]);
    }
  } else {
    pts.push([0, height]);
  }

  return pts;
}

/**
 * Draw the wall outline polygon on the OUTLINE layer.
 */
export function drawWallOutline(d, layout) {
  d.setActiveLayer('OUTLINE');
  const pts = wallOutlinePoints(layout);
  d.drawPolyline(pts.map(([x, y]) => [x, y]), true);
}

/**
 * Draw opening rectangles on the OPENINGS layer.
 * Openings have: x, drawWidth, y (sill from floor), drawHeight.
 */
export function drawOpenings(d, openings) {
  d.setActiveLayer('OPENINGS');
  for (const op of openings) {
    const x1 = op.x;
    const y1 = op.y; // sill height from floor
    const x2 = op.x + op.drawWidth;
    const y2 = op.y + op.drawHeight;
    d.drawPolyline([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], true);

    // X cross lines inside opening
    d.drawLine(x1, y1, x2, y2);
    d.drawLine(x2, y1, x1, y2);
  }
}

/**
 * Draw opening labels on LABELS layer.
 */
export function drawOpeningLabels(d, openings) {
  d.setActiveLayer('LABELS');
  for (const op of openings) {
    const cx = op.x + op.drawWidth / 2;
    const cy = op.y + op.drawHeight / 2;
    d.drawText(cx - 50, cy + 20, 40, 0, op.ref);
    d.drawText(cx - 80, cy - 30, 30, 0, `${op.width_mm}w x ${op.height_mm}h`);
  }
}

/**
 * Draw overall dimension lines.
 */
export function drawDimensions(d, layout) {
  d.setActiveLayer('DIMENSIONS');
  const { grossLength, height, maxHeight, isRaked, heightAt, heightLeft, heightRight } = layout;
  const dimOffset = 150;

  // Bottom width dimension
  const yDim = -dimOffset;
  d.drawLine(0, yDim, grossLength, yDim);
  d.drawLine(0, yDim - 30, 0, yDim + 30);
  d.drawLine(grossLength, yDim - 30, grossLength, yDim + 30);
  d.drawText(grossLength / 2 - 100, yDim - 80, 50, 0, `${grossLength} mm`);

  // Left height dimension
  const leftH = heightLeft || height;
  const xDim = -dimOffset;
  d.drawLine(xDim, 0, xDim, leftH);
  d.drawLine(xDim - 30, 0, xDim + 30, 0);
  d.drawLine(xDim - 30, leftH, xDim + 30, leftH);
  d.drawText(xDim - 80, leftH / 2, 50, 90, `${leftH} mm`);

  // Right height dimension (for raked/gable)
  if (isRaked) {
    const rightH = heightRight || height;
    const rxDim = grossLength + dimOffset;
    d.drawLine(rxDim, 0, rxDim, rightH);
    d.drawLine(rxDim - 30, 0, rxDim + 30, 0);
    d.drawLine(rxDim - 30, rightH, rxDim + 30, rightH);
    d.drawText(rxDim + 40, rightH / 2, 50, 90, `${rightH} mm`);
  }
}

/**
 * Draw running measurement ticks along the bottom.
 */
export function drawRunningMeasurement(d, layout) {
  const { grossLength, panels, footerPanels, deductionLeft, deductionRight } = layout;
  const basePanels = panels.filter(p => (p.course ?? 0) === 0);
  d.setActiveLayer('DIMENSIONS');

  const points = new Set([0, grossLength]);
  if (deductionLeft > 0) points.add(deductionLeft);
  if (deductionRight > 0) points.add(grossLength - deductionRight);
  basePanels.forEach(p => points.add(Math.round(p.x + p.width)));
  footerPanels.forEach(f => points.add(Math.round(f.x + f.width)));

  const tickY = -60;
  const sorted = [...points].sort((a, b) => a - b);
  for (const pt of sorted) {
    d.drawLine(pt, tickY - 20, pt, tickY + 20);
    d.drawText(pt - 30, tickY - 60, 30, 0, `${pt}`);
  }
}

/**
 * Draw a title block.
 */
export function drawTitle(d, title, subtitle, grossLength) {
  d.setActiveLayer('LABELS');
  const useHeight = 0; // titles go above the wall
  d.drawText(grossLength / 2 - 200, useHeight + 250, 60, 0, title);
  if (subtitle) {
    d.drawText(grossLength / 2 - 300, useHeight + 170, 40, 0, subtitle);
  }
}

/**
 * Trigger browser download of a DXF file.
 * In Firefox, set Settings > General > Files and Applications >
 * "Always ask you where to save files" to get a folder picker.
 */
function sanitize(str) {
  return (str || '').replace(/[<>:"/\\|?*]/g, '_');
}

export function downloadDxf(drawing, filename) {
  const content = drawing.toDxfString();
  const sanitized = sanitize(filename);
  const safeName = sanitized.endsWith('.dxf') ? sanitized : `${sanitized}.dxf`;
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate DXF string without downloading (for zip bundling).
 */
export function toDxfString(drawing) {
  return drawing.toDxfString();
}
