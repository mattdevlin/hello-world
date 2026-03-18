/**
 * Roof Layout Calculator
 *
 * Takes a roof definition (type, dimensions, pitch, overhangs, penetrations)
 * and computes the complete panel layout for roof SIP panels.
 *
 * Roof types:
 * - Gable: 2 sloping planes meeting at a ridge
 * - Skillion: single sloping plane
 * - Flat: horizontal plane
 *
 * Panel pitch: 1205mm (1200mm + 5mm gap), same as walls/floors
 * Thickness options: wall(162), floor(192), roof(242)
 */

import {
  PANEL_PITCH, PANEL_WIDTH, PANEL_GAP, MIN_PANEL,
  MAX_SHEET_HEIGHT, SPLINE_WIDTH,
  ROOF_TYPES, ROOF_PANEL_DIRECTIONS, RIDGE_ORIENTATIONS,
  ROOF_THICKNESS_OPTIONS,
  DEFAULT_EAVE_OVERHANG, DEFAULT_GABLE_OVERHANG,
  MAGBOARD, WALL_THICKNESS, PLY_SHEET_HEIGHT,
  HSPLINE_CLEARANCE, DEFAULT_PERIMETER_PLATE_WIDTH,
} from './constants.js';

/**
 * Detect roof type from project walls.
 * - If any wall has gable profile → gable
 * - If any wall has raked profile → skillion
 * - Otherwise → flat
 */
export function detectRoofType(walls) {
  if (!walls || walls.length === 0) return ROOF_TYPES.FLAT;

  const hasGable = walls.some(w => w.profile === 'gable');
  const hasRaked = walls.some(w => w.profile === 'raked');

  if (hasGable) return ROOF_TYPES.GABLE;
  if (hasRaked) return ROOF_TYPES.SKILLION;
  return ROOF_TYPES.FLAT;
}

/**
 * Resolve high/low eave overhangs for skillion roofs.
 * Falls back to the single eaveOverhang_mm for backward compat.
 */
export function resolveEaveOverhangs(roof) {
  const eave = roof.eaveOverhang_mm ?? DEFAULT_EAVE_OVERHANG;
  return {
    highEave: roof.eaveOverhangHigh_mm ?? eave,
    lowEave: roof.eaveOverhangLow_mm ?? eave,
  };
}

/**
 * Compute the roof planes (1 or 2 rectangular UV planes) from a roof definition.
 *
 * Each plane has:
 *   - uLength: dimension along ridge (includes gable overhangs both sides)
 *   - vLength: dimension up the slope from eave (includes eave overhang)
 *   - slopeLength: actual slope length (vLength)
 *   - planWidth: horizontal projection of vLength
 *   - label: 'Left Slope' / 'Right Slope' / 'Slope' / 'Ceiling'
 */
export function computeRoofPlanes(roof) {
  const {
    type = ROOF_TYPES.FLAT,
    length_mm = 6000,
    width_mm = 8000,
    pitch_deg = 0,
    ridgeOffset_mm = 0,
    highEdge = 'left',
    eaveOverhang_mm = DEFAULT_EAVE_OVERHANG,
    gableOverhang_mm = DEFAULT_GABLE_OVERHANG,
  } = roof;

  // For gable: if ridge runs along width, swap so U axis = ridge
  let effectiveLength = length_mm;
  let effectiveWidth = width_mm;
  if (type === ROOF_TYPES.GABLE && roof.ridgeOrientation === RIDGE_ORIENTATIONS.ALONG_WIDTH) {
    effectiveLength = width_mm;
    effectiveWidth = length_mm;
  }

  const pitchRad = (pitch_deg * Math.PI) / 180;
  const cosPitch = Math.cos(pitchRad);
  const uTotal = effectiveLength + 2 * gableOverhang_mm;

  const planes = [];

  if (type === ROOF_TYPES.GABLE) {
    // Two sloping planes, ridge at center (+ offset)
    const halfWidthLeft = effectiveWidth / 2 + ridgeOffset_mm;
    const halfWidthRight = effectiveWidth / 2 - ridgeOffset_mm;

    const slopeLengthLeft = cosPitch > 0 ? (halfWidthLeft + eaveOverhang_mm) / cosPitch : halfWidthLeft + eaveOverhang_mm;
    const slopeLengthRight = cosPitch > 0 ? (halfWidthRight + eaveOverhang_mm) / cosPitch : halfWidthRight + eaveOverhang_mm;

    planes.push({
      index: 0,
      label: 'Left Slope',
      uLength: uTotal,
      vLength: slopeLengthLeft,
      planWidth: halfWidthLeft + eaveOverhang_mm,
      pitchDeg: pitch_deg,
    });
    planes.push({
      index: 1,
      label: 'Right Slope',
      uLength: uTotal,
      vLength: slopeLengthRight,
      planWidth: halfWidthRight + eaveOverhang_mm,
      pitchDeg: pitch_deg,
    });
  } else if (type === ROOF_TYPES.SKILLION) {
    // Single sloping plane — separate high/low eave overhangs
    const { highEave, lowEave } = resolveEaveOverhangs(roof);
    const totalWidth = width_mm + highEave + lowEave;
    const slopeLength = cosPitch > 0 ? totalWidth / cosPitch : totalWidth;

    planes.push({
      index: 0,
      label: 'Slope',
      uLength: uTotal,
      vLength: slopeLength,
      planWidth: totalWidth,
      pitchDeg: pitch_deg,
      highEdge,
      eaveOverhangHigh: highEave,
      eaveOverhangLow: lowEave,
    });
  } else {
    // Flat / ceiling
    planes.push({
      index: 0,
      label: 'Ceiling',
      uLength: length_mm,
      vLength: width_mm,
      planWidth: width_mm,
      pitchDeg: 0,
    });
  }

  return planes;
}

