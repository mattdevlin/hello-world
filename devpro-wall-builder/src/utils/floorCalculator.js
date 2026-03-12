/**
 * Floor Layout Calculator
 *
 * Takes a floor definition (polygon outline, panel direction, openings, recesses,
 * bearer lines) and computes the complete panel layout for a floor SIP system.
 *
 * Floor panels: 192mm depth (172mm EPS + 2×10mm magboard)
 * Panel pitch: 1205mm (1200mm + 5mm gap), same as walls
 * Spline width: 146mm
 * Perimeter plates: configurable width × 170mm deep
 */

import {
  PANEL_PITCH, PANEL_WIDTH, PANEL_GAP, SPLINE_WIDTH,
  FLOOR_EPS_DEPTH, FLOOR_SPLINE_DEPTH, FLOOR_PLATE_DEPTH,
  FLOOR_THICKNESS, DEFAULT_PERIMETER_PLATE_WIDTH, MAX_SHEET_HEIGHT,
  MIN_FLOOR_PANEL_WIDTH, FLOOR_PENETRATION_CLEARANCE,
} from './constants.js';

import {
  boundingBox, polygonArea, polygonPerimeter, polygonEdges,
  clipRectToPolygon, rectOverlapsOpening, circleToPolygon,
} from './polygonUtils.js';

const EPS_INSET = 10; // mm inset from framing for EPS

/**
 * Calculate complete floor layout from a floor definition.
 *
 * @param {Object} floor - Floor definition object
 * @returns {Object} Complete floor layout
 */
