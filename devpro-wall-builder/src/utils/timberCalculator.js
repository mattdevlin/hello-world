/**
 * Timber Takeoff Calculator — Prenail Schedule
 *
 * Computes all timber pieces needed for walls and floors:
 * - Wall plates (bottom, top ×2, end, jamb, sill): 140×45mm
 * - Lintels: 142mm wide × lintelHeight deep
 * - Floor boundary plates: perimeterPlateWidth × 170mm
 *
 * Pieces longer than 4800mm are split. Top plate 2 joins are
 * staggered 600mm from top plate 1.
 */

import {
  MAX_PLATE_LENGTH, WALL_PLATE_WIDTH, WALL_PLATE_DEPTH,
  LINTEL_WIDTH, TOP_PLATE_STAGGER,
  FLOOR_PLATE_DEPTH,
} from './constants.js';
import { calculateWallLayout } from './calculator.js';
import { calculateFloorLayout } from './floorCalculator.js';

// ─────────────────────────────────────────────────────────────
// Utility: split a long plate into pieces ≤ maxLength
// ─────────────────────────────────────────────────────────────

export function splitPlate(totalLength, maxLength = MAX_PLATE_LENGTH, staggerOffset = 0) {
  if (totalLength <= 0) return [];
  if (totalLength <= maxLength) return [totalLength];

  const pieces = [];
  let remaining = totalLength;

  if (staggerOffset > 0 && staggerOffset < maxLength) {
    // First piece is the stagger offset length
    const first = Math.min(staggerOffset, remaining);
    pieces.push(first);
    remaining -= first;
  }

  while (remaining > 0) {
    const piece = Math.min(maxLength, remaining);
    pieces.push(piece);
    remaining -= piece;
  }

  return pieces;
}

// ─────────────────────────────────────────────────────────────
// Per-wall timber computation
// ─────────────────────────────────────────────────────────────

export function computeWallTimber(wall) {
  const layout = calculateWallLayout(wall);
  const pieces = [];
  const wallName = wall.name || 'Unnamed';

  const {
    netLength,
    heightLeft, heightRight,
    openings = [], lintelPanels = [],
  } = layout;

  // ── Bottom plate ──
  const bottomPieces = splitPlate(netLength);
  bottomPieces.forEach((len, i) => {
    pieces.push({
      type: 'bottom_plate',
      label: bottomPieces.length > 1
        ? `${wallName} - Bottom Plate (${i + 1} of ${bottomPieces.length})`
        : `${wallName} - Bottom Plate`,
      length: Math.round(len),
      width: WALL_PLATE_WIDTH,
      depth: WALL_PLATE_DEPTH,
      wallName,
      section: `${WALL_PLATE_WIDTH}\u00D7${WALL_PLATE_DEPTH}`,
    });
  });

  // ── End wall plates (vertical plates at both wall edges) ──
  // Every wall has edge plates at both ends, matching the framing elevation.
  pieces.push({
    type: 'end_plate',
    label: `${wallName} - Left End Plate`,
    length: Math.round(heightLeft),
    width: WALL_PLATE_WIDTH,
    depth: WALL_PLATE_DEPTH,
    wallName,
    section: `${WALL_PLATE_WIDTH}\u00D7${WALL_PLATE_DEPTH}`,
  });
  pieces.push({
    type: 'end_plate',
    label: `${wallName} - Right End Plate`,
    length: Math.round(heightRight),
    width: WALL_PLATE_WIDTH,
    depth: WALL_PLATE_DEPTH,
    wallName,
    section: `${WALL_PLATE_WIDTH}\u00D7${WALL_PLATE_DEPTH}`,
  });

  // ── Top plate 1 ──
  const top1Pieces = splitPlate(netLength);
  top1Pieces.forEach((len, i) => {
    pieces.push({
      type: 'top_plate_1',
      label: top1Pieces.length > 1
        ? `${wallName} - Top Plate 1 (${i + 1} of ${top1Pieces.length})`
        : `${wallName} - Top Plate 1`,
      length: Math.round(len),
      width: WALL_PLATE_WIDTH,
      depth: WALL_PLATE_DEPTH,
      wallName,
      section: `${WALL_PLATE_WIDTH}\u00D7${WALL_PLATE_DEPTH}`,
    });
  });

  // ── Top plate 2 (staggered joins) ──
  const top2Pieces = splitPlate(netLength, MAX_PLATE_LENGTH, TOP_PLATE_STAGGER);
  top2Pieces.forEach((len, i) => {
    pieces.push({
      type: 'top_plate_2',
      label: top2Pieces.length > 1
        ? `${wallName} - Top Plate 2 (${i + 1} of ${top2Pieces.length})`
        : `${wallName} - Top Plate 2`,
      length: Math.round(len),
      width: WALL_PLATE_WIDTH,
      depth: WALL_PLATE_DEPTH,
      wallName,
      section: `${WALL_PLATE_WIDTH}\u00D7${WALL_PLATE_DEPTH}`,
    });
  });

  // ── Opening-related pieces ──
  for (const op of openings) {
    const ref = op.ref || '';
    const isWindow = op.type === 'window';

    // Window sill plates
    if (isWindow && op.sillPlate && op.sillPlate.width > 0) {
      pieces.push({
        type: 'window_sill',
        label: `${wallName} - Sill Plate (${ref})`,
        length: Math.round(op.sillPlate.width),
        width: WALL_PLATE_WIDTH,
        depth: WALL_PLATE_DEPTH,
        wallName,
        openingRef: ref,
        section: `${WALL_PLATE_WIDTH}\u00D7${WALL_PLATE_DEPTH}`,
      });
    }

    // Jamb plates (windows and doors)
    if (op.leftJamb && op.leftJamb.height > 0) {
      pieces.push({
        type: isWindow ? 'window_jamb' : 'door_jamb',
        label: `${wallName} - Left Jamb (${ref})`,
        length: Math.round(op.leftJamb.height),
        width: WALL_PLATE_WIDTH,
        depth: WALL_PLATE_DEPTH,
        wallName,
        openingRef: ref,
        section: `${WALL_PLATE_WIDTH}\u00D7${WALL_PLATE_DEPTH}`,
      });
    }
    if (op.rightJamb && op.rightJamb.height > 0) {
      pieces.push({
        type: isWindow ? 'window_jamb' : 'door_jamb',
        label: `${wallName} - Right Jamb (${ref})`,
        length: Math.round(op.rightJamb.height),
        width: WALL_PLATE_WIDTH,
        depth: WALL_PLATE_DEPTH,
        wallName,
        openingRef: ref,
        section: `${WALL_PLATE_WIDTH}\u00D7${WALL_PLATE_DEPTH}`,
      });
    }
  }

  // ── Timber lintels ──
  for (const lp of lintelPanels) {
    const lintelH = lp.lintelHeight || 200;
    const lintelPieces = splitPlate(lp.width);
    lintelPieces.forEach((len, i) => {
      pieces.push({
        type: 'lintel',
        label: lintelPieces.length > 1
          ? `${wallName} - Lintel ${lp.ref} (${i + 1} of ${lintelPieces.length})`
          : `${wallName} - Lintel (${lp.ref})`,
        length: Math.round(len),
        width: LINTEL_WIDTH,
        depth: lintelH,
        wallName,
        openingRef: lp.ref,
        section: `${LINTEL_WIDTH}\u00D7${lintelH}`,
      });
    });
  }

  return pieces;
}

