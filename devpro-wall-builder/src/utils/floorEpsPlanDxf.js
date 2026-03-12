/**
 * Floor EPS Plan DXF Export
 */
import { createDrawing } from './dxfExporter.js';
import { EPS_GAP } from './constants.js';

export function buildFloorEpsPlanDxf(layout) {
  const d = createDrawing();
  const { polygon, panels, reinforcedSplines, unreinforcedSplines, openings, recesses } = layout;

  // Floor outline
  d.setActiveLayer('OUTLINE');
  if (polygon.length >= 3) {
    const pts = polygon.map(p => [p.x, p.y]);
    pts.push(pts[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      d.drawLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
  }

  // Panel EPS
  d.setActiveLayer('EPS');
  for (const panel of panels) {
    d.drawRect(
      panel.x + EPS_GAP, panel.y + EPS_GAP,
      panel.x + panel.width - EPS_GAP, panel.y + panel.length - EPS_GAP
    );
  }

  // Spline EPS
  d.setActiveLayer('EPS_SPLINE');
  for (const s of [...reinforcedSplines, ...unreinforcedSplines]) {
    d.drawRect(s.x, s.y, s.x + s.width, s.y + s.length);
  }

  // Opening voids
  d.setActiveLayer('OPENINGS');
  for (const op of openings) {
    if (op.type === 'circular') {
      d.drawCircle(op.x, op.y, op.diameter / 2);
    } else {
      d.drawRect(op.x, op.y, op.x + op.width, op.y + op.length);
    }
  }

  // Recess voids
  for (const rec of recesses) {
    d.drawRect(rec.x, rec.y, rec.x + rec.width, rec.y + rec.length);
  }

  return d;
}
