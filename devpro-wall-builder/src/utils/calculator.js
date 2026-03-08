import {
  PANEL_WIDTH,
  PANEL_GAP,
  PANEL_PITCH,
  MIN_PANEL,
  MIN_LCUT_PANEL,
  WALL_THICKNESS,
  WINDOW_OVERHANG,
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
  const wallStart = wall.deduction_left_mm || 0;
  const wallEnd = grossLength - (wall.deduction_right_mm || 0);

  // Process openings first to determine clear spans
  const openingDetails = [];
  const footers = [];
  const lintels = [];
  const sortedOpenings = [...(wall.openings || [])].sort(
    (a, b) => a.position_from_left_mm - b.position_from_left_mm
  );

  for (const opening of sortedOpenings) {
    const isWindow = opening.type === OPENING_TYPES.WINDOW;
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

    if (isWindow && openBottom > 0) {
      footers.push({
        ref: opening.ref,
        x: openLeft - WINDOW_OVERHANG,
        y: 0,
        width: opening.width_mm + 2 * WINDOW_OVERHANG,
        height: openBottom - PANEL_GAP,
        type: 'footer',
      });
    }

    const lintelOverhang = WINDOW_OVERHANG;
    const lintelDepth = height - openTop; // magboard extends to top of wall
    lintels.push({
      ref: opening.ref,
      x: openLeft - lintelOverhang,
      y: openTop,
      width: opening.width_mm + 2 * lintelOverhang,
      height: lintelDepth,
      type: 'lintel',
    });
  }

  // Build clear spans between openings
  // Each span is a region of wall that needs panels
  const spans = [];
  let cursor = wallStart;

  for (const opening of sortedOpenings) {
    const openLeft = opening.position_from_left_mm;
    const openRight = openLeft + opening.width_mm;

    if (openLeft > cursor) {
      spans.push({ start: cursor, end: openLeft, type: 'clear' });
    }
    spans.push({ start: openLeft, end: openRight, type: 'opening', opening });
    cursor = openRight;
  }
  if (cursor < wallEnd) {
    spans.push({ start: cursor, end: wallEnd, type: 'clear' });
  }

  // Fill each span with panels
  const panels = [];

  // Helper: fill a clear span with full panels + end panel
  function fillClearSpan(start, end) {
    const spanLen = end - start;
    if (spanLen < MIN_PANEL) return; // too small for a panel

    const count = Math.floor(spanLen / PANEL_PITCH);
    const remainder = spanLen - count * PANEL_PITCH;
    let x = start;

    for (let i = 0; i < count; i++) {
      panels.push({ x, width: PANEL_WIDTH, pitch: PANEL_PITCH, height, type: 'full' });
      x += PANEL_PITCH;
    }

    if (remainder >= MIN_PANEL) {
      panels.push({ x, width: remainder, pitch: remainder, height, type: 'end' });
    } else if (remainder > 0 && count > 0) {
      // Redistribute with last full panel
      const last = panels[panels.length - 1];
      const combined = PANEL_PITCH + remainder;
      const each = Math.round(combined / 2);
      last.width = each - PANEL_GAP;
      last.pitch = each;
      panels.push({
        x: last.x + each,
        width: combined - each - PANEL_GAP,
        pitch: combined - each,
        height,
        type: 'end',
      });
    }
  }

  if (sortedOpenings.length === 0) {
    // No openings — simple case
    fillClearSpan(wallStart, wallEnd);
  } else {
    // For each opening, we need L-cut panels on left and right sides.
    // Then fill clear gaps between with full panels.

    // First, determine L-cut panel positions for each opening
    // L-cut panel on left side: extends from some position leftward of opening, INTO the opening
    // L-cut panel on right side: extends from opening right edge, rightward
    // Each L-cut panel is a full 1200mm panel positioned so it overlaps the opening edge

    // Collect all "features" left to right: wall-start, opening-edges, wall-end
    // Between features that are far enough apart, place full panels
    // At opening edges, place L-cut panels

    // Build list of L-cut panels and the clear zones between them
    const lcutPanels = []; // { x, width, openingRef, side }

    for (const opening of sortedOpenings) {
      const openLeft = opening.position_from_left_mm;
      const openRight = openLeft + opening.width_mm;

      // Left L-cut: panel right edge at opening left + some overlap into opening
      // Panel is 1200mm wide, positioned so it straddles the left edge of the opening
      // The panel extends from (openLeft - baseWidth) to (openLeft + legWidth)
      // We want at least MIN_LCUT_PANEL (600mm) of base (the part outside the opening)
      const leftLcutX = openLeft - PANEL_WIDTH; // panel starts 1200mm left of opening left
      lcutPanels.push({
        x: leftLcutX,
        width: PANEL_WIDTH,
        pitch: PANEL_PITCH,
        height,
        type: 'lcut',
        openingRefs: [opening.ref],
        side: 'left',
        openLeft,
        openRight,
      });

      // Right L-cut: panel left edge inside opening, extends right past opening right
      const rightLcutX = openRight; // panel starts at opening right edge
      lcutPanels.push({
        x: rightLcutX,
        width: PANEL_WIDTH,
        pitch: PANEL_PITCH,
        height,
        type: 'lcut',
        openingRefs: [opening.ref],
        side: 'right',
        openLeft,
        openRight,
      });
    }

    // Now merge overlapping L-cut panels (e.g., right L-cut of W01 and left L-cut of W02
    // might overlap if windows are close). Also clamp to wall boundaries.
    // And fill clear spans between L-cut panels with full panels.

    // Sort all L-cut panels by x position
    lcutPanels.sort((a, b) => a.x - b.x);

    // Resolve: walk left to right, placing L-cut panels and filling gaps
    let pos = wallStart;

    for (let i = 0; i < lcutPanels.length; i++) {
      const lp = lcutPanels[i];
      let lpX = lp.x;
      let lpRight = lpX + lp.width;

      // Clamp to wall boundaries
      if (lpX < wallStart) { lpX = wallStart; }
      if (lpRight > wallEnd) { lpRight = wallEnd; }
      let lpWidth = lpRight - lpX;

      // If this L-cut would overlap with already-placed panels, adjust
      if (lpX < pos) {
        // Overlap with previous panel — check if it's an adjacent opening scenario
        const overlap = pos - lpX;
        lpX = pos;
        lpWidth = lpRight - lpX;
      }

      if (lpWidth < MIN_PANEL) continue; // too narrow, skip

      // Fill clear gap before this L-cut panel
      if (lpX > pos + PANEL_GAP) {
        fillClearSpan(pos, lpX - PANEL_GAP);
        // Add gap
        pos = lpX;
      } else if (lpX > pos) {
        pos = lpX;
      }

      // Cap width at PANEL_WIDTH
      if (lpWidth > PANEL_WIDTH) lpWidth = PANEL_WIDTH;

      // Enforce MIN_LCUT_PANEL: ensure the base portion (outside opening) is >= 600mm
      // For left L-cut: base = openLeft - lpX
      // For right L-cut: base = (lpX + lpWidth) - openRight
      if (lp.side === 'left') {
        const base = lp.openLeft - lpX;
        if (base < MIN_LCUT_PANEL && lpX > wallStart) {
          // Shift panel left to get more base
          const shift = MIN_LCUT_PANEL - base;
          const newX = Math.max(wallStart, lpX - shift);
          if (newX >= pos || pos === lpX) {
            lpWidth += (lpX - newX);
            lpX = newX;
            if (lpWidth > PANEL_WIDTH) lpWidth = PANEL_WIDTH;
          }
        }
      } else {
        const base = (lpX + lpWidth) - lp.openRight;
        if (base < MIN_LCUT_PANEL && lpX + lpWidth < wallEnd) {
          const needed = MIN_LCUT_PANEL - base;
          lpWidth = Math.min(PANEL_WIDTH, lpWidth + needed);
          if (lpX + lpWidth > wallEnd) lpWidth = wallEnd - lpX;
        }
      }

      panels.push({
        x: lpX,
        width: lpWidth,
        pitch: lpWidth + PANEL_GAP,
        height,
        type: 'lcut',
        openingRefs: lp.openingRefs,
      });

      pos = lpX + lpWidth + PANEL_GAP;
    }

    // Fill remaining clear span after last L-cut to wall end
    if (pos < wallEnd) {
      const remaining = wallEnd - pos;
      if (remaining >= MIN_PANEL) {
        fillClearSpan(pos, wallEnd);
      } else if (remaining > 0 && panels.length > 0) {
        // Redistribute with previous panel
        const last = panels[panels.length - 1];
        const combined = last.width + PANEL_GAP + remaining;
        if (combined <= PANEL_WIDTH) {
          last.width = combined;
          last.pitch = combined + PANEL_GAP;
        } else {
          const each = Math.round((combined + PANEL_GAP) / 2);
          last.width = each - PANEL_GAP;
          last.pitch = each;
          panels.push({
            x: last.x + each,
            width: combined + PANEL_GAP - each - PANEL_GAP,
            pitch: combined + PANEL_GAP - each,
            height,
            type: 'end',
          });
        }
      }
    }
  }

  // Re-index panels
  panels.forEach((p, i) => { p.index = i; });

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
