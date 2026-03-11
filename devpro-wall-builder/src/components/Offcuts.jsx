import { useRef } from 'react';
import { WINDOW_OVERHANG, PANEL_WIDTH, PANEL_GAP, COLORS, OPENING_TYPES } from '../utils/constants.js';
import PrintButton from './PrintButton.jsx';

const CARD_MARGIN = { top: 44, right: 30, bottom: 20, left: 30 };
const CARD_MAX_H = 240;

/**
 * Compute all offcut pieces from the layout.
 * Returns an array of { width, height, source, label, type } objects.
 *   type: 'notch' | 'stock'
 */
function computeOffcuts(layout) {
  const offcuts = [];
  const ovh = WINDOW_OVERHANG;
  const gap = PANEL_GAP;

  for (const panel of layout.panels) {
    const panelLabel = `P${panel.index + 1}`;
    const H = panel.heightLeft || panel.height;

    // ── Sheet stock remainder (1200mm stock) ──
    if (panel.width < PANEL_WIDTH) {
      const remainder = PANEL_WIDTH - panel.width;
      if (remainder >= 1) {
        offcuts.push({
          width: remainder,
          height: H,
          source: panelLabel,
          label: `${panelLabel} stock remainder`,
          type: 'stock',
        });
      }
    }

    // ── L-cut notch waste ──
    if (panel.type === 'lcut') {
      if (panel.side === 'pier') {
        // Left opening notch
        const lIsWindow = panel.openingType === OPENING_TYPES.WINDOW;
        const lSill = panel.openBottom + gap;
        const lLintel = panel.openTop - gap;
        // Top notch (above lintel on left leg)
        if (H - lLintel > 0) {
          offcuts.push({
            width: ovh,
            height: H - lLintel,
            source: panelLabel,
            label: `${panelLabel} left top notch`,
            type: 'notch',
          });
        }
        // Bottom notch (below sill on left leg) — only for windows
        if (lIsWindow && lSill > 0) {
          offcuts.push({
            width: ovh,
            height: lSill,
            source: panelLabel,
            label: `${panelLabel} left bottom notch`,
            type: 'notch',
          });
        }

        // Right opening notch
        const rIsWindow = panel.rightOpeningType === OPENING_TYPES.WINDOW;
        const rSill = panel.rightOpenBottom + gap;
        const rLintel = panel.rightOpenTop - gap;
        if (H - rLintel > 0) {
          offcuts.push({
            width: ovh,
            height: H - rLintel,
            source: panelLabel,
            label: `${panelLabel} right top notch`,
            type: 'notch',
          });
        }
        if (rIsWindow && rSill > 0) {
          offcuts.push({
            width: ovh,
            height: rSill,
            source: panelLabel,
            label: `${panelLabel} right bottom notch`,
            type: 'notch',
          });
        }
      } else {
        // Single-side L-cut (left or right)
        const isWindow = panel.openingType === OPENING_TYPES.WINDOW;
        const sill = panel.openBottom + gap;
        const lintel = panel.openTop - gap;

        // Top notch
        if (H - lintel > 0) {
          offcuts.push({
            width: ovh,
            height: H - lintel,
            source: panelLabel,
            label: `${panelLabel} top notch`,
            type: 'notch',
          });
        }
        // Bottom notch — only for windows with sill
        if (isWindow && sill > 0) {
          offcuts.push({
            width: ovh,
            height: sill,
            source: panelLabel,
            label: `${panelLabel} bottom notch`,
            type: 'notch',
          });
        }
      }
    }
  }

  // ── Lintel panel & footer panel offcuts (cut from 2440 × 1200 sheets) ──
  // Piece is rotated so its long dimension runs along the 2440mm sheet height.
  // Two rectangular offcuts from the L-shaped remainder:
  //   Strip A (full-width beside): sheetH × (sheetW - shortDim)
  //   Strip B (under the piece):   (sheetH - longDim) × shortDim
  const SHEET_H = layout.height;  // 2440
  const SHEET_W = PANEL_WIDTH;    // 1200

  const sheetPieces = [
    ...(layout.lintelPanels || []).map(l => ({ w: l.width, h: l.height, source: `Lintel Panel ${l.ref}` })),
    ...(layout.footerPanels || []).map(f => ({ w: f.width, h: f.height, source: `Footer Panel ${f.ref}` })),
  ];

  for (const piece of sheetPieces) {
    const longDim = Math.max(piece.w, piece.h);
    const shortDim = Math.min(piece.w, piece.h);

    // Strip A — full sheet height × remaining width
    const stripAWidth = SHEET_W - shortDim;
    if (stripAWidth > 0) {
      offcuts.push({
        width: stripAWidth,
        height: SHEET_H,
        source: piece.source,
        label: `${piece.source} side strip`,
        type: 'stock',
      });
    }

    // Strip B — remaining height × piece short dimension
    const stripBHeight = SHEET_H - longDim;
    if (stripBHeight > 0) {
      offcuts.push({
        width: shortDim,
        height: stripBHeight,
        source: piece.source,
        label: `${piece.source} end strip`,
        type: 'stock',
      });
    }
  }

  return offcuts;
}

