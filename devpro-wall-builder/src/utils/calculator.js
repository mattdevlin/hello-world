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
  WALL_PROFILES,
  STOCK_SHEET_HEIGHTS,
} from './constants.js';

/**
 * Build a height-at-x function based on wall profile.
 *
 * @returns {function(number): number} heightAt(x) → wall height in mm at position x
 */
function buildHeightFn(wall) {
  const profile = wall.profile || WALL_PROFILES.STANDARD;
  const hLeft = wall.height_mm;
  const grossLen = wall.length_mm;

  if (profile === WALL_PROFILES.RAKED) {
    const hRight = wall.height_right_mm || hLeft;
    return (x) => hLeft + (hRight - hLeft) * (x / grossLen);
  }

  if (profile === WALL_PROFILES.GABLE) {
    const peakH = wall.peak_height_mm || hLeft;
    const peakX = wall.peak_position_mm ?? Math.round(grossLen / 2);
    return (x) => {
      if (x <= peakX) {
        return peakX > 0 ? hLeft + (peakH - hLeft) * (x / peakX) : peakH;
      }
      const remaining = grossLen - peakX;
      return remaining > 0 ? peakH - (peakH - hLeft) * ((x - peakX) / remaining) : peakH;
    };
  }

  // Standard — constant height
  return () => hLeft;
}

/**
 * Compute vertical course layout for walls that exceed the max stock sheet height.
 * Each course represents one horizontal row of sheets stacked vertically.
 *
 * @param {number} wallHeight - total wall height in mm
 * @param {number[]} [availableSheets=STOCK_SHEET_HEIGHTS] - stock sheet sizes to choose from
 *        (future project-level optimizer can pass a custom subset)
 * @returns {{ courses: Array<{y: number, height: number, sheetHeight: number}>, isMultiCourse: boolean }}
 */
export function computeCourses(wallHeight, availableSheets = STOCK_SHEET_HEIGHTS, preferredBottom = null) {
  const maxSheet = Math.max(...availableSheets);

  if (wallHeight <= maxSheet) {
    // Single course — pick smallest stock sheet that covers the height
    const sheet = availableSheets.find(s => s >= wallHeight) || maxSheet;
    return {
      courses: [{ y: 0, height: wallHeight, sheetHeight: sheet }],
      isMultiCourse: false,
    };
  }

  // If a preferred bottom course height is specified, use it directly
  if (preferredBottom && preferredBottom < wallHeight) {
    const bottomSheet = availableSheets.find(s => s >= preferredBottom) || maxSheet;
    const topHeight = wallHeight - preferredBottom;
    const topSheet = availableSheets.find(s => s >= topHeight) || maxSheet;
    if (topHeight <= maxSheet) {
      return {
        courses: [
          { y: 0, height: preferredBottom, sheetHeight: bottomSheet },
          { y: preferredBottom, height: topHeight, sheetHeight: topSheet },
        ],
        isMultiCourse: true,
      };
    }
    // Top still exceeds max sheet — stack preferred bottom + remaining courses
    const courses = [{ y: 0, height: preferredBottom, sheetHeight: bottomSheet }];
    let remaining = topHeight;
    let y = preferredBottom;
    while (remaining > maxSheet) {
      courses.push({ y, height: maxSheet, sheetHeight: maxSheet });
      y += maxSheet;
      remaining -= maxSheet;
    }
    const sheet = availableSheets.find(s => s >= remaining) || maxSheet;
    courses.push({ y, height: remaining, sheetHeight: sheet });
    return { courses, isMultiCourse: true };
  }

  // No preference — try all two-course combinations; pick the one with minimum waste
  // Default: prefer smaller bottom sheet (less material usage)
  let best = null;
  let bestWaste = Infinity;

  for (const bottomSheet of availableSheets) {
    const topHeight = wallHeight - bottomSheet;
    if (topHeight <= 0) continue;
    const topSheet = availableSheets.find(s => s >= topHeight);
    if (!topSheet) continue; // top too tall for any single sheet
    const waste = topSheet - topHeight;
    // Prefer less waste; on tie prefer smaller bottom (less material)
    if (waste < bestWaste || (waste === bestWaste && bottomSheet < (best?.bottomSheet || Infinity))) {
      bestWaste = waste;
      best = { bottomSheet, topHeight, topSheet };
    }
  }

  if (best) {
    return {
      courses: [
        { y: 0, height: best.bottomSheet, sheetHeight: best.bottomSheet },
        { y: best.bottomSheet, height: best.topHeight, sheetHeight: best.topSheet },
      ],
      isMultiCourse: true,
    };
  }

  // Wall > sum of two max sheets — split into maxSheet courses + remainder
  const courses = [];
  let remaining = wallHeight;
  let y = 0;
  while (remaining > maxSheet) {
    courses.push({ y, height: maxSheet, sheetHeight: maxSheet });
    y += maxSheet;
    remaining -= maxSheet;
  }
  const sheet = availableSheets.find(s => s >= remaining) || maxSheet;
  courses.push({ y, height: remaining, sheetHeight: sheet });
  return { courses, isMultiCourse: true };
}

