import { useRef, useState } from 'react';
import PrintButton from './PrintButton.jsx';
import ZoomControls, { ZOOM_STEPS, DEFAULT_IDX } from './ZoomControls.jsx';

const MARGIN = { top: 80, right: 110, bottom: 170, left: 90 };
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
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_IDX);
  const zoom = ZOOM_STEPS[zoomIdx];
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const { polygon, perimeterPlates, reinforcedSplines, unreinforcedSplines,
    bearerLines, shortEdgeJoins = [], recesses, boundingBox: bb,
    panelDirection = 0, boundaryJoistCount = 1, perimeterPlateWidth = 45 } = layout;

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

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>Framing Plan — {floorName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ZoomControls zoomIdx={zoomIdx} setZoomIdx={setZoomIdx} zoom={zoom} />
          <PrintButton sectionRef={sectionRef} label="Framing Plan" projectName={projectName} wallName={floorName} />
        </div>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 700 }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ background: '#F5F5F0' }}>
        {/* Polygon outline */}
        <polygon points={polyPoints} fill="none" stroke={COLORS.OUTLINE} strokeWidth={2} />

        {/* Boundary joists — 1 or 2 per edge, drawn as rectangles */}
        {perimeterPlates.map((plate, i) => {
          const dx = plate.x2 - plate.x1;
          const dy = plate.y2 - plate.y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) return null;
          // Unit normal pointing inward (CCW polygon → left-hand normal is inward)
          const nx = -dy / len;
          const ny = dx / len;
          const joistW = perimeterPlateWidth;
          const joists = [];
          for (let j = 0; j < boundaryJoistCount; j++) {
            // Outer joist (j=0) aligns with panel edge, inner joist (j=1) offset by one joist width + gap
            const offsetStart = j * joistW;
            const offsetEnd = offsetStart + joistW;
            // Build rectangle corners along edge with normal offset
            const x1 = plate.x1 + nx * offsetStart;
            const y1 = plate.y1 + ny * offsetStart;
            const x2 = plate.x2 + nx * offsetStart;
            const y2 = plate.y2 + ny * offsetStart;
            const x3 = plate.x2 + nx * offsetEnd;
            const y3 = plate.y2 + ny * offsetEnd;
            const x4 = plate.x1 + nx * offsetEnd;
            const y4 = plate.y1 + ny * offsetEnd;
            const pts = `${tx(x1)},${ty(y1)} ${tx(x2)},${ty(y2)} ${tx(x3)},${ty(y3)} ${tx(x4)},${ty(y4)}`;
            joists.push(
              <polygon key={`bj${i}-${j}`} points={pts}
                fill={COLORS.PLATE} fillOpacity={0.4} stroke={COLORS.PLATE} strokeWidth={0.75} />
            );
          }
          return <g key={`pp${i}`}>{joists}</g>;
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

        {/* Short-edge joins */}
        {shortEdgeJoins.map((join, i) =>
          join.segments.map((seg, j) => (
            <line key={`sej${i}-${j}`}
              x1={tx(seg.x1)} y1={ty(seg.y1)} x2={tx(seg.x2)} y2={ty(seg.y2)}
              stroke="#999" strokeWidth={1} strokeDasharray="6,3"
            />
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

        {/* Left Y-axis: Horizontal spline centre setout dimensions */}
        {(() => {
          // Horizontal splines run along X (width > length) — includes both reinforced and unreinforced
          const allSplines = [...reinforcedSplines, ...unreinforcedSplines];
          const horizontalSplines = allSplines.filter(s => s.width > s.length);
          if (horizontalSplines.length === 0) return null;
          const tickW = 5;
          const DIM_COLOR = '#666';
          const splineCenterYs = [...new Set(horizontalSplines.map(s => Math.round(s.y + s.length / 2)))].sort((a, b) => a - b);
          if (splineCenterYs.length === 0) return null;
          const positions = [bb.minY, ...splineCenterYs, bb.maxY];
          const dimX = MARGIN.left - 20;
          return (
            <g>
              <text x={dimX} y={ty(bb.maxY) - 6} textAnchor="middle" fontSize={8} fill={DIM_COLOR}>Splines</text>
              <line x1={dimX} y1={ty(bb.minY)} x2={dimX} y2={ty(bb.maxY)} stroke={DIM_COLOR} strokeWidth={0.5} />
              {positions.map((pos, i) => {
                const y = ty(pos);
                return (
                  <g key={`sly${i}`}>
                    <line x1={dimX - tickW} y1={y} x2={dimX + tickW} y2={y} stroke={DIM_COLOR} strokeWidth={0.5} />
                    {i < positions.length - 1 && (() => {
                      const y2 = ty(positions[i + 1]);
                      const segH = Math.round(positions[i + 1] - pos);
                      if (Math.abs(y - y2) < 28) return null;
                      const midY = (y + y2) / 2;
                      return <text x={dimX} y={midY} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={DIM_COLOR}
                        transform={`rotate(-90,${dimX},${midY})`}>{segH}</text>;
                    })()}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Right Y-axis: Horizontal bearer setout dimensions */}
        {(() => {
          if (!bearerLines || bearerLines.length === 0) return null;
          const tickW = 5;
          const DIM_COLOR = '#666';
          // Only horizontal bearers (position = Y coordinate)
          const horizontalBearers = bearerLines.filter(bl =>
            (bl.orientation || 'vertical') === 'horizontal');
          if (horizontalBearers.length === 0) return null;
          const bearerYs = [...new Set(horizontalBearers.map(bl => Math.round(bl.position)))].sort((a, b) => a - b);
          if (bearerYs.length === 0) return null;
          const positions = [bb.minY, ...bearerYs, bb.maxY];
          const dimX = svgW - MARGIN.right + 20;
          return (
            <g>
              <text x={dimX} y={ty(bb.maxY) - 6} textAnchor="middle" fontSize={8} fill={DIM_COLOR}>Bearers</text>
              <line x1={dimX} y1={ty(bb.minY)} x2={dimX} y2={ty(bb.maxY)} stroke={DIM_COLOR} strokeWidth={0.5} />
              {positions.map((pos, i) => {
                const y = ty(pos);
                return (
                  <g key={`bry${i}`}>
                    <line x1={dimX - tickW} y1={y} x2={dimX + tickW} y2={y} stroke={DIM_COLOR} strokeWidth={0.5} />
                    {i < positions.length - 1 && (() => {
                      const y2 = ty(positions[i + 1]);
                      const segH = Math.round(positions[i + 1] - pos);
                      if (Math.abs(y - y2) < 28) return null;
                      const midY = (y + y2) / 2;
                      return <text x={dimX} y={midY} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={DIM_COLOR}
                        transform={`rotate(-90,${dimX},${midY})`}>{segH}</text>;
                    })()}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Right Y-axis: Reinforced spline edge dimensions */}
        {(() => {
          const verticalSplines = reinforcedSplines.filter(s => s.width < s.length);
          if (verticalSplines.length === 0) return null;
          const tickW = 5;
          const DIM_COLOR = COLORS.REINFORCED;
          // Collect unique top/bottom edges of reinforced splines
          const edgeYs = new Set();
          verticalSplines.forEach(s => {
            edgeYs.add(Math.round(s.y));
            edgeYs.add(Math.round(s.y + s.length));
          });
          const positions = [bb.minY, ...edgeYs, bb.maxY].sort((a, b) => a - b)
            .filter((v, i, arr) => i === 0 || v !== arr[i - 1]);
          const dimX = svgW - MARGIN.right + 50;
          return (
            <g>
              <text x={dimX} y={ty(bb.maxY) - 6} textAnchor="middle" fontSize={8} fill={DIM_COLOR}>Reinf.</text>
              <line x1={dimX} y1={ty(bb.minY)} x2={dimX} y2={ty(bb.maxY)} stroke={DIM_COLOR} strokeWidth={0.5} />
              {positions.map((pos, i) => {
                const y = ty(pos);
                return (
                  <g key={`rsy${i}`}>
                    <line x1={dimX - tickW} y1={y} x2={dimX + tickW} y2={y} stroke={DIM_COLOR} strokeWidth={0.5} />
                    {i < positions.length - 1 && (() => {
                      const y2 = ty(positions[i + 1]);
                      const segH = Math.round(positions[i + 1] - pos);
                      if (Math.abs(y - y2) < 28) return null;
                      const midY = (y + y2) / 2;
                      return <text x={dimX} y={midY} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={DIM_COLOR}
                        transform={`rotate(-90,${dimX},${midY})`}>{segH}</text>;
                    })()}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Bottom X-axis: Vertical bearer setout dimensions */}
        {(() => {
          if (!bearerLines || bearerLines.length === 0) return null;
          const tickH = 5;
          const DIM_COLOR = '#666';
          // Only vertical bearers (position = X coordinate)
          const verticalBearers = bearerLines.filter(bl =>
            (bl.orientation || 'vertical') === 'vertical');
          if (verticalBearers.length === 0) return null;
          const bearerXs = [...new Set(verticalBearers.map(bl => Math.round(bl.position)))].sort((a, b) => a - b);
          if (bearerXs.length === 0) return null;
          const positions = [bb.minX, ...bearerXs, bb.maxX];
          const dimY = svgH - MARGIN.bottom + 20;
          return (
            <g>
              <text x={tx(bb.minX) - 4} y={dimY + 4} textAnchor="end" fontSize={8} fill={DIM_COLOR}>Bearers</text>
              <line x1={tx(bb.minX)} y1={dimY} x2={tx(bb.maxX)} y2={dimY} stroke={DIM_COLOR} strokeWidth={0.5} />
              {positions.map((pos, i) => {
                const x = tx(pos);
                return (
                  <g key={`btx${i}`}>
                    <line x1={x} y1={dimY - tickH} x2={x} y2={dimY + tickH} stroke={DIM_COLOR} strokeWidth={0.5} />
                    {i < positions.length - 1 && (() => {
                      const x2 = tx(positions[i + 1]);
                      const segW = Math.round(positions[i + 1] - pos);
                      if (x2 - x < 28) return null;
                      return <text x={(x + x2) / 2} y={dimY + 14} textAnchor="middle" fontSize={9} fill={DIM_COLOR}>{segW}</text>;
                    })()}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Bottom X-axis: Reinforced spline centre setout dimensions */}
        {(() => {
          const allSplines = [...reinforcedSplines, ...unreinforcedSplines];
          const verticalSplines = allSplines.filter(s => s.width < s.length);
          if (verticalSplines.length === 0) return null;
          const tickH = 5;
          const DIM_COLOR = '#666';
          const splineCenterXs = [...new Set(verticalSplines.map(s => Math.round(s.x + s.width / 2)))].sort((a, b) => a - b);
          if (splineCenterXs.length === 0) return null;
          const positions = [bb.minX, ...splineCenterXs, bb.maxX];
          const dimY = svgH - MARGIN.bottom + 42;
          return (
            <g>
              <text x={tx(bb.minX) - 4} y={dimY + 4} textAnchor="end" fontSize={8} fill={DIM_COLOR}>Splines</text>
              <line x1={tx(bb.minX)} y1={dimY} x2={tx(bb.maxX)} y2={dimY} stroke={DIM_COLOR} strokeWidth={0.5} />
              {positions.map((pos, i) => {
                const x = tx(pos);
                return (
                  <g key={`stx${i}`}>
                    <line x1={x} y1={dimY - tickH} x2={x} y2={dimY + tickH} stroke={DIM_COLOR} strokeWidth={0.5} />
                    {i < positions.length - 1 && (() => {
                      const x2 = tx(positions[i + 1]);
                      const segW = Math.round(positions[i + 1] - pos);
                      if (x2 - x < 28) return null;
                      return <text x={(x + x2) / 2} y={dimY + 14} textAnchor="middle" fontSize={9} fill={DIM_COLOR}>{segW}</text>;
                    })()}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Bottom X-axis: Unreinforced spline edge dimensions */}
        {(() => {
          const horizontalSplines = unreinforcedSplines.filter(s => s.width > s.length);
          if (horizontalSplines.length === 0) return null;
          const tickH = 5;
          const DIM_COLOR = COLORS.UNREINFORCED;
          // Collect unique left/right edges of unreinforced splines
          const edgeXs = new Set();
          horizontalSplines.forEach(s => {
            edgeXs.add(Math.round(s.x));
            edgeXs.add(Math.round(s.x + s.width));
          });
          const positions = [bb.minX, ...edgeXs, bb.maxX].sort((a, b) => a - b)
            .filter((v, i, arr) => i === 0 || v !== arr[i - 1]);
          const dimY = svgH - MARGIN.bottom + 64;
          return (
            <g>
              <text x={tx(bb.minX) - 4} y={dimY + 4} textAnchor="end" fontSize={8} fill={DIM_COLOR}>Unreinf.</text>
              <line x1={tx(bb.minX)} y1={dimY} x2={tx(bb.maxX)} y2={dimY} stroke={DIM_COLOR} strokeWidth={0.5} />
              {positions.map((pos, i) => {
                const x = tx(pos);
                return (
                  <g key={`usx${i}`}>
                    <line x1={x} y1={dimY - tickH} x2={x} y2={dimY + tickH} stroke={DIM_COLOR} strokeWidth={0.5} />
                    {i < positions.length - 1 && (() => {
                      const x2 = tx(positions[i + 1]);
                      const segW = Math.round(positions[i + 1] - pos);
                      if (x2 - x < 28) return null;
                      return <text x={(x + x2) / 2} y={dimY + 14} textAnchor="middle" fontSize={9} fill={DIM_COLOR}>{segW}</text>;
                    })()}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Far-left Y-axis: Running measure from bottom */}
        {(() => {
          const DIM_COLOR = '#666';
          const tickW = 5;
          const dimX = MARGIN.left - 50;
          const origin = bb.minY;
          // Collect all notable Y positions: spline centres + bearer positions
          const allSplines = [...reinforcedSplines, ...unreinforcedSplines];
          const horizontalSplineCYs = allSplines.filter(s => s.width > s.length).map(s => Math.round(s.y + s.length / 2));
          const horizontalBearerYs = bearerLines
            .filter(bl => (bl.orientation || 'vertical') === 'horizontal')
            .map(bl => Math.round(bl.position));
          const allYs = [...new Set([origin, ...horizontalSplineCYs, ...horizontalBearerYs, Math.round(bb.maxY)])].sort((a, b) => a - b);
          return (
            <g>
              <line x1={dimX} y1={ty(allYs[0])} x2={dimX} y2={ty(allYs[allYs.length - 1])} stroke={DIM_COLOR} strokeWidth={0.5} />
              {allYs.map((pos, i) => {
                const y = ty(pos);
                const cumulative = Math.round(pos - origin);
                const prevY = i > 0 ? ty(allYs[i - 1]) : y;
                const showLabel = cumulative > 0 && Math.abs(y - prevY) > 20;
                return (
                  <g key={`rmy${i}`}>
                    <line x1={dimX - tickW} y1={y} x2={dimX + tickW} y2={y} stroke={DIM_COLOR} strokeWidth={0.5} />
                    {showLabel && (
                      <text x={dimX} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={DIM_COLOR}
                        transform={`rotate(-90,${dimX},${y})`}>{cumulative}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Bottom X-axis: Running measure (cumulative from left) */}
        {(() => {
          const DIM_COLOR = '#444';
          const tickH = 5;
          const origin = bb.minX;
          // Collect all notable X positions
          const allSplines = [...reinforcedSplines, ...unreinforcedSplines];
          const vertSplineCXs = allSplines.filter(s => s.width < s.length).map(s => Math.round(s.x + s.width / 2));
          const vertBearerXs = bearerLines
            .filter(bl => (bl.orientation || 'vertical') === 'vertical')
            .map(bl => Math.round(bl.position));
          const polyXs = polygon.map(p => Math.round(p.x));
          const allXs = [...new Set([Math.round(origin), ...vertSplineCXs, ...vertBearerXs, ...polyXs, Math.round(bb.maxX)])].sort((a, b) => a - b);
          const dimY = svgH - MARGIN.bottom + 86;
          return (
            <g>
              <text x={tx(origin) - 4} y={dimY + 4} textAnchor="end" fontSize={8} fill={DIM_COLOR}>Running</text>
              <line x1={tx(allXs[0])} y1={dimY} x2={tx(allXs[allXs.length - 1])} y2={dimY} stroke={DIM_COLOR} strokeWidth={0.75} />
              {allXs.map((pos, i) => {
                const x = tx(pos);
                const cumulative = Math.round(pos - origin);
                const prevX = i > 0 ? tx(allXs[i - 1]) : x;
                const showLabel = i === 0 || (x - prevX) > 24;
                return (
                  <g key={`rmxb${i}`}>
                    <line x1={x} y1={dimY - tickH} x2={x} y2={dimY + tickH} stroke={DIM_COLOR} strokeWidth={0.75} />
                    {showLabel && (
                      <text x={x} y={dimY + 16} textAnchor="middle" fontSize={9} fontWeight={i === 0 || i === allXs.length - 1 ? 'bold' : 'normal'} fill={DIM_COLOR}>{cumulative}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* Legend — horizontal row below dimension chains */}
        <g transform={`translate(${MARGIN.left}, ${svgH - 18})`}>
          {[
            { type: 'rect', fill: COLORS.PLATE, opacity: 0.4, label: `Boundary Joists (×${boundaryJoistCount})` },
            { type: 'rect', fill: COLORS.REINFORCED, opacity: 0.4, label: 'Reinforced Splines' },
            { type: 'rect', fill: COLORS.UNREINFORCED, opacity: 0.3, label: 'Unreinforced Splines' },
            { type: 'line', stroke: COLORS.BEARER, dash: '4,2', label: 'Bearer Lines' },
            { type: 'line', stroke: COLORS.STEEL, dash: '3,2', label: 'Steel Channel' },
            { type: 'line', stroke: '#999', dash: '6,3', label: 'Sheet Joins' },
          ].reduce((acc, item, i) => {
            const x = acc.offset;
            const labelW = item.label.length * 6.5 + 24;
            acc.elements.push(
              <g key={i} transform={`translate(${x}, 0)`}>
                {item.type === 'rect'
                  ? <rect x={0} y={-4} width={14} height={8} fill={item.fill} fillOpacity={item.opacity} />
                  : <line x1={0} y1={0} x2={14} y2={0} stroke={item.stroke} strokeWidth={2} strokeDasharray={item.dash} />
                }
                <text x={18} y={4} fontSize={9} fill="#333">{item.label}</text>
              </g>
            );
            acc.offset = x + labelW;
            return acc;
          }, { elements: [], offset: 0 }).elements}
        </g>
      </svg>
      </div>
    </div>
  );
}
