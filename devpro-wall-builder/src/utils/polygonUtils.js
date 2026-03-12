/**
 * 2D Polygon Geometry Utilities for Floor Builder
 *
 * All coordinates in mm. Polygons are arrays of {x, y} points,
 * wound counter-clockwise (positive area).
 */

/**
 * Bounding box of a polygon.
 * @param {Array<{x,y}>} polygon
 * @returns {{minX, minY, maxX, maxY, width, height}}
 */
export function boundingBox(polygon) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Ray-casting point-in-polygon test.
 * @param {{x,y}} point
 * @param {Array<{x,y}>} polygon
 * @returns {boolean}
 */
export function pointInPolygon(point, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Sutherland-Hodgman polygon clipping.
 * Clips subject polygon against a convex clip polygon.
 * @param {Array<{x,y}>} subject
 * @param {Array<{x,y}>} clip - must be convex
 * @returns {Array<{x,y}>}
 */
export function clipPolygonSH(subject, clip) {
  let output = [...subject];
  const clipLen = clip.length;

  for (let i = 0; i < clipLen; i++) {
    if (output.length === 0) return [];
    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clipLen];
    const input = output;
    output = [];

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const currInside = isInsideEdge(current, edgeStart, edgeEnd);
      const prevInside = isInsideEdge(prev, edgeStart, edgeEnd);

      if (currInside) {
        if (!prevInside) {
          output.push(lineIntersect(prev, current, edgeStart, edgeEnd));
        }
        output.push(current);
      } else if (prevInside) {
        output.push(lineIntersect(prev, current, edgeStart, edgeEnd));
      }
    }
  }
  return output;
}

function isInsideEdge(point, edgeStart, edgeEnd) {
  return (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
         (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x) >= 0;
}

function lineIntersect(p1, p2, p3, p4) {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

/**
 * Clip a rectangle to an arbitrary polygon.
 * For concave polygons, decomposes into convex parts first.
 * @param {{x, y, width, height}} rect
 * @param {Array<{x,y}>} polygon
 * @returns {Array<{x,y}>} clipped polygon (may be empty)
 */
export function clipRectToPolygon(rect, polygon) {
  const rectPoly = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  if (isConvex(polygon)) {
    return clipPolygonSH(rectPoly, polygon);
  }

  // For concave polygons, clip rect against each convex part and merge
  const convexParts = decomposeConvex(polygon);
  const results = [];
  for (const part of convexParts) {
    const clipped = clipPolygonSH(rectPoly, part);
    if (clipped.length >= 3) results.push(clipped);
  }

  // Return the largest clipped region (simplified approach)
  if (results.length === 0) return [];
  if (results.length === 1) return results[0];

  // For multiple parts, return the union approximated by the one with largest area
  let best = results[0];
  let bestArea = Math.abs(polygonArea(best));
  for (let i = 1; i < results.length; i++) {
    const a = Math.abs(polygonArea(results[i]));
    if (a > bestArea) { best = results[i]; bestArea = a; }
  }
  return best;
}

/**
 * Check if polygon is convex.
 */
export function isConvex(polygon) {
  const n = polygon.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const p0 = polygon[i];
    const p1 = polygon[(i + 1) % n];
    const p2 = polygon[(i + 2) % n];
    const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
    if (Math.abs(cross) > 1e-10) {
      if (sign === 0) sign = cross > 0 ? 1 : -1;
      else if ((cross > 0 ? 1 : -1) !== sign) return false;
    }
  }
  return true;
}

/**
 * Decompose a polygon into convex parts using ear-clipping triangulation,
 * then merge adjacent triangles with compatible normals.
 * Simple fallback: returns triangles.
 */
export function decomposeConvex(polygon) {
  // Simple ear-clipping triangulation
  const triangles = [];
  const pts = polygon.map((p, i) => ({ ...p, idx: i }));
  const verts = [...pts];

  while (verts.length > 3) {
    let earFound = false;
    for (let i = 0; i < verts.length; i++) {
      const prev = verts[(i + verts.length - 1) % verts.length];
      const curr = verts[i];
      const next = verts[(i + 1) % verts.length];

      // Check if this is a convex vertex (ear candidate)
      const cross = (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x);
      if (cross <= 0) continue; // reflex vertex

      // Check no other vertex is inside this triangle
      let isEar = true;
      for (let j = 0; j < verts.length; j++) {
        if (j === (i + verts.length - 1) % verts.length || j === i || j === (i + 1) % verts.length) continue;
        if (pointInTriangle(verts[j], prev, curr, next)) { isEar = false; break; }
      }

      if (isEar) {
        triangles.push([prev, curr, next]);
        verts.splice(i, 1);
        earFound = true;
        break;
      }
    }
    if (!earFound) break; // degenerate polygon
  }
  if (verts.length === 3) triangles.push([verts[0], verts[1], verts[2]]);

  return triangles;
}

function pointInTriangle(p, a, b, c) {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

function sign(p1, p2, p3) {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

/**
 * Shoelace formula for polygon area. Positive = CCW.
 * @param {Array<{x,y}>} polygon
 * @returns {number}
 */
export function polygonArea(polygon) {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return area / 2;
}

/**
 * Perimeter of a polygon.
 * @param {Array<{x,y}>} polygon
 * @returns {number}
 */
export function polygonPerimeter(polygon) {
  let perimeter = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = polygon[j].x - polygon[i].x;
    const dy = polygon[j].y - polygon[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

/**
 * Get edges of a polygon as line segments.
 * @param {Array<{x,y}>} polygon
 * @returns {Array<{x1,y1,x2,y2}>}
 */
export function polygonEdges(polygon) {
  const edges = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    edges.push({
      x1: polygon[i].x, y1: polygon[i].y,
      x2: polygon[j].x, y2: polygon[j].y,
    });
  }
  return edges;
}

/**
 * Approximate a circle as an n-gon.
 * @param {number} cx - center X
 * @param {number} cy - center Y
 * @param {number} r - radius
 * @param {number} n - number of sides (default 32)
 * @returns {Array<{x,y}>}
 */
export function circleToPolygon(cx, cy, r, n = 32) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    pts.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return pts;
}

/**
 * Check if a rectangle overlaps with an opening (rectangular or circular).
 * @param {{x,y,width,height}} rect
 * @param {Object} opening - {type, x, y, width?, length?, diameter?}
 * @returns {boolean}
 */
export function rectOverlapsOpening(rect, opening) {
  if (opening.type === 'circular') {
    const r = opening.diameter / 2;
    const cx = opening.x;
    const cy = opening.y;
    // Closest point on rect to circle center
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (r * r);
  }
  // Rectangular opening
  const ox = opening.x;
  const oy = opening.y;
  const ow = opening.width || 0;
  const oh = opening.length || 0;
  return rect.x < ox + ow && rect.x + rect.width > ox &&
         rect.y < oy + oh && rect.y + rect.height > oy;
}
