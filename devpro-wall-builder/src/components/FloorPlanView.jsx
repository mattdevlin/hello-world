import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import { FLOOR_THICKNESS, MAX_SHEET_HEIGHT } from '../utils/constants.js';

const MARGIN = { top: 60, right: 40, bottom: 80, left: 70 };
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
  BOUNDARY_JOIST: '#8B4513',
};

export default function FloorPlanView({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const { polygon, panels, openings, recesses,
    perimeterPlates = [], shortEdgeJoins = [], boundingBox: bb,
    columnPositions: rawColPos = [], spanBreaks: rawSpanBreaks = [], panelDirection } = layout;

  // Fallback: recompute spanBreaks from bb if empty
  const spanBreaks = rawSpanBreaks.length > 1 ? rawSpanBreaks : (() => {
    const spanAxis = panelDirection === 0 ? bb.height : bb.width;
    const spanMin = panelDirection === 0 ? bb.minY : bb.minX;
    const breaks = [spanMin];
    let pos = spanMin;
    while (pos + MAX_SHEET_HEIGHT < spanMin + spanAxis) {
      pos += MAX_SHEET_HEIGHT;
      breaks.push(pos);
    }
    breaks.push(spanMin + spanAxis);
    return breaks;
  })();

  // Fallback: derive columnPositions from panel data if empty
  const columnPositions = rawColPos.length > 0 ? rawColPos : (() => {
    if (panelDirection === 0) {
      const xs = [...new Set(panels.map(p => p.x))].sort((a, b) => a - b);
      return xs.map(x => {
        const colPanels = panels.filter(p => p.x === x);
        const w = colPanels.length > 0 ? colPanels[0].width : 0;
        return { start: x, width: w };
      });
    } else {
      const ys = [...new Set(panels.map(p => p.y))].sort((a, b) => a - b);
      return ys.map(y => {
        const colPanels = panels.filter(p => p.y === y);
        const w = colPanels.length > 0 ? colPanels[0].length : 0;
        return { start: y, width: w };
      });
    }
  })();

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

        {/* Boundary joists */}
        {perimeterPlates.map((plate, i) => {
          const len = Math.sqrt((plate.x2 - plate.x1) ** 2 + (plate.y2 - plate.y1) ** 2);
          if (len < 1) return null;
          return <line key={`bj${i}`} x1={tx(plate.x1)} y1={ty(plate.y1)}
            x2={tx(plate.x2)} y2={ty(plate.y2)}
            stroke={COLORS.BOUNDARY_JOIST} strokeWidth={Math.max(2, plate.width * scale)}
            strokeOpacity={0.5} />;
        })}

        {/* Panels */}
        {panels.map((p, i) => {
          const color = p.type === 'full' ? COLORS.PANEL_FULL : COLORS.PANEL_EDGE;
          if (p.clippedPolygon && p.clippedPolygon.length >= 3) {
            const pts = p.clippedPolygon.map(pt => `${tx(pt.x)},${ty(pt.y)}`).join(' ');
            const cx = p.clippedPolygon.reduce((s, pt) => s + pt.x, 0) / p.clippedPolygon.length;
            const cy = p.clippedPolygon.reduce((s, pt) => s + pt.y, 0) / p.clippedPolygon.length;
            const svgW_p = p.width * scale;
            const svgH_p = p.length * scale;
            return (
              <g key={i}>
                <polygon points={pts} fill={color} fillOpacity={0.3} stroke={COLORS.PANEL_STROKE} strokeWidth={0.5} />
                <text x={tx(cx)} y={ty(cy)} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#333">
                  P{p.index + 1}
                </text>
                {svgW_p > 40 && svgH_p > 40 && (
                  <text x={tx(cx)} y={ty(cy) + 12} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill={COLORS.DIM}>
                    {Math.round(p.width)}×{Math.round(p.length)}
                  </text>
                )}
              </g>
            );
          }
          const svgW_p = p.width * scale;
          const svgH_p = p.length * scale;
          return (
            <g key={i}>
              <rect x={tx(p.x)} y={ty(p.y + p.length)} width={svgW_p} height={svgH_p}
                fill={color} fillOpacity={0.3} stroke={COLORS.PANEL_STROKE} strokeWidth={0.5} />
              <text x={tx(p.x + p.width / 2)} y={ty(p.y + p.length / 2)} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#333">
                P{p.index + 1}
              </text>
              {svgW_p > 40 && svgH_p > 40 && (
                <text x={tx(p.x + p.width / 2)} y={ty(p.y + p.length / 2) + 12} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill={COLORS.DIM}>
                  {Math.round(p.width)}×{Math.round(p.length)}
                </text>
              )}
            </g>
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

        {/* X-axis running measure from left end at panel edges (bottom) */}
        {(() => {
          const dimY = svgH - MARGIN.bottom + 16;
          const tickH = 5;
          const origin = bb.minX;
          // Panel edge positions relative to left end
          const edgePositions = panelDirection === 0
            ? [...new Set(columnPositions.flatMap(c => [c.start, c.start + c.width]))].sort((a, b) => a - b)
            : spanBreaks.length > 1
              ? [...spanBreaks]
              : [bb.minX, bb.maxX];
          // Ensure origin is included
          if (edgePositions[0] > origin) edgePositions.unshift(origin);
          return (
            <g>
              <line x1={tx(origin)} y1={dimY} x2={tx(edgePositions[edgePositions.length - 1])} y2={dimY} stroke={COLORS.DIM} strokeWidth={0.5} />
              {edgePositions.map((pos, i) => {
                const x = tx(pos);
                const cumulative = Math.round(pos - origin);
                // Show running distance label below each tick (skip 0 at origin)
                const prevX = i > 0 ? tx(edgePositions[i - 1]) : x;
                const showLabel = cumulative > 0 && (x - prevX) > 20;
                return (
                  <g key={`xd${i}`}>
                    <line x1={x} y1={dimY - tickH} x2={x} y2={dimY + tickH} stroke={COLORS.DIM} strokeWidth={0.5} />
                    {showLabel && (
                      <text x={x} y={dimY + 14} textAnchor="middle" fontSize={9} fill={COLORS.DIM}>{cumulative}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Y-axis running measure from bottom at panel edges (left) */}
        {(() => {
          const dimX = MARGIN.left - 16;
          const tickW = 5;
          const origin = bb.minY;
          // Panel edge positions relative to bottom
          const edgePositions = panelDirection === 90
            ? [...new Set(columnPositions.flatMap(c => [c.start, c.start + c.width]))].sort((a, b) => a - b)
            : spanBreaks.length > 1
              ? [...spanBreaks]
              : [bb.minY, bb.maxY];
          if (edgePositions[0] > origin) edgePositions.unshift(origin);
          return (
            <g>
              <line x1={dimX} y1={ty(origin)} x2={dimX} y2={ty(edgePositions[edgePositions.length - 1])} stroke={COLORS.DIM} strokeWidth={0.5} />
              {edgePositions.map((pos, i) => {
                const y = ty(pos);
                const cumulative = Math.round(pos - origin);
                const prevY = i > 0 ? ty(edgePositions[i - 1]) : y;
                const showLabel = cumulative > 0 && Math.abs(y - prevY) > 20;
                return (
                  <g key={`yd${i}`}>
                    <line x1={dimX - tickW} y1={y} x2={dimX + tickW} y2={y} stroke={COLORS.DIM} strokeWidth={0.5} />
                    {showLabel && (
                      <text x={dimX} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={COLORS.DIM}
                        transform={`rotate(-90,${dimX},${y})`}>{cumulative}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
