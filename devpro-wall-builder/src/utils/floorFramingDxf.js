/**
 * Floor Framing Plan DXF Export
 */
import { createDrawing } from './dxfExporter.js';

export function buildFloorFramingDxf(layout) {
  const d = createDrawing();
  const { polygon, perimeterPlates, reinforcedSplines, unreinforcedSplines, bearerLines, recesses } = layout;

  // Floor outline
  d.setActiveLayer('OUTLINE');
  if (polygon.length >= 3) {
    const pts = polygon.map(p => [p.x, p.y]);
    pts.push(pts[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      d.drawLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
  }

  // Perimeter plates
  d.setActiveLayer('FRAMING');
  for (const plate of perimeterPlates) {
    d.drawLine(plate.x1, plate.y1, plate.x2, plate.y2);
  }

  // Reinforced splines
  d.setActiveLayer('EPS_SPLINE');
  for (const s of reinforcedSplines) {
    d.drawRect(s.x, s.y, s.x + s.width, s.y + s.length);
  }

  // Unreinforced splines
  for (const s of unreinforcedSplines) {
    d.drawRect(s.x, s.y, s.x + s.width, s.y + s.length);
  }

  // Bearer lines
  d.setActiveLayer('DIMENSIONS');
  for (const bl of bearerLines) {
    for (const seg of bl.segments) {
      d.drawLine(seg.x1, seg.y1, seg.x2, seg.y2);
    }
  }

  // Recess plates
  d.setActiveLayer('FRAMING');
  for (const rec of recesses) {
    if (rec.recessPlates) {
      for (const plate of rec.recessPlates) {
        d.drawLine(plate.x1, plate.y1, plate.x2, plate.y2);
      }
    }
  }

  return d;
}
