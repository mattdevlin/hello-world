// DEVPRO Panel System Constants
export const PANEL_WIDTH = 1200;        // mm
export const PANEL_GAP = 5;             // mm plaster gap
export const PANEL_PITCH = 1205;        // mm (width + gap)
export const MIN_PANEL = 300;           // mm minimum panel width
export const MIN_LCUT_PANEL = 600;      // mm minimum L-cut panel width at base
export const WALL_THICKNESS = 162;      // mm
export const WALL_EPS_DEPTH = 142;      // mm
export const EPS_GAP = 10;              // mm gap between EPS and framing (all sides)
export const MAGBOARD = 10;             // mm magboard skin thickness (each face)
export const FLOOR_THICKNESS = 192;     // mm
export const ROOF_THICKNESS = 242;      // mm

// Floor panel system
export const FLOOR_EPS_DEPTH = 172;           // mm (192 - 2×10mm magboard)
export const FLOOR_SPLINE_DEPTH = 170;        // mm
export const FLOOR_SPLINE_EPS_DEPTH = 150;    // mm
export const FLOOR_PLATE_DEPTH = 170;         // mm
export const FLOOR_PANEL_SLABS_PER_BLOCK = 3; // 172×3 = 516mm from 630
export const FLOOR_SPLINE_SLABS_PER_BLOCK = 3;// 170×3 = 510mm from 630
export const DEFAULT_PERIMETER_PLATE_WIDTH = 45; // mm
export const MIN_FLOOR_PANEL_WIDTH = 498;          // mm (332mm EPS + 2×83mm recess)
export const FLOOR_EPS_RECESS = 83;                // mm EPS inset from panel edge
export const FLOOR_PENETRATION_CLEARANCE = 45;     // mm clearance from penetration edge to panel boundary

// Panel heights available
export const PANEL_HEIGHTS = [2440, 2745, 3050]; // mm

// Stock sheet heights for CNC cutting (2440mm not stocked — use 2745 or 3050)
export const STOCK_SHEET_HEIGHTS = [2745, 3050]; // mm
export const MAX_SHEET_HEIGHT = 3050;             // mm — tallest single sheet

// Plates
export const BOTTOM_PLATE = 45;         // mm single bottom plate
export const TOP_PLATE = 45;            // mm each (two top plates)

// Opening constants
export const WINDOW_OVERHANG = 121;     // mm each side
export const DOOR_OVERHANG = 166;       // mm each side
export const DOOR_TOP_CUTOUT = 171;     // mm
export const LINTEL_DEPTH = 300;        // mm default
export const WINDOW_PLATE = 45;         // mm — sill plate and jamb plate thickness
export const DOOR_JAMB_PLATE = 45;      // mm — door jamb plate thickness
export const CNC_KERF = 10;            // mm

// Timber plates
export const MAX_PLATE_LENGTH = 4800;        // mm
export const WALL_PLATE_WIDTH = 140;         // mm
export const WALL_PLATE_DEPTH = 45;          // mm
export const LINTEL_WIDTH = 142;             // mm (fills EPS cavity)
export const TOP_PLATE_STAGGER = 600;        // mm join offset between top plates

// Splines
export const SPLINE_WIDTH = 146;           // mm
export const HSPLINE_CLEARANCE = 10;       // mm clearance from spline edges

// Cassette
export const MAX_CASSETTE = 6;          // panels
export const MAX_CASSETTE_LEN = 7230;   // mm

// Transport
export const MAX_TRANSPORT_H = 5000;    // mm
export const MAX_TRANSPORT_W = 3000;    // mm
export const DECK_HEIGHT = 1200;        // mm
export const MAX_PANEL_HEIGHT = 3800;   // mm

// Wall profile types
export const WALL_PROFILES = {
  STANDARD: 'standard',
  RAKED: 'raked',
  GABLE: 'gable',
};

// Opening types
export const OPENING_TYPES = {
  WINDOW: 'window',
  DOOR: 'door',
  SINGLE_GARAGE: 'single_garage',
  DOUBLE_GARAGE: 'double_garage',
};

// Colours for drawing
export const COLORS = {
  PANEL: '#4A90D9',
  PANEL_STROKE: '#2C5F8A',
  PANEL_LABEL: '#1a1a1a',
  LCUT: '#E8A838',
  LCUT_STROKE: '#B07D20',
  FOOTER: '#6BBF6B',
  FOOTER_STROKE: '#3D8B3D',
  LINTEL: '#D94A4A',
  LINTEL_STROKE: '#A03030',
  OPENING: '#FFFFFF',
  OPENING_STROKE: '#666666',
  BACKGROUND: '#F5F5F0',
  WALL_OUTLINE: '#333333',
  DIMENSION: '#333333',
  END_CAP: '#9B59B6',
  END_CAP_STROKE: '#7D3C98',
};

/**
 * Build horizontal spline segments within [splineLeft, splineRight],
 * excluding zones around lintel panels and openings (with their plates/splines).
 *
 * @param {number} splineLeft  - left boundary (already inset by HSPLINE_CLEARANCE)
 * @param {number} splineRight - right boundary (already inset by HSPLINE_CLEARANCE)
 * @param {Array} lintelPanels  - lintel panel objects with { x, width }
 * @param {Array} openings - opening objects with { x, drawWidth, y }
 * @returns {Array<[number, number]>} segments as [left, right] pairs
 */
export function buildHSplineSegments(splineLeft, splineRight, lintelPanels, openings) {
  if (splineRight <= splineLeft) return [];

  const excl = [];
  for (const l of lintelPanels) {
    const eL = Math.max(l.x - HSPLINE_CLEARANCE, splineLeft);
    const eR = Math.min(l.x + l.width + HSPLINE_CLEARANCE, splineRight);
    if (eL < eR) excl.push([eL, eR]);
  }
  for (const op of openings) {
    const oL = op.x - BOTTOM_PLATE - SPLINE_WIDTH - HSPLINE_CLEARANCE;
    const oR = op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH + HSPLINE_CLEARANCE;
    const eL = Math.max(oL, splineLeft);
    const eR = Math.min(oR, splineRight);
    if (eL < eR) excl.push([eL, eR]);
  }
  excl.sort((a, b) => a[0] - b[0]);

  const segs = [];
  let cursor = splineLeft;
  for (const [eL, eR] of excl) {
    if (cursor < eL) segs.push([cursor, eL]);
    cursor = Math.max(cursor, eR);
  }
  if (cursor < splineRight) segs.push([cursor, splineRight]);
  return segs;
}
