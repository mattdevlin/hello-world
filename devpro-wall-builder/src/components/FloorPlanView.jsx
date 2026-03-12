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
  SPLINE: '#27ae60',
  BEARER: '#8e44ad',
};

export default function FloorPlanView({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const { polygon, panels, openings, recesses, reinforcedSplines, unreinforcedSplines,
    bearerLines, shortEdgeJoins = [], boundingBox: bb,
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

        {/* Reinforced splines */}
        {reinforcedSplines.map((s, i) => (
          <rect key={`rs${i}`}
            x={tx(s.x)} y={ty(s.y + s.length)}
            width={s.width * scale} height={s.length * scale}
            fill={COLORS.SPLINE} fillOpacity={0.3} stroke={COLORS.SPLINE} strokeWidth={1}
          />
        ))}

        {/* Unreinforced splines (between reinforced, at sheet joins) */}
        {unreinforcedSplines.map((s, i) => (
          <rect key={`us${i}`}
            x={tx(s.x)} y={ty(s.y + s.length)}
            width={s.width * scale} height={s.length * scale}
            fill={COLORS.SPLINE} fillOpacity={0.2} stroke={COLORS.SPLINE} strokeWidth={0.5}
            strokeDasharray="4,2"
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

        {/* X-axis panel dimensions (bottom) */}
        {(() => {
          const dimY = svgH - MARGIN.bottom + 16;
          const tickH = 5;
          // Build X-axis segments from column positions (column axis)
          const xSegs = panelDirection === 0
            ? columnPositions.map(c => ({ start: c.start, end: c.start + c.width }))
            : spanBreaks.length > 1
              ? spanBreaks.slice(0, -1).map((b, i) => ({ start: b, end: spanBreaks[i + 1] }))
              : [{ start: bb.minX, end: bb.maxX }];
          // Add gaps between columns for dir=0
          const allXSegs = [];
          for (let i = 0; i < xSegs.length; i++) {
            allXSegs.push(xSegs[i]);
            if (panelDirection === 0 && i < xSegs.length - 1) {
              const gapStart = xSegs[i].end;
              const gapEnd = xSegs[i + 1].start;
              if (gapEnd - gapStart > 1) allXSegs.push({ start: gapStart, end: gapEnd, isGap: true });
            }
          }
          return (
            <g>
              {/* Dimension line */}
              <line x1={tx(bb.minX)} y1={dimY} x2={tx(bb.maxX)} y2={dimY} stroke={COLORS.DIM} strokeWidth={0.5} />
              {/* Ticks and labels for each segment */}
              {allXSegs.map((seg, i) => {
                const x1 = tx(seg.start);
                const x2 = tx(seg.end);
                const w = Math.round(seg.end - seg.start);
                return (
                  <g key={`xd${i}`}>
                    <line x1={x1} y1={dimY - tickH} x2={x1} y2={dimY + tickH} stroke={COLORS.DIM} strokeWidth={0.5} />
                    {i === allXSegs.length - 1 && (
                      <line x1={x2} y1={dimY - tickH} x2={x2} y2={dimY + tickH} stroke={COLORS.DIM} strokeWidth={0.5} />
                    )}
                    {!seg.isGap && (x2 - x1) > 28 && (
                      <text x={(x1 + x2) / 2} y={dimY + 14} textAnchor="middle" fontSize={9} fill={COLORS.DIM}>{w}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Y-axis panel dimensions (left) */}
        {(() => {
          const dimX = MARGIN.left - 16;
          const tickW = 5;
          // Build Y-axis segments from span breaks (span axis)
          const ySegs = panelDirection === 0
            ? (spanBreaks.length > 1
              ? spanBreaks.slice(0, -1).map((b, i) => ({ start: b, end: spanBreaks[i + 1] }))
              : [{ start: bb.minY, end: bb.maxY }])
            : columnPositions.map(c => ({ start: c.start, end: c.start + c.width }));
          // Add gaps between columns for dir=90
          const allYSegs = [];
          for (let i = 0; i < ySegs.length; i++) {
            allYSegs.push(ySegs[i]);
            if (panelDirection === 90 && i < ySegs.length - 1) {
              const gapStart = ySegs[i].end;
              const gapEnd = ySegs[i + 1].start;
              if (gapEnd - gapStart > 1) allYSegs.push({ start: gapStart, end: gapEnd, isGap: true });
            }
          }
          return (
            <g>
              {/* Dimension line */}
              <line x1={dimX} y1={ty(bb.minY)} x2={dimX} y2={ty(bb.maxY)} stroke={COLORS.DIM} strokeWidth={0.5} />
              {/* Ticks and labels for each segment */}
              {allYSegs.map((seg, i) => {
                const y1 = ty(seg.start);
                const y2 = ty(seg.end);
                const h = Math.round(seg.end - seg.start);
                const midY = (y1 + y2) / 2;
                return (
                  <g key={`yd${i}`}>
                    <line x1={dimX - tickW} y1={y1} x2={dimX + tickW} y2={y1} stroke={COLORS.DIM} strokeWidth={0.5} />
                    {i === allYSegs.length - 1 && (
                      <line x1={dimX - tickW} y1={y2} x2={dimX + tickW} y2={y2} stroke={COLORS.DIM} strokeWidth={0.5} />
                    )}
                    {!seg.isGap && Math.abs(y1 - y2) > 28 && (
                      <text x={dimX} y={midY} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={COLORS.DIM}
                        transform={`rotate(-90,${dimX},${midY})`}>{h}</text>
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
