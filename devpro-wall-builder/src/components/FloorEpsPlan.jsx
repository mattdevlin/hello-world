import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import { FLOOR_EPS_DEPTH, FLOOR_SPLINE_DEPTH, SPLINE_WIDTH } from '../utils/constants.js';

const MARGIN = { top: 60, right: 40, bottom: 80, left: 60 };
const MAX_SVG_WIDTH = 1200;
const MAX_SVG_HEIGHT = 600;

const EPS_INSET = 10;

export default function FloorEpsPlan({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const { polygon, panels, reinforcedSplines, unreinforcedSplines,
    openings, recesses, shortEdgeJoins = [], boundingBox: bb,
    boundaryJoistCount = 1, joistRecess = 0 } = layout;

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

  // Inset polygon for EPS clipping — recessed by boundary joists + gap
  const perimeterRecess = joistRecess > 0 ? joistRecess : EPS_INSET;
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
        <PrintButton sectionRef={sectionRef} label="EPS Floor Plan" projectName={projectName} wallName={floorName} />
      </div>

      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ background: '#F5F5F0' }}>
        {/* Clip path — inset polygon accounting for boundary joists + gap */}
        <defs>
          <clipPath id="floor-eps-clip">
            <polygon points={insetPolyPoints} />
          </clipPath>
        </defs>

        {/* Polygon outline */}
        <polygon points={polyPoints} fill="none" stroke="#333" strokeWidth={2} />

        {/* Boundary joist zone — shaded area between polygon and inset polygon */}
        <defs>
          <clipPath id="floor-joist-zone-clip">
            <polygon points={polyPoints} />
          </clipPath>
        </defs>
        <polygon points={insetPolyPoints} fill="none" stroke="#8B4513" strokeWidth={0.75} strokeDasharray="4,2" clipPath="url(#floor-joist-zone-clip)" />

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
              <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight="bold" fill="#2C5F8A">
                P{p.index + 1}
              </text>
              <text x={cx} y={cy + 6} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#4A6A8A">
                {Math.round(p.width)}×{Math.round(p.length)}
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

        {/* Spline width dimension — annotate first reinforced spline */}
        {(() => {
          if (reinforcedSplines.length === 0) return null;
          const s = reinforcedSplines[0];
          const isVertical = s.width < s.length;
          const scaledW = (isVertical ? s.width : s.length) * scale;
          if (scaledW <= 20) return null;
          const tickLen = 5;
          const dimLabel = Math.round(SPLINE_WIDTH);
          if (isVertical) {
            // Horizontal dimension across top of spline
            const dY = ty(s.y + s.length) - 8;
            const x1 = tx(s.x);
            const x2 = tx(s.x + s.width);
            return (
              <g>
                <line x1={x1} y1={dY} x2={x2} y2={dY} stroke="#666" strokeWidth={0.5} />
                <line x1={x1} y1={dY - tickLen} x2={x1} y2={dY + tickLen} stroke="#666" strokeWidth={0.5} />
                <line x1={x2} y1={dY - tickLen} x2={x2} y2={dY + tickLen} stroke="#666" strokeWidth={0.5} />
                <text x={(x1 + x2) / 2} y={dY - 3} textAnchor="middle" fontSize={9} fill="#666">{dimLabel}</text>
              </g>
            );
          } else {
            // Vertical dimension on left side of spline
            const dX = tx(s.x) - 8;
            const y1 = ty(s.y);
            const y2 = ty(s.y + s.length);
            return (
              <g>
                <line x1={dX} y1={y1} x2={dX} y2={y2} stroke="#666" strokeWidth={0.5} />
                <line x1={dX - tickLen} y1={y1} x2={dX + tickLen} y2={y1} stroke="#666" strokeWidth={0.5} />
                <line x1={dX - tickLen} y1={y2} x2={dX + tickLen} y2={y2} stroke="#666" strokeWidth={0.5} />
                {(() => {
                  const midY = (y1 + y2) / 2;
                  return <text x={dX} y={midY} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#666"
                    transform={`rotate(-90,${dX},${midY})`}>{dimLabel}</text>;
                })()}
              </g>
            );
          }
        })()}

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
