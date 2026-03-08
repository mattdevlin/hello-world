// DEVPRO Panel System Constants
export const PANEL_WIDTH = 1200;        // mm
export const PANEL_GAP = 5;             // mm plaster gap
export const PANEL_PITCH = 1205;        // mm (width + gap)
export const MIN_PANEL = 300;           // mm minimum panel width
export const WALL_THICKNESS = 162;      // mm
export const FLOOR_THICKNESS = 192;     // mm
export const ROOF_THICKNESS = 242;      // mm

// Panel heights available
export const PANEL_HEIGHTS = [2400, 2700, 3000]; // mm

// Opening constants
export const WINDOW_OVERHANG = 121;     // mm each side
export const DOOR_OVERHANG = 166;       // mm each side
export const DOOR_TOP_CUTOUT = 171;     // mm
export const LINTEL_DEPTH = 300;        // mm default
export const CNC_KERF = 10;            // mm

// Cassette
export const MAX_CASSETTE = 6;          // panels
export const MAX_CASSETTE_LEN = 7230;   // mm

// Transport
export const MAX_TRANSPORT_H = 5000;    // mm
export const MAX_TRANSPORT_W = 3000;    // mm
export const DECK_HEIGHT = 1200;        // mm
export const MAX_PANEL_HEIGHT = 3800;   // mm

// Opening types
export const OPENING_TYPES = {
  WINDOW: 'window',
  DOOR: 'door',
  GARAGE_DOOR: 'garage_door',
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
