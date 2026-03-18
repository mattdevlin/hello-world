import { useRef, useState } from 'react';
import PrintButton from './PrintButton.jsx';
import ZoomControls, { ZOOM_STEPS, DEFAULT_IDX } from './ZoomControls.jsx';
import { NEUTRAL } from '../utils/designTokens.js';
import { PANEL_GAP, SPLINE_WIDTH, ROOF_EPS_DEPTH, EPS_GAP, HSPLINE_CLEARANCE } from '../utils/constants.js';

const FRAMING_COLORS = {
  PLATE: '#8B4513',
  SPLINE: '#e74c3c',
  SPLINE_STROKE: '#c0392b',
  penetration: '#FFE082',
  penetrationStroke: '#F9A825',
  outline: '#333',
  DIM: '#666',
};

const EPS_COLORS = {
  panelEps: '#B3D9FF',
  panelEpsStroke: '#4A90D9',
  splineEps: '#90EE90',
  splineEpsStroke: '#27ae60',
  penetration: '#FFE082',
  penetrationStroke: '#F9A825',
  outline: '#333',
  DIM: '#666',
};

/**
 * Roof slope view — used for both Framing and EPS plans.
 * @param {string} mode - 'framing' or 'eps'
 */
export default function RoofSlopeView({ layout, roofName, projectName, mode = 'framing' }) {
  if (!layout) return null;

  const { planeLayouts, panelDirection, penetrations, epsDepth, boundaryJoistCount = 1, perimeterPlateWidth = 45, longSplineEps, shortSplineEps, splines: allSplines = [] } = layout;
  const hasShortSplines = allSplines.some(s => s.splineType === 'short');
  const isEps = mode === 'eps';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {planeLayouts.map((pl) => (
        <SlopePlane
          key={pl.plane.index}
          planeLayout={pl}
          panelDirection={panelDirection}
          penetrations={penetrations.filter(p => p.plane === pl.plane.index)}
          roofName={roofName}
          projectName={projectName}
          mode={mode}
          epsDepth={epsDepth}
          longSplineEps={longSplineEps}
          boundaryJoistCount={boundaryJoistCount}
          perimeterPlateWidth={perimeterPlateWidth}
        />
      ))}

      {/* Legend — EPS only (framing legend is SVG inline per plane) */}
      {isEps && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 11, color: '#555' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width={16} height={12}><rect x={1} y={1} width={14} height={10} fill={EPS_COLORS.panelEps} fillOpacity={0.4} stroke={EPS_COLORS.panelEpsStroke} strokeWidth={1} /></svg>
            <span>Panel EPS ({epsDepth || ROOF_EPS_DEPTH}mm)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width={16} height={12}><rect x={1} y={1} width={14} height={10} fill={EPS_COLORS.splineEps} fillOpacity={0.4} stroke={EPS_COLORS.splineEpsStroke} strokeWidth={1} /></svg>
            <span>Long Spline EPS ({longSplineEps || 208}mm)</span>
          </div>
          {hasShortSplines && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width={16} height={12}><rect x={1} y={1} width={14} height={10} fill={EPS_COLORS.splineEps} fillOpacity={0.4} stroke={EPS_COLORS.splineEpsStroke} strokeWidth={1} /></svg>
              <span>Short Spline EPS ({shortSplineEps || 220}mm)</span>
            </div>
          )}
          {penetrations.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width={16} height={12}><rect x={1} y={1} width={14} height={10} fill={EPS_COLORS.penetration} stroke={EPS_COLORS.penetrationStroke} strokeWidth={1} /></svg>
              <span>Penetration</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SlopePlane({ planeLayout, panelDirection, penetrations, roofName, projectName, mode, epsDepth, longSplineEps, boundaryJoistCount, perimeterPlateWidth }) {
  const sectionRef = useRef(null);
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_IDX);
  const zoom = ZOOM_STEPS[zoomIdx];

  const { plane, panels, splines, columnPositions = [] } = planeLayout;
  const { uLength, vLength, label: planeLabel } = plane;
  const isEps = mode === 'eps';
  const COLORS = isEps ? EPS_COLORS : FRAMING_COLORS;

  const margin = isEps ? 60 : 80;
  const maxSvgWidth = 1100;
  const bottomMargin = isEps ? 40 : 120;
  const scale = Math.min((maxSvgWidth - 2 * margin) / uLength, (600 - margin - bottomMargin) / vLength, 0.15) * zoom;
  const svgW = uLength * scale + 2 * margin;
  const svgH = vLength * scale + margin + bottomMargin;

  const sx = (x) => margin + x * scale;
  const sy = (y) => margin + y * scale;
  const sw = (w) => w * scale;

  const titlePrefix = isEps
    ? `EPS Roof Plan — ${roofName} (${epsDepth || ROOF_EPS_DEPTH}mm panel / ${longSplineEps || 208}mm long spline)`
    : `Roof Framing Plan — ${roofName}`;
  const titleSuffix = ` — ${planeLabel}`;

  // Column edges for dimension chains
  const edges = [];
  if (columnPositions.length > 0) {
    columnPositions.forEach(col => {
      edges.push(Math.round(col.x));
      edges.push(Math.round(col.x + col.width));
    });
  }
  const sortedEdges = [...new Set(edges)].sort((a, b) => a - b);

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{titlePrefix}{titleSuffix}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ZoomControls zoomIdx={zoomIdx} setZoomIdx={setZoomIdx} zoom={zoom} />
          <PrintButton sectionRef={sectionRef} label={isEps ? 'EPS Plan' : 'Roof Framing Plan'} projectName={projectName} wallName={roofName} />
        </div>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 700 }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width={svgW} height={svgH}
        style={{ background: '#F5F5F0' }}
      >
        {/* Plane outline */}
        <rect
          x={sx(0)} y={sy(0)}
          width={sw(uLength)} height={sw(vLength)}
          fill="none" stroke={COLORS.outline} strokeWidth={2}
        />

        {isEps ? (() => {
          const joistRecess = boundaryJoistCount * perimeterPlateWidth + HSPLINE_CLEARANCE;
          const clipId = `eps-clip-${plane.index}`;
          const inset = EPS_GAP * scale;
          const splineOverlap = (SPLINE_WIDTH - PANEL_GAP) / 2; // how far spline extends into panel zone
          const numCourses = planeLayout.courses ? planeLayout.courses.length : 1;
          return (
          <>
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={sx(joistRecess)} y={sy(joistRecess)}
                  width={sw(uLength - joistRecess * 2)}
                  height={sw(vLength - joistRecess * 2)}
                />
              </clipPath>
            </defs>

            {/* EPS mode: panel EPS blocks */}
            {panels.map((panel, i) => {
              let px, py, pw, ph;
              if (panelDirection === 'along_ridge') {
                px = panel.u; py = panel.v; pw = panel.width; ph = panel.length;
              } else {
                px = panel.v; py = panel.u; pw = panel.length; ph = panel.width;
              }

              // Determine which edges are adjacent to splines vs boundaries
              const colIdx = columnPositions.findIndex(c => Math.abs(c.x - panel.u) < 1);
              const hasSplineLeft = colIdx > 0;
              const hasSplineRight = colIdx < columnPositions.length - 1;
              const hasSplineTop = panel.course > 0;
              const hasSplineBottom = panel.course < numCourses - 1;

              // Per-edge deductions: EPS_GAP on all edges + splineOverlap on spline edges
              // In screen coords: left/right map to px-axis, top/bottom map to py-axis
              const dLeft = EPS_GAP + (hasSplineLeft ? splineOverlap : 0);
              const dRight = EPS_GAP + (hasSplineRight ? splineOverlap : 0);
              const dTop = EPS_GAP + (hasSplineTop ? splineOverlap : 0);
              const dBottom = EPS_GAP + (hasSplineBottom ? splineOverlap : 0);

              const epsX = px + dLeft;
              const epsY = py + dTop;
              const epsW = pw - dLeft - dRight;
              const epsH = ph - dTop - dBottom;

              if (epsW <= 0 || epsH <= 0) return null;
              return (
                <g key={`panel-${i}`}>
                  <rect
                    x={sx(epsX)} y={sy(epsY)}
                    width={sw(epsW)} height={sw(epsH)}
                    fill={COLORS.panelEps} fillOpacity={0.4} stroke={COLORS.panelEpsStroke}
                    strokeWidth={0.5}
                    clipPath={`url(#${clipId})`}
                  />
                  <text
                    x={sx(px + pw / 2)} y={sy(py + ph / 2) - 4}
                    textAnchor="middle" fontSize={9} fontWeight="bold"
                    fill="#2C5F8A"
                  >
                    P{panel.globalIndex + 1}
                  </text>
                  <text
                    x={sx(px + pw / 2)} y={sy(py + ph / 2) + 8}
                    textAnchor="middle" fontSize={7}
                    fill="#4A6A8A"
                  >
                    {Math.round(epsW)}×{Math.round(epsH)}
                  </text>
                </g>
              );
            })}

            {/* Spline EPS */}
            {splines.map((spline, i) => {
              let sx2, sy2, sw2, sh2;
              if (spline.orientation === 'horizontal') {
                if (panelDirection === 'along_ridge') {
                  sx2 = spline.u; sy2 = spline.v - SPLINE_WIDTH / 2;
                  sw2 = spline.width; sh2 = SPLINE_WIDTH;
                } else {
                  sx2 = spline.v - SPLINE_WIDTH / 2; sy2 = spline.u;
                  sw2 = SPLINE_WIDTH; sh2 = spline.length;
                }
              } else {
                if (panelDirection === 'along_ridge') {
                  sx2 = spline.u - SPLINE_WIDTH / 2;
                  sy2 = spline.v;
                  sw2 = SPLINE_WIDTH;
                  sh2 = spline.length;
                } else {
                  sx2 = spline.v;
                  sy2 = spline.u - SPLINE_WIDTH / 2;
                  sw2 = spline.length;
                  sh2 = SPLINE_WIDTH;
                }
              }
              return (
                <rect
                  key={`spline-${i}`}
                  x={sx(sx2) + inset} y={sy(sy2) + inset}
                  width={Math.max(0, sw(sw2) - inset * 2)} height={Math.max(0, sw(sh2) - inset * 2)}
                  fill={COLORS.splineEps} stroke={COLORS.splineEpsStroke}
                  strokeWidth={0.5} fillOpacity={0.4}
                  clipPath={`url(#${clipId})`}
                />
              );
            })}
          </>
          );
        })() : (
          <>
            {/* Boundary joists — rectangles along each perimeter edge */}
            {(planeLayout.perimeterPlates || []).map((plate, pi) => {
              // Each plate is an edge segment {x1,y1,x2,y2} in UV coords
              const dx = plate.x2 - plate.x1;
              const dy = plate.y2 - plate.y1;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len < 1) return null;
              // Unit normal pointing inward
              const nx = -dy / len;
              const ny = dx / len;
              const joistW = perimeterPlateWidth;
              const joists = [];
              for (let j = 0; j < boundaryJoistCount; j++) {
                const offsetStart = j * joistW;
                const offsetEnd = offsetStart + joistW;
                // Build 4 corners of the joist rectangle
                const cx1 = plate.x1 + nx * offsetStart;
                const cy1 = plate.y1 + ny * offsetStart;
                const cx2 = plate.x2 + nx * offsetStart;
                const cy2 = plate.y2 + ny * offsetStart;
                const cx3 = plate.x2 + nx * offsetEnd;
                const cy3 = plate.y2 + ny * offsetEnd;
                const cx4 = plate.x1 + nx * offsetEnd;
                const cy4 = plate.y1 + ny * offsetEnd;
                const pts = `${sx(cx1)},${sy(cy1)} ${sx(cx2)},${sy(cy2)} ${sx(cx3)},${sy(cy3)} ${sx(cx4)},${sy(cy4)}`;
                joists.push(
                  <polygon key={`bj${pi}-${j}`} points={pts}
                    fill={COLORS.PLATE} fillOpacity={0.4} stroke={COLORS.PLATE} strokeWidth={0.75} />
                );
              }
              return <g key={`pp${pi}`}>{joists}</g>;
            })}

            {/* Splines — red */}
            {splines.map((spline, i) => {
              let sx2, sy2, sw2, sh2;
              if (spline.orientation === 'horizontal') {
                if (panelDirection === 'along_ridge') {
                  sx2 = spline.u; sy2 = spline.v - SPLINE_WIDTH / 2;
                  sw2 = spline.width; sh2 = SPLINE_WIDTH;
                } else {
                  sx2 = spline.v - SPLINE_WIDTH / 2; sy2 = spline.u;
                  sw2 = SPLINE_WIDTH; sh2 = spline.length;
                }
              } else {
                if (panelDirection === 'along_ridge') {
                  sx2 = spline.u - SPLINE_WIDTH / 2;
                  sy2 = spline.v;
                  sw2 = SPLINE_WIDTH;
                  sh2 = spline.length;
                } else {
                  sx2 = spline.v;
                  sy2 = spline.u - SPLINE_WIDTH / 2;
                  sw2 = spline.length;
                  sh2 = SPLINE_WIDTH;
                }
              }
              return (
                <rect
                  key={`spline-${i}`}
                  x={sx(sx2)} y={sy(sy2)}
                  width={sw(sw2)} height={sw(sh2)}
                  fill={COLORS.SPLINE} fillOpacity={0.4} stroke={COLORS.SPLINE_STROKE}
                  strokeWidth={0.75}
                />
              );
            })}
          </>
        )}

        {/* Penetrations */}
        {penetrations.map((pen, i) => {
          if (pen.type === 'pipe') {
            const r = (pen.diameter_mm || 100) / 2;
            return (
              <circle
                key={`pen-${i}`}
                cx={sx(pen.position_x_mm)} cy={sy(pen.position_y_mm)}
                r={sw(r)}
                fill={COLORS.penetration || COLORS.penetration} stroke={COLORS.penetrationStroke} strokeWidth={1}
              />
            );
          }
          return (
            <rect
              key={`pen-${i}`}
              x={sx(pen.position_x_mm)} y={sy(pen.position_y_mm)}
              width={sw(pen.width_mm || 0)} height={sw(pen.length_mm || 0)}
              fill={COLORS.penetration} stroke={COLORS.penetrationStroke} strokeWidth={1}
            />
          );
        })}

        {/* Framing-only dimension chains and labels */}
        {!isEps && (
          <>
            {/* U-axis spline centre segment dimensions (bottom) */}
            {splines.length > 0 && (() => {
              const dimY = svgH - bottomMargin + 16;
              const tickH = 5;
              const DIM_COLOR = '#666';
              const splineCentres = [...new Set(splines.map(s => {
                if (panelDirection === 'along_ridge') return Math.round(s.u);
                return Math.round(s.v + s.length / 2);
              }))].sort((a, b) => a - b);
              if (splineCentres.length === 0) return null;
              const positions = [0, ...splineCentres, Math.round(uLength)];
              return (
                <g>
                  <text x={sx(0) - 4} y={dimY + 4} textAnchor="end" fontSize={8} fill={DIM_COLOR}>Splines</text>
                  <line x1={sx(0)} y1={dimY} x2={sx(uLength)} y2={dimY} stroke={DIM_COLOR} strokeWidth={0.5} />
                  {positions.map((pos, i) => {
                    const x = sx(pos);
                    return (
                      <g key={`spu${i}`}>
                        <line x1={x} y1={dimY - tickH} x2={x} y2={dimY + tickH} stroke={DIM_COLOR} strokeWidth={0.5} />
                        {i < positions.length - 1 && (() => {
                          const x2 = sx(positions[i + 1]);
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

            {/* V-axis course break segment dimensions (left) */}
            {planeLayout.courses && planeLayout.courses.length > 1 && (() => {
              const dimX = margin - 20;
              const tickW = 5;
              const DIM_COLOR = '#666';
              const courseBreaks = [0, ...planeLayout.courses.map(c => Math.round(c.offset + c.height))];
              const positions = [...new Set(courseBreaks)].sort((a, b) => a - b);
              return (
                <g>
                  <text x={dimX} y={sy(0) - 6} textAnchor="middle" fontSize={8} fill={DIM_COLOR}>Courses</text>
                  <line x1={dimX} y1={sy(0)} x2={dimX} y2={sy(vLength)} stroke={DIM_COLOR} strokeWidth={0.5} />
                  {positions.map((pos, i) => {
                    const y = sy(pos);
                    return (
                      <g key={`cv${i}`}>
                        <line x1={dimX - tickW} y1={y} x2={dimX + tickW} y2={y} stroke={DIM_COLOR} strokeWidth={0.5} />
                        {i < positions.length - 1 && (() => {
                          const y2 = sy(positions[i + 1]);
                          const segH = Math.round(positions[i + 1] - pos);
                          if (Math.abs(y2 - y) < 28) return null;
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

            {/* U-axis running measure (bottom, below spline chain) */}
            {sortedEdges.length > 1 && (() => {
              const dimY = svgH - bottomMargin + 38;
              const tickH = 5;
              const DIM_COLOR = '#444';
              const origin = sortedEdges[0];
              return (
                <g>
                  <text x={sx(origin) - 4} y={dimY + 4} textAnchor="end" fontSize={8} fill={DIM_COLOR}>Running</text>
                  <line x1={sx(origin)} y1={dimY} x2={sx(sortedEdges[sortedEdges.length - 1])} y2={dimY} stroke={DIM_COLOR} strokeWidth={0.75} />
                  {sortedEdges.map((pos, i) => {
                    const x = sx(pos);
                    const cumulative = Math.round(pos - origin);
                    const prevX = i > 0 ? sx(sortedEdges[i - 1]) : x;
                    const showLabel = i === 0 || (x - prevX) > 24;
                    return (
                      <g key={`xd${i}`}>
                        <line x1={x} y1={dimY - tickH} x2={x} y2={dimY + tickH} stroke={DIM_COLOR} strokeWidth={0.75} />
                        {showLabel && (
                          <text x={x} y={dimY + 16} textAnchor="middle" fontSize={9} fontWeight={i === 0 || i === sortedEdges.length - 1 ? 'bold' : 'normal'} fill={DIM_COLOR}>{cumulative}</text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* V-axis dimension (right side) */}
            <text
              x={sx(uLength) + 16} y={sy(vLength / 2)}
              textAnchor="middle" fontSize={11} fill={NEUTRAL.textMuted}
              transform={`rotate(90, ${sx(uLength) + 16}, ${sy(vLength / 2)})`}
            >
              {Math.round(vLength)} mm
            </text>

            {/* U-axis dimension (bottom) */}
            <text x={sx(uLength / 2)} y={sy(vLength) + 16} textAnchor="middle" fontSize={11} fill={NEUTRAL.textMuted}>
              {Math.round(uLength)} mm
            </text>

            {/* SVG inline legend */}
            <g transform={`translate(${margin}, ${svgH - 18})`}>
              {[
                { fill: FRAMING_COLORS.PLATE, opacity: 0.4, label: `Boundary Joists (\u00d7${boundaryJoistCount})` },
                { fill: FRAMING_COLORS.SPLINE, opacity: 0.4, label: 'Splines' },
                ...(planeLayout.courses && planeLayout.courses.length > 1 ? [{ fill: '#999', opacity: 0.3, label: 'Sheet Joins', dash: '6,3' }] : []),
                ...(penetrations.length > 0 ? [{ fill: FRAMING_COLORS.penetration, opacity: 1, label: 'Penetrations' }] : []),
              ].reduce((acc, item, i) => {
                const x = acc.offset;
                const labelW = item.label.length * 6.5 + 24;
                acc.elements.push(
                  <g key={i} transform={`translate(${x}, 0)`}>
                    {item.dash
                      ? <line x1={0} y1={0} x2={14} y2={0} stroke={item.fill} strokeWidth={2} strokeDasharray={item.dash} />
                      : <rect x={0} y={-4} width={14} height={8} fill={item.fill} fillOpacity={item.opacity} />
                    }
                    <text x={18} y={4} fontSize={9} fill="#333">{item.label}</text>
                  </g>
                );
                acc.offset = x + labelW;
                return acc;
              }, { elements: [], offset: 0 }).elements}
            </g>
          </>
        )}
      </svg>
      </div>
    </div>
  );
}
