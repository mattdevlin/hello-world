import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import { ROOF_EPS_DEPTH, SPLINE_WIDTH, MAGBOARD } from '../utils/constants.js';

const CARD_W = 260;
const CARD_H = 280;
const PAD = 40;

export default function RoofEpsCutPlans({ layout, roofName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const pieces = extractRoofEpsPiecesList(layout);
  if (pieces.length === 0) return null;

  const epsDepth = layout.epsDepth || ROOF_EPS_DEPTH;
  const panelPieces = pieces.filter(p => p.type === 'panel');
  const longSplinePieces = pieces.filter(p => p.splineType === 'long');
  const shortSplinePieces = pieces.filter(p => p.splineType === 'short');

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>EPS Cut Plans — {roofName}</div>
        <PrintButton sectionRef={sectionRef} label="EPS Cuts" projectName={projectName} wallName={roofName} />
      </div>

      {panelPieces.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>
            Panel EPS ({epsDepth}mm) — {panelPieces.length} pieces
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {panelPieces.map((piece, i) => <RectCard key={`p${i}`} piece={piece} />)}
          </div>
        </>
      )}

      {longSplinePieces.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>
            Long Spline EPS ({longSplinePieces[0].depth}mm) — {longSplinePieces.length} pieces
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {longSplinePieces.map((piece, i) => <RectCard key={`ls${i}`} piece={piece} />)}
          </div>
        </>
      )}

      {shortSplinePieces.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8, textTransform: 'uppercase' }}>
            Short Spline EPS ({shortSplinePieces[0].depth}mm) — {shortSplinePieces.length} pieces
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {shortSplinePieces.map((piece, i) => <RectCard key={`ss${i}`} piece={piece} />)}
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

        <text x={ox + w / 2} y={oy - 4} textAnchor="middle" fontSize={10} fill="#666">{piece.width}</text>
        <text x={ox + w + 6} y={oy + h / 2} dominantBaseline="middle" fontSize={10} fill="#666">{piece.height}</text>
      </svg>
    </div>
  );
}

function extractRoofEpsPiecesList(layout) {
  const pieces = [];
  const { panels, splines } = layout;
  const epsDepth = layout.epsDepth || ROOF_EPS_DEPTH;

  for (const panel of panels) {
    pieces.push({
      width: Math.round(panel.width),
      height: Math.round(panel.length),
      depth: epsDepth,
      label: `P${panel.globalIndex + 1}`,
      type: 'panel',
    });
  }

  const splineEpsW = SPLINE_WIDTH - MAGBOARD * 2;
  for (const s of splines) {
    const isLong = s.splineType === 'long';
    pieces.push({
      width: splineEpsW,
      height: Math.round(s.length),
      depth: s.epsDepth || (s.totalDepth || 220),
      label: isLong ? 'Long Spline' : 'Short Spline',
      splineType: s.splineType || 'long',
    });
  }

  return pieces;
}
