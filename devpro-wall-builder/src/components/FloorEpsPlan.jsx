import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import { FLOOR_EPS_DEPTH, FLOOR_SPLINE_DEPTH } from '../utils/constants.js';

const MARGIN = { top: 60, right: 40, bottom: 80, left: 60 };
const MAX_SVG_WIDTH = 1200;
const MAX_SVG_HEIGHT = 600;

const EPS_INSET = 10;

export default function FloorEpsPlan({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const { polygon, panels, reinforcedSplines, unreinforcedSplines,
    openings, recesses, shortEdgeJoins = [], boundingBox: bb } = layout;

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
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>EPS Plan — {floorName} ({FLOOR_EPS_DEPTH}mm panel / {FLOOR_SPLINE_DEPTH}mm spline)</div>
        <PrintButton sectionRef={sectionRef} label="EPS Plan" projectName={projectName} wallName={floorName} />
      </div>

      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ background: '#F5F5F0' }}>
        {/* Clip path for polygon boundary */}
        <defs>
          <clipPath id="floor-eps-clip">
            <polygon points={polyPoints} />
          </clipPath>
        </defs>

        {/* Polygon outline */}
        <polygon points={polyPoints} fill="none" stroke="#333" strokeWidth={2} />

        {/* Panel EPS blocks — inset EPS_INSET from all panel edges, clipped to polygon */}
        {panels.map((p, i) => {
          const inset = EPS_INSET * scale;
          const epsX = tx(p.x) + inset;
          const epsY = ty(p.y + p.length) + inset;
          const epsW = Math.max(0, p.width * scale - inset * 2);
          const epsH = Math.max(0, p.length * scale - inset * 2);
          if (epsW <= 0 || epsH <= 0) return null;
          const cx = tx(p.clippedPolygon ? p.clippedPolygon.reduce((s, pt) => s + pt.x, 0) / p.clippedPolygon.length : p.x + p.width / 2);
          const cy = ty(p.clippedPolygon ? p.clippedPolygon.reduce((s, pt) => s + pt.y, 0) / p.clippedPolygon.length : p.y + p.length / 2);
          return (
            <g key={i}>
              <rect
                x={epsX} y={epsY} width={epsW} height={epsH}
                fill="#B3D9FF" fillOpacity={0.4} stroke="#4A90D9" strokeWidth={0.5}
                clipPath="url(#floor-eps-clip)"
              />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#2C5F8A">
                P{p.index + 1}
              </text>
            </g>
          );
        })}

        {/* Reinforced spline EPS — inset EPS_INSET from magboard faces */}
        {reinforcedSplines.map((s, i) => {
          const inset = EPS_INSET * scale;
          return (
            <rect key={`rse${i}`}
              x={tx(s.x) + inset} y={ty(s.y + s.length) + inset}
              width={Math.max(0, s.width * scale - inset * 2)} height={Math.max(0, s.length * scale - inset * 2)}
              fill="#90EE90" fillOpacity={0.4} stroke="#27ae60" strokeWidth={1} />
          );
        })}

        {/* Unreinforced spline EPS — inset EPS_INSET from magboard faces */}
        {unreinforcedSplines.map((s, i) => {
          const inset = EPS_INSET * scale;
          return (
            <rect key={`use${i}`}
              x={tx(s.x) + inset} y={ty(s.y + s.length) + inset}
              width={Math.max(0, s.width * scale - inset * 2)} height={Math.max(0, s.length * scale - inset * 2)}
              fill="#90EE90" fillOpacity={0.2} stroke="#27ae60" strokeWidth={0.5}
              strokeDasharray="4,2" />
          );
        })}

        {/* Short-edge joins */}
        {shortEdgeJoins.map((join, i) =>
          join.segments.map((seg, j) => (
            <line key={`sej${i}-${j}`}
              x1={tx(seg.x1)} y1={ty(seg.y1)} x2={tx(seg.x2)} y2={ty(seg.y2)}
              stroke="#999" strokeWidth={1} strokeDasharray="6,3"
            />
          ))
        )}

        {/* Opening voids */}
        {openings.map((op, i) => {
          if (op.type === 'circular') {
            return <circle key={`ov${i}`} cx={tx(op.x)} cy={ty(op.y)} r={(op.diameter / 2) * scale} fill="#fff" stroke="#e74c3c" strokeWidth={1} />;
          }
          return (
            <rect key={`ov${i}`}
              x={tx(op.x)} y={ty(op.y + op.length)} width={op.width * scale} height={op.length * scale}
              fill="#fff" stroke="#e74c3c" strokeWidth={1} />
          );
        })}

        {/* Recess voids */}
        {recesses.map((rec, i) => (
          <rect key={`rv${i}`}
            x={tx(rec.x)} y={ty(rec.y + rec.length)} width={rec.width * scale} height={rec.length * scale}
            fill="#FFE0B2" fillOpacity={0.5} stroke="#E65100" strokeWidth={1} strokeDasharray="4,2" />
        ))}
      </svg>
    </div>
  );
}
