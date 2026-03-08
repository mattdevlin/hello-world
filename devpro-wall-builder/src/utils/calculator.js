import {
  PANEL_WIDTH,
  PANEL_GAP,
  PANEL_PITCH,
  MIN_PANEL,
  WALL_THICKNESS,
  WINDOW_OVERHANG,
  DOOR_OVERHANG,
  DOOR_TOP_CUTOUT,
  LINTEL_DEPTH,
  OPENING_TYPES,
} from './constants.js';

/**
 * Calculate the panel layout for a single DEVPRO wall.
 *
 * @param {object} wall - Wall definition
 * @param {number} wall.length_mm - Net wall length after deductions
 * @param {number} wall.height_mm - Wall height
 * @param {number} wall.deduction_left_mm - Corner deduction left (0 or 162)
 * @param {number} wall.deduction_right_mm - Corner deduction right (0 or 162)
 * @param {Array} wall.openings - Array of opening objects
 * @returns {object} Layout result with panels, openings, footers, lintels
 */
export function calculateWallLayout(wall) {
  const grossLength = wall.length_mm;
  const netLength = grossLength - (wall.deduction_left_mm || 0) - (wall.deduction_right_mm || 0);
  const height = wall.height_mm;

  // Calculate number of full-width panels and remainder
  const fullPanels = Math.floor(netLength / PANEL_PITCH);
  const remainder = netLength - fullPanels * PANEL_PITCH;

  // Build panel list
  const panels = [];
  let x = wall.deduction_left_mm || 0;

  for (let i = 0; i < fullPanels; i++) {
    panels.push({
      index: i,
      x,
      width: PANEL_WIDTH,
      pitch: PANEL_PITCH,
      height,
      type: 'full',
    });
    x += PANEL_PITCH;
  }

  // End panel (remainder)
  if (remainder >= MIN_PANEL) {
    panels.push({
      index: fullPanels,
      x,
      width: remainder,
      pitch: remainder,
      height,
      type: 'end',
    });
  } else if (remainder > 0 && fullPanels > 0) {
    // Redistribute: make last two panels equal
    const lastPanel = panels[panels.length - 1];
    const combined = PANEL_PITCH + remainder;
    const each = Math.round(combined / 2);
    lastPanel.width = each - PANEL_GAP;
    lastPanel.pitch = each;
    panels.push({
      index: fullPanels,
      x: lastPanel.x + each,
      width: combined - each - PANEL_GAP,
      pitch: combined - each,
      height,
      type: 'end',
    });
  }

  // Process openings - determine which panels are L-cut
  const openingDetails = [];
  const footers = [];
  const lintels = [];

  if (wall.openings) {
    for (const opening of wall.openings) {
      const isWindow = opening.type === OPENING_TYPES.WINDOW;
      const isDoor = opening.type === OPENING_TYPES.DOOR || opening.type === OPENING_TYPES.GARAGE_DOOR;
      const overhang = isWindow ? WINDOW_OVERHANG : DOOR_OVERHANG;

      // Opening position in wall coordinates (from left, looking from outside)
      const openLeft = opening.position_from_left_mm;
      const openRight = openLeft + opening.width_mm;
      const openBottom = opening.sill_mm || 0;
      const openTop = openBottom + opening.height_mm;

      openingDetails.push({
        ...opening,
        x: openLeft,
        y: openBottom,
        drawWidth: opening.width_mm,
        drawHeight: opening.height_mm,
      });

      // Footer panel (windows only)
      if (isWindow && openBottom > 0) {
        const footerWidth = opening.width_mm + 2 * WINDOW_OVERHANG;
        const footerX = openLeft - WINDOW_OVERHANG;
        footers.push({
          ref: opening.ref,
          x: footerX,
          y: 0,
          width: footerWidth,
          height: openBottom,
          type: 'footer',
        });
      }

      // Lintel
      const lintelOverhang = isWindow ? WINDOW_OVERHANG : DOOR_OVERHANG;
      const lintelWidth = opening.width_mm + 2 * lintelOverhang;
      const lintelX = openLeft - lintelOverhang;
      const lintelDepth = Math.min(LINTEL_DEPTH, height - openTop);
      lintels.push({
        ref: opening.ref,
        x: lintelX,
        y: openTop,
        width: lintelWidth,
        height: lintelDepth,
        type: 'lintel',
      });

      // Mark panels that get L-cut
      for (const panel of panels) {
        const panelLeft = panel.x;
        const panelRight = panel.x + panel.width;
        if (panelRight > openLeft && panelLeft < openRight) {
          panel.type = 'lcut';
          if (!panel.openingRefs) panel.openingRefs = [];
          panel.openingRefs.push(opening.ref);
        }
      }
    }
  }

  return {
    grossLength,
    netLength,
    height,
    deductionLeft: wall.deduction_left_mm || 0,
    deductionRight: wall.deduction_right_mm || 0,
    panels,
    openings: openingDetails,
    footers,
    lintels,
    totalPanels: panels.length,
    fullPanels: panels.filter(p => p.type === 'full').length,
    lcutPanels: panels.filter(p => p.type === 'lcut').length,
    endPanels: panels.filter(p => p.type === 'end').length,
  };
}

/**
 * Choose the best panel height for a given wall height.
 */
export function recommendPanelHeight(wallHeight) {
  const available = [2400, 2700, 3000];
  for (const h of available) {
    if (h >= wallHeight) return h;
  }
  return available[available.length - 1];
}