/**
 * Calculate the panel layout for a single DEVPRO wall.
 */
export function calculateWallLayout(wall) {
  const grossLength = wall.length_mm;
  const height = wall.height_mm;
  const profile = wall.profile || WALL_PROFILES.STANDARD;
  const isRaked = profile !== WALL_PROFILES.STANDARD;
  const dedLeft = wall.deduction_left_mm || 0;
  const dedRight = wall.deduction_right_mm || 0;
  const netLength = grossLength - dedLeft - dedRight;
  const wallStart = dedLeft + (dedLeft > 0 ? PANEL_GAP : 0);
  const wallEnd = grossLength - dedRight - (dedRight > 0 ? PANEL_GAP : 0);

  const heightAt = buildHeightFn(wall);

  // Max height across wall (for layout bounds)
  // Always check both sides — even if heightAt is unavailable, fall back to height
  const heightRight = heightAt ? heightAt(grossLength) : height;
  const peakHeight = profile === WALL_PROFILES.GABLE && heightAt
    ? heightAt(wall.peak_position_mm ?? grossLength / 2) : 0;
  const maxHeight = Math.max(height, heightRight, peakHeight);

  // Process openings
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

    // Lintel follows the wall slope — trapezoid for raked/gable, pentagon if straddling gable peak
    const lintelOverhang = WINDOW_OVERHANG;
    const lintelLeft = openLeft - lintelOverhang;
    const lintelRight = openRight + lintelOverhang;
    const lHeightLeft = Math.max(0, heightAt(lintelLeft) - openTop);
    const lHeightRight = Math.max(0, heightAt(lintelRight) - openTop);

    // Detect gable peak within lintel span
    let lPeakHeight, lPeakXLocal;
    if (profile === WALL_PROFILES.GABLE) {
      const peakX = wall.peak_position_mm ?? Math.round(grossLength / 2);
      if (lintelLeft < peakX && lintelRight > peakX) {
        lPeakHeight = Math.max(0, heightAt(peakX) - openTop);
        lPeakXLocal = peakX - lintelLeft;
      }
    }

    lintels.push({
      ref: opening.ref,
      x: lintelLeft,
      y: openTop,
      width: opening.width_mm + 2 * lintelOverhang,
      height: Math.max(lHeightLeft, lHeightRight, lPeakHeight || 0),
      heightLeft: lHeightLeft,
      heightRight: lHeightRight,
      peakHeight: lPeakHeight,
      peakXLocal: lPeakXLocal,
      beamHeight: opening.lintel_height_mm ?? 200,
      type: 'lintel',
    });
  }

  // Build clear spans
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

  // ── Panel generation ──
  const panels = [];
  const ovh = WINDOW_OVERHANG;
  const maxBase = PANEL_WIDTH;

  function fillClearSpan(start, end) {
    const spanLen = end - start;
    if (spanLen < MIN_PANEL) return;

    const count = Math.floor(spanLen / PANEL_PITCH);
    const remainder = spanLen - count * PANEL_PITCH;
    let x = start;

    for (let i = 0; i < count; i++) {
      panels.push({
        x, width: PANEL_WIDTH, pitch: PANEL_PITCH,
        height, type: 'full',
        heightLeft: Math.round(heightAt(x)),
        heightRight: Math.round(heightAt(x + PANEL_WIDTH)),
      });
      x += PANEL_PITCH;
    }

    if (remainder >= MIN_PANEL) {
      panels.push({
        x, width: remainder, pitch: remainder,
        height, type: 'end',
        heightLeft: Math.round(heightAt(x)),
        heightRight: Math.round(heightAt(x + remainder)),
      });
    } else if (remainder > 0 && count > 0) {
      const last = panels[panels.length - 1];
      const combined = PANEL_PITCH + remainder;
      const each = Math.round(combined / 2);
      last.width = each - PANEL_GAP;
      last.pitch = each;
      last.heightRight = Math.round(heightAt(last.x + last.width));
      panels.push({
        x: last.x + each,
        width: combined - each - PANEL_GAP,
        pitch: combined - each,
        height, type: 'end',
        heightLeft: Math.round(heightAt(last.x + each)),
        heightRight: Math.round(heightAt(last.x + each + combined - each - PANEL_GAP)),
      });
    }
  }

  function addLcut(x, base, opening, side) {
    if (base < MIN_PANEL) return;
    const openLeft = opening.position_from_left_mm;
    const openRight = openLeft + opening.width_mm;
    panels.push({
      x, width: base, pitch: base + PANEL_GAP,
      height, type: 'lcut',
      openingRefs: [opening.ref], side, openLeft, openRight,
      openBottom: opening.sill_mm || 0,
      openTop: (opening.sill_mm || 0) + opening.height_mm,
      openingType: opening.type,
      heightLeft: Math.round(heightAt(x)),
      heightRight: Math.round(heightAt(x + base)),
    });
  }

  function addPier(x, base, leftOpening, rightOpening) {
    if (base < MIN_PANEL) return;
    const lOpenLeft = leftOpening.position_from_left_mm;
    const lOpenRight = lOpenLeft + leftOpening.width_mm;
    const rOpenLeft = rightOpening.position_from_left_mm;
    const rOpenRight = rOpenLeft + rightOpening.width_mm;
    panels.push({
      x, width: base, pitch: base + PANEL_GAP,
      height, type: 'lcut',
      openingRefs: [leftOpening.ref, rightOpening.ref],
      side: 'pier',
      openLeft: lOpenLeft, openRight: lOpenRight,
      openBottom: leftOpening.sill_mm || 0,
      openTop: (leftOpening.sill_mm || 0) + leftOpening.height_mm,
      openingType: leftOpening.type,
      rightOpenLeft: rOpenLeft, rightOpenRight: rOpenRight,
      rightOpenBottom: rightOpening.sill_mm || 0,
      rightOpenTop: (rightOpening.sill_mm || 0) + rightOpening.height_mm,
      rightOpeningType: rightOpening.type,
      heightLeft: Math.round(heightAt(x)),
      heightRight: Math.round(heightAt(x + base)),
    });
  }

  function hasFooter(opening) {
    return opening.type === OPENING_TYPES.WINDOW && (opening.sill_mm || 0) > 0;
  }

  if (sortedOpenings.length === 0) {
    fillClearSpan(wallStart, wallEnd);
  } else {
    const zones = [];

    const firstOp = sortedOpenings[0];
    zones.push({
      start: wallStart,
      end: firstOp.position_from_left_mm - (hasFooter(firstOp) ? PANEL_GAP : 0),
      leftOp: null,
      rightOp: firstOp,
    });

    for (let i = 0; i < sortedOpenings.length - 1; i++) {
      const curr = sortedOpenings[i];
      const next = sortedOpenings[i + 1];
      zones.push({
        start: curr.position_from_left_mm + curr.width_mm + (hasFooter(curr) ? PANEL_GAP : 0),
        end: next.position_from_left_mm - (hasFooter(next) ? PANEL_GAP : 0),
        leftOp: curr,
        rightOp: next,
      });
    }

    const lastOp = sortedOpenings[sortedOpenings.length - 1];
    zones.push({
      start: lastOp.position_from_left_mm + lastOp.width_mm + (hasFooter(lastOp) ? PANEL_GAP : 0),
      end: wallEnd,
      leftOp: lastOp,
      rightOp: null,
    });

    for (const zone of zones) {
      const zoneLen = zone.end - zone.start;
      if (zoneLen <= 0) continue;

      const needLeft = !!zone.leftOp;
      const needRight = !!zone.rightOp;

      if (!needLeft && !needRight) {
        fillClearSpan(zone.start, zone.end);
        continue;
      }

      let leftBase = 0;
      let rightBase = 0;

      if (needLeft && needRight) {
        if (zoneLen <= PANEL_WIDTH) {
          addPier(zone.start, zoneLen, zone.leftOp, zone.rightOp);
          continue;
        } else if (zoneLen <= 2 * maxBase) {
          leftBase = Math.min(maxBase, Math.floor(zoneLen / 2));
          rightBase = Math.min(maxBase, zoneLen - leftBase);
        } else {
          leftBase = maxBase;
          rightBase = maxBase;
        }
      } else if (needLeft) {
        leftBase = Math.min(maxBase, zoneLen);
      } else {
        rightBase = Math.min(maxBase, zoneLen);
      }

      // If the fill span between L-cuts would be too small for a panel,
      // extend the L-cut(s) to absorb the remainder (avoids thin slivers)
      const fillStart0 = zone.start + (leftBase > 0 ? leftBase + PANEL_GAP : 0);
      const fillEnd0 = zone.end - (rightBase > 0 ? rightBase + PANEL_GAP : 0);
      const fillLen0 = fillEnd0 - fillStart0;
      if (fillLen0 > 0 && fillLen0 < MIN_PANEL) {
        // Distribute remainder to whichever L-cut exists
        if (leftBase > 0 && rightBase > 0) {
          leftBase += Math.ceil(fillLen0 / 2);
          rightBase = zoneLen - leftBase;
        } else if (leftBase > 0) {
          leftBase = zoneLen;
        } else {
          rightBase = zoneLen;
        }
      }

      if (needLeft && leftBase >= MIN_PANEL) {
        addLcut(zone.start, leftBase, zone.leftOp, 'right');
      }

      const fillStart = zone.start + (leftBase > 0 ? leftBase + PANEL_GAP : 0);
      const fillEnd = zone.end - (rightBase > 0 ? rightBase + PANEL_GAP : 0);
      if (fillEnd - fillStart >= MIN_PANEL) {
        fillClearSpan(fillStart, fillEnd);
      }

      if (needRight && rightBase >= MIN_PANEL) {
        addLcut(zone.end - rightBase, rightBase, zone.rightOp, 'left');
      }
    }
  }

  panels.forEach((p, i) => { p.index = i; });

  // For gable walls, detect panels that straddle the peak and stamp them
  // with peakHeight and peakXLocal so profile renderers can draw a pentagon.
  if (profile === WALL_PROFILES.GABLE) {
    const peakX = wall.peak_position_mm ?? Math.round(grossLength / 2);
    panels.forEach(panel => {
      const panelRight = panel.x + panel.width;
      if (panel.x < peakX && panelRight > peakX) {
        panel.peakHeight = Math.round(heightAt(peakX));
        panel.peakXLocal = peakX - panel.x;
      }
    });
  }

  // Compute vertical course layout (multi-course for walls > 3050mm)
  // Use maxHeight so raked/gable walls trigger multi-course when any part exceeds sheet height
  // Determine preferred bottom course height based on wall profile
  const maxStockSheet = Math.max(...STOCK_SHEET_HEIGHTS);
  let preferredBottom = wall.preferred_sheet_height || null;
  if (!preferredBottom && maxHeight > maxStockSheet) {
    if (profile === WALL_PROFILES.RAKED) {
      // Use the actual lower wall height as the course split point
      // (the sheet that covers it is tracked separately in sheetHeight)
      const lowerH = Math.min(height, heightAt ? heightAt(grossLength) : height);
      preferredBottom = lowerH;
    } else if (profile === WALL_PROFILES.GABLE) {
      // Use the actual base wall height as the course split point
      preferredBottom = height;
    } else {
      // Standard flat wall — default to smaller sheet
      preferredBottom = Math.min(...STOCK_SHEET_HEIGHTS);
    }
  }

  const { courses, isMultiCourse } = computeCourses(maxHeight, STOCK_SHEET_HEIGHTS, preferredBottom);

  // ── Replicate panels across courses ──
  // The panels array so far represents horizontal positions for a single row.
  // For multi-course walls, each course gets its own copy with adjusted heights.
  let allPanels;

  if (!isMultiCourse) {
    // Single course — tag panels and assign sheet heights as before
    panels.forEach(panel => {
      panel.course = 0;
      panel.courseY = 0;
      const panelMaxH = Math.max(panel.heightLeft, panel.heightRight, panel.peakHeight || 0);
      panel.sheetHeight = STOCK_SHEET_HEIGHTS.find(s => s >= panelMaxH) || maxStockSheet;
      panel.isMultiCourse = false;
    });
    allPanels = panels;
  } else {
    allPanels = [];

    for (let ci = 0; ci < courses.length; ci++) {
      const course = courses[ci];
      const courseTop = course.y + course.height;

      for (const basePanel of panels) {
        // Compute this panel's absolute height range at its edges for this course
        const absLeftH = Math.max(basePanel.heightLeft, basePanel.heightRight, basePanel.peakHeight || 0) > 0
          ? basePanel.heightLeft : height;
        const absRightH = Math.max(basePanel.heightLeft, basePanel.heightRight, basePanel.peakHeight || 0) > 0
          ? basePanel.heightRight : height;

        // For raked/gable, use heightAt to get absolute heights at panel edges
        const absHL = Math.round(heightAt(basePanel.x));
        const absHR = Math.round(heightAt(basePanel.x + basePanel.width));

        // Panel height within this course
        const courseHL = Math.max(0, Math.min(absHL, courseTop) - course.y);
        const courseHR = Math.max(0, Math.min(absHR, courseTop) - course.y);

        // Skip if this panel has zero height in this course
        if (courseHL <= 0 && courseHR <= 0) continue;

        // Determine panel type for this course
        let panelType = basePanel.type;
        let panelProps = {};

        if (basePanel.type === 'lcut') {
          // Check if the opening intersects this course's vertical range
          const openBottom = basePanel.openBottom || 0;
          const openTop = basePanel.openTop || 0;
          const overlaps = openBottom < courseTop && openTop > course.y;

          if (overlaps) {
            // Opening intersects this course — keep as L-cut with adjusted open coords
            panelProps = {
              openingRefs: basePanel.openingRefs,
              side: basePanel.side,
              openLeft: basePanel.openLeft,
              openRight: basePanel.openRight,
              openBottom: Math.max(0, openBottom - course.y),
              openTop: Math.min(course.height, openTop - course.y),
              openingType: basePanel.openingType,
            };
            if (basePanel.side === 'pier') {
              panelProps.rightOpenLeft = basePanel.rightOpenLeft;
              panelProps.rightOpenRight = basePanel.rightOpenRight;
              panelProps.rightOpenBottom = Math.max(0, (basePanel.rightOpenBottom || 0) - course.y);
              panelProps.rightOpenTop = Math.min(course.height, (basePanel.rightOpenTop || 0) - course.y);
              panelProps.rightOpeningType = basePanel.rightOpeningType;
            }
          } else {
            // Opening doesn't reach this course — emit as full or end panel
            panelType = basePanel.width < PANEL_WIDTH ? 'end' : 'full';
          }
        }

        // Gable peak detection for this course
        let panelPeakHeight;
        let panelPeakXLocal;
        if (profile === WALL_PROFILES.GABLE && basePanel.peakHeight != null) {
          const absPeakH = basePanel.peakHeight;
          const coursePeakH = Math.max(0, Math.min(absPeakH, courseTop) - course.y);
          if (coursePeakH > 0) {
            panelPeakHeight = coursePeakH;
            panelPeakXLocal = basePanel.peakXLocal;
          }
        }

        const panelMaxH = Math.max(courseHL, courseHR, panelPeakHeight || 0);

        allPanels.push({
          x: basePanel.x,
          width: basePanel.width,
          pitch: basePanel.pitch,
          height: course.height,
          type: panelType,
          heightLeft: courseHL,
          heightRight: courseHR,
          peakHeight: panelPeakHeight,
          peakXLocal: panelPeakXLocal,
          course: ci,
          courseY: course.y,
          sheetHeight: course.sheetHeight,
          isMultiCourse: true,
          ...panelProps,
        });
      }
    }

    // Re-index all panels
    allPanels.forEach((p, i) => { p.index = i; });
  }

  return {
    grossLength,
    netLength,
    height,
    maxHeight,
    isRaked,
    profile,
    heightAt,
    heightLeft: Math.round(heightAt(0)),
    heightRight: Math.round(heightAt(grossLength)),
    peakHeight: profile === WALL_PROFILES.GABLE
      ? Math.round(heightAt(wall.peak_position_mm ?? grossLength / 2))
      : undefined,
    peakPosition: profile === WALL_PROFILES.GABLE
      ? (wall.peak_position_mm ?? Math.round(grossLength / 2))
      : undefined,
    deductionLeft: dedLeft,
    deductionRight: dedRight,
    panels: allPanels,
    openings: openingDetails,
    footers,
    lintels,
    courses,
    isMultiCourse,
    totalPanels: allPanels.length,
    fullPanels: allPanels.filter(p => p.type === 'full').length,
    lcutPanels: allPanels.filter(p => p.type === 'lcut').length,
    endPanels: allPanels.filter(p => p.type === 'end').length,
  };
}

/**
 * Choose the best panel height for a given wall height.
 */
export function recommendPanelHeight(wallHeight) {
  for (const h of STOCK_SHEET_HEIGHTS) {
    if (h >= wallHeight) return h;
  }
  return STOCK_SHEET_HEIGHTS[STOCK_SHEET_HEIGHTS.length - 1];
}