/**
 * Generate panel layout for a single roof plane.
 *
 * Panels are laid out along the U direction at PANEL_PITCH spacing.
 * If vLength exceeds MAX_SHEET_HEIGHT, panels are split into courses.
 *
 * @param {Object} plane - Roof plane from computeRoofPlanes
 * @param {string} panelDirection - 'along_ridge' or 'eave_to_ridge'
 * @param {Array} penetrations - Penetrations on this plane
 * @returns {Object} { panels, splines, courses }
 */
function layoutPlane(plane, panelDirection, penetrations = [], joistRecess = 0, splineDepthInfo = {}) {
  const { uLength, vLength } = plane;

  // Determine primary and secondary dimensions based on panel direction
  let primaryLen, secondaryLen;
  if (panelDirection === ROOF_PANEL_DIRECTIONS.ALONG_RIDGE) {
    // Panels run along ridge (U), stacked eave-to-ridge (V)
    primaryLen = uLength;
    secondaryLen = vLength;
  } else {
    // Panels run eave-to-ridge (V), stacked along ridge (U)
    primaryLen = vLength;
    secondaryLen = uLength;
  }

  // Compute courses (spans) if secondary exceeds max sheet height
  const courses = [];
  let remaining = secondaryLen;
  let offset = 0;
  while (remaining > 0) {
    const courseHeight = Math.min(remaining, MAX_SHEET_HEIGHT);
    courses.push({ offset, height: courseHeight });
    offset += courseHeight;
    remaining -= courseHeight;
  }

  // Generate panel columns along primary direction
  const fullCount = Math.floor(primaryLen / PANEL_PITCH);
  const remainder = primaryLen - fullCount * PANEL_PITCH;

  const columnPositions = [];
  for (let i = 0; i < fullCount; i++) {
    columnPositions.push({ x: i * PANEL_PITCH, width: PANEL_WIDTH });
  }

  // Handle remainder
  if (remainder > 0) {
    if (remainder >= MIN_PANEL) {
      columnPositions.push({ x: fullCount * PANEL_PITCH, width: remainder });
    } else if (columnPositions.length > 0) {
      // Split last panel and remainder
      const lastCol = columnPositions[columnPositions.length - 1];
      const combined = lastCol.width + PANEL_GAP + remainder;
      const splitA = Math.round(combined / 2);
      const splitB = combined - splitA;
      lastCol.width = splitA;
      columnPositions.push({ x: lastCol.x + splitA + PANEL_GAP, width: splitB });
    } else {
      // Single panel narrower than MIN_PANEL — use as-is
      columnPositions.push({ x: 0, width: remainder });
    }
  }

  // Generate panels for each course × column
  const panels = [];
  let panelIndex = 0;
  for (const course of courses) {
    for (const col of columnPositions) {
      const panel = {
        index: panelIndex++,
        planeIndex: plane.index,
        // In plane UV coordinates
        u: panelDirection === ROOF_PANEL_DIRECTIONS.ALONG_RIDGE ? col.x : course.offset,
        v: panelDirection === ROOF_PANEL_DIRECTIONS.ALONG_RIDGE ? course.offset : col.x,
        width: col.width,
        length: course.height,
        course: courses.indexOf(course),
        type: col.width === PANEL_WIDTH ? 'full' : 'cut',
      };

      // Check penetration overlaps
      panel.penetrationCuts = [];
      for (const pen of penetrations) {
        if (pen.plane !== plane.index) continue;
        if (panelOverlapsPenetration(panel, pen, panelDirection)) {
          panel.penetrationCuts.push(pen.ref || pen.id);
        }
      }

      panels.push(panel);
    }
  }

  // Generate perimeter plates (4 edges of the plane rectangle)
  const perimeterPlates = [
    { x1: 0, y1: 0, x2: uLength, y2: 0 },           // top (v=0)
    { x1: 0, y1: vLength, x2: uLength, y2: vLength }, // bottom (v=vLength)
    { x1: 0, y1: 0, x2: 0, y2: vLength },             // left (u=0)
    { x1: uLength, y1: 0, x2: uLength, y2: vLength }, // right (u=uLength)
  ];

  // Generate splines between adjacent columns — inset v-extent by joistRecess
  const splines = [];
  for (let i = 0; i < columnPositions.length - 1; i++) {
    const col = columnPositions[i];
    const splineU = col.x + col.width + PANEL_GAP / 2;
    for (const course of courses) {
      const vStart = Math.max(course.offset, joistRecess);
      const vEnd = Math.min(course.offset + course.height, secondaryLen - joistRecess);
      const splineLen = Math.max(0, vEnd - vStart);
      if (splineLen <= 0) continue;

      const MIN_SPLINE_OVERLAP = 600;
      let numSegments = Math.ceil(splineLen / PLY_SHEET_HEIGHT);

      // Build per-segment lengths to maximize full-length (PLY_SHEET_HEIGHT) pieces
      const segLengths = [];
      if (numSegments === 1) {
        segLengths.push(splineLen);
      } else {
        const remainder = splineLen - (numSegments - 1) * PLY_SHEET_HEIGHT;
        if (remainder >= MIN_SPLINE_OVERLAP) {
          // Normal: (n-1) full-length pieces + remainder
          for (let s = 0; s < numSegments - 1; s++) segLengths.push(PLY_SHEET_HEIGHT);
          segLengths.push(remainder);
        } else {
          // Maximize full-length: (n-2) full + shortened + MIN_SPLINE_OVERLAP
          for (let s = 0; s < numSegments - 2; s++) segLengths.push(PLY_SHEET_HEIGHT);
          segLengths.push(splineLen - (numSegments - 2) * PLY_SHEET_HEIGHT - MIN_SPLINE_OVERLAP);
          segLengths.push(MIN_SPLINE_OVERLAP);
        }
      }

      let segOffset = 0;
      for (let seg = 0; seg < numSegments; seg++) {
        const thisLen = segLengths[seg];
        const segStart = vStart + segOffset;
        segOffset += thisLen;
        splines.push({
          u: panelDirection === ROOF_PANEL_DIRECTIONS.ALONG_RIDGE ? splineU : segStart,
          v: panelDirection === ROOF_PANEL_DIRECTIONS.ALONG_RIDGE ? segStart : splineU,
          width: SPLINE_WIDTH,
          length: thisLen,
          course: courses.indexOf(course),
          planeIndex: plane.index,
          splineType: 'long',
          epsDepth: splineDepthInfo.longSplineEps,
          totalDepth: splineDepthInfo.splineTotal,
        });
      }
    }
  }

  // Generate splines at course breaks (horizontal — running along primary axis)
  // Inset u-extent by joistRecess and split around long spline positions
  if (courses.length > 1) {
    // Collect long-spline centre positions along the primary (u) axis
    const longSplineUs = columnPositions.slice(0, -1).map(col => col.x + col.width + PANEL_GAP / 2);

    for (let c = 0; c < courses.length - 1; c++) {
      const breakV = courses[c].offset + courses[c].height;
      const uStart = joistRecess;
      const uEnd = Math.max(0, primaryLen - joistRecess);

      // Build segments: split the full span at each long spline zone
      const cuts = longSplineUs
        .map(u => ({ from: u - SPLINE_WIDTH / 2, to: u + SPLINE_WIDTH / 2 }))
        .filter(cut => cut.to > uStart && cut.from < uEnd)
        .sort((a, b) => a.from - b.from);

      const segments = [];
      let cursor = uStart;
      for (const cut of cuts) {
        if (cut.from > cursor) segments.push({ start: cursor, end: cut.from });
        cursor = Math.max(cursor, cut.to);
      }
      if (cursor < uEnd) segments.push({ start: cursor, end: uEnd });

      for (const seg of segments) {
        const segLen = seg.end - seg.start;
        if (segLen <= 0) continue;
        splines.push({
          u: panelDirection === ROOF_PANEL_DIRECTIONS.ALONG_RIDGE ? seg.start : breakV,
          v: panelDirection === ROOF_PANEL_DIRECTIONS.ALONG_RIDGE ? breakV : seg.start,
          width: panelDirection === ROOF_PANEL_DIRECTIONS.ALONG_RIDGE ? segLen : SPLINE_WIDTH,
          length: panelDirection === ROOF_PANEL_DIRECTIONS.ALONG_RIDGE ? SPLINE_WIDTH : segLen,
          course: c,
          planeIndex: plane.index,
          orientation: 'horizontal',
          splineType: 'short',
          epsDepth: splineDepthInfo.shortSplineEps,
          totalDepth: splineDepthInfo.splineTotal,
        });
      }
    }
  }

  return { panels, splines, courses, columnPositions, perimeterPlates };
}

