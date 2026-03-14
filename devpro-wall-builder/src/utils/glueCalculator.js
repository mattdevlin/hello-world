/**
 * PU Glue Calculator — SabreBond PU6000
 *
 * Application rate : 400 g/m²
 * Specific gravity : 1.1  (1 L = 1.1 kg)
 * Drum size        : 200 L
 *
 * Glue is applied to both faces of every EPS piece before bonding
 * to the magboard skins.
 */

import { PANEL_GAP, BOTTOM_PLATE, TOP_PLATE, SPLINE_WIDTH as CONST_SPLINE_WIDTH, EPS_GAP } from './constants.js';
import { calculateWallLayout } from './calculator.js';
import { calculateFloorLayout } from './floorCalculator.js';
import { calculateRoofLayout } from './roofCalculator.js';
import { getEpsSegments } from './binPacking.js';

const SPLINE_WIDTH = 146;
const PANEL_EPS_DEPTH = 142;
const SPLINE_EPS_DEPTH = 120;

const GLUE_RATE_KG_M2 = 0.4;      // 400 g/m²
const GLUE_SPECIFIC_GRAVITY = 1.1; // kg/L
const DRUM_LITRES = 200;

// ─────────────────────────────────────────────────────────────
// Per-wall glue area (mm²) — mirrors WallSummary calculation
// ─────────────────────────────────────────────────────────────

export function computeWallGlueArea(layout) {
  const {
    panels = [], openings = [], lintelPanels = [], footerPanels = [], height = 0,
    deductionLeft = 0, deductionRight = 0, grossLength = 0, isRaked = false,
  } = layout || {};

  if (panels.length === 0 || height <= 0 || grossLength <= 0) {
    return { panelAreaMm2: 0, splineAreaMm2: 0, footerPanelAreaMm2: 0, totalAreaMm2: 0 };
  }

  const HALF_SPLINE = SPLINE_WIDTH / 2;

  // ── Count splines ──
  const jointSplines = [];
  for (let i = 0; i < panels.length - 1; i++) {
    const gapCentre = panels[i].x + panels[i].width + PANEL_GAP / 2;
    const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintelPanel && !insideFooterPanel) jointSplines.push(gapCentre);
  }
  let openingSplineCount = 0;
  for (const op of openings) {
    if (op.y > 0) openingSplineCount += 2;
  }
  const splineCount = jointSplines.length + openingSplineCount;

  // ── Build exclusion zones ──
  const exclusions = [];
  if (deductionLeft > 0) exclusions.push([deductionLeft, deductionLeft + BOTTOM_PLATE]);
  if (deductionRight > 0) exclusions.push([grossLength - deductionRight - BOTTOM_PLATE, grossLength - deductionRight]);

  for (const gc of jointSplines) {
    exclusions.push([gc - HALF_SPLINE, gc + HALF_SPLINE]);
  }

  for (const op of openings) {
    exclusions.push([op.x - BOTTOM_PLATE, op.x]);
    exclusions.push([op.x - BOTTOM_PLATE - SPLINE_WIDTH, op.x - BOTTOM_PLATE]);
    exclusions.push([op.x + op.drawWidth, op.x + op.drawWidth + BOTTOM_PLATE]);
    exclusions.push([op.x + op.drawWidth + BOTTOM_PLATE, op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH]);
    exclusions.push([op.x, op.x + op.drawWidth]);
  }

  for (const p of panels) {
    if (p.type === 'end') exclusions.push([p.x + p.width - BOTTOM_PLATE, p.x + p.width]);
    if (deductionRight === 0 && Math.abs(p.x + p.width - grossLength) < 1) exclusions.push([grossLength - BOTTOM_PLATE, grossLength]);
    if (deductionLeft === 0 && Math.abs(p.x) < 1) exclusions.push([0, BOTTOM_PLATE]);
  }

  for (const l of lintelPanels) exclusions.push([l.x, l.x + l.width]);
  exclusions.sort((a, b) => a[0] - b[0]);

  const computeSegments = (panelLeft, panelRight) =>
    getEpsSegments(panelLeft, panelRight, exclusions, EPS_GAP);

  const epsTop = TOP_PLATE * 2 + EPS_GAP;
  const epsBottom = height - BOTTOM_PLATE - EPS_GAP;
  const stdEpsH = epsBottom - epsTop;

  // ── Panel EPS surface area ──
  let panelEpsSA = 0;
  for (const panel of panels) {
    const segments = computeSegments(panel.x, panel.x + panel.width);
    const panelEpsH = isRaked
      ? Math.round(((panel.heightLeft + panel.heightRight) / 2) - BOTTOM_PLATE - TOP_PLATE * 2 - EPS_GAP * 2)
      : stdEpsH;
    for (const seg of segments) {
      const w = Math.round(seg[1] - seg[0]);
      if (w > 0 && panelEpsH > 0) panelEpsSA += w * panelEpsH;
    }
  }

  // ── Spline EPS surface area ──
  const splineH = height - BOTTOM_PLATE - TOP_PLATE * 2 - 10;
  const splineEpsSA = splineCount * SPLINE_WIDTH * splineH;

  // ── Footer panel EPS surface area ──
  let footerPanelEpsSA = 0;
  for (const f of footerPanels) {
    const op = openings.find(o => o.ref === f.ref);
    if (!op || op.x == null || f.x == null) continue;
    const fEpsTop = height - op.y + BOTTOM_PLATE + EPS_GAP;
    const fEpsBot = height - BOTTOM_PLATE - EPS_GAP;
    if (fEpsBot <= fEpsTop) continue;
    const leftSplineRight = op.x - BOTTOM_PLATE;
    const fEpsLeft = f.x < leftSplineRight ? leftSplineRight + EPS_GAP : f.x + EPS_GAP;
    const rightSplineLeft = op.x + op.drawWidth + BOTTOM_PLATE;
    const fEpsRight = f.x + f.width > rightSplineLeft ? rightSplineLeft - EPS_GAP : f.x + f.width - EPS_GAP;
    if (fEpsRight <= fEpsLeft) continue;
    const fW = Math.round(fEpsRight - fEpsLeft);
    const fH = Math.round(fEpsBot - fEpsTop);
    if (fW > 0 && fH > 0) footerPanelEpsSA += fW * fH;
  }

  // Both faces of every EPS piece
  const totalGlueAreaMm2 = (panelEpsSA + splineEpsSA + footerPanelEpsSA) * 2;

  return {
    panelAreaMm2: panelEpsSA * 2,
    splineAreaMm2: splineEpsSA * 2,
    footerPanelAreaMm2: footerPanelEpsSA * 2,
    totalAreaMm2: totalGlueAreaMm2,
  };
}

