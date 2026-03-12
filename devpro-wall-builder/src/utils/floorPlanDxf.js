/**
 * Floor Plan DXF Export
 *
 * Generates a DXF drawing of the floor plan view (top-down).
 * Coordinates 1:1 in mm. Y=0 at bottom (DXF natural).
 */
import { createDrawing, toDxfString } from './dxfExporter.js';

export function buildFloorPlanDxf(layout) {
  const d = createDrawing();
  const { polygon, panels, openings, recesses, reinforcedSplines, unreinforcedSplines } = layout;

  // Floor outline
  d.setActiveLayer('OUTLINE');
  if (polygon.length >= 3) {
    const pts = polygon.map(p => [p.x, p.y]);
    pts.push(pts[0]); // close
    for (let i = 0; i < pts.length - 1; i++) {
      d.drawLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
  }

  // Panels
  d.setActiveLayer('EPS');
  for (const panel of panels) {
    d.drawRect(panel.x, panel.y, panel.x + panel.width, panel.y + panel.length);
  }

  // Splines
  d.setActiveLayer('EPS_SPLINE');
  for (const s of [...reinforcedSplines, ...unreinforcedSplines]) {
    d.drawRect(s.x, s.y, s.x + s.width, s.y + s.length);
  }

  // Openings
  d.setActiveLayer('OPENINGS');
  for (const op of openings) {
    if (op.type === 'circular') {
      d.drawCircle(op.x, op.y, op.diameter / 2);
    } else {
      d.drawRect(op.x, op.y, op.x + op.width, op.y + op.length);
      d.drawLine(op.x, op.y, op.x + op.width, op.y + op.length);
      d.drawLine(op.x + op.width, op.y, op.x, op.y + op.length);
    }
  }

  // Recesses
  for (const rec of recesses) {
    d.drawRect(rec.x, rec.y, rec.x + rec.width, rec.y + rec.length);
  }

  // Labels
  d.setActiveLayer('LABELS');
  for (const panel of panels) {
    d.drawText(panel.x + panel.width / 2, panel.y + panel.length / 2, 50, 0,
      `P${panel.index + 1}`);
  }

  return d;
}

export function exportFloorPlanDxf(layout, floorName, projectName) {
  const d = buildFloorPlanDxf(layout, floorName);
  const str = toDxfString(d);
  const blob = new Blob([str], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName || 'Floor'} ${floorName || 'Plan'} Floor Plan.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}
