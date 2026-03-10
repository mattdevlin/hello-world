/**
 * Wall Snap Geometry Engine
 *
 * Computes wall positions in a floor plan based on snap connections.
 * Each wall runs along its local X axis. The "left" end is at x=0,
 * the "right" end is at x=length_mm (before deductions).
 *
 * Snap points account for deductions:
 *   left snap point  = deduction_left_mm   from the geometric left edge
 *   right snap point = length_mm - deduction_right_mm  from the geometric left edge
 *
 * Walls are placed in the XZ plane. Y is height (each wall centered on its own height).
 */

import { WALL_THICKNESS } from './constants.js';

/**
 * Get the snap point of a wall end in the wall's local coordinate space.
 * The wall runs along local X from 0 to length_mm, centered at length_mm/2.
 *
 * Returns offset from wall center (which is what Three.js positions use).
 *
 * @param {Object} wall - Wall object with length_mm, deduction_left_mm, deduction_right_mm
 * @param {"left"|"right"} end - Which end
 * @returns {{ localX_mm: number }} Offset from wall center along local X
 */
export function computeWallEndpoint(wall, end) {
  const halfLen = wall.length_mm / 2;
  const dedLeft = wall.deduction_left_mm || 0;
  const dedRight = wall.deduction_right_mm || 0;

  if (end === 'left') {
    // Left snap point: inset by deduction from the left edge
    // In center-origin coords: -halfLen + dedLeft
    return { localX_mm: -halfLen + dedLeft };
  }
  // Right snap point: inset by deduction from the right edge
  // In center-origin coords: halfLen - dedRight
  return { localX_mm: halfLen - dedRight };
}

/**
 * Compute the world-space position and rotation for an attached wall,
 * given an anchor wall's placement and a connection definition.
 *
 * @param {Object} anchorWall - The wall being snapped TO
 * @param {"left"|"right"} anchorEnd - Which end of the anchor wall
 * @param {{ x: number, y: number, z: number }} anchorPos - Anchor wall center position (mm)
 * @param {number} anchorAngleRad - Anchor wall's Y rotation in radians
 * @param {Object} attachedWall - The wall being attached
 * @param {"left"|"right"} attachedEnd - Which end of the attached wall connects
 * @param {number} angleDeg - Rotation of attached wall relative to anchor (0, 90, 180, 270)
 * @returns {{ position: {x: number, y: number, z: number}, rotation: {x: number, y: number, z: number} }}
 */
export function computeSnapPosition(
  anchorWall, anchorEnd, anchorPos, anchorAngleRad,
  attachedWall, attachedEnd, angleDeg
) {
  const t = WALL_THICKNESS;

  // 1. Find anchor's snap point in world space
  const anchorEndpoint = computeWallEndpoint(anchorWall, anchorEnd);
  const anchorCos = Math.cos(anchorAngleRad);
  const anchorSin = Math.sin(anchorAngleRad);

  // Anchor snap point in world space (XZ plane)
  const snapX = anchorPos.x + anchorEndpoint.localX_mm * anchorCos;
  const snapZ = anchorPos.z - anchorEndpoint.localX_mm * anchorSin;

  // 2. Compute the attached wall's world rotation
  const angleRad = (angleDeg * Math.PI) / 180;
  const attachedAngleRad = anchorAngleRad + angleRad;

  // 3. Find the attached wall's endpoint offset (we need to position the wall
  //    so that its specified end lands on the snap point)
  const attachedEndpoint = computeWallEndpoint(attachedWall, attachedEnd);
  const attachedCos = Math.cos(attachedAngleRad);
  const attachedSin = Math.sin(attachedAngleRad);

  // The attached wall's center needs to be offset so its endpoint hits the snap point
  const centerX = snapX - attachedEndpoint.localX_mm * attachedCos;
  const centerZ = snapZ + attachedEndpoint.localX_mm * attachedSin;

  // 4. Apply wall thickness offset perpendicular to the anchor wall's face
  //    so walls butt against each other rather than overlapping
  // The perpendicular direction to the anchor wall is along its local Z axis
  // (90° rotated from its facing direction)
  const perpX = anchorSin;  // sin(angle) gives the X component of the perpendicular
  const perpZ = anchorCos;  // cos(angle) gives the Z component of the perpendicular

  // Offset by half thickness of each wall
  // Direction depends on which side: for 90° snap, offset outward
  // For 0°/180° (inline), no perpendicular offset needed
  let offsetX = 0;
  let offsetZ = 0;
  const normalizedAngle = ((angleDeg % 360) + 360) % 360;
  if (normalizedAngle === 90) {
    offsetX = perpX * (t / 2);
    offsetZ = perpZ * (t / 2);
  } else if (normalizedAngle === 270) {
    offsetX = -perpX * (t / 2);
    offsetZ = -perpZ * (t / 2);
  }

  // 5. Y position: each wall centered on its own height
  const posY = attachedWall.height_mm / 2;

  return {
    position: {
      x: centerX + offsetX,
      y: posY,
      z: centerZ + offsetZ,
    },
    rotation: {
      x: 0,
      y: attachedAngleRad,
      z: 0,
    },
  };
}

