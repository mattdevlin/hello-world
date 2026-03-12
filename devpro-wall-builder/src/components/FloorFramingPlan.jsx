import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';

const MARGIN = { top: 60, right: 40, bottom: 80, left: 60 };
const MAX_SVG_WIDTH = 1200;
const MAX_SVG_HEIGHT = 600;

const COLORS = {
  PLATE: '#8B4513',
  REINFORCED: '#e74c3c',
  UNREINFORCED: '#3498db',
  BEARER: '#27ae60',
  OUTLINE: '#333',
  STEEL: '#FFD700',
};

export default function FloorFramingPlan({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const { polygon, perimeterPlates, reinforcedSplines, unreinforcedSplines,
    bearerLines, recesses, boundingBox: bb } = layout;

  const drawW = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const drawH = MAX_SVG_HEIGHT - MARGIN.top - MARGIN.bottom;
  const scaleX = drawW / (bb.width || 1);
  const scaleY = drawH / (bb.height || 1);
  const scale = Math.min(scaleX, scaleY);

  const svgW = bb.width * scale + MARGIN.left + MARGIN.right;
  const svgH = bb.height * scale + MARGIN.top + MARGIN.bottom;

  const tx = (x) => MARGIN.left + (x - bb.minX) * scale;
  const ty = (y) => svgH - MARGIN.bottom - (y - bb.minY) * scale;

  const polyPoints = polygon.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ');

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>Framing Plan — {floorName}</div>
        <PrintButton sectionRef={sectionRef} label="Framing Plan" projectName={projectName} wallName={floorName} />
      </div>

      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ background: '#F5F5F0' }}>
        {/* Polygon outline */}
        <polygon points={polyPoints} fill="none" stroke={COLORS.OUTLINE} strokeWidth={2} />

        {/* Perimeter plates */}
        {perimeterPlates.map((plate, i) => {
          const dx = plate.x2 - plate.x1;
          const dy = plate.y2 - plate.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return null;
          // Draw plate as thick line along edge
          return (
            <line key={`pp${i}`}
              x1={tx(plate.x1)} y1={ty(plate.y1)} x2={tx(plate.x2)} y2={ty(plate.y2)}
              stroke={COLORS.PLATE} strokeWidth={Math.max(2, plate.width * scale)} strokeOpacity={0.6}
            />
          );
        })}

        {/* Reinforced splines (red) */}
        {reinforcedSplines.map((s, i) => (
          <g key={`rs${i}`}>
            <rect x={tx(s.x)} y={ty(s.y + s.length)} width={s.width * scale} height={s.length * scale}
              fill={COLORS.REINFORCED} fillOpacity={0.4} stroke={COLORS.REINFORCED} strokeWidth={1} />
            {s.hasSteelChannel && (
              <rect x={tx(s.x) + 2} y={ty(s.y + s.length) + 2}
                width={Math.max(0, s.width * scale - 4)} height={Math.max(0, s.length * scale - 4)}
                fill="none" stroke={COLORS.STEEL} strokeWidth={1.5} strokeDasharray="3,2" />
            )}
          </g>
        ))}

        {/* Unreinforced splines (blue) */}
        {unreinforcedSplines.map((s, i) => (
          <rect key={`us${i}`}
            x={tx(s.x)} y={ty(s.y + s.length)} width={s.width * scale} height={s.length * scale}
            fill={COLORS.UNREINFORCED} fillOpacity={0.3} stroke={COLORS.UNREINFORCED} strokeWidth={1} />
        ))}

        {/* Bearer lines (green dashed) */}
        {bearerLines.map((bl, i) =>
          bl.segments.map((seg, j) => (
            <line key={`bl${i}-${j}`}
              x1={tx(seg.x1)} y1={ty(seg.y1)} x2={tx(seg.x2)} y2={ty(seg.y2)}
              stroke={COLORS.BEARER} strokeWidth={2} strokeDasharray="8,4" />
          ))
        )}

        {/* Recess plates */}
        {recesses.map((rec, ri) =>
          (rec.recessPlates || []).map((plate, pi) => (
            <line key={`rp${ri}-${pi}`}
              x1={tx(plate.x1)} y1={ty(plate.y1)} x2={tx(plate.x2)} y2={ty(plate.y2)}
              stroke={COLORS.PLATE} strokeWidth={Math.max(2, plate.width * scale)} strokeOpacity={0.8} />
          ))
        )}

        {/* Legend */}
        <g transform={`translate(${svgW - 200}, 12)`}>
          <rect x={0} y={0} width={180} height={90} fill="#fff" fillOpacity={0.9} stroke="#ccc" rx={4} />
          <rect x={8} y={8} width={14} height={8} fill={COLORS.PLATE} fillOpacity={0.6} />
          <text x={28} y={16} fontSize={10} fill="#333">Perimeter Plates</text>
          <rect x={8} y={24} width={14} height={8} fill={COLORS.REINFORCED} fillOpacity={0.4} />
          <text x={28} y={32} fontSize={10} fill="#333">Reinforced Splines</text>
          <rect x={8} y={40} width={14} height={8} fill={COLORS.UNREINFORCED} fillOpacity={0.3} />
          <text x={28} y={48} fontSize={10} fill="#333">Unreinforced Splines</text>
          <line x1={8} y1={60} x2={22} y2={60} stroke={COLORS.BEARER} strokeWidth={2} strokeDasharray="4,2" />
          <text x={28} y={64} fontSize={10} fill="#333">Bearer Lines</text>
          <line x1={8} y1={76} x2={22} y2={76} stroke={COLORS.STEEL} strokeWidth={2} strokeDasharray="3,2" />
          <text x={28} y={80} fontSize={10} fill="#333">Steel Channel</text>
        </g>
      </svg>
    </div>
  );
}