/**
 * Check if a panel overlaps a penetration.
 */
function panelOverlapsPenetration(panel, pen, panelDirection) {
  const pu = panel.u;
  const pv = panel.v;
  const pw = panel.width;
  const pl = panel.length;

  let penU, penV, penW, penL;
  if (pen.type === 'pipe') {
    const r = (pen.diameter_mm || 100) / 2;
    penU = pen.position_x_mm - r;
    penV = pen.position_y_mm - r;
    penW = pen.diameter_mm || 100;
    penL = pen.diameter_mm || 100;
  } else {
    penU = pen.position_x_mm;
    penV = pen.position_y_mm;
    penW = pen.width_mm || 0;
    penL = pen.length_mm || 0;
  }

  // Swap if direction differs
  if (panelDirection === ROOF_PANEL_DIRECTIONS.EAVE_TO_RIDGE) {
    [penU, penV] = [penV, penU];
    [penW, penL] = [penL, penW];
  }

  return !(pu + pw <= penU || penU + penW <= pu || pv + pl <= penV || penV + penL <= pv);
}

/**
 * Main entry point: calculate complete roof layout.
 *
 * @param {Object} roof - Roof definition
 * @param {Array} projectWalls - Optional, for auto-detection
 * @returns {Object} Complete roof layout
 */
