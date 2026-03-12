import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import { FLOOR_THICKNESS } from '../utils/constants.js';

const MARGIN = { top: 60, right: 40, bottom: 80, left: 60 };
const MAX_SVG_WIDTH = 1200;
const MAX_SVG_HEIGHT = 600;

const COLORS = {
  PANEL_FULL: '#4A90D9',
  PANEL_EDGE: '#E8A838',
  PANEL_STROKE: '#2C5F8A',
  OPENING_FILL: '#fff',
  OPENING_STROKE: '#e74c3c',
  RECESS_FILL: '#FFE0B2',
  RECESS_STROKE: '#E65100',
  OUTLINE: '#333',
  DIM: '#666',
  SPLINE: '#27ae60',
  BEARER: '#8e44ad',
};

export default function FloorPlanView({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const { polygon, panels, openings, recesses, reinforcedSplines, unreinforcedSplines,
    bearerLines, shortEdgeJoins = [], boundingBox: bb } = layout;

  const drawW = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const drawH = MAX_SVG_HEIGHT - MARGIN.top - MARGIN.bottom;
  const scaleX = drawW / (bb.width || 1);
  const scaleY = drawH / (bb.height || 1);
  const scale = Math.min(scaleX, scaleY);

  const svgW = bb.width * scale + MARGIN.left + MARGIN.right;
  const svgH = bb.height * scale + MARGIN.top + MARGIN.bottom;

  // Transform: X right, Y up → SVG Y flip
  const tx = (x) => MARGIN.left + (x - bb.minX) * scale;
  const ty = (y) => svgH - MARGIN.bottom - (y - bb.minY) * scale;

  const polyPoints = polygon.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ');

  const title = `${floorName || 'Floor'} — ${Math.round(bb.width)}×${Math.round(bb.height)}mm — ${panels.length} panels (${FLOOR_THICKNESS}mm)`;

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{title}</div>
        <PrintButton sectionRef={sectionRef} label="Floor Plan" projectName={projectName} wallName={floorName} />
      </div>

      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ background: '#F5F5F0' }}>
        {/* Polygon outline */}
        <polygon points={polyPoints} fill="none" stroke={COLORS.OUTLINE} strokeWidth={2} />

        {/* Panels */}
        {panels.map((p, i) => {
          const color = p.type === 'full' ? COLORS.PANEL_FULL : COLORS.PANEL_EDGE;
          if (p.clippedPolygon && p.clippedPolygon.length >= 3) {
            const pts = p.clippedPolygon.map(pt => `${tx(pt.x)},${ty(pt.y)}`).join(' ');
            return (
              <g key={i}>
                <polygon points={pts} fill={color} fillOpacity={0.3} stroke={COLORS.PANEL_STROKE} strokeWidth={0.5} />
                <text x={tx(p.clippedPolygon.reduce((s, pt) => s + pt.x, 0) / p.clippedPolygon.length)} y={ty(p.clippedPolygon.reduce((s, pt) => s + pt.y, 0) / p.clippedPolygon.length)} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#333">
                  P{p.index + 1}
                </text>
              </g>
            );
          }
          return (
            <g key={i}>
              <rect x={tx(p.x)} y={ty(p.y + p.length)} width={p.width * scale} height={p.length * scale}
                fill={color} fillOpacity={0.3} stroke={COLORS.PANEL_STROKE} strokeWidth={0.5} />
              <text x={tx(p.x + p.width / 2)} y={ty(p.y + p.length / 2)} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#333">
                P{p.index + 1}
              </text>
            </g>
          );
        })}

        {/* Splines */}
        {[...reinforcedSplines, ...unreinforcedSplines].map((s, i) => (
          <rect key={`s${i}`}
            x={tx(s.x)} y={ty(s.y + (s.length || s.width))}
            width={s.width * scale} height={(s.length || s.width) * scale}
            fill={COLORS.SPLINE} fillOpacity={0.3} stroke={COLORS.SPLINE} strokeWidth={1}
          />
        ))}

        {/* Short-edge joins */}
        {shortEdgeJoins.map((join, i) =>
          join.segments.map((seg, j) => (
            <line key={`sej${i}-${j}`}
              x1={tx(seg.x1)} y1={ty(seg.y1)} x2={tx(seg.x2)} y2={ty(seg.y2)}
              stroke="#999" strokeWidth={1} strokeDasharray="6,3"
            />
          ))
        )}

        {/* Bearer lines */}
        {bearerLines.map((bl, i) =>
          bl.segments.map((seg, j) => (
            <line key={`b${i}-${j}`}
              x1={tx(seg.x1)} y1={ty(seg.y1)} x2={tx(seg.x2)} y2={ty(seg.y2)}
              stroke={COLORS.BEARER} strokeWidth={1.5} strokeDasharray="8,4"
            />
          ))
        )}

        {/* Openings */}
        {openings.map((op, i) => {
          if (op.type === 'circular') {
            const r = (op.diameter / 2) * scale;
            return (
              <g key={`o${i}`}>
                <circle cx={tx(op.x)} cy={ty(op.y)} r={r} fill={COLORS.OPENING_FILL} stroke={COLORS.OPENING_STROKE} strokeWidth={1.5} />
                <text x={tx(op.x)} y={ty(op.y)} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={COLORS.OPENING_STROKE}>
                  {op.ref}
                </text>
              </g>
            );
          }
          return (
            <g key={`o${i}`}>
              <rect x={tx(op.x)} y={ty(op.y + op.length)} width={op.width * scale} height={op.length * scale}
                fill={COLORS.OPENING_FILL} stroke={COLORS.OPENING_STROKE} strokeWidth={1.5} />
              <line x1={tx(op.x)} y1={ty(op.y)} x2={tx(op.x + op.width)} y2={ty(op.y + op.length)} stroke={COLORS.OPENING_STROKE} strokeWidth={0.5} />
              <line x1={tx(op.x + op.width)} y1={ty(op.y)} x2={tx(op.x)} y2={ty(op.y + op.length)} stroke={COLORS.OPENING_STROKE} strokeWidth={0.5} />
              <text x={tx(op.x + op.width / 2)} y={ty(op.y + op.length / 2)} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={COLORS.OPENING_STROKE}>
                {op.ref}
              </text>
            </g>
          );
        })}

        {/* Recesses */}
        {recesses.map((rec, i) => (
          <g key={`r${i}`}>
            <rect x={tx(rec.x)} y={ty(rec.y + rec.length)} width={rec.width * scale} height={rec.length * scale}
              fill={COLORS.RECESS_FILL} stroke={COLORS.RECESS_STROKE} strokeWidth={1.5} strokeDasharray="4,2" />
            <text x={tx(rec.x + rec.width / 2)} y={ty(rec.y + rec.length / 2)} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={COLORS.RECESS_STROKE}>
              {rec.ref}
            </text>
          </g>
        ))}

        {/* Dimension: overall width */}
        <line x1={tx(bb.minX)} y1={svgH - 20} x2={tx(bb.maxX)} y2={svgH - 20} stroke={COLORS.DIM} strokeWidth={0.5} />
        <text x={tx(bb.minX + bb.width / 2)} y={svgH - 8} textAnchor="middle" fontSize={11} fill={COLORS.DIM}>
          {Math.round(bb.width)} mm
        </text>

        {/* Dimension: overall height */}
        <line x1={12} y1={ty(bb.minY)} x2={12} y2={ty(bb.maxY)} stroke={COLORS.DIM} strokeWidth={0.5} />
        <text x={6} y={ty(bb.minY + bb.height / 2)} textAnchor="middle" fontSize={11} fill={COLORS.DIM} transform={`rotate(-90,6,${ty(bb.minY + bb.height / 2)})`}>
          {Math.round(bb.height)} mm
        </text>
      </svg>
    </div>
  );
}
