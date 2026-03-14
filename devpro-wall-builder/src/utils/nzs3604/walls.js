/**
 * NZS 3604:2011 — Wall Framing Rules
 *
 * Prescriptive sizing for timber-framed wall members per NZS 3604
 * with supplementary rules from BRANZ Build 141 (Oct/Nov 2014).
 *
 * References:
 *   - NZS 3604:2011 Table 8.5  — Trimming studs
 *   - NZS 3604:2011 Table 8.2  — Studs in loadbearing walls
 *   - NZS 3604:2011 Tables 8.9–8.13 — Lintels
 *   - BRANZ Build 141, Oct/Nov 2014 — "Getting trimmer studs right"
 */

// ─────────────────────────────────────────────────────────────
// NZ Member Terminology
// ─────────────────────────────────────────────────────────────

/**
 * Maps internal member type strings to NZ display labels.
 * Per NZS 3604 and BRANZ terminology:
 *   - Trimming stud: full-height stud at each side of an opening
 *   - Doubling stud (understud): shorter stud beside trimming stud, supports lintel
 *   - Jack stud: short stud above lintel or below sill
 *   - Sill trimmer: horizontal member under window sill
 *   - Dwang (nog): horizontal bracing between studs
 */
export const NZ_MEMBER_LABELS = {
  bottom_plate:   'Bottom Plate',
  top_plate_1:    'Top Plate 1',
  top_plate_2:    'Top Plate 2',
  stud:           'Stud',
  end_stud:       'End Stud',
  trimming_stud:  'Trimming Stud',
  doubling_stud:  'Doubling Stud',
  jack_stud:      'Jack Stud',
  lintel:         'Lintel',
  sill_trimmer:   'Sill Trimmer',
  dwang:          'Dwang',
};

// ─────────────────────────────────────────────────────────────
// BRANZ Build 141 Rules
// ─────────────────────────────────────────────────────────────

/**
 * Key rules from BRANZ Build 141 (Oct/Nov 2014) for trimming stud sizing.
 * These are prescriptive constraints that apply in addition to Table 8.5.
 *
 * Reference: BRANZ Build 141, Oct/Nov 2014 — "Getting trimmer studs right"
 */