export function calculateRoofLayout(roof, projectWalls = []) {
  const {
    type: inputType,
    autoDetected,
    length_mm = 6000,
    width_mm = 8000,
    pitch_deg = 15,
    ridgeOffset_mm = 0,
    highEdge = 'left',
    panelDirection = ROOF_PANEL_DIRECTIONS.ALONG_RIDGE,
    thickness = 'roof',
    eaveOverhang_mm = DEFAULT_EAVE_OVERHANG,
    gableOverhang_mm = DEFAULT_GABLE_OVERHANG,
    penetrations = [],
    boundaryJoistCount = 1,
  } = roof;

  const perimeterPlateWidth = DEFAULT_PERIMETER_PLATE_WIDTH;
  const joistRecess = boundaryJoistCount * perimeterPlateWidth + HSPLINE_CLEARANCE;

  // Validate dimensions
  if (!length_mm || length_mm <= 0) {
    return { error: 'Roof length must be greater than 0', panels: [] };
  }
  if (!width_mm || width_mm <= 0) {
    return { error: 'Roof width must be greater than 0', panels: [] };
  }

  // Resolve type
  const type = inputType || (autoDetected ? detectRoofType(projectWalls) : ROOF_TYPES.FLAT);

  // Resolve thickness
  const thicknessOption = ROOF_THICKNESS_OPTIONS[thickness] || ROOF_THICKNESS_OPTIONS.roof;
  const epsDepth = thicknessOption.eps;
  const totalThickness = thicknessOption.total;
  const { longSplineEps, shortSplineEps, splineTotal } = thicknessOption;

  // Resolve separate high/low eave overhangs for skillion
  const { highEave: eaveOverhangHigh_mm, lowEave: eaveOverhangLow_mm } = resolveEaveOverhangs(roof);

  // Compute planes
  const ridgeOrientation = roof.ridgeOrientation || RIDGE_ORIENTATIONS.ALONG_LENGTH;
  const resolvedRoof = {
    type, length_mm, width_mm, pitch_deg, ridgeOffset_mm,
    highEdge, eaveOverhang_mm, gableOverhang_mm,
    eaveOverhangHigh_mm, eaveOverhangLow_mm,
    ridgeOrientation,
  };
  const planes = computeRoofPlanes(resolvedRoof);

  // Layout each plane
  const allPanels = [];
  const allSplines = [];
  const planeLayouts = [];
  let globalPanelIndex = 0;

  for (const plane of planes) {
    const planePenetrations = penetrations.filter(p => p.plane === plane.index);
    const splineDepthInfo = { longSplineEps, shortSplineEps, splineTotal };
    const planeLayout = layoutPlane(plane, panelDirection, planePenetrations, joistRecess, splineDepthInfo);

    // Reindex panels globally
    for (const panel of planeLayout.panels) {
      panel.globalIndex = globalPanelIndex++;
    }

    allPanels.push(...planeLayout.panels);
    allSplines.push(...planeLayout.splines);
    planeLayouts.push({
      plane,
      panels: planeLayout.panels,
      splines: planeLayout.splines,
      courses: planeLayout.courses,
      columnPositions: planeLayout.columnPositions,
      perimeterPlates: planeLayout.perimeterPlates,
    });
  }

  // Compute areas
  const totalPlanArea = planes.reduce((sum, p) => sum + p.uLength * p.vLength, 0);
  const totalPanelArea = allPanels.reduce((sum, p) => sum + p.width * p.length, 0);

  // Effective dimensions after ridge orientation swap
  let effectiveLength = length_mm;
  let effectiveWidth = width_mm;
  if (type === ROOF_TYPES.GABLE && ridgeOrientation === RIDGE_ORIENTATIONS.ALONG_WIDTH) {
    effectiveLength = width_mm;
    effectiveWidth = length_mm;
  }

  // ── Internal roof area for H1 compliance ──
  // This is the ceiling area bounded by the inside face of the walls,
  // excluding overhangs. Wall thickness (162mm) is deducted from all sides
  // of the building footprint. For pitched roofs the slope area of this
  // internal footprint is used (heat flows through the sloped surface).
  const wallThk = WALL_THICKNESS; // 162mm
  const internalLength = Math.max(0, effectiveLength - 2 * wallThk);
  const internalWidth = Math.max(0, effectiveWidth - 2 * wallThk);
  const pitchRad = (pitch_deg * Math.PI) / 180;
  const cosPitch = Math.cos(pitchRad) || 1;

  let internalRoofArea;
  if (type === ROOF_TYPES.GABLE) {
    // Two slopes: each covers half the internal width (adjusted by ridge offset)
    const halfLeft = Math.max(0, internalWidth / 2 + ridgeOffset_mm);
    const halfRight = Math.max(0, internalWidth / 2 - ridgeOffset_mm);
    const slopeLeft = halfLeft / cosPitch;
    const slopeRight = halfRight / cosPitch;
    internalRoofArea = internalLength * (slopeLeft + slopeRight);
  } else if (type === ROOF_TYPES.SKILLION) {
    // Single slope over full internal width
    const slopeLen = internalWidth / cosPitch;
    internalRoofArea = internalLength * slopeLen;
  } else {
    // Flat: plan area = internal footprint
    internalRoofArea = internalLength * internalWidth;
  }

  // Ridge length (for gable)
  const ridgeLength = type === ROOF_TYPES.GABLE ? effectiveLength + 2 * gableOverhang_mm : 0;

  // Ridge height
  let ridgeHeight = 0;
  if (type === ROOF_TYPES.GABLE) {
    ridgeHeight = (effectiveWidth / 2 + ridgeOffset_mm) * Math.tan(pitchRad);
  } else if (type === ROOF_TYPES.SKILLION) {
    ridgeHeight = width_mm * Math.tan(pitchRad);
  }

  return {
    type,
    length_mm: effectiveLength,
    width_mm: effectiveWidth,
    ridgeOrientation,
    pitch_deg,
    ridgeOffset_mm,
    highEdge,
    panelDirection,
    thickness,
    epsDepth,
    totalThickness,
    eaveOverhang_mm,
    eaveOverhangHigh_mm,
    eaveOverhangLow_mm,
    gableOverhang_mm,
    planes,
    planeLayouts,
    panels: allPanels,
    splines: allSplines,
    penetrations,
    totalPanels: allPanels.length,
    fullPanels: allPanels.filter(p => p.type === 'full').length,
    cutPanels: allPanels.filter(p => p.type === 'cut').length,
    totalSplines: allSplines.length,
    totalPlanArea: Math.round(totalPlanArea),
    totalPanelArea: Math.round(totalPanelArea),
    // Internal roof area (mm²): ceiling surface bounded by inside face of walls,
    // excluding overhangs. Used for H1/AS1 compliance (thermal envelope area).
    internalRoofArea: Math.round(internalRoofArea),
    ridgeLength: Math.round(ridgeLength),
    ridgeHeight: Math.round(ridgeHeight),
    boundaryJoistCount,
    perimeterPlateWidth,
    longSplineEps,
    shortSplineEps,
    splineTotal,
  };
}
