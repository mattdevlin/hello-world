/**
 * Floor Panel Plans DXF Export
 *
 * Generates individual panel cut diagrams laid out side by side.
 */
import { createDrawing } from './dxfExporter.js';

export function buildFloorPanelPlansDxf(layout) {
  const d = createDrawing();
  const { panels } = layout;
  const GAP = 200; // gap between panels in layout
  let offsetX = 0;

  d.setActiveLayer('OUTLINE');
  for (const panel of panels) {
    d.drawRect(offsetX, 0, offsetX + panel.width, panel.length);

    // Label
    d.setActiveLayer('LABELS');
    d.drawText(offsetX + panel.width / 2, panel.length / 2, 40, 0, `P${panel.index + 1}`);
    d.drawText(offsetX + panel.width / 2, -30, 30, 0, `${Math.round(panel.width)}×${Math.round(panel.length)}`);

    d.setActiveLayer('OUTLINE');
    offsetX += panel.width + GAP;
  }

  return d;
}
