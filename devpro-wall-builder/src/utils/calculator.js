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
  const dedLeft = wall.deduction_left_mm || 0;
  const dedRight = wall.deduction_right_mm || 0;
  const wallStart = dedLeft + (dedLeft > 0 ? PANEL_GAP : 0);
  const wallEnd = grossLength - dedRight - (dedRight > 0 ? PANEL_GAP : 0);

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
        height: openBottom,
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

  // ── Panel generation: built around openings ──────────────────────
  //
  // Logic:
  //   1. Identify clear zones (wall regions between openings / wall edges)
  //   2. At each opening edge, place an L-cut panel whose BASE sits in
  //      the clear zone and whose LEG (overhang) extends over the opening.
  //      Panel width in layout = base only.  CNC profile = base + ovh.
  //   3. Fill whatever clear-zone space remains with full / end panels.
  //   4. No panels are placed inside the opening void.

  const panels = [];
  const ovh = WINDOW_OVERHANG;                  // 121 mm leg overhang
  const maxBase = PANEL_WIDTH;                   // max L-cut panel clear-zone width

  // Helper: fill a clear span with full panels + end panel
  function fillClearSpan(start, end) {
    const spanLen = end - start;
    if (spanLen < MIN_PANEL) return;

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

  // Helper: push an L-cut panel
  function addLcut(x, base, opening, side) {
    if (base < MIN_PANEL) return;
    const openLeft = opening.position_from_left_mm;
    const openRight = openLeft + opening.width_mm;
    panels.push({
      x,
      width: base,
      pitch: base + PANEL_GAP,
      height,
      type: 'lcut',
      openingRefs: [opening.ref],
      side,
      openLeft,
      openRight,
      openBottom: opening.sill_mm || 0,
      openTop: (opening.sill_mm || 0) + opening.height_mm,
      openingType: opening.type,
    });
  }

  // Helper: push a pier panel (single panel between two openings, L-cuts both sides)
  function addPier(x, base, leftOpening, rightOpening) {
    if (base < MIN_PANEL) return;
    const lOpenLeft = leftOpening.position_from_left_mm;
    const lOpenRight = lOpenLeft + leftOpening.width_mm;
    const rOpenLeft = rightOpening.position_from_left_mm;
    const rOpenRight = rOpenLeft + rightOpening.width_mm;
    panels.push({
      x,
      width: base,
      pitch: base + PANEL_GAP,
      height,
      type: 'lcut',
      openingRefs: [leftOpening.ref, rightOpening.ref],
      side: 'pier',
      // Left opening data (right L-cut side)
      openLeft: lOpenLeft,
      openRight: lOpenRight,
      openBottom: leftOpening.sill_mm || 0,
      openTop: (leftOpening.sill_mm || 0) + leftOpening.height_mm,
      openingType: leftOpening.type,
      // Right opening data (left L-cut side)
      rightOpenLeft: rOpenLeft,
      rightOpenRight: rOpenRight,
      rightOpenBottom: rightOpening.sill_mm || 0,
      rightOpenTop: (rightOpening.sill_mm || 0) + rightOpening.height_mm,
      rightOpeningType: rightOpening.type,
    });
  }

  // Helper: does this opening have a footer panel?
  function hasFooter(opening) {
    return opening.type === OPENING_TYPES.WINDOW && (opening.sill_mm || 0) > 0;
  }

  if (sortedOpenings.length === 0) {
    // No openings — just fill the wall
    fillClearSpan(wallStart, wallEnd);
  } else {
    // Build clear zones between wall edges and openings.
    // Each zone knows which opening (if any) borders it on each side.
    // Zone boundaries are shrunk by PANEL_GAP on sides where a footer
    // exists, so that the panel base → footer joint has a 5 mm gap.
    const zones = [];

    // Zone before first opening
    const firstOp = sortedOpenings[0];
    zones.push({
      start: wallStart,
      end: firstOp.position_from_left_mm - (hasFooter(firstOp) ? PANEL_GAP : 0),
      leftOp: null,                       // wall edge — no L-cut
      rightOp: firstOp,                   // opening on right — left L-cut
    });

    // Zones between consecutive openings
    for (let i = 0; i < sortedOpenings.length - 1; i++) {
      const curr = sortedOpenings[i];
      const next = sortedOpenings[i + 1];
      zones.push({
        start: curr.position_from_left_mm + curr.width_mm + (hasFooter(curr) ? PANEL_GAP : 0),
        end: next.position_from_left_mm - (hasFooter(next) ? PANEL_GAP : 0),
        leftOp: curr,                     // opening on left — right L-cut
        rightOp: next,                    // opening on right — left L-cut
      });
    }

    // Zone after last opening
    const lastOp = sortedOpenings[sortedOpenings.length - 1];
    zones.push({
      start: lastOp.position_from_left_mm + lastOp.width_mm + (hasFooter(lastOp) ? PANEL_GAP : 0),
      end: wallEnd,
      leftOp: lastOp,                     // opening on left — right L-cut
      rightOp: null,                      // wall edge — no L-cut
    });

    // Process each zone
    for (const zone of zones) {
      const zoneLen = zone.end - zone.start;
      if (zoneLen <= 0) continue;

      const needLeft  = !!zone.leftOp;     // right L-cut of left opening
      const needRight = !!zone.rightOp;    // left L-cut of right opening

      if (!needLeft && !needRight) {
        // Pure clear span (shouldn't happen with openings, but safe)
        fillClearSpan(zone.start, zone.end);
        continue;
      }

      // Determine base widths for L-cut panels on each side
      let leftBase = 0;    // right L-cut of left opening
      let rightBase = 0;   // left L-cut of right opening

      if (needLeft && needRight) {
        // Both sides need L-cuts — check if a single pier panel fits
        if (zoneLen <= PANEL_WIDTH) {
          // Entire pier (clear zone) fits on one sheet → single panel
          addPier(zone.start, zoneLen, zone.leftOp, zone.rightOp);
          continue;
        } else if (zoneLen <= 2 * maxBase) {
          // Zone fits two L-cuts with no fill between
          leftBase = Math.min(maxBase, Math.floor(zoneLen / 2));
          rightBase = Math.min(maxBase, zoneLen - leftBase);
        } else {
          // Plenty of room — both L-cuts at max, fill between
          leftBase = maxBase;
          rightBase = maxBase;
        }
      } else if (needLeft) {
        leftBase = Math.min(maxBase, zoneLen);
      } else {
        rightBase = Math.min(maxBase, zoneLen);
      }

      // Place right L-cut of left opening (base extends rightward from opening)
      if (needLeft && leftBase >= MIN_PANEL) {
        addLcut(zone.start, leftBase, zone.leftOp, 'right');
      }

      // Fill middle clear space
      const fillStart = zone.start + (leftBase > 0 ? leftBase + PANEL_GAP : 0);
      const fillEnd   = zone.end   - (rightBase > 0 ? rightBase + PANEL_GAP : 0);
      if (fillEnd - fillStart >= MIN_PANEL) {
        fillClearSpan(fillStart, fillEnd);
      }

      // Place left L-cut of right opening (base extends leftward from opening)
      if (needRight && rightBase >= MIN_PANEL) {
        addLcut(zone.end - rightBase, rightBase, zone.rightOp, 'left');
      }
    }
  }

  // Re-index panels
  panels.forEach((p, i) => { p.index = i; });

  return {
    grossLength,
    netLength,
    height,
    deductionLeft: dedLeft,
    deductionRight: dedRight,
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
