/**
 * Stickframe Wall Layout Calculator — NZS 3604:2011
 *
 * Computes the full NZS 3604 timber frame layout for a wall:
 * - Bottom plate, top plate ×2
 * - End studs, regular studs at 600mm centres
 * - Trimming studs, doubling studs at openings (NZ terminology per NZS 3604)
 * - Lintels, sill trimmers
 * - Jack studs above lintels and below sills
 * - Dwangs (nogs) at ~810mm vertical spacing
 *
 * Also calculates thermal bridging ratio (timber face area ÷ effective wall area).
 *
 * Terminology follows NZS 3604:2011 and BRANZ Build 141 (Oct/Nov 2014):
 *   Trimming stud  — full-height stud at each side of an opening
 *   Doubling stud  — shorter stud beside trimming stud, supports lintel
 *   Jack stud      — short stud above lintel or below sill
 *   Sill trimmer   — horizontal member under window sill
 *   Dwang (nog)    — horizontal bracing between studs
 */

import {
  SF_STUD_WIDTH, SF_STUD_DEPTH, SF_STUD_SPACING,
  SF_PLATE_WIDTH, SF_PLATE_DEPTH, SF_DEDUCTION, SF_LINTEL_DEPTH,
  WALL_THICKNESS,
} from './constants.js';

import { getTrimmingStudSize, validateDoublingStud } from './nzs3604/walls.js';

// ─────────────────────────────────────────────────────────────
// Remap SIP deductions (162mm) to stickframe (90mm)
// ─────────────────────────────────────────────────────────────

function remapDeduction(d) {
  if (d === WALL_THICKNESS) return SF_DEDUCTION;
  if (d > 0) return SF_DEDUCTION; // any non-zero deduction → stud width
  return 0;
}

// ─────────────────────────────────────────────────────────────
// Main layout calculator
// ─────────────────────────────────────────────────────────────