// ─────────────────────────────────────────────────────────────
// Project-level glue computation
// ─────────────────────────────────────────────────────────────

export function computeProjectGlue(walls) {
  let totalAreaMm2 = 0;
  let panelAreaMm2 = 0;
  let splineAreaMm2 = 0;
  let footerPanelAreaMm2 = 0;
  const perWall = [];

  for (const wall of walls) {
    const layout = calculateWallLayout(wall);
    const area = computeWallGlueArea(layout);
    totalAreaMm2 += area.totalAreaMm2;
    panelAreaMm2 += area.panelAreaMm2;
    splineAreaMm2 += area.splineAreaMm2;
    footerPanelAreaMm2 += area.footerPanelAreaMm2;

    const wallM2 = area.totalAreaMm2 / 1e6;
    perWall.push({
      wallName: wall.name,
      wallId: wall.id,
      areaM2: wallM2,
      glueKg: wallM2 * GLUE_RATE_KG_M2,
      glueLitres: (wallM2 * GLUE_RATE_KG_M2) / GLUE_SPECIFIC_GRAVITY,
    });
  }

  const totalM2 = totalAreaMm2 / 1e6;
  const totalKg = totalM2 * GLUE_RATE_KG_M2;
  const totalLitres = totalKg / GLUE_SPECIFIC_GRAVITY;
  const drumsNeeded = totalLitres > 0 ? Math.ceil(totalLitres / DRUM_LITRES) : 0;
  const drumCapacityUsed = drumsNeeded > 0 ? totalLitres / (drumsNeeded * DRUM_LITRES) : 0;

  return {
    // Areas
    totalAreaM2: totalM2,
    panelAreaM2: panelAreaMm2 / 1e6,
    splineAreaM2: splineAreaMm2 / 1e6,
    footerPanelAreaM2: footerPanelAreaMm2 / 1e6,

    // Glue quantities
    totalKg,
    totalLitres,

    // Drums
    drumsNeeded,
    drumCapacityUsed, // 0–1 fraction of last drum set
    drumLitres: DRUM_LITRES,

    // Constants (for display)
    rateKgM2: GLUE_RATE_KG_M2,
    specificGravity: GLUE_SPECIFIC_GRAVITY,

    perWall,
  };
}

// ─────────────────────────────────────────────────────────────
// Floor glue calculation
// ─────────────────────────────────────────────────────────────

const FLOOR_MAGBOARD = 10;

/**
 * Compute glue bond area for a single floor layout.
 */
export function computeFloorGlueArea(layout) {
  const { panels = [], reinforcedSplines = [], unreinforcedSplines = [] } = layout || {};

  let panelAreaMm2 = 0;
  for (const panel of panels) {
    panelAreaMm2 += panel.width * panel.length;
  }

  const splineEpsW = CONST_SPLINE_WIDTH - FLOOR_MAGBOARD * 2;
  let splineAreaMm2 = 0;
  for (const s of [...reinforcedSplines, ...unreinforcedSplines]) {
    splineAreaMm2 += splineEpsW * s.length;
  }

  // Both faces of every EPS piece
  return {
    panelAreaMm2: panelAreaMm2 * 2,
    splineAreaMm2: splineAreaMm2 * 2,
    footerPanelAreaMm2: 0,
    totalAreaMm2: (panelAreaMm2 + splineAreaMm2) * 2,
  };
}