// ─────────────────────────────────────────────────────────────
// Floor boundary plate computation
// ─────────────────────────────────────────────────────────────

export function computeFloorTimber(floor) {
  const layout = calculateFloorLayout(floor);
  if (layout.error) return [];

  const pieces = [];
  const floorName = floor.name || 'Unnamed Floor';
  const plates = layout.perimeterPlates || [];

  plates.forEach((plate, i) => {
    const edgeLength = Math.round(
      Math.sqrt((plate.x2 - plate.x1) ** 2 + (plate.y2 - plate.y1) ** 2)
    );
    if (edgeLength <= 0) return;

    const platePieces = splitPlate(edgeLength);
    platePieces.forEach((len, j) => {
      pieces.push({
        type: 'floor_boundary',
        label: platePieces.length > 1
          ? `${floorName} - Edge ${i + 1} Plate (${j + 1} of ${platePieces.length})`
          : `${floorName} - Edge ${i + 1} Plate`,
        length: Math.round(len),
        width: plate.width || layout.perimeterPlateWidth || 45,
        depth: plate.depth || FLOOR_PLATE_DEPTH,
        wallName: floorName,
        section: `${plate.width || layout.perimeterPlateWidth || 45}\u00D7${plate.depth || FLOOR_PLATE_DEPTH}`,
      });
    });
  });

  return pieces;
}

// ─────────────────────────────────────────────────────────────
// Project-level timber aggregation
// ─────────────────────────────────────────────────────────────

export function computeProjectTimber(walls, floors) {
  const allWallPieces = [];
  const perWall = [];

  for (const wall of (walls || [])) {
    const pieces = computeWallTimber(wall);
    allWallPieces.push(...pieces);

    const linealMm = pieces.reduce((sum, p) => sum + p.length, 0);
    perWall.push({
      wallName: wall.name || 'Unnamed',
      wallId: wall.id,
      pieces: pieces.length,
      linealMetres: linealMm / 1000,
    });
  }

  const allFloorPieces = [];
  const perFloor = [];

  for (const floor of (floors || [])) {
    const pieces = computeFloorTimber(floor);
    allFloorPieces.push(...pieces);

    const linealMm = pieces.reduce((sum, p) => sum + p.length, 0);
    perFloor.push({
      floorName: floor.name || 'Unnamed Floor',
      floorId: floor.id,
      pieces: pieces.length,
      linealMetres: linealMm / 1000,
    });
  }

  const wallLinealMm = allWallPieces.reduce((sum, p) => sum + p.length, 0);
  const floorLinealMm = allFloorPieces.reduce((sum, p) => sum + p.length, 0);
  const totalLinealMm = wallLinealMm + floorLinealMm;

  return {
    totalPieces: allWallPieces.length + allFloorPieces.length,
    totalLinealMetres: totalLinealMm / 1000,
    wallLinealMetres: wallLinealMm / 1000,
    floorLinealMetres: floorLinealMm / 1000,
    wallPieces: allWallPieces,
    floorPieces: allFloorPieces,
    perWall,
    perFloor,
    hasFloors: allFloorPieces.length > 0,
  };
}