export function calculateStickframeLayout(wall) {
  const members = [];
  const wallName = wall.name || 'Unnamed';

  const grossLength = wall.length_mm || 0;
  const wallHeight = wall.height_mm || 2440;
  const deductionLeft = remapDeduction(wall.deduction_left_mm || 0);
  const deductionRight = remapDeduction(wall.deduction_right_mm || 0);
  const netLength = grossLength - deductionLeft - deductionRight;

  if (netLength <= 0 || wallHeight <= 0) {
    return { netLength: 0, wallHeight: 0, grossLength, deductionLeft, deductionRight, members: [], thermalRatio: null };
  }

  const plateH = SF_PLATE_DEPTH;   // 45mm
  const studW = SF_STUD_DEPTH;     // 45mm — studs show edge-on in elevation

  // Heights
  const studHeight = wallHeight - 3 * plateH; // between bottom plate and top plate 1

  // ── Bottom plate ──
  members.push({
    type: 'bottom_plate',
    x: deductionLeft,
    y: wallHeight - plateH,
    width: netLength,
    height: plateH,
    label: 'Bottom Plate',
    length_mm: netLength,
  });

  // ── Top plate 1 ──
  members.push({
    type: 'top_plate_1',
    x: deductionLeft,
    y: 0,
    width: netLength,
    height: plateH,
    label: 'Top Plate 1',
    length_mm: netLength,
  });

  // ── Top plate 2 ──
  members.push({
    type: 'top_plate_2',
    x: deductionLeft,
    y: plateH,
    width: netLength,
    height: plateH,
    label: 'Top Plate 2',
    length_mm: netLength,
  });

  // ── Process openings — build exclusion zones and framing ──
  const openings = (wall.openings || []).map(op => {
    const posFromLeft = op.position_from_left_mm || 0;
    // Position relative to net wall (after left deduction)
    const opX = posFromLeft;
    const opW = op.width_mm || 0;
    const opH = op.height_mm || 0;
    const sillH = op.type === 'door' || op.type === 'single_garage' || op.type === 'double_garage' ? 0 : (op.sill_mm || 0);
    const lintelH = op.lintel_height_mm || 200;
    const isDoor = op.type === 'door' || op.type === 'single_garage' || op.type === 'double_garage';

    return {
      ref: op.ref || '',
      type: op.type,
      x: opX,        // from left edge of net wall
      width: opW,
      height: opH,
      sill: sillH,
      lintelHeight: lintelH,
      isDoor,
      // Computed positions (Y from top, 0 = top of wall)
      // Bottom of opening = wallHeight - plateH - sillH - opH
      openingBottom: wallHeight - plateH - sillH,
      openingTop: wallHeight - plateH - sillH - opH,
      // Lintel sits above opening
      lintelBottom: wallHeight - plateH - sillH - opH - lintelH,
      lintelTop: wallHeight - plateH - sillH - opH,
      // Sill trimmer sits below opening (at sill level)
      sillY: wallHeight - plateH - sillH,
      // Trimming stud zone (for regular stud exclusion)
      trimmingLeft: opX - studW,
      trimmingRight: opX + opW,
    };
  });

  // Sort openings left to right
  openings.sort((a, b) => a.x - b.x);

  // Build exclusion zones for regular studs (between trimming studs)
  const exclusionZones = openings.map(op => ({
    left: deductionLeft + op.trimmingLeft,
    right: deductionLeft + op.trimmingRight + studW,
  }));

  // ── End studs ──
  members.push({
    type: 'end_stud',
    x: deductionLeft,
    y: plateH * 2,
    width: studW,
    height: studHeight,
    label: 'Left End Stud',
    length_mm: studHeight,
  });

  members.push({
    type: 'end_stud',
    x: deductionLeft + netLength - studW,
    y: plateH * 2,
    width: studW,
    height: studHeight,
    label: 'Right End Stud',
    length_mm: studHeight,
  });

  // ── Regular studs at 600mm centres ──
  // Start measuring from left edge of net wall
  const studStartX = deductionLeft + SF_STUD_SPACING;
  const studEndX = deductionLeft + netLength - studW;

  for (let x = studStartX; x < studEndX; x += SF_STUD_SPACING) {
    // Check if this stud position falls within an opening exclusion zone
    const studLeft = x;
    const studRight = x + studW;
    const inExclusion = exclusionZones.some(zone =>
      studLeft < zone.right && studRight > zone.left
    );

    if (!inExclusion) {
      members.push({
        type: 'stud',
        x: x,
        y: plateH * 2,
        width: studW,
        height: studHeight,
        label: 'Stud',
        length_mm: studHeight,
      });
    }
  }

  // ── Opening framing (NZS 3604 terminology) ──
  for (const op of openings) {
    const absX = deductionLeft + op.x; // absolute x position
    const ref = op.ref || op.type;

    // Trimming studs — full height studs at each side of opening (NZS 3604)
    const trimmingLeftX = absX - studW;
    const trimmingRightX = absX + op.width;

    // Look up trimming stud sizing from NZS 3604 Table 8.5
    const trimmingSizing = getTrimmingStudSize(op.width, SF_STUD_WIDTH, 'sot_and_nlb');

    // Only add trimming stud if it's not at the same position as an end stud
    if (trimmingLeftX > deductionLeft + studW / 2) {
      members.push({
        type: 'trimming_stud',
        x: trimmingLeftX,
        y: plateH * 2,
        width: studW,
        height: studHeight,
        label: `Trimming Stud L (${ref})`,
        length_mm: studHeight,
        nzs3604: trimmingSizing,
      });
    }

    if (trimmingRightX < deductionLeft + netLength - studW * 1.5) {
      members.push({
        type: 'trimming_stud',
        x: trimmingRightX,
        y: plateH * 2,
        width: studW,
        height: studHeight,
        label: `Trimming Stud R (${ref})`,
        length_mm: studHeight,
        nzs3604: trimmingSizing,
      });
    }

    // Doubling studs (understuds) — beside trimming studs, support lintel (NZS 3604)
    const doublingHeight = op.sill + op.height + op.lintelHeight;
    const doublingY = wallHeight - plateH - doublingHeight;

    // Validate doubling stud height per BRANZ Build 141 rules
    const doublingValidation = validateDoublingStud(doublingHeight, studHeight);

    if (trimmingLeftX + studW <= absX) {
      members.push({
        type: 'doubling_stud',
        x: trimmingLeftX + studW,
        y: doublingY,
        width: studW,
        height: doublingHeight,
        label: `Doubling L (${ref})`,
        length_mm: doublingHeight,
        branzWarnings: doublingValidation.warnings,
      });
    }

    if (trimmingRightX - studW >= absX + op.width) {
      members.push({
        type: 'doubling_stud',
        x: trimmingRightX - studW,
        y: doublingY,
        width: studW,
        height: doublingHeight,
        label: `Doubling R (${ref})`,
        length_mm: doublingHeight,
        branzWarnings: doublingValidation.warnings,
      });
    }

    // Lintel — spans between trimming studs
    const lintelSpan = op.width + studW * 2; // trimming to trimming
    members.push({
      type: 'lintel',
      x: trimmingLeftX,
      y: op.lintelBottom,
      width: lintelSpan,
      height: op.lintelHeight,
      label: `Lintel (${ref})`,
      length_mm: lintelSpan,
    });

    // Sill trimmer (windows only — not doors)
    if (!op.isDoor && op.sill > 0) {
      members.push({
        type: 'sill_trimmer',
        x: absX,
        y: op.sillY,
        width: op.width,
        height: plateH,
        label: `Sill Trimmer (${ref})`,
        length_mm: op.width,
      });
    }

    // Jack studs below window sill (NZS 3604: short studs below sill)
    if (!op.isDoor && op.sill > plateH) {
      const jackHeight = op.sill - plateH; // from top of bottom plate to sill trimmer
      const jackY = wallHeight - plateH - op.sill;

      for (let cx = absX + SF_STUD_SPACING; cx < absX + op.width - studW; cx += SF_STUD_SPACING) {
        members.push({
          type: 'jack_stud',
          x: cx,
          y: jackY + plateH,
          width: studW,
          height: jackHeight,
          label: `Jack Stud Below (${ref})`,
          length_mm: jackHeight,
        });
      }
    }

    // Jack studs above lintel (NZS 3604: short studs above lintel to top plate)
    const spaceAboveLintel = op.lintelBottom - plateH * 2;
    if (spaceAboveLintel > plateH) {
      for (let cx = absX + SF_STUD_SPACING; cx < absX + op.width - studW; cx += SF_STUD_SPACING) {
        members.push({
          type: 'jack_stud',
          x: cx,
          y: plateH * 2,
          width: studW,
          height: spaceAboveLintel,
          label: `Jack Stud Above (${ref})`,
          length_mm: spaceAboveLintel,
        });
      }
    }
  }

  // ── Dwangs (nogs) ──
  // Horizontal members between studs at regular vertical intervals
  // Divide wall height into roughly 3 zones → dwangs at ~1/3 and ~2/3 height
  const dwangCount = Math.max(1, Math.round((wallHeight - 3 * plateH) / 810) - 1);
  const dwangSpacing = studHeight / (dwangCount + 1);

  for (let d = 1; d <= dwangCount; d++) {
    const dwangY = plateH * 2 + d * dwangSpacing;

    // Get all vertical members sorted by x to find gaps between them
    const verticals = members
      .filter(m => ['stud', 'end_stud', 'trimming_stud', 'doubling_stud', 'jack_stud'].includes(m.type))
      .filter(m => m.y <= dwangY && m.y + m.height >= dwangY + plateH)
      .sort((a, b) => a.x - b.x);

    for (let i = 0; i < verticals.length - 1; i++) {
      const leftStud = verticals[i];
      const rightStud = verticals[i + 1];
      const dwangLeft = leftStud.x + leftStud.width;
      const dwangRight = rightStud.x;
      const dwangWidth = dwangRight - dwangLeft;

      if (dwangWidth > studW && dwangWidth < SF_STUD_SPACING * 2) {
        // Check this dwang doesn't overlap with an opening
        const inOpening = openings.some(op => {
          const opLeft = deductionLeft + op.x;
          const opRight = opLeft + op.width;
          const opTop = op.openingTop;
          const opBot = op.openingBottom;
          return dwangLeft >= opLeft && dwangRight <= opRight &&
                 dwangY >= opTop && dwangY <= opBot;
        });

        if (!inOpening) {
          members.push({
            type: 'dwang',
            x: dwangLeft,
            y: dwangY,
            width: dwangWidth,
            height: plateH,
            label: 'Dwang',
            length_mm: dwangWidth,
          });
        }
      }
    }
  }

  // ── Thermal ratio ──
  const thermalRatio = computeStickframeThermalRatio(
    netLength, wallHeight, members, wall.openings || [], deductionLeft
  );

  return {
    netLength,
    wallHeight,
    grossLength,
    deductionLeft,
    deductionRight,
    members,
    thermalRatio,
    wallName,
  };
}