/**
 * Resolve full floor plan layout from walls and their snap connections.
 *
 * Builds a graph of connections and traverses it BFS-style from a root wall.
 * Walls with no connections are placed at origin as standalone.
 *
 * @param {Array} walls - All wall objects in the project
 * @param {Array} connections - Array of connection objects
 * @returns {Array<{ wall, side: string, position: {x,y,z}, rotation: {x,y,z}, dimensions: {length, height, thickness} }>}
 */
export function resolveFloorPlanLayout(walls, connections) {
  if (!walls || walls.length === 0) return [];
  if (!connections || connections.length === 0) {
    // No connections: place each wall at origin (backward compat)
    return walls.map((wall, i) => ({
      wall,
      side: i === 0 ? 'front' : `wall-${i}`,
      position: { x: 0, y: wall.height_mm / 2, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: { length: wall.length_mm, height: wall.height_mm, thickness: WALL_THICKNESS },
    }));
  }

  const wallMap = new Map(walls.map(w => [w.id, w]));

  // Build adjacency: for each wall, which connections reference it?
  const adjacency = new Map();
  for (const wall of walls) {
    adjacency.set(wall.id, []);
  }
  for (const conn of connections) {
    if (adjacency.has(conn.wallId)) {
      adjacency.get(conn.wallId).push(conn);
    }
    if (adjacency.has(conn.attachedWallId)) {
      adjacency.get(conn.attachedWallId).push(conn);
    }
  }

  // Find root wall: a wall that appears as an anchor but never as an attached wall,
  // or just the first wall if all are attached
  const attachedIds = new Set(connections.map(c => c.attachedWallId));
  const rootWall = walls.find(w => !attachedIds.has(w.id)) || walls[0];

  // BFS to place walls
  const placed = new Map(); // wallId → { position, rotation }
  const results = [];

  // Place root at origin
  placed.set(rootWall.id, {
    position: { x: 0, y: rootWall.height_mm / 2, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  });
  results.push({
    wall: rootWall,
    side: 'root',
    position: { x: 0, y: rootWall.height_mm / 2, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    dimensions: { length: rootWall.length_mm, height: rootWall.height_mm, thickness: WALL_THICKNESS },
  });

  const queue = [rootWall.id];
  const visited = new Set([rootWall.id]);

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentWall = wallMap.get(currentId);
    const currentPlacement = placed.get(currentId);

    for (const conn of adjacency.get(currentId) || []) {
      // Determine which wall is the "other" wall in this connection
      let otherWallId, anchorWall, anchorEnd, attachedWall, attachedEnd, angleDeg;

      if (conn.wallId === currentId) {
        // Current wall is the anchor
        otherWallId = conn.attachedWallId;
        anchorWall = currentWall;
        anchorEnd = conn.anchorEnd;
        attachedWall = wallMap.get(otherWallId);
        attachedEnd = conn.attachedEnd;
        angleDeg = conn.angleDeg;
      } else {
        // Current wall is the attached; reverse the connection
        otherWallId = conn.wallId;
        anchorWall = currentWall;
        anchorEnd = conn.attachedEnd;
        attachedWall = wallMap.get(otherWallId);
        attachedEnd = conn.anchorEnd;
        // Reverse the angle
        angleDeg = (360 - conn.angleDeg) % 360;
      }

      if (!attachedWall || visited.has(otherWallId)) continue;

      const snap = computeSnapPosition(
        anchorWall, anchorEnd,
        currentPlacement.position, currentPlacement.rotation.y,
        attachedWall, attachedEnd,
        angleDeg
      );

      placed.set(otherWallId, snap);
      results.push({
        wall: attachedWall,
        side: `snap-${otherWallId}`,
        position: snap.position,
        rotation: snap.rotation,
        dimensions: {
          length: attachedWall.length_mm,
          height: attachedWall.height_mm,
          thickness: WALL_THICKNESS,
        },
      });

      visited.add(otherWallId);
      queue.push(otherWallId);
    }
  }

  // Place any unconnected walls at origin
  for (const wall of walls) {
    if (!visited.has(wall.id)) {
      results.push({
        wall,
        side: `standalone-${wall.id}`,
        position: { x: 0, y: wall.height_mm / 2, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: { length: wall.length_mm, height: wall.height_mm, thickness: WALL_THICKNESS },
      });
    }
  }

  return results;
}

/**
 * Validate a set of connections for common errors.
 *
 * @param {Array} walls - All wall objects
 * @param {Array} connections - Connection objects to validate
 * @returns {Array<{ type: string, message: string, connectionId?: string }>}
 */
export function validateConnections(walls, connections) {
  if (!connections || connections.length === 0) return [];

  const errors = [];
  const wallIds = new Set(walls.map(w => w.id));

  // Track which endpoints are used
  const usedEndpoints = new Map(); // "wallId:end" → connectionId

  for (const conn of connections) {
    // Self-connection
    if (conn.wallId === conn.attachedWallId) {
      errors.push({
        type: 'self_connection',
        message: `Connection ${conn.id} connects wall "${conn.wallId}" to itself`,
        connectionId: conn.id,
      });
    }

    // Missing wall IDs
    if (!wallIds.has(conn.wallId)) {
      errors.push({
        type: 'missing_wall',
        message: `Connection ${conn.id} references unknown anchor wall "${conn.wallId}"`,
        connectionId: conn.id,
      });
    }
    if (!wallIds.has(conn.attachedWallId)) {
      errors.push({
        type: 'missing_wall',
        message: `Connection ${conn.id} references unknown attached wall "${conn.attachedWallId}"`,
        connectionId: conn.id,
      });
    }

    // Duplicate endpoint usage
    const anchorKey = `${conn.wallId}:${conn.anchorEnd}`;
    const attachedKey = `${conn.attachedWallId}:${conn.attachedEnd}`;

    if (usedEndpoints.has(anchorKey)) {
      errors.push({
        type: 'duplicate_endpoint',
        message: `Endpoint "${anchorKey}" used by both connection ${usedEndpoints.get(anchorKey)} and ${conn.id}`,
        connectionId: conn.id,
      });
    } else {
      usedEndpoints.set(anchorKey, conn.id);
    }

    if (usedEndpoints.has(attachedKey)) {
      errors.push({
        type: 'duplicate_endpoint',
        message: `Endpoint "${attachedKey}" used by both connection ${usedEndpoints.get(attachedKey)} and ${conn.id}`,
        connectionId: conn.id,
      });
    } else {
      usedEndpoints.set(attachedKey, conn.id);
    }

    // Invalid angle
    const validAngles = [0, 90, 180, 270];
    if (!validAngles.includes(conn.angleDeg)) {
      errors.push({
        type: 'invalid_angle',
        message: `Connection ${conn.id} has invalid angle ${conn.angleDeg} (must be 0, 90, 180, or 270)`,
        connectionId: conn.id,
      });
    }
  }

  return errors;
}

/**
 * Compute axis-aligned bounding box for a resolved floor plan layout.
 *
 * @param {Array} layoutEntries - Output of resolveFloorPlanLayout
 * @returns {{ minX: number, maxX: number, minZ: number, maxZ: number, maxHeight: number, width: number, depth: number }}
 */
export function computeLayoutBounds(layoutEntries) {
  if (!layoutEntries || layoutEntries.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, maxHeight: 0, width: 0, depth: 0 };
  }

  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let maxHeight = 0;

  for (const entry of layoutEntries) {
    const { position, rotation, dimensions } = entry;
    const halfLen = dimensions.length / 2;
    const halfThick = dimensions.thickness / 2;
    const angle = rotation.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Four corners of the wall footprint (XZ plane)
    const corners = [
      { dx: -halfLen, dz: -halfThick },
      { dx: halfLen, dz: -halfThick },
      { dx: halfLen, dz: halfThick },
      { dx: -halfLen, dz: halfThick },
    ];

    for (const c of corners) {
      const wx = position.x + c.dx * cos + c.dz * sin;
      const wz = position.z - c.dx * sin + c.dz * cos;
      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz);
      maxZ = Math.max(maxZ, wz);
    }

    maxHeight = Math.max(maxHeight, dimensions.height);
  }

  return {
    minX, maxX, minZ, maxZ,
    maxHeight,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}
