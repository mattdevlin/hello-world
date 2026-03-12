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

  // ── Generate panel grid ──
  const panels = generatePanelGrid(poly, bb, panelDirection);

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
    panels, poly, bb, panelDirection, bearerLines
  );

  // ── Generate bearer line segments ──
  const enrichedBearerLines = bearerLines.map(bl => {
    const pos = bl.position;
    const segments = [];
    // Find intersection of bearer line with polygon
    if (panelDirection === 0) {
      // Bearer lines run along Y at position X
      const edges = polygonEdges(poly);
      const intersections = [];
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
      // Bearer lines run along X at position Y
      const edges = polygonEdges(poly);
      const intersections = [];
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
    return { position: pos, segments };
  });

  // ── Generate short-edge joins ──
  const shortEdgeJoins = generateShortEdgeJoins(poly, bb, panelDirection);

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
  };
}

/**
 * Generate panel grid clipped to polygon.
 */
function generatePanelGrid(polygon, bb, panelDirection) {
  const panels = [];
  let index = 0;

  if (panelDirection === 0) {
    // Panels run along X-axis, span along Y — split at MAX_SHEET_HEIGHT intervals along Y
    const yBreaks = [bb.minY];
    let yb = bb.minY + MAX_SHEET_HEIGHT;
    while (yb < bb.maxY) { yBreaks.push(yb); yb += MAX_SHEET_HEIGHT; }
    yBreaks.push(bb.maxY);

    let x = bb.minX;
    while (x < bb.maxX) {
      const panelW = Math.min(PANEL_WIDTH, bb.maxX - x);
      if (panelW < 1) break;

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
          });
          index++;
        }
      }

      x += PANEL_PITCH;
    }
  } else {
    // Panels run along Y-axis, span along X — split at MAX_SHEET_HEIGHT intervals along X
    const xBreaks = [bb.minX];
    let xb = bb.minX + MAX_SHEET_HEIGHT;
    while (xb < bb.maxX) { xBreaks.push(xb); xb += MAX_SHEET_HEIGHT; }
    xBreaks.push(bb.maxX);

    let y = bb.minY;
    while (y < bb.maxY) {
      const panelL = Math.min(PANEL_WIDTH, bb.maxY - y);
      if (panelL < 1) break;

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
          });
          index++;
        }
      }

      y += PANEL_PITCH;
    }
  }

  return panels;
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
function generateSplines(panels, polygon, bb, panelDirection, bearerLines) {
  const reinforcedSplines = [];
  const unreinforcedSplines = [];
  const edges = polygonEdges(polygon);

  if (panelDirection === 0) {
    // Panels along X → splines at panel pitch boundaries (between adjacent panels along X)
    for (let i = 0; i < panels.length - 1; i++) {
      const p = panels[i];
      const nextP = panels[i + 1];
      const gapX = nextP.x - (p.x + p.width);
      if (Math.abs(gapX - PANEL_GAP) < 10) {
        const splineCenterX = p.x + p.width + PANEL_GAP / 2;
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
          Math.abs(bl.position - splineCenterX) < SPLINE_WIDTH
        );

        // Create one spline segment per inside-polygon interval
        for (let j = 0; j < intersections.length - 1; j += 2) {
          const segY = intersections[j];
          const segLen = intersections[j + 1] - intersections[j];
          if (segLen > 0) {
            const spline = {
              x: splineX,
              y: segY,
              length: segLen,
              width: SPLINE_WIDTH,
              depth: FLOOR_SPLINE_DEPTH,
            };
            if (atBearer) {
              reinforcedSplines.push({ ...spline, hasSteelChannel: true });
            } else {
              reinforcedSplines.push({ ...spline, hasSteelChannel: false });
            }
          }
        }
      }
    }
  } else {
    // Panels along Y → splines at panel pitch boundaries along Y
    for (let i = 0; i < panels.length - 1; i++) {
      const p = panels[i];
      const nextP = panels[i + 1];
      const gapY = nextP.y - (p.y + p.length);
      if (Math.abs(gapY - PANEL_GAP) < 10) {
        const splineCenterY = p.y + p.length + PANEL_GAP / 2;
        const splineY = splineCenterY - SPLINE_WIDTH / 2;

        // Find horizontal line intersections with polygon edges
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
          Math.abs(bl.position - splineCenterY) < SPLINE_WIDTH
        );

        for (let j = 0; j < intersections.length - 1; j += 2) {
          const segX = intersections[j];
          const segLen = intersections[j + 1] - intersections[j];
          if (segLen > 0) {
            const spline = {
              x: segX,
              y: splineY,
              length: segLen,
              width: SPLINE_WIDTH,
              depth: FLOOR_SPLINE_DEPTH,
            };
            if (atBearer) {
              reinforcedSplines.push({ ...spline, hasSteelChannel: true });
            } else {
              reinforcedSplines.push({ ...spline, hasSteelChannel: false });
            }
          }
        }
      }
    }
  }

  // ── Unreinforced splines at short-edge joins (between reinforced splines) ──
  // Mirrors wall horizontal splines: one segment per panel column, bounded by
  // adjacent reinforced splines on each side.
  const reinforcedCenters = [...new Set(
    reinforcedSplines.map(s => s.x + s.width / 2)
  )].sort((a, b) => a - b);

  if (panelDirection === 0) {
    // Unique column X positions and widths
    const colMap = new Map();
    for (const p of panels) {
      if (!colMap.has(p.x)) colMap.set(p.x, p.width);
    }
    const columnXs = [...colMap.keys()].sort((a, b) => a - b);

    // Join Y positions
    const joinYs = [];
    let jy = bb.minY + MAX_SHEET_HEIGHT;
    while (jy < bb.maxY) { joinYs.push(jy); jy += MAX_SHEET_HEIGHT; }

    for (const joinY of joinYs) {
      // Get polygon X intersections at this Y (inside segments)
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
        const colW = colMap.get(colX);

        // Check this column has panels at the join
        const hasPanel = panels.some(p =>
          p.x === colX && (Math.abs(p.y + p.length - joinY) < 1 || Math.abs(p.y - joinY) < 1)
        );
        if (!hasPanel) continue;

        // Left edge: right side of left reinforced spline, or polygon edge
        let leftEdge = colX;
        const leftSpline = reinforcedCenters.find(sx => sx < colX && colX - sx < PANEL_PITCH);
        if (leftSpline != null) leftEdge = leftSpline + SPLINE_WIDTH / 2;

        // Right edge: left side of right reinforced spline, or polygon edge
        let rightEdge = colX + colW;
        const rightSpline = reinforcedCenters.find(sx => sx > colX && sx - colX < PANEL_PITCH);
        if (rightSpline != null) rightEdge = rightSpline - SPLINE_WIDTH / 2;

        // Clip to polygon interior at joinY
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
    // dir=90: Unique row Y positions and heights
    const rowMap = new Map();
    for (const p of panels) {
      if (!rowMap.has(p.y)) rowMap.set(p.y, p.length);
    }
    const rowYs = [...rowMap.keys()].sort((a, b) => a - b);

    // Reinforced spline centers are along Y for dir=90
    const reinforcedYCenters = [...new Set(
      reinforcedSplines.map(s => s.y + s.length / 2)
    )].sort((a, b) => a - b);

    // Join X positions
    const joinXs = [];
    let jx = bb.minX + MAX_SHEET_HEIGHT;
    while (jx < bb.maxX) { joinXs.push(jx); jx += MAX_SHEET_HEIGHT; }

    for (const joinX of joinXs) {
      // Get polygon Y intersections at this X
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
        const rowH = rowMap.get(rowY);

        const hasPanel = panels.some(p =>
          p.y === rowY && (Math.abs(p.x + p.width - joinX) < 1 || Math.abs(p.x - joinX) < 1)
        );
        if (!hasPanel) continue;

        let topEdge = rowY;
        const topSpline = reinforcedYCenters.find(sy => sy < rowY && rowY - sy < PANEL_PITCH);
        if (topSpline != null) topEdge = topSpline + SPLINE_WIDTH / 2;

        let bottomEdge = rowY + rowH;
        const bottomSpline = reinforcedYCenters.find(sy => sy > rowY && sy - rowY < PANEL_PITCH);
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
function generateShortEdgeJoins(polygon, bb, panelDirection) {
  const edges = polygonEdges(polygon);
  const joins = [];

  if (panelDirection === 0) {
    // Panels span along Y → joins are horizontal lines at Y intervals
    let y = bb.minY + MAX_SHEET_HEIGHT;
    while (y < bb.maxY) {
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
      y += MAX_SHEET_HEIGHT;
    }
  } else {
    // Panels span along X → joins are vertical lines at X intervals
    let x = bb.minX + MAX_SHEET_HEIGHT;
    while (x < bb.maxX) {
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
      x += MAX_SHEET_HEIGHT;
    }
  }

  return joins;
}