// ─────────────────────────────────────────────────────────────
// Thermal bridging calculation
// ─────────────────────────────────────────────────────────────

function computeStickframeThermalRatio(netLength, wallHeight, members, rawOpenings, deductionLeft) {
  const grossWallArea = netLength * wallHeight;

  let openingArea = 0;
  for (const op of rawOpenings) {
    openingArea += (op.width_mm || 0) * (op.height_mm || 0);
  }

  const effectiveWallArea = grossWallArea - openingArea;
  if (effectiveWallArea <= 0) {
    return {
      grossWallArea: 0, openingArea: 0, effectiveWallArea: 0,
      timberFaceArea: 0, timberPercentage: 0, insulationPercentage: 100,
      breakdown: { plates: 0, studs: 0, dwangs: 0, lintels: 0, doublings: 0, jackStuds: 0 },
    };
  }

  const breakdown = {
    plates: 0,
    studs: 0,
    dwangs: 0,
    lintels: 0,
    doublings: 0,
    jackStuds: 0,
  };

  for (const m of members) {
    // Face area = width × height of the member as drawn
    const faceArea = m.width * m.height;

    switch (m.type) {
      case 'bottom_plate':
      case 'top_plate_1':
      case 'top_plate_2':
        breakdown.plates += faceArea;
        break;
      case 'stud':
      case 'end_stud':
      case 'trimming_stud':
        breakdown.studs += faceArea;
        break;
      case 'dwang':
        breakdown.dwangs += faceArea;
        break;
      case 'lintel':
        breakdown.lintels += faceArea;
        break;
      case 'doubling_stud':
        breakdown.doublings += faceArea;
        break;
      case 'jack_stud':
        breakdown.jackStuds += faceArea;
        break;
      case 'sill_trimmer':
        breakdown.doublings += faceArea;
        break;
    }
  }

  const timberFaceArea = breakdown.plates + breakdown.studs + breakdown.dwangs
    + breakdown.lintels + breakdown.doublings + breakdown.jackStuds;

  const timberPercentage = (timberFaceArea / effectiveWallArea) * 100;

  return {
    grossWallArea: Math.round(grossWallArea),
    openingArea: Math.round(openingArea),
    effectiveWallArea: Math.round(effectiveWallArea),
    timberFaceArea: Math.round(timberFaceArea),
    timberPercentage: Math.round(timberPercentage * 100) / 100,
    insulationPercentage: Math.round((100 - timberPercentage) * 100) / 100,
    breakdown: {
      plates: Math.round(breakdown.plates),
      studs: Math.round(breakdown.studs),
      dwangs: Math.round(breakdown.dwangs),
      lintels: Math.round(breakdown.lintels),
      doublings: Math.round(breakdown.doublings),
      jackStuds: Math.round(breakdown.jackStuds),
    },
  };
}