export function calculateFloorLayout(floor) {
  const {
    polygon = [],
    panelDirection = 0,
    perimeterPlateWidth = DEFAULT_PERIMETER_PLATE_WIDTH,
    bearerLines = [],
    openings = [],
    recesses = [],
  } = floor;

  if (polygon.length < 3) {
    return { error: 'Floor polygon must have at least 3 points', panels: [] };
  }

  // Ensure polygon is CCW (positive area)
  const rawArea = polygonArea(polygon);
  const poly = rawArea < 0 ? [...polygon].reverse() : polygon;

  const bb = boundingBox(poly);
  const totalArea = Math.abs(polygonArea(poly));
  const perimeterLen = polygonPerimeter(poly);

  // ── Compute span breaks once (shared by panel grid, splines, short-edge joins) ──
  const spanBreaks = computeSpanBreaks(bb, panelDirection, openings);

  // ── Generate panel grid ──
  const { panels, columnPositions } = generatePanelGrid(poly, bb, panelDirection, openings, spanBreaks);

  // ── Process openings ──
  const enrichedOpenings = openings.map((op, i) => {
    const affectedPanels = panels
      .filter(p => rectOverlapsOpening(
        { x: p.x, y: p.y, width: p.width, height: p.length },
        op
      ))
      .map(p => p.index);

    return {
      ...op,
      index: i,
      affectedPanels,
      cutoutPolygon: op.type === 'circular'
        ? circleToPolygon(op.x, op.y, op.diameter / 2, 32)
        : [
            { x: op.x, y: op.y },
            { x: op.x + op.width, y: op.y },
            { x: op.x + op.width, y: op.y + op.length },
            { x: op.x, y: op.y + op.length },
          ],
    };
  });

  // Mark panels with opening cuts
  for (const panel of panels) {
    panel.openingCuts = [];
    for (const op of enrichedOpenings) {
      if (op.affectedPanels.includes(panel.index)) {
        panel.openingCuts.push(op.ref || `O${op.index + 1}`);
      }
    }
  }

  // ── Process recesses ──
  const enrichedRecesses = recesses.map((rec, i) => {
    const recessDepth = rec.depth || 0;
    const recessPanelThickness = FLOOR_THICKNESS - recessDepth;
    const recessPlateWidth = rec.plateWidth || DEFAULT_PERIMETER_PLATE_WIDTH;

    const cutoutRegion = {
      x: rec.x,
      y: rec.y,
      width: rec.width,
      height: rec.length,
    };

    const affectedPanels = panels
      .filter(p => {
        const pr = { x: p.x, y: p.y, width: p.width, height: p.length };
        return pr.x < cutoutRegion.x + cutoutRegion.width && pr.x + pr.width > cutoutRegion.x &&
               pr.y < cutoutRegion.y + cutoutRegion.height && pr.y + pr.height > cutoutRegion.y;
      })
      .map(p => p.index);

    // Generate recess plates (along exposed edges within the floor, not perimeter)
    const recessPlates = [];
    if (rec.type === 'shower') {
      // Plates along all four edges of the recess
      const w = rec.width;
      const l = rec.length;
      recessPlates.push(
        { x1: rec.x, y1: rec.y, x2: rec.x + w, y2: rec.y, width: recessPlateWidth, depth: FLOOR_PLATE_DEPTH },
        { x1: rec.x, y1: rec.y + l, x2: rec.x + w, y2: rec.y + l, width: recessPlateWidth, depth: FLOOR_PLATE_DEPTH },
        { x1: rec.x, y1: rec.y, x2: rec.x, y2: rec.y + l, width: recessPlateWidth, depth: FLOOR_PLATE_DEPTH },
        { x1: rec.x + w, y1: rec.y, x2: rec.x + w, y2: rec.y + l, width: recessPlateWidth, depth: FLOOR_PLATE_DEPTH },
      );
    }

    return {
      ...rec,
      index: i,
      affectedPanels,
      recessPanelThickness,
      recessPlates,
      cutoutRegion,
    };
  });

  // Mark panels with recess cuts
  for (const panel of panels) {
    panel.recessCuts = [];
    for (const rec of enrichedRecesses) {
      if (rec.affectedPanels.includes(panel.index)) {
        panel.recessCuts.push(rec.ref || `R${rec.index + 1}`);
      }
    }
  }

  // ── Generate perimeter plates ──
  const perimeterPlates = generatePerimeterPlates(poly, perimeterPlateWidth);

  // ── Generate splines ──
  const { reinforcedSplines, unreinforcedSplines } = generateSplines(
    panels, poly, bb, panelDirection, bearerLines, columnPositions, spanBreaks
  );

  // ── Generate bearer line segments ──
  const enrichedBearerLines = bearerLines.map(bl => {
    const pos = bl.position;
    const orientation = bl.orientation || 'vertical';
    const segments = [];
    const edges = polygonEdges(poly);
    const intersections = [];

    if (orientation === 'vertical') {
      // Vertical bearer at X=pos, find Y intersections
      for (const edge of edges) {
        if ((edge.x1 <= pos && edge.x2 >= pos) || (edge.x2 <= pos && edge.x1 >= pos)) {
          if (Math.abs(edge.x2 - edge.x1) < 0.001) continue;
          const t = (pos - edge.x1) / (edge.x2 - edge.x1);
          if (t >= 0 && t <= 1) intersections.push(edge.y1 + t * (edge.y2 - edge.y1));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length - 1; i += 2) {
        segments.push({ x1: pos, y1: intersections[i], x2: pos, y2: intersections[i + 1] });
      }
    } else {
      // Horizontal bearer at Y=pos, find X intersections
      for (const edge of edges) {
        if ((edge.y1 <= pos && edge.y2 >= pos) || (edge.y2 <= pos && edge.y1 >= pos)) {
          if (Math.abs(edge.y2 - edge.y1) < 0.001) continue;
          const t = (pos - edge.y1) / (edge.y2 - edge.y1);
          if (t >= 0 && t <= 1) intersections.push(edge.x1 + t * (edge.x2 - edge.x1));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length - 1; i += 2) {
        segments.push({ x1: intersections[i], y1: pos, x2: intersections[i + 1], y2: pos });
      }
    }
    return { position: pos, orientation, segments };
  });

  // ── Generate short-edge joins ──
  const shortEdgeJoins = generateShortEdgeJoins(poly, bb, panelDirection, spanBreaks);

  // ── Summary stats ──
  const fullPanels = panels.filter(p => p.type === 'full').length;
  const edgePanels = panels.filter(p => p.type === 'edge').length;

  return {
    polygon: poly,
    panelDirection,
    boundingBox: bb,
    panels,
    perimeterPlates,
    reinforcedSplines,
    unreinforcedSplines,
    bearerLines: enrichedBearerLines,
    shortEdgeJoins,
    openings: enrichedOpenings,
    recesses: enrichedRecesses,
    totalPanels: panels.length,
    fullPanels,
    edgePanels,
    totalArea: Math.round(totalArea),
    perimeterLength: Math.round(perimeterLen),
    perimeterPlateWidth,
    columnPositions,
    spanBreaks,
  };
}

/**
 * Compute exclusion zones from openings that conflict with spline positions.
 * Returns merged, sorted zones along the column axis.
 */
function computeExclusionZones(openings, panelDirection, minPos, maxPos) {
  const CLEARANCE = FLOOR_PENETRATION_CLEARANCE;
  const zones = [];

  // Compute standard spline positions to check for conflicts
  const splinePositions = [];
  let sp = minPos + PANEL_WIDTH + PANEL_GAP / 2;
  while (sp < maxPos) {
    splinePositions.push({
      center: sp,
      left: sp - SPLINE_WIDTH / 2,
      right: sp + SPLINE_WIDTH / 2,
    });
    sp += PANEL_PITCH;
  }

  for (let oi = 0; oi < openings.length; oi++) {
    const op = openings[oi];
    let zoneStart, zoneEnd;

    if (panelDirection === 0) {
      if (op.type === 'circular') {
        const r = op.diameter / 2;
        zoneStart = op.x - r - CLEARANCE;
        zoneEnd = op.x + r + CLEARANCE;
      } else {
        zoneStart = op.x - CLEARANCE;
        zoneEnd = op.x + op.width + CLEARANCE;
      }
    } else {
      if (op.type === 'circular') {
        const r = op.diameter / 2;
        zoneStart = op.y - r - CLEARANCE;
        zoneEnd = op.y + r + CLEARANCE;
      } else {
        zoneStart = op.y - CLEARANCE;
        zoneEnd = op.y + op.length + CLEARANCE;
      }
    }

    // Check if this zone conflicts with any spline position
    const conflictsWithSpline = splinePositions.some(
      s => zoneStart < s.right && zoneEnd > s.left
    );
    if (!conflictsWithSpline) continue;

    // Expand to MIN_FLOOR_PANEL_WIDTH if zone is narrower
    const zoneWidth = zoneEnd - zoneStart;
    if (zoneWidth < MIN_FLOOR_PANEL_WIDTH) {
      const expand = (MIN_FLOOR_PANEL_WIDTH - zoneWidth) / 2;
      zoneStart -= expand;
      zoneEnd += expand;
    }

    // Clamp to bounding box
    zoneStart = Math.max(zoneStart, minPos);
    zoneEnd = Math.min(zoneEnd, maxPos);

    zones.push({ start: zoneStart, end: zoneEnd, openingIndices: [oi] });
  }

  if (zones.length === 0) return zones;

  // Sort and merge overlapping zones
  zones.sort((a, b) => a.start - b.start);
  const merged = [zones[0]];
  for (let i = 1; i < zones.length; i++) {
    const last = merged[merged.length - 1];
    if (zones[i].start <= last.end) {
      last.end = Math.max(last.end, zones[i].end);
      last.openingIndices.push(...zones[i].openingIndices);
    } else {
      merged.push(zones[i]);
    }
  }
  return merged;
}

/**
 * Compute span-axis break positions, adjusting for penetration conflicts.
 * Span axis is Y for dir=0, X for dir=90.
 *
 * @param {Object} bb - bounding box
 * @param {number} panelDirection - 0 or 90
 * @param {Array} openings - floor openings
 * @returns {number[]} Full break array including min and max boundaries.
 */
export function computeSpanBreaks(bb, panelDirection, openings) {
  const CLEARANCE = FLOOR_PENETRATION_CLEARANCE;
  const minSpan = panelDirection === 0 ? bb.minY : bb.minX;
  const maxSpan = panelDirection === 0 ? bb.maxY : bb.maxX;

  // No breaks needed if total span fits in one sheet
  if (maxSpan - minSpan <= MAX_SHEET_HEIGHT) {
    return [minSpan, maxSpan];
  }

  // Compute span-axis exclusion zones per opening (spline must not overlap these)
  const zones = [];
  if (openings && openings.length > 0) {
    for (const op of openings) {
      let zoneStart, zoneEnd;
      if (panelDirection === 0) {
        if (op.type === 'circular') {
          const r = op.diameter / 2;
          zoneStart = op.y - r - CLEARANCE;
          zoneEnd = op.y + r + CLEARANCE;
        } else {
          zoneStart = op.y - CLEARANCE;
          zoneEnd = op.y + op.length + CLEARANCE;
        }
      } else {
        if (op.type === 'circular') {
          const r = op.diameter / 2;
          zoneStart = op.x - r - CLEARANCE;
          zoneEnd = op.x + r + CLEARANCE;
        } else {
          zoneStart = op.x - CLEARANCE;
          zoneEnd = op.x + op.width + CLEARANCE;
        }
      }
      zones.push({ start: zoneStart, end: zoneEnd });
    }
  }

  // Greedy forward placement: each break is placed relative to the previous
  // break, so penetration shifts cascade naturally and minimize total breaks.
  const breaks = [minSpan];

  while (maxSpan - breaks[breaks.length - 1] > MAX_SHEET_HEIGHT) {
    const prev = breaks[breaks.length - 1];
    let target = prev + MAX_SHEET_HEIGHT;

    // Check if spline band at target conflicts with any exclusion zone
    const splineLo = target - SPLINE_WIDTH / 2;
    const splineHi = target + SPLINE_WIDTH / 2;
    const conflicts = zones.filter(z => z.start < splineHi && z.end > splineLo);

    if (conflicts.length === 0) {
      // Check if remaining after this break would be too short
      if (maxSpan - target > 0 && maxSpan - target < MIN_FLOOR_PANEL_WIDTH) {
        // Pull break back so last segment is at least MIN_FLOOR_PANEL_WIDTH
        target = maxSpan - MIN_FLOOR_PANEL_WIDTH;
      }
      breaks.push(target);
      continue;
    }

    // Merge conflicting zones into one region
    const conflictStart = Math.min(...conflicts.map(z => z.start));
    const conflictEnd = Math.max(...conflicts.map(z => z.end));

    // Two candidate positions: just before and just after the conflict
    const candidateDown = conflictStart - SPLINE_WIDTH / 2;
    const candidateUp = conflictEnd + SPLINE_WIDTH / 2;

    const downValid = (candidateDown - prev) >= MIN_FLOOR_PANEL_WIDTH &&
                      (maxSpan - candidateDown) >= MIN_FLOOR_PANEL_WIDTH;
    const upValid = (candidateUp - prev) >= MIN_FLOOR_PANEL_WIDTH &&
                    (maxSpan - candidateUp) >= MIN_FLOOR_PANEL_WIDTH &&
                    (candidateUp - prev) <= MAX_SHEET_HEIGHT;

    let chosen;
    if (downValid && upValid) {
      const downDisp = Math.abs(target - candidateDown);
      const upDisp = Math.abs(target - candidateUp);
      chosen = downDisp <= upDisp ? candidateDown : candidateUp;
    } else if (downValid) {
      chosen = candidateDown;
    } else if (upValid) {
      chosen = candidateUp;
    } else {
      chosen = target; // unavoidable edge case
    }

    // If remaining after this break would be too short, pull back
    if (maxSpan - chosen > 0 && maxSpan - chosen < MIN_FLOOR_PANEL_WIDTH) {
      chosen = maxSpan - MIN_FLOOR_PANEL_WIDTH;
    }
    breaks.push(chosen);
  }

  breaks.push(maxSpan);
  return breaks;
}

/**
 * Fill a clear span with standard-pitch columns, handling remainders.
 * Returns array of { start, width } objects.
 */
function fillClearSpanColumns(spanStart, spanLen) {
  if (spanLen < MIN_FLOOR_PANEL_WIDTH) return [];

  const columns = [];
  const count = Math.floor(spanLen / PANEL_PITCH);
  const remainder = spanLen - count * PANEL_PITCH;
  let x = spanStart;

  for (let i = 0; i < count; i++) {
    columns.push({ start: x, width: PANEL_WIDTH });
    x += PANEL_PITCH;
  }

  if (remainder >= MIN_FLOOR_PANEL_WIDTH) {
    columns.push({ start: x, width: remainder });
  } else if (remainder > 0 && count > 0) {
    // Redistribute: split last column + remainder into two equal columns
    const last = columns[columns.length - 1];
    const combined = PANEL_PITCH + remainder;
    const each = Math.round(combined / 2);
    const firstWidth = each - PANEL_GAP;
    const secondWidth = combined - each - PANEL_GAP;
    last.width = firstWidth;
    columns.push({ start: last.start + each, width: secondWidth });
  } else if (remainder > 0 && count === 0) {
    columns.push({ start: x, width: spanLen });
  }

  return columns;
}

/**
 * Compute column positions along the panel-column axis, repositioning
 * splines to avoid penetration conflicts.
 *
 * @param {Object} bb - bounding box
 * @param {number} panelDirection - 0 or 90
 * @param {Array} openings - floor openings
 * @returns {Array<{start, width, isPenetration, openingIndices}>}
 */
export function computeColumnPositions(bb, panelDirection, openings) {
  const minPos = panelDirection === 0 ? bb.minX : bb.minY;
  const maxPos = panelDirection === 0 ? bb.maxX : bb.maxY;

  const zones = computeExclusionZones(openings || [], panelDirection, minPos, maxPos);

  // No conflicting openings → uniform pitch (same as before)
  if (zones.length === 0) {
    const columns = [];
    let pos = minPos;
    while (pos < maxPos) {
      const w = Math.min(PANEL_WIDTH, maxPos - pos);
      if (w < 1) break;
      columns.push({ start: pos, width: w, isPenetration: false, openingIndices: [] });
      pos += PANEL_PITCH;
    }
    return columns;
  }

  // Build clear spans between exclusion zones
  const columns = [];
  const spans = [];

  // Span before first zone
  if (zones[0].start > minPos) {
    spans.push({ start: minPos, end: zones[0].start - PANEL_GAP });
  }
  // Spans between zones
  for (let i = 0; i < zones.length - 1; i++) {
    const gapStart = zones[i].end + PANEL_GAP;
    const gapEnd = zones[i + 1].start - PANEL_GAP;
    if (gapEnd > gapStart) {
      spans.push({ start: gapStart, end: gapEnd });
    }
  }
  // Span after last zone
  const lastZone = zones[zones.length - 1];
  if (lastZone.end < maxPos) {
    spans.push({ start: lastZone.end + PANEL_GAP, end: maxPos });
  }

  // Fill each clear span with standard columns
  for (const span of spans) {
    const spanLen = span.end - span.start;
    const filled = fillClearSpanColumns(span.start, spanLen);
    for (const col of filled) {
      columns.push({ start: col.start, width: col.width, isPenetration: false, openingIndices: [] });
    }
  }

  // Add penetration columns for each zone
  for (const zone of zones) {
    columns.push({
      start: zone.start,
      width: zone.end - zone.start,
      isPenetration: true,
      openingIndices: zone.openingIndices,
    });
  }

  // Sort by start position
  columns.sort((a, b) => a.start - b.start);
  return columns;
}

/**
 * Generate panel grid clipped to polygon.
 */
function generatePanelGrid(polygon, bb, panelDirection, openings, spanBreaks) {
  const panels = [];
  let index = 0;
  const columnPositions = computeColumnPositions(bb, panelDirection, openings);

  if (panelDirection === 0) {
    // Panels run along X-axis, span along Y — split at span break positions along Y
    const yBreaks = spanBreaks;

    for (const col of columnPositions) {
      const x = col.start;
      const panelW = col.width;
      if (panelW < 1) continue;

      for (let s = 0; s < yBreaks.length - 1; s++) {
        const segY = yBreaks[s];
        const segH = yBreaks[s + 1] - segY;
        const rect = { x, y: segY, width: panelW, height: segH };
        const clipped = clipRectToPolygon(rect, polygon);
        const clippedArea = clipped.length >= 3 ? Math.abs(polygonArea(clipped)) : 0;
        const fullArea = panelW * segH;

        if (clippedArea > 100) {
          const type = Math.abs(clippedArea - fullArea) / fullArea < 0.01 ? 'full' : 'edge';
          panels.push({
            index, x, y: segY, width: panelW, length: segH,
            type, clippedPolygon: clipped, area: Math.round(clippedArea),
            openingCuts: [], recessCuts: [],
            isPenetrationPanel: col.isPenetration,
            columnIndex: columnPositions.indexOf(col),
          });
          index++;
        }
      }
    }
  } else {
    // Panels run along Y-axis, span along X — split at span break positions along X
    const xBreaks = spanBreaks;

    for (const col of columnPositions) {
      const y = col.start;
      const panelL = col.width;
      if (panelL < 1) continue;

      for (let s = 0; s < xBreaks.length - 1; s++) {
        const segX = xBreaks[s];
        const segW = xBreaks[s + 1] - segX;
        const rect = { x: segX, y, width: segW, height: panelL };
        const clipped = clipRectToPolygon(rect, polygon);
        const clippedArea = clipped.length >= 3 ? Math.abs(polygonArea(clipped)) : 0;
        const fullArea = segW * panelL;

        if (clippedArea > 100) {
          const type = Math.abs(clippedArea - fullArea) / fullArea < 0.01 ? 'full' : 'edge';
          panels.push({
            index, x: segX, y, width: segW, length: panelL,
            type, clippedPolygon: clipped, area: Math.round(clippedArea),
            openingCuts: [], recessCuts: [],
            isPenetrationPanel: col.isPenetration,
            columnIndex: columnPositions.indexOf(col),
          });
          index++;
        }
      }
    }
  }

  return { panels, columnPositions };
}

/**
 * Generate perimeter plates along polygon edges.
 */
function generatePerimeterPlates(polygon, plateWidth) {
  const edges = polygonEdges(polygon);
  return edges.map(edge => ({
    x1: edge.x1,
    y1: edge.y1,
    x2: edge.x2,
    y2: edge.y2,
    width: plateWidth,
    depth: FLOOR_PLATE_DEPTH,
  }));
}

/**
 * Generate reinforced and unreinforced splines.
 * Reinforced: along long panel edges and at bearer line positions
 * Unreinforced: along short panel edges
 */
function generateSplines(panels, polygon, bb, panelDirection, bearerLines, columnPositions, spanBreaks) {
  const reinforcedSplines = [];
  const unreinforcedSplines = [];
  const edges = polygonEdges(polygon);

  if (panelDirection === 0) {
    // Derive spline positions from adjacent column pairs
    for (let i = 0; i < columnPositions.length - 1; i++) {
      const col = columnPositions[i];
      const nextCol = columnPositions[i + 1];
      const gapStart = col.start + col.width;
      const gapEnd = nextCol.start;
      if (gapEnd <= gapStart) continue;

      const splineCenterX = (gapStart + gapEnd) / 2;
      const splineX = splineCenterX - SPLINE_WIDTH / 2;

      // Find vertical line intersections with polygon edges
      const intersections = [];
      for (const edge of edges) {
        if ((edge.x1 <= splineCenterX && edge.x2 >= splineCenterX) ||
            (edge.x2 <= splineCenterX && edge.x1 >= splineCenterX)) {
          if (Math.abs(edge.x2 - edge.x1) < 0.001) continue;
          const t = (splineCenterX - edge.x1) / (edge.x2 - edge.x1);
          if (t >= 0 && t <= 1) {
            intersections.push(edge.y1 + t * (edge.y2 - edge.y1));
          }
        }
      }
      intersections.sort((a, b) => a - b);

      const atBearer = bearerLines.some(bl =>
        (bl.orientation || 'vertical') === 'vertical' &&
        Math.abs(bl.position - splineCenterX) < SPLINE_WIDTH
      );

      for (let j = 0; j < intersections.length - 1; j += 2) {
        const segY = intersections[j];
        const segLen = intersections[j + 1] - intersections[j];
        if (segLen > 0) {
          reinforcedSplines.push({
            x: splineX, y: segY, length: segLen,
            width: SPLINE_WIDTH, depth: FLOOR_SPLINE_DEPTH,
            hasSteelChannel: atBearer,
          });
        }
      }
    }
  } else {
    // Panels along Y → splines at column boundaries along Y
    for (let i = 0; i < columnPositions.length - 1; i++) {
      const col = columnPositions[i];
      const nextCol = columnPositions[i + 1];
      const gapStart = col.start + col.width;
      const gapEnd = nextCol.start;
      if (gapEnd <= gapStart) continue;

      const splineCenterY = (gapStart + gapEnd) / 2;
      const splineY = splineCenterY - SPLINE_WIDTH / 2;

      const intersections = [];
      for (const edge of edges) {
        if ((edge.y1 <= splineCenterY && edge.y2 >= splineCenterY) ||
            (edge.y2 <= splineCenterY && edge.y1 >= splineCenterY)) {
          if (Math.abs(edge.y2 - edge.y1) < 0.001) continue;
          const t = (splineCenterY - edge.y1) / (edge.y2 - edge.y1);
          if (t >= 0 && t <= 1) {
            intersections.push(edge.x1 + t * (edge.x2 - edge.x1));
          }
        }
      }
      intersections.sort((a, b) => a - b);

      const atBearer = bearerLines.some(bl =>
        (bl.orientation || 'vertical') === 'horizontal' &&
        Math.abs(bl.position - splineCenterY) < SPLINE_WIDTH
      );

      for (let j = 0; j < intersections.length - 1; j += 2) {
        const segX = intersections[j];
        const segLen = intersections[j + 1] - intersections[j];
        if (segLen > 0) {
          reinforcedSplines.push({
            x: segX, y: splineY, length: segLen,
            width: SPLINE_WIDTH, depth: FLOOR_SPLINE_DEPTH,
            hasSteelChannel: atBearer,
          });
        }
      }
    }
  }

  // ── Unreinforced splines at short-edge joins (between reinforced splines) ──
  const reinforcedCenters = [...new Set(
    reinforcedSplines.map(s => s.x + s.width / 2)
  )].sort((a, b) => a - b);

  if (panelDirection === 0) {
    // Use columnPositions directly for column X positions and widths
    const columnXs = columnPositions.map(c => c.start);
    const colWidthMap = new Map(columnPositions.map(c => [c.start, c.width]));

    // Join Y positions — interior span breaks
    const joinYs = spanBreaks.slice(1, -1);

    for (const joinY of joinYs) {
      const polyIntersections = [];
      for (const edge of edges) {
        if ((edge.y1 <= joinY && edge.y2 >= joinY) || (edge.y2 <= joinY && edge.y1 >= joinY)) {
          if (Math.abs(edge.y2 - edge.y1) < 0.001) continue;
          const t = (joinY - edge.y1) / (edge.y2 - edge.y1);
          if (t >= 0 && t <= 1) polyIntersections.push(edge.x1 + t * (edge.x2 - edge.x1));
        }
      }
      polyIntersections.sort((a, b) => a - b);

      for (let ci = 0; ci < columnXs.length; ci++) {
        const colX = columnXs[ci];
        const colW = colWidthMap.get(colX);

        const hasPanel = panels.some(p =>
          p.x === colX && (Math.abs(p.y + p.length - joinY) < 1 || Math.abs(p.y - joinY) < 1)
        );
        if (!hasPanel) continue;

        let leftEdge = colX;
        // Find closest reinforced spline to the left (last one less than colX)
        for (let si = reinforcedCenters.length - 1; si >= 0; si--) {
          if (reinforcedCenters[si] < colX) { leftEdge = reinforcedCenters[si] + SPLINE_WIDTH / 2; break; }
        }

        let rightEdge = colX + colW;
        // Find closest reinforced spline to the right (first one greater than colX + colW)
        const rightSpline = reinforcedCenters.find(sx => sx > colX);
        if (rightSpline != null) rightEdge = rightSpline - SPLINE_WIDTH / 2;

        for (let k = 0; k < polyIntersections.length - 1; k += 2) {
          const polyL = polyIntersections[k];
          const polyR = polyIntersections[k + 1];
          const clippedL = Math.max(leftEdge, polyL);
          const clippedR = Math.min(rightEdge, polyR);
          if (clippedR - clippedL > 1) {
            unreinforcedSplines.push({
              x: clippedL, y: joinY - SPLINE_WIDTH / 2,
              width: clippedR - clippedL, length: SPLINE_WIDTH,
              depth: FLOOR_SPLINE_DEPTH,
            });
          }
        }
      }
    }
  } else {
    // dir=90: Use columnPositions for row Y positions
    const rowYs = columnPositions.map(c => c.start);
    const rowHeightMap = new Map(columnPositions.map(c => [c.start, c.width]));

    const reinforcedYCenters = [...new Set(
      reinforcedSplines.map(s => s.y + s.length / 2)
    )].sort((a, b) => a - b);

    // Join X positions — interior span breaks
    const joinXs = spanBreaks.slice(1, -1);

    for (const joinX of joinXs) {
      const polyIntersections = [];
      for (const edge of edges) {
        if ((edge.x1 <= joinX && edge.x2 >= joinX) || (edge.x2 <= joinX && edge.x1 >= joinX)) {
          if (Math.abs(edge.x2 - edge.x1) < 0.001) continue;
          const t = (joinX - edge.x1) / (edge.x2 - edge.x1);
          if (t >= 0 && t <= 1) polyIntersections.push(edge.y1 + t * (edge.y2 - edge.y1));
        }
      }
      polyIntersections.sort((a, b) => a - b);

      for (let ri = 0; ri < rowYs.length; ri++) {
        const rowY = rowYs[ri];
        const rowH = rowHeightMap.get(rowY);

        const hasPanel = panels.some(p =>
          p.y === rowY && (Math.abs(p.x + p.width - joinX) < 1 || Math.abs(p.x - joinX) < 1)
        );
        if (!hasPanel) continue;

        let topEdge = rowY;
        for (let si = reinforcedYCenters.length - 1; si >= 0; si--) {
          if (reinforcedYCenters[si] < rowY) { topEdge = reinforcedYCenters[si] + SPLINE_WIDTH / 2; break; }
        }

        let bottomEdge = rowY + rowH;
        const bottomSpline = reinforcedYCenters.find(sy => sy > rowY);
        if (bottomSpline != null) bottomEdge = bottomSpline - SPLINE_WIDTH / 2;

        for (let k = 0; k < polyIntersections.length - 1; k += 2) {
          const polyT = polyIntersections[k];
          const polyB = polyIntersections[k + 1];
          const clippedT = Math.max(topEdge, polyT);
          const clippedB = Math.min(bottomEdge, polyB);
          if (clippedB - clippedT > 1) {
            unreinforcedSplines.push({
              x: joinX - SPLINE_WIDTH / 2, y: clippedT,
              width: SPLINE_WIDTH, length: clippedB - clippedT,
              depth: FLOOR_SPLINE_DEPTH,
            });
          }
        }
      }
    }
  }

  return { reinforcedSplines, unreinforcedSplines };
}

/**
 * Generate short-edge join lines where magboard sheets butt together.
 * Sheets max out at MAX_SHEET_HEIGHT, so joins appear at that interval along the span axis.
 */
function generateShortEdgeJoins(polygon, bb, panelDirection, spanBreaks) {
  const edges = polygonEdges(polygon);
  const joins = [];
  const joinPositions = spanBreaks.slice(1, -1);

  if (panelDirection === 0) {
    // Panels span along Y → joins are horizontal lines at span break positions
    for (const y of joinPositions) {
      const intersections = [];
      for (const edge of edges) {
        if ((edge.y1 <= y && edge.y2 >= y) || (edge.y2 <= y && edge.y1 >= y)) {
          if (Math.abs(edge.y2 - edge.y1) < 0.001) continue;
          const t = (y - edge.y1) / (edge.y2 - edge.y1);
          if (t >= 0 && t <= 1) intersections.push(edge.x1 + t * (edge.x2 - edge.x1));
        }
      }
      intersections.sort((a, b) => a - b);
      const segments = [];
      for (let i = 0; i < intersections.length - 1; i += 2) {
        segments.push({ x1: intersections[i], y1: y, x2: intersections[i + 1], y2: y });
      }
      if (segments.length > 0) {
        joins.push({ position: y, segments });
      }
    }
  } else {
    // Panels span along X → joins are vertical lines at span break positions
    for (const x of joinPositions) {
      const intersections = [];
      for (const edge of edges) {
        if ((edge.x1 <= x && edge.x2 >= x) || (edge.x2 <= x && edge.x1 >= x)) {
          if (Math.abs(edge.x2 - edge.x1) < 0.001) continue;
          const t = (x - edge.x1) / (edge.x2 - edge.x1);
          if (t >= 0 && t <= 1) intersections.push(edge.y1 + t * (edge.y2 - edge.y1));
        }
      }
      intersections.sort((a, b) => a - b);
      const segments = [];
      for (let i = 0; i < intersections.length - 1; i += 2) {
        segments.push({ x1: x, y1: intersections[i], x2: x, y2: intersections[i + 1] });
      }
      if (segments.length > 0) {
        joins.push({ position: x, segments });
      }
    }
  }

  return joins;
}
