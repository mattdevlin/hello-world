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
  FLOOR_THICKNESS, DEFAULT_PERIMETER_PLATE_WIDTH,
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
    // Panels run along X-axis
    const startY = bb.minY;
    const endY = bb.maxY;
    let x = bb.minX;

    while (x < bb.maxX) {
      const panelW = Math.min(PANEL_WIDTH, bb.maxX - x);
      if (panelW < 1) break;

      const rect = { x, y: startY, width: panelW, height: endY - startY };
      const clipped = clipRectToPolygon(rect, polygon);
      const clippedArea = clipped.length >= 3 ? Math.abs(polygonArea(clipped)) : 0;
      const fullArea = panelW * (endY - startY);

      if (clippedArea > 100) { // minimum viable area
        const type = Math.abs(clippedArea - fullArea) / fullArea < 0.01 ? 'full' : 'edge';
        panels.push({
          index,
          x,
          y: startY,
          width: panelW,
          length: endY - startY,
          type,
          clippedPolygon: clipped,
          area: Math.round(clippedArea),
          openingCuts: [],
          recessCuts: [],
        });
        index++;
      }

      x += PANEL_PITCH;
    }
  } else {
    // Panels run along Y-axis (direction = 90)
    const startX = bb.minX;
    const endX = bb.maxX;
    let y = bb.minY;

    while (y < bb.maxY) {
      const panelL = Math.min(PANEL_WIDTH, bb.maxY - y);
      if (panelL < 1) break;

      const rect = { x: startX, y, width: endX - startX, height: panelL };
      const clipped = clipRectToPolygon(rect, polygon);
      const clippedArea = clipped.length >= 3 ? Math.abs(polygonArea(clipped)) : 0;
      const fullArea = (endX - startX) * panelL;

      if (clippedArea > 100) {
        const type = Math.abs(clippedArea - fullArea) / fullArea < 0.01 ? 'full' : 'edge';
        panels.push({
          index,
          x: startX,
          y,
          width: endX - startX,
          length: panelL,
          type,
          clippedPolygon: clipped,
          area: Math.round(clippedArea),
          openingCuts: [],
          recessCuts: [],
        });
        index++;
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

  if (panelDirection === 0) {
    // Panels along X → long edges are top/bottom of panels (Y boundaries)
    // Splines at panel pitch boundaries (between adjacent panels along X)
    for (let i = 0; i < panels.length - 1; i++) {
      const p = panels[i];
      const nextP = panels[i + 1];
      // Check if they are adjacent (share an X boundary)
      const gapX = nextP.x - (p.x + p.width);
      if (Math.abs(gapX - PANEL_GAP) < 10) {
        const splineX = p.x + p.width + PANEL_GAP / 2 - SPLINE_WIDTH / 2;
        // Spline runs along Y within polygon bounds
        const splineLen = Math.min(p.length, nextP.length);
        if (splineLen > 0) {
          // Check if at a bearer line position → reinforced
          const atBearer = bearerLines.some(bl =>
            Math.abs(bl.position - (p.x + p.width + PANEL_GAP / 2)) < SPLINE_WIDTH
          );
          const spline = {
            x: splineX,
            y: p.y,
            length: splineLen,
            width: SPLINE_WIDTH,
            depth: FLOOR_SPLINE_DEPTH,
          };
          if (atBearer) {
            reinforcedSplines.push({ ...spline, hasSteelChannel: true });
          } else {
            // Long panel edges → reinforced
            reinforcedSplines.push({ ...spline, hasSteelChannel: false });
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
        const splineY = p.y + p.length + PANEL_GAP / 2 - SPLINE_WIDTH / 2;
        const splineLen = Math.min(p.width, nextP.width);
        if (splineLen > 0) {
          const atBearer = bearerLines.some(bl =>
            Math.abs(bl.position - (p.y + p.length + PANEL_GAP / 2)) < SPLINE_WIDTH
          );
          const spline = {
            x: p.x,
            y: splineY,
            length: splineLen,
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

  return { reinforcedSplines, unreinforcedSplines };
}