/**
 * Small rectangular card showing an offcut piece with dimensions.
 */
function OffcutCard({ offcut }) {
  const W = offcut.width;
  const H = offcut.height;
  const availW = 140;
  const availH = CARD_MAX_H - CARD_MARGIN.top - CARD_MARGIN.bottom;
  const sx = availW / W;
  const sy = availH / H;
  const scale = Math.min(sx, sy);
  const drawW = W * scale;
  const drawH = H * scale;
  const svgW = drawW + CARD_MARGIN.left + CARD_MARGIN.right;
  const svgH = drawH + CARD_MARGIN.top + CARD_MARGIN.bottom;

  const fill = offcut.type === 'notch' ? '#999' : '#bbb';

  return (
    <div style={cardStyle}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block' }}>
        <text x={svgW / 2} y={14} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#333">
          {offcut.source}
        </text>
        <text x={svgW / 2} y={28} textAnchor="middle" fontSize={8} fill="#666">
          {offcut.type === 'notch' ? 'Notch waste' : 'Stock remainder'}
        </text>
        {/* Rectangle */}
        <rect
          x={CARD_MARGIN.left}
          y={CARD_MARGIN.top}
          width={drawW}
          height={drawH}
          fill={fill}
          fillOpacity={0.2}
          stroke={fill}
          strokeWidth={1.5}
          strokeDasharray={offcut.type === 'notch' ? '4,3' : 'none'}
        />
        {/* Width label — top */}
        <text
          x={CARD_MARGIN.left + drawW / 2}
          y={CARD_MARGIN.top - 6}
          textAnchor="middle"
          fontSize={9}
          fill="#333"
        >
          {Math.round(W)}
        </text>
        {/* Height label — right */}
        <text
          x={CARD_MARGIN.left + drawW + 10}
          y={CARD_MARGIN.top + drawH / 2 + 3}
          textAnchor="middle"
          fontSize={9}
          fill="#333"
          transform={`rotate(-90, ${CARD_MARGIN.left + drawW + 10}, ${CARD_MARGIN.top + drawH / 2 + 3})`}
        >
          {Math.round(H)}
        </text>
      </svg>
    </div>
  );
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 6,
  display: 'inline-block',
  verticalAlign: 'top',
  margin: 4,
};

export default function Offcuts({ layout, wallName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout) return null;

  const offcuts = computeOffcuts(layout);
  if (offcuts.length === 0) return null;

  const notchPieces = offcuts.filter(o => o.type === 'notch');
  const stockPieces = offcuts.filter(o => o.type === 'stock');

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, border: '1px solid #ddd', padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#333' }}>
          Offcuts {wallName && `— ${wallName}`}
        </h3>
        <PrintButton sectionRef={sectionRef} label="Offcuts" projectName={projectName} wallName={wallName} />
      </div>

      {stockPieces.length > 0 && (
        <>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: '#666' }}>
            Sheet Stock Remainders ({PANEL_WIDTH}mm stock)
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {stockPieces.map((o, i) => (
              <OffcutCard key={`stock-${i}`} offcut={o} />
            ))}
          </div>
        </>
      )}

      {notchPieces.length > 0 && (
        <>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: '#666' }}>
            L-Cut Notch Waste
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {notchPieces.map((o, i) => (
              <OffcutCard key={`notch-${i}`} offcut={o} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
