import { useRef, useState } from 'react';
import PrintButton from './PrintButton.jsx';
import { FLOOR_EPS_DEPTH, FLOOR_SPLINE_DEPTH, EPS_GAP } from '../utils/constants.js';
import { computeFloorEpsDeductions } from '../utils/floorEpsDeductions.js';

const MARGIN = { top: 60, right: 40, bottom: 80, left: 60 };
const MAX_SVG_WIDTH = 1200;
const MAX_SVG_HEIGHT = 600;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];


export default function FloorEpsPlan({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  const [zoomIdx, setZoomIdx] = useState(2);
  const zoom = ZOOM_STEPS[zoomIdx];
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const { polygon, panels, reinforcedSplines = [], unreinforcedSplines = [],
    openings, recesses, boundingBox: bb,
    boundaryJoistCount = 1, joistRecess = 0 } = layout;

  const drawW = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const drawH = MAX_SVG_HEIGHT - MARGIN.top - MARGIN.bottom;
  const scaleX = drawW / (bb.width || 1);
  const scaleY = drawH / (bb.height || 1);
  const scale = Math.min(scaleX, scaleY) * zoom;

  const svgW = bb.width * scale + MARGIN.left + MARGIN.right;
  const svgH = bb.height * scale + MARGIN.top + MARGIN.bottom;

  const tx = (x) => MARGIN.left + (x - bb.minX) * scale;
  const ty = (y) => svgH - MARGIN.bottom - (y - bb.minY) * scale;

  const polyPoints = polygon.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ');

  // Inset polygon for EPS clipping — recessed by boundary joists + gap
  const perimeterRecess = joistRecess > 0 ? joistRecess : EPS_GAP;
  const insetPolygon = (() => {
    const n = polygon.length;
    if (n < 3) return polygon;
    // Compute inward-offset edges, then intersect consecutive pairs
    const offsetEdges = [];
    for (let i = 0; i < n; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % n];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.001) continue;
      // Inward normal for CCW polygon
      const nx = -dy / len;
      const ny = dx / len;
      offsetEdges.push({
        x1: p1.x + nx * perimeterRecess,
        y1: p1.y + ny * perimeterRecess,
        x2: p2.x + nx * perimeterRecess,
        y2: p2.y + ny * perimeterRecess,
      });
    }
    // Intersect consecutive offset edges to find inset polygon vertices
    const result = [];
    for (let i = 0; i < offsetEdges.length; i++) {
      const e1 = offsetEdges[i];
      const e2 = offsetEdges[(i + 1) % offsetEdges.length];
      const d1x = e1.x2 - e1.x1, d1y = e1.y2 - e1.y1;
      const d2x = e2.x2 - e2.x1, d2y = e2.y2 - e2.y1;
      const denom = d1x * d2y - d1y * d2x;
      if (Math.abs(denom) < 0.001) {
        result.push({ x: e1.x2, y: e1.y2 });
      } else {
        const t = ((e2.x1 - e1.x1) * d2y - (e2.y1 - e1.y1) * d2x) / denom;
        result.push({ x: e1.x1 + t * d1x, y: e1.y1 + t * d1y });
      }
    }
    return result;
  })();
  const insetPolyPoints = insetPolygon.map(p => `${tx(p.x)},${ty(p.y)}`).join(' ');

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
          EPS Floor Plan — {floorName} ({FLOOR_EPS_DEPTH}mm panel / {FLOOR_SPLINE_DEPTH}mm spline)
          {boundaryJoistCount > 1 && ` · ${boundaryJoistCount}× boundary joists`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setZoomIdx(i => Math.max(0, i - 1))} disabled={zoomIdx === 0}
              style={{ width: 28, height: 28, border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>-</button>
            <span style={{ fontSize: 12, minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoomIdx(i => Math.min(ZOOM_STEPS.length - 1, i + 1))} disabled={zoomIdx === ZOOM_STEPS.length - 1}
              style={{ width: 28, height: 28, border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>+</button>
          </div>
          <PrintButton sectionRef={sectionRef} label="EPS Floor Plan" projectName={projectName} wallName={floorName} />
        </div>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 700 }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ background: '#F5F5F0' }}>
        {/* Clip path — inset polygon accounting for boundary joists + gap */}
        <defs>
          <clipPath id="floor-eps-clip">
            <polygon points={insetPolyPoints} />
          </clipPath>
        </defs>

        {/* Polygon outline */}
        <polygon points={polyPoints} fill="none" stroke="#333" strokeWidth={2} />

        {/* Panel EPS blocks — per-edge deductions, clipped to polygon */}
        {panels.map((p, i) => {
          const ded = computeFloorEpsDeductions(p, layout);
          const epsX = tx(p.x) + ded.left * scale;
          const epsY = ty(p.y + p.length) + ded.top * scale;
          const epsW = Math.max(0, (p.width - ded.left - ded.right) * scale);
          const epsH = Math.max(0, (p.length - ded.bottom - ded.top) * scale);
          if (epsW <= 0 || epsH <= 0) return null;
          const epsWidthMm = Math.round(p.width - ded.left - ded.right);
          const epsHeightMm = Math.round(p.length - ded.bottom - ded.top);
          const cx = tx(p.clippedPolygon ? p.clippedPolygon.reduce((s, pt) => s + pt.x, 0) / p.clippedPolygon.length : p.x + p.width / 2);
          const cy = ty(p.clippedPolygon ? p.clippedPolygon.reduce((s, pt) => s + pt.y, 0) / p.clippedPolygon.length : p.y + p.length / 2);
          return (
            <g key={i}>
              <rect
                x={epsX} y={epsY} width={epsW} height={epsH}
                fill="#B3D9FF" fillOpacity={0.4} stroke="#4A90D9" strokeWidth={0.5}
                clipPath="url(#floor-eps-clip)"
              />
              <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight="bold" fill="#2C5F8A">
                P{p.index + 1}
              </text>
              <text x={cx} y={cy + 6} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#4A6A8A">
                {epsWidthMm}×{epsHeightMm}
              </text>
            </g>
          );
        })}

        {/* Reinforced spline EPS */}
        {reinforcedSplines.map((s, i) => {
          const inset = EPS_GAP * scale;
          return (
            <rect key={`rse${i}`}
              x={tx(s.x) + inset} y={ty(s.y + s.length) + inset}
              width={Math.max(0, s.width * scale - inset * 2)} height={Math.max(0, s.length * scale - inset * 2)}
              fill="#90EE90" fillOpacity={0.4} stroke="#27ae60" strokeWidth={0.5}
              clipPath="url(#floor-eps-clip)"
            />
          );
        })}

        {/* Unreinforced spline EPS */}
        {unreinforcedSplines.map((s, i) => {
          const inset = EPS_GAP * scale;
          return (
            <rect key={`use${i}`}
              x={tx(s.x) + inset} y={ty(s.y + s.length) + inset}
              width={Math.max(0, s.width * scale - inset * 2)} height={Math.max(0, s.length * scale - inset * 2)}
              fill="#90EE90" fillOpacity={0.2} stroke="#27ae60" strokeWidth={0.5}
              clipPath="url(#floor-eps-clip)"
            />
          );
        })}

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
            fill="#FFE0B2" fillOpacity={0.5} stroke="#E65100" strokeWidth={1} />
        ))}
      </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10, fontSize: 11, color: '#555' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width={16} height={12}><rect x={1} y={1} width={14} height={10} fill="#B3D9FF" fillOpacity={0.4} stroke="#4A90D9" strokeWidth={1} /></svg>
          <span>Panel EPS ({FLOOR_EPS_DEPTH}mm)</span>
        </div>
        {reinforcedSplines.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width={16} height={12}><rect x={1} y={1} width={14} height={10} fill="#90EE90" fillOpacity={0.4} stroke="#27ae60" strokeWidth={1} /></svg>
            <span>Reinforced spline EPS ({FLOOR_SPLINE_DEPTH}mm)</span>
          </div>
        )}
        {unreinforcedSplines.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width={16} height={12}><rect x={1} y={1} width={14} height={10} fill="#90EE90" fillOpacity={0.2} stroke="#27ae60" strokeWidth={1} /></svg>
            <span>Unreinforced spline EPS ({FLOOR_SPLINE_DEPTH}mm)</span>
          </div>
        )}
        {openings.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width={16} height={12}><rect x={1} y={1} width={14} height={10} fill="#fff" stroke="#e74c3c" strokeWidth={1} /></svg>
            <span>Opening</span>
          </div>
        )}
        {recesses.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width={16} height={12}><rect x={1} y={1} width={14} height={10} fill="#FFE0B2" fillOpacity={0.5} stroke="#E65100" strokeWidth={1} /></svg>
            <span>Recess</span>
          </div>
        )}
      </div>
    </div>
  );
}