export const BRANZ_RULES = {
  reference: 'BRANZ Build 141, Oct/Nov 2014 — Getting trimmer studs right',

  rules: [
    {
      id: 'trimming_stud_width',
      description: 'Trimming studs must be the same width as the wall studs',
      detail: 'If wall studs are 90mm wide, trimming studs must also be 90mm wide.',
    },
    {
      id: 'no_holes_middle_third',
      description: 'No holes or notches in the middle third of trimming stud height',
      detail: 'Services must not penetrate the middle third of a trimming stud. Route pipes and cables around or use alternative framing.',
    },
    {
      id: 'doubling_max_shorter',
      description: 'Doubling stud cannot be more than 400mm shorter than wall studs',
      detail: 'The doubling (understud) that supports the lintel must not be more than 400mm shorter than the full-height wall studs. If the lintel drop exceeds 400mm, additional support is required.',
    },
    {
      id: 'sizing_process',
      description: 'Four-step sizing process for trimming studs',
      detail: '1) Determine lintel size (Table 8.9). 2) Determine wall stud thickness (Table 8.2). 3) Determine max clear opening width (Table 8.5). 4) Determine trimming stud size from Table 8.5.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// Table 8.5 — Trimming Studs
// ─────────────────────────────────────────────────────────────

/**
 * NZS 3604:2011 Table 8.5 — Trimming studs at 600mm CRS
 *
 * Returns the required total trimming stud thickness (mm) for a given
 * opening width and wall stud thickness.
 *
 * Two position categories:
 *   'sot_and_nlb' — Single or top storey, and non-loadbearing walls
 *   'other'       — Any other location (lower storey, etc.)
 *
 * The trimming stud assembly is made up of multiple members of the same
 * width as the wall studs, packed together to achieve the required thickness.
 * For example, 180mm total from 90mm studs = 2 trimming studs + 1 doubling.
 */

// Table 8.5 data: position → stud_thickness → [{ maxOpeningWidth, trimmingThickness }]
// Openings wider than the largest entry are not permitted by NZS 3604
const TABLE_8_5 = {
  sot_and_nlb: {
    35: [
      { maxWidth: 1800, thickness: 45 },
      { maxWidth: 3000, thickness: 70 },
    ],
    45: [
      { maxWidth: 1800, thickness: 45 },
      { maxWidth: 3000, thickness: 90 },
    ],
    70: [
      { maxWidth: 1800, thickness: 90 },
      { maxWidth: 3000, thickness: 140 },
      { maxWidth: 3600, thickness: 180 },
    ],
    90: [
      { maxWidth: 1800, thickness: 90 },
      { maxWidth: 3000, thickness: 180 },
      { maxWidth: 3600, thickness: 180 },
      { maxWidth: 4200, thickness: 270 },
    ],
  },
  other: {
    35: [
      { maxWidth: 900, thickness: 45 },
      { maxWidth: 1800, thickness: 70 },
    ],
    45: [
      { maxWidth: 900, thickness: 45 },
      { maxWidth: 1800, thickness: 90 },
      { maxWidth: 3000, thickness: 90 },
    ],
    70: [
      { maxWidth: 900, thickness: 70 },
      { maxWidth: 1800, thickness: 90 },
      { maxWidth: 3000, thickness: 180 },
    ],
    90: [
      { maxWidth: 900, thickness: 90 },
      { maxWidth: 1800, thickness: 90 },
      { maxWidth: 3000, thickness: 180 },
    ],
  },
};

/**
 * Look up the required trimming stud thickness from NZS 3604 Table 8.5.
 *
 * @param {number} openingWidth  — clear opening width in mm
 * @param {number} studThickness — wall stud thickness in mm (35, 45, 70, or 90)
 * @param {'sot_and_nlb'|'other'} position — wall position category
 * @returns {{ thickness: number, studCount: number, note: string }|null}
 *   thickness:  total trimming stud thickness required (mm)
 *   studCount:  number of stud members needed (thickness / studThickness)
 *   note:       human-readable description
 *   Returns null if opening exceeds Table 8.5 limits (engineer required).
 */
export function getTrimmingStudSize(openingWidth, studThickness = 90, position = 'sot_and_nlb') {
  const positionData = TABLE_8_5[position];
  if (!positionData) return null;

  // Find closest stud thickness in table (round down to nearest available)
  const availableThicknesses = Object.keys(positionData).map(Number).sort((a, b) => a - b);
  let matchedThickness = availableThicknesses[0];
  for (const t of availableThicknesses) {
    if (t <= studThickness) matchedThickness = t;
  }

  const entries = positionData[matchedThickness];
  if (!entries) return null;

  // Find the first entry where opening width fits
  for (const entry of entries) {
    if (openingWidth <= entry.maxWidth) {
      const studCount = Math.ceil(entry.thickness / studThickness);
      return {
        thickness: entry.thickness,
        studCount,
        note: `Table 8.5: ${openingWidth}mm opening, ${studThickness}mm studs → ${entry.thickness}mm trimming (${studCount}× ${studThickness}mm)`,
      };
    }
  }

  // Opening exceeds table limits
  return null;
}

/**
 * Validate a doubling stud against BRANZ rules.
 *
 * @param {number} doublingHeight — height of the doubling stud (mm)
 * @param {number} wallStudHeight — height of full wall studs (mm)
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateDoublingStud(doublingHeight, wallStudHeight) {
  const warnings = [];
  const heightDiff = wallStudHeight - doublingHeight;

  if (heightDiff > 400) {
    warnings.push(
      `Doubling stud is ${heightDiff}mm shorter than wall studs (max 400mm per BRANZ Build 141). ` +
      `Additional support or engineering design required.`
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// Table 8.9 — Lintels (placeholder)
// ─────────────────────────────────────────────────────────────

/**
 * Placeholder for lintel sizing lookup.
 * TODO: Implement Tables 8.9–8.13 for full lintel sizing.
 *
 * @param {'roof_only'|'roof_wall'|'roof_wall_floor'|'wall_floor'|'floor_only'} loadCase
 * @param {number} loadedDimension — loaded dimension in metres
 * @param {number} span — lintel span in metres
 * @returns {string|null} lintel size string (e.g., "190x90") or null
 */
export function getLintelSize(loadCase, loadedDimension, span) {
  // TODO: Implement from nzs3604_tables.json Tables 8.9–8.13
  return null;
}
