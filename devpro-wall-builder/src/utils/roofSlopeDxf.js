/**
 * Roof Slope DXF Export
 *
 * Generates DXF drawings of unfolded slope planes (fabrication views).
 * Each plane is drawn as a flat rectangle with panels, splines, and penetrations.
 * Coordinates 1:1 in mm. Y=0 at bottom (DXF natural).
 */
import { createDrawing } from './dxfExporter.js';
import { SPLINE_WIDTH } from './constants.js';

export function buildRoofSlopeDxf(layout, roofName = '') {
  const d = createDrawing();
  const { planeLayouts, panelDirection, penetrations } = layout;

  let yOffset = 0;
  const GAP = 500; // spacing between planes

  for (const pl of planeLayouts) {
    const { plane, panels, splines } = pl;
    const { uLength, vLength, label } = plane;

    // Plane outline
    d.setActiveLayer('OUTLINE');
    d.drawRect(0, yOffset, uLength, yOffset + vLength);

    // Panels
    d.setActiveLayer('PANELS');
    for (const panel of panels) {
      let px, py, pw, ph;
      if (panelDirection === 'along_ridge') {
        px = panel.u; py = yOffset + panel.v; pw = panel.width; ph = panel.length;
      } else {
        px = panel.v; py = yOffset + panel.u; pw = panel.length; ph = panel.width;
      }
      d.drawRect(px, py, px + pw, py + ph);
    }

    // Panel labels
    d.setActiveLayer('LABELS');
    for (const panel of panels) {
      let px, py, pw, ph;
      if (panelDirection === 'along_ridge') {
        px = panel.u; py = yOffset + panel.v; pw = panel.width; ph = panel.length;
      } else {
        px = panel.v; py = yOffset + panel.u; pw = panel.length; ph = panel.width;
      }
      d.drawText(px + pw / 2, py + ph / 2, 50, 0, `P${panel.globalIndex + 1}`);
    }

    // Splines
    d.setActiveLayer('SPLINES');
    for (const spline of splines) {
      let sx, sy, sw, sh;
      if (panelDirection === 'along_ridge') {
        sx = spline.u - SPLINE_WIDTH / 2;
        sy = yOffset + spline.v;
        sw = SPLINE_WIDTH;
        sh = spline.length;
      } else {
        sx = spline.v;
        sy = yOffset + spline.u - SPLINE_WIDTH / 2;
        sw = spline.length;
        sh = SPLINE_WIDTH;
      }
      d.drawRect(sx, sy, sx + sw, sy + sh);
    }

    // Penetrations on this plane
    d.setActiveLayer('PENETRATIONS');
    const planePens = penetrations.filter(p => p.plane === plane.index);
    for (const pen of planePens) {
      if (pen.type === 'pipe') {
        d.drawCircle(pen.position_x_mm, yOffset + pen.position_y_mm, (pen.diameter_mm || 100) / 2);
      } else {
        d.drawRect(
          pen.position_x_mm, yOffset + pen.position_y_mm,
          pen.position_x_mm + (pen.width_mm || 0),
          yOffset + pen.position_y_mm + (pen.length_mm || 0)
        );
      }
    }

    // Plane label
    d.setActiveLayer('LABELS');
    d.drawText(uLength / 2, yOffset - 100, 80, 0, `${roofName} — ${label}`);

    yOffset += vLength + GAP;
  }

  return d;
}
