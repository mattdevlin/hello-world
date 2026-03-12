import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import { FLOOR_EPS_DEPTH, FLOOR_SPLINE_DEPTH, SPLINE_WIDTH } from '../utils/constants.js';

const CARD_W = 260;
const CARD_H = 280;
const PAD = 40;

export default function FloorEpsCutPlans({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const pieces = extractFloorEpsPiecesList(layout, floorName);
  if (pieces.length === 0) return null;

  const panelPieces = pieces.filter(p => p.depth === FLOOR_EPS_DEPTH);
  const splinePieces = pieces.filter(p => p.depth === FLOOR_SPLINE_DEPTH);

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>EPS Cut Plans — {floorName}</div>
        <PrintButton sectionRef={sectionRef} label="EPS Cuts" projectName={projectName} wallName={floorName} />
      </div>

      {panelPieces.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>
            Panel EPS ({FLOOR_EPS_DEPTH}mm) — {panelPieces.length} pieces
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {panelPieces.map((piece, i) => <RectCard key={`p${i}`} piece={piece} />)}
          </div>
        </>
      )}

      {splinePieces.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>
            Spline EPS ({FLOOR_SPLINE_DEPTH}mm) — {splinePieces.length} pieces
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {splinePieces.map((piece, i) => <RectCard key={`s${i}`} piece={piece} />)}
          </div>
        </>
      )}
    </div>
  );
}

function RectCard({ piece }) {
  const drawW = CARD_W - PAD * 2;
  const drawH = CARD_H - PAD * 2 - 20;
  const scaleX = drawW / (piece.width || 1);
  const scaleY = drawH / (piece.height || 1);
  const scale = Math.min(scaleX, scaleY);
  const w = piece.width * scale;
  const h = piece.height * scale;
  const ox = PAD + (drawW - w) / 2;
  const oy = PAD + 16 + (drawH - h) / 2;

  return (
    <div style={{
      width: CARD_W, background: '#fff', borderRadius: 6, border: '1px solid #e0e0e0', overflow: 'hidden'
    }}>
      <svg width={CARD_W} height={CARD_H} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
        <text x={CARD_W / 2} y={14} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#333">{piece.label}</text>
        <text x={CARD_W / 2} y={28} textAnchor="middle" fontSize={9} fill="#888">{piece.depth}mm thick</text>

        <rect x={ox} y={oy} width={w} height={h} fill="#B3D9FF" fillOpacity={0.5} stroke="#4A90D9" strokeWidth={1} />

        {/* Dimensions */}
        <text x={ox + w / 2} y={oy - 4} textAnchor="middle" fontSize={10} fill="#666">{piece.width}</text>
        <text x={ox + w + 6} y={oy + h / 2} dominantBaseline="middle" fontSize={10} fill="#666">{piece.height}</text>
      </svg>
    </div>
  );
}

/**
 * Extract EPS pieces from a floor layout for display.
 */
function extractFloorEpsPiecesList(layout, floorName) {
  const pieces = [];
  const { panels, reinforcedSplines, unreinforcedSplines } = layout;

  // Panel EPS pieces
  for (const panel of panels) {
    if (panel.area > 0) {
      pieces.push({
        width: Math.round(panel.width),
        height: Math.round(panel.length),
        depth: FLOOR_EPS_DEPTH,
        label: `P${panel.index + 1}`,
        floorName,
      });
    }
  }

  // Spline EPS pieces
  const MAGBOARD = 10;
  const splineEpsW = SPLINE_WIDTH - MAGBOARD * 2;
  for (const s of [...reinforcedSplines, ...unreinforcedSplines]) {
    pieces.push({
      width: splineEpsW,
      height: Math.round(s.length),
      depth: FLOOR_SPLINE_DEPTH,
      label: `Spline`,
      floorName,
    });
  }

  return pieces;
}