/**
 * Compute glue requirements for walls + floors.
 */
export function computeProjectGlueWithFloors(walls, floors) {
  const wallResult = computeProjectGlue(walls);

  if (!floors || floors.length === 0) return wallResult;

  let floorTotalAreaMm2 = 0;
  const perFloor = [];

  for (const floor of floors) {
    const layout = calculateFloorLayout(floor);
    if (layout.error) continue;
    const area = computeFloorGlueArea(layout);
    floorTotalAreaMm2 += area.totalAreaMm2;

    const floorM2 = area.totalAreaMm2 / 1e6;
    perFloor.push({
      floorName: floor.name,
      floorId: floor.id,
      areaM2: floorM2,
      glueKg: floorM2 * GLUE_RATE_KG_M2,
      glueLitres: (floorM2 * GLUE_RATE_KG_M2) / GLUE_SPECIFIC_GRAVITY,
    });
  }

  const combinedAreaMm2 = wallResult.totalAreaM2 * 1e6 + floorTotalAreaMm2;
  const combinedM2 = combinedAreaMm2 / 1e6;
  const combinedKg = combinedM2 * GLUE_RATE_KG_M2;
  const combinedLitres = combinedKg / GLUE_SPECIFIC_GRAVITY;
  const drumsNeeded = combinedLitres > 0 ? Math.ceil(combinedLitres / DRUM_LITRES) : 0;
  const drumCapacityUsed = drumsNeeded > 0 ? combinedLitres / (drumsNeeded * DRUM_LITRES) : 0;

  return {
    ...wallResult,
    // Override totals with combined
    totalAreaM2: combinedM2,
    totalKg: combinedKg,
    totalLitres: combinedLitres,
    drumsNeeded,
    drumCapacityUsed,
    perFloor,
    hasFloors: true,
  };
}

// ─────────────────────────────────────────────────────────────
// Roof glue area
// ─────────────────────────────────────────────────────────────

const ROOF_MAGBOARD = 10;

/**
 * Compute glue bond area for a single roof layout.
 */
export function computeRoofGlueArea(layout) {
  const { panels = [], splines = [] } = layout || {};

  let panelAreaMm2 = 0;
  for (const panel of panels) {
    panelAreaMm2 += panel.width * panel.length;
  }

  const splineEpsW = CONST_SPLINE_WIDTH - ROOF_MAGBOARD * 2;
  let splineAreaMm2 = 0;
  for (const s of splines) {
    splineAreaMm2 += splineEpsW * s.length;
  }

  // Both faces of every EPS piece
  return {
    panelAreaMm2: panelAreaMm2 * 2,
    splineAreaMm2: splineAreaMm2 * 2,
    footerPanelAreaMm2: 0,
    totalAreaMm2: (panelAreaMm2 + splineAreaMm2) * 2,
  };
}

/**
 * Compute glue requirements for walls + floors + roofs.
 */
export function computeProjectGlueWithRoofs(walls, floors, roofs) {
  const baseResult = (floors && floors.length > 0)
    ? computeProjectGlueWithFloors(walls, floors)
    : computeProjectGlue(walls);

  if (!roofs || roofs.length === 0) return baseResult;

  let roofTotalAreaMm2 = 0;
  const perRoof = [];

  for (const roof of roofs) {
    const layout = calculateRoofLayout(roof);
    if (layout.error) continue;
    const area = computeRoofGlueArea(layout);
    roofTotalAreaMm2 += area.totalAreaMm2;

    const roofM2 = area.totalAreaMm2 / 1e6;
    perRoof.push({
      roofName: roof.name,
      roofId: roof.id,
      areaM2: roofM2,
      glueKg: roofM2 * GLUE_RATE_KG_M2,
      glueLitres: (roofM2 * GLUE_RATE_KG_M2) / GLUE_SPECIFIC_GRAVITY,
    });
  }

  const combinedAreaMm2 = baseResult.totalAreaM2 * 1e6 + roofTotalAreaMm2;
  const combinedM2 = combinedAreaMm2 / 1e6;
  const combinedKg = combinedM2 * GLUE_RATE_KG_M2;
  const combinedLitres = combinedKg / GLUE_SPECIFIC_GRAVITY;
  const drumsNeeded = combinedLitres > 0 ? Math.ceil(combinedLitres / DRUM_LITRES) : 0;
  const drumCapacityUsed = drumsNeeded > 0 ? combinedLitres / (drumsNeeded * DRUM_LITRES) : 0;

  return {
    ...baseResult,
    totalAreaM2: combinedM2,
    totalKg: combinedKg,
    totalLitres: combinedLitres,
    drumsNeeded,
    drumCapacityUsed,
    perRoof,
    hasRoofs: true,
  };
}
