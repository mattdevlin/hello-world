/**
 * Roof Plan DXF Export
 *
 * Generates a DXF drawing of the roof plan view (top-down projection).
 * Coordinates 1:1 in mm. Y=0 at bottom (DXF natural).
 */
import { createDrawing } from './dxfExporter.js';

export function buildRoofPlanDxf(layout, roofName = '') {
  const d = createDrawing();
  const {
    type, length_mm, width_mm, pitch_deg,
    eaveOverhang_mm, gableOverhang_mm, ridgeOffset_mm,
    planeLayouts, penetrations, panelDirection,
  } = layout;

  const totalWidth = type === 'flat' ? length_mm : length_mm + 2 * gableOverhang_mm;
  const totalHeight = type === 'flat' ? width_mm : width_mm + 2 * eaveOverhang_mm;
  const oxFoot = type === 'flat' ? 0 : gableOverhang_mm;
  const oyFoot = type === 'flat' ? 0 : eaveOverhang_mm;

  // Footprint outline
  d.setActiveLayer('OUTLINE');
  d.drawRect(oxFoot, oyFoot, oxFoot + length_mm, oyFoot + width_mm);

  // Overall extent (with overhangs)
  if (type !== 'flat') {
    d.setActiveLayer('OVERHANG');
    d.drawRect(0, 0, totalWidth, totalHeight);
  }

  // Ridge line
  if (type === 'gable') {
    d.setActiveLayer('RIDGE');
    const ridgeY = oyFoot + width_mm / 2 + ridgeOffset_mm;
    d.drawLine(0, ridgeY, totalWidth, ridgeY);
  }

  // Panels (projected onto plan)
  d.setActiveLayer('PANELS');
  const pitchRad = (pitch_deg * Math.PI) / 180;
  const cosPitch = Math.cos(pitchRad);

  for (const pl of planeLayouts) {
    const plane = pl.plane;
    for (const panel of pl.panels) {
      let px, py, pw, ph;
      if (type === 'flat') {
        if (panelDirection === 'along_ridge') {
          px = panel.u; py = panel.v; pw = panel.width; ph = panel.length;
        } else {
          px = panel.v; py = panel.u; pw = panel.length; ph = panel.width;
        }
      } else if (type === 'gable') {
        if (panelDirection === 'along_ridge') {
          px = panel.u; pw = panel.width;
          const vPlan = panel.v * cosPitch;
          const lPlan = panel.length * cosPitch;
          if (plane.index === 0) {
            py = oyFoot + width_mm / 2 + ridgeOffset_mm - vPlan - lPlan;
          } else {
            py = oyFoot + width_mm / 2 - ridgeOffset_mm + vPlan;
          }
          ph = lPlan;
        } else {
          py = panel.u; ph = panel.width;
          const vPlan = panel.v * cosPitch;
          const lPlan = panel.length * cosPitch;
          if (plane.index === 0) {
            px = oxFoot + width_mm / 2 + ridgeOffset_mm - vPlan - lPlan;
          } else {
            px = oxFoot + width_mm / 2 - ridgeOffset_mm + vPlan;
          }
          pw = lPlan;
        }
      } else {
        if (panelDirection === 'along_ridge') {
          px = panel.u; pw = panel.width;
          py = oyFoot + panel.v * cosPitch;
          ph = panel.length * cosPitch;
        } else {
          py = panel.u; ph = panel.width;
          px = oxFoot + panel.v * cosPitch;
          pw = panel.length * cosPitch;
        }
      }
      d.drawRect(px, py, px + pw, py + ph);
    }
  }

  // Penetrations
  d.setActiveLayer('PENETRATIONS');
  for (const pen of penetrations) {
    if (pen.type === 'pipe') {
      d.drawCircle(oxFoot + pen.position_x_mm, oyFoot + pen.position_y_mm, (pen.diameter_mm || 100) / 2);
    } else {
      d.drawRect(
        oxFoot + pen.position_x_mm, oyFoot + pen.position_y_mm,
        oxFoot + pen.position_x_mm + (pen.width_mm || 0),
        oyFoot + pen.position_y_mm + (pen.length_mm || 0)
      );
    }
  }

  // Labels
  d.setActiveLayer('LABELS');
  d.drawText(oxFoot + length_mm / 2, oyFoot + width_mm / 2, 100, 0, roofName || 'Roof');

  return d;
}
