import { useRef, useState } from 'react';
import PrintButton from './PrintButton.jsx';
import ZoomControls, { ZOOM_STEPS, DEFAULT_IDX } from './ZoomControls.jsx';
import { NEUTRAL } from '../utils/designTokens.js';
import { ROOF_THICKNESS } from '../utils/constants.js';

const MARGIN = { top: 60, right: 40, bottom: 80, left: 70 };
const MAX_SVG_WIDTH = 1200;
const MAX_SVG_HEIGHT = 600;

const COLORS = {
  footprint: '#E8D5B7',
  footprintStroke: '#8D6E63',
  panel: '#B3D4F0',
  panelStroke: '#5B8DB8',
  ridge: '#D32F2F',
  overhang: '#E0E0E0',
  overhangStroke: '#BDBDBD',
  penetration: '#FFE082',
  penetrationStroke: '#F9A825',
  roofFill: '#D7CCC8',
  roofStroke: '#5D4037',
  DIM: '#666',
};

export default function RoofPlanView({ layout, roofName, projectName }) {
  const sectionRef = useRef(null);
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_IDX);
  const zoom = ZOOM_STEPS[zoomIdx];

  if (!layout) return null;

  const {
    type, length_mm, width_mm, pitch_deg,
    eaveOverhang_mm, gableOverhang_mm, ridgeOffset_mm,
    ridgeHeight, totalPanels,
    planeLayouts, penetrations,
    panelDirection,
  } = layout;

  // ── Plan view dimensions ──
  const totalPlanW = type === 'flat' ? length_mm : length_mm + 2 * gableOverhang_mm;
  const totalPlanH = type === 'flat' ? width_mm : width_mm + 2 * eaveOverhang_mm;
  const oxFoot = type === 'flat' ? 0 : gableOverhang_mm;
  const oyFoot = type === 'flat' ? 0 : eaveOverhang_mm;

  // ── Elevation dimensions (end view, looking along ridge) ──
  const elevSpan = type === 'flat' ? width_mm : width_mm + 2 * eaveOverhang_mm;
  const elevRiseRaw = type === 'flat' ? 300 : ridgeHeight + eaveOverhang_mm * Math.tan((pitch_deg * Math.PI) / 180);
  const elevRise = Math.max(elevRiseRaw, 300);

  // ── Layout: plan on left, rotated elevation on right ──
  const margin = 60;
  const gap = 80;
  const maxTotalWidth = 1100;

  const availW = maxTotalWidth - 2 * margin - gap;
  const planAllocW = availW * 0.6;
  const planScale = Math.min(planAllocW / totalPlanW, 500 / totalPlanH) * zoom;

  const planW = totalPlanW * planScale;
  const planH = totalPlanH * planScale;

  const elevScale = Math.min(planH / elevSpan, (availW * 0.4) / elevRise, planScale);
  const elevSpanPx = elevSpan * elevScale;
  const elevRisePx = elevRise * elevScale;

  const svgW = margin + planW + gap + elevRisePx + margin;
  const svgH = Math.max(planH, elevSpanPx) + 2 * margin + 20;

  const px = (x) => margin + x * planScale;
  const py = (y) => margin + 20 + y * planScale;
  const ps = (w) => w * planScale;

  const elevOriginX = margin + planW + gap;
  const elevTopY = margin + 20;
  const elevOffsetY = elevTopY + (planH - elevSpanPx) / 2;
  const ex = (rise) => elevOriginX + rise * elevScale;
  const ey = (spanPos) => elevOffsetY + spanPos * elevScale;
  const es = (w) => w * elevScale;

  // Collect all panel column edges for X-axis running measure
  const allPanelXPositions = new Set();
  planeLayouts.forEach(pl => {
    pl.panels.forEach(panel => {
      let ppx, ppw;
      if (type === 'flat') {
        if (panelDirection === 'along_ridge') { ppx = panel.u; ppw = panel.width; }
        else { ppx = panel.v; ppw = panel.length; }
      } else {
        const cosPitch = Math.cos((pitch_deg * Math.PI) / 180);
        if (panelDirection === 'along_ridge') { ppx = panel.u; ppw = panel.width; }
        else {
          const vPlan = panel.v * cosPitch;
          const lPlan = panel.length * cosPitch;
          ppx = panel.u; ppw = panel.width;
          // For eave_to_ridge, panel X is the v projection
          ppx = type === 'gable'
            ? (pl.plane.index === 0 ? oxFoot + width_mm / 2 + ridgeOffset_mm - vPlan - lPlan : oxFoot + width_mm / 2 - ridgeOffset_mm + vPlan)
            : (oyFoot + panel.v * cosPitch);
          ppw = lPlan;
        }
      }
      allPanelXPositions.add(Math.round(ppx));
      allPanelXPositions.add(Math.round(ppx + ppw));
    });
  });

  // Simpler: collect unique U-edge positions for the running measure along the primary axis
  const columnEdges = new Set();
  planeLayouts.forEach(pl => {
    if (pl.columnPositions) {
      pl.columnPositions.forEach(col => {
        columnEdges.add(Math.round(col.x));
        columnEdges.add(Math.round(col.x + col.width));
      });
    }
  });
  const sortedColumnEdges = [...columnEdges].sort((a, b) => a - b);

  // Collect Y-edge positions for the Y-axis running measure
  const rowEdges = new Set();
  planeLayouts.forEach(pl => {
    pl.panels.forEach(panel => {
      const { u, v, width: pw, length: pl2 } = panel;
      let ppy, pph;
      if (type === 'flat') {
        if (panelDirection === 'along_ridge') { ppy = v; pph = pl2; }
        else { ppy = u; pph = pw; }
      } else if (type === 'gable') {
        const cosPitch = Math.cos((pitch_deg * Math.PI) / 180);
        if (panelDirection === 'along_ridge') {
          const vPlan = v * cosPitch;
          const lPlan = pl2 * cosPitch;
          if (pl.plane.index === 0) { ppy = oyFoot + width_mm / 2 + ridgeOffset_mm - vPlan - lPlan; }
          else { ppy = oyFoot + width_mm / 2 - ridgeOffset_mm + vPlan; }
          pph = lPlan;
        } else {
          ppy = u; pph = pw;
        }
      } else {
        const cosPitch = Math.cos((pitch_deg * Math.PI) / 180);
        if (panelDirection === 'along_ridge') { ppy = oyFoot + v * cosPitch; pph = pl2 * cosPitch; }
        else { ppy = u; pph = pw; }
      }
      rowEdges.add(Math.round(ppy));
      rowEdges.add(Math.round(ppy + pph));
    });
  });
  const sortedRowEdges = [...rowEdges].sort((a, b) => a - b);

  const title = `${roofName || 'Roof'} — ${Math.round(length_mm)}×${Math.round(width_mm)}mm — ${totalPanels} panels (${ROOF_THICKNESS}mm)`;

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ZoomControls zoomIdx={zoomIdx} setZoomIdx={setZoomIdx} zoom={zoom} />
          <PrintButton sectionRef={sectionRef} label="Roof Plan" projectName={projectName} wallName={roofName} />
        </div>
      </div>

      <div style={{ overflow: 'auto', maxHeight: 700 }}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width={Math.min(svgW, maxTotalWidth)}
        style={{ background: '#F5F5F0' }}
      >
        {/* ═══ Plan View (left) ═══ */}
        <text x={margin + planW / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={600} fill={NEUTRAL.text}>
          {projectName} — {roofName} — Plan View
        </text>

        {/* Overhang area */}
        {type !== 'flat' && (
          <rect
            x={px(0)} y={py(0)}
            width={ps(totalPlanW)} height={ps(totalPlanH)}
            fill={COLORS.overhang} stroke={COLORS.overhangStroke}
            strokeWidth={1} strokeDasharray="6,3"
          />
        )}

        {/* Building footprint */}
        <rect
          x={px(oxFoot)} y={py(oyFoot)}
          width={ps(length_mm)} height={ps(width_mm)}
          fill={COLORS.footprint} stroke={COLORS.footprintStroke}
          strokeWidth={2}
        />

        {/* Ridge line */}
        {type === 'gable' && (
          <line
            x1={px(0)} y1={py(oyFoot + width_mm / 2 + ridgeOffset_mm)}
            x2={px(totalPlanW)} y2={py(oyFoot + width_mm / 2 + ridgeOffset_mm)}
            stroke={COLORS.ridge} strokeWidth={3}
          />
        )}

        {/* Panels projected onto plan */}
        {planeLayouts.map((pl, pi) => {
          const plane = pl.plane;
          return pl.panels.map((panel, idx) => {
            const { u, v, width: pw, length: pl2 } = panel;
            let ppx, ppy, ppw, pph;
            if (type === 'flat') {
              if (panelDirection === 'along_ridge') {
                ppx = u; ppy = v; ppw = pw; pph = pl2;
              } else {
                ppx = v; ppy = u; ppw = pl2; pph = pw;
              }
            } else if (type === 'gable') {
              const cosPitch = Math.cos((pitch_deg * Math.PI) / 180);
              if (panelDirection === 'along_ridge') {
                ppx = u; ppw = pw;
                const vPlan = v * cosPitch;
                const lPlan = pl2 * cosPitch;
                if (plane.index === 0) {
                  ppy = oyFoot + width_mm / 2 + ridgeOffset_mm - vPlan - lPlan;
                } else {
                  ppy = oyFoot + width_mm / 2 - ridgeOffset_mm + vPlan;
                }
                pph = lPlan;
              } else {
                ppy = u; pph = pw;
                const vPlan = v * cosPitch;
                const lPlan = pl2 * cosPitch;
                if (plane.index === 0) {
                  ppx = oxFoot + width_mm / 2 + ridgeOffset_mm - vPlan - lPlan;
                } else {
                  ppx = oxFoot + width_mm / 2 - ridgeOffset_mm + vPlan;
                }
                ppw = lPlan;
              }
            } else {
              const cosPitch = Math.cos((pitch_deg * Math.PI) / 180);
              if (panelDirection === 'along_ridge') {
                ppx = u; ppw = pw;
                ppy = oyFoot + v * cosPitch;
                pph = pl2 * cosPitch;
              } else {
                ppy = u; pph = pw;
                ppx = oxFoot + v * cosPitch;
                ppw = pl2 * cosPitch;
              }
            }
            return (
              <g key={`panel-${pi}-${idx}`}>
                <rect
                  x={px(ppx)} y={py(ppy)}
                  width={ps(ppw)} height={ps(pph)}
                  fill={COLORS.panel} stroke={COLORS.panelStroke}
                  strokeWidth={0.5} opacity={0.7}
                />
                {ps(ppw) > 40 && ps(pph) > 40 && (
                  <>
                    <text
                      x={px(ppx + ppw / 2)} y={py(ppy + pph / 2)}
                      textAnchor="middle" fontSize={10} fill="#333"
                    >
                      P{panel.globalIndex + 1}
                    </text>
                    <text
                      x={px(ppx + ppw / 2)} y={py(ppy + pph / 2) + 12}
                      textAnchor="middle" fontSize={8} fill="#666"
                    >
                      {Math.round(ppw)}×{Math.round(pph)}
                    </text>
                  </>
                )}
              </g>
            );
          });
        })}

        {/* Penetrations */}
        {penetrations.map((pen, i) => {
          if (pen.type === 'pipe') {
            const r = (pen.diameter_mm || 100) / 2;
            return (
              <circle
                key={`pen-${i}`}
                cx={px(oxFoot + pen.position_x_mm)} cy={py(oyFoot + pen.position_y_mm)}
                r={ps(r)}
                fill={COLORS.penetration} stroke={COLORS.penetrationStroke}
                strokeWidth={1}
              />
            );
          }
          return (
            <rect
              key={`pen-${i}`}
              x={px(oxFoot + pen.position_x_mm)} y={py(oyFoot + pen.position_y_mm)}
              width={ps(pen.width_mm || 0)} height={ps(pen.length_mm || 0)}
              fill={COLORS.penetration} stroke={COLORS.penetrationStroke}
              strokeWidth={1}
            />
          );
        })}

        {/* X-axis running measure — panel column edges along ridge */}
        {sortedColumnEdges.length > 1 && (() => {
          const dimY = svgH - MARGIN.bottom + 16;
          const tickH = 5;
          const origin = sortedColumnEdges[0];
          return (
            <g>
              <line x1={px(origin)} y1={dimY} x2={px(sortedColumnEdges[sortedColumnEdges.length - 1])} y2={dimY} stroke={COLORS.DIM} strokeWidth={0.5} />
              {sortedColumnEdges.map((pos, i) => {
                const x = px(pos);
                const cumulative = Math.round(pos - origin);
                const prevX = i > 0 ? px(sortedColumnEdges[i - 1]) : x;
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

        {/* Y-axis running measure — panel row edges (left side) */}
        {sortedRowEdges.length > 1 && (() => {
          const dimX = margin - 16;
          const tickW = 5;
          const origin = sortedRowEdges[0];
          return (
            <g>
              <line x1={dimX} y1={py(origin)} x2={dimX} y2={py(sortedRowEdges[sortedRowEdges.length - 1])} stroke={COLORS.DIM} strokeWidth={0.5} />
              {sortedRowEdges.map((pos, i) => {
                const y = py(pos);
                const cumulative = Math.round(pos - origin);
                const prevY = i > 0 ? py(sortedRowEdges[i - 1]) : y;
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

        {/* Plan dimensions */}
        <text x={px(oxFoot + length_mm / 2)} y={py(totalPlanH) + 16} textAnchor="middle" fontSize={11} fill={NEUTRAL.textMuted}>
          {length_mm} mm
        </text>
        <text
          x={px(totalPlanW) + 16} y={py(oyFoot + width_mm / 2)}
          textAnchor="middle" fontSize={11} fill={NEUTRAL.textMuted}
          transform={`rotate(90, ${px(totalPlanW) + 16}, ${py(oyFoot + width_mm / 2)})`}
        >
          {width_mm} mm
        </text>

        {/* ═══ Elevation View (right, rotated 90° left) ═══ */}
        <text x={elevOriginX + elevRisePx / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={600} fill={NEUTRAL.text}>
          End Elevation
        </text>

        {renderElevation(type, width_mm, eaveOverhang_mm, ridgeOffset_mm, pitch_deg, ridgeHeight, ex, ey, es)}

        {/* Elevation span dimension (vertical, right side) */}
        <text
          x={ex(elevRise) + 16} y={ey(elevSpan / 2)}
          textAnchor="middle" fontSize={11} fill={NEUTRAL.textMuted}
          transform={`rotate(90, ${ex(elevRise) + 16}, ${ey(elevSpan / 2)})`}
        >
          {Math.round(elevSpan)} mm
        </text>
        {/* Elevation rise dimension (horizontal, below) */}
        {ridgeHeight > 0 && (
          <text x={ex(ridgeHeight / 2)} y={ey(elevSpan) + 16} textAnchor="middle" fontSize={11} fill={NEUTRAL.textMuted}>
            {Math.round(ridgeHeight)} mm
          </text>
        )}
      </svg>
      </div>
    </div>
  );
}

/**
 * Render the end elevation profile (rotated 90° left).
 */
function renderElevation(type, width_mm, eaveOverhang_mm, ridgeOffset_mm, pitch_deg, _ridgeHeight, ex, ey, es) {
  const pitchRad = (pitch_deg * Math.PI) / 180;
  const tanPitch = Math.tan(pitchRad);
  const totalSpan = type === 'flat' ? width_mm : width_mm + 2 * eaveOverhang_mm;

  if (type === 'gable') {
    const ridgeSpan = eaveOverhang_mm + width_mm / 2 + ridgeOffset_mm;
    const leftHalfW = width_mm / 2 + ridgeOffset_mm;
    const rHeight = leftHalfW * tanPitch;
    const leftEaveRise = -(eaveOverhang_mm * tanPitch);
    const rightEaveRise = -(eaveOverhang_mm * tanPitch);

    const pts = [
      [0, leftEaveRise],
      [ridgeSpan, rHeight],
      [totalSpan, rightEaveRise],
    ];
    const polyStr = pts.map(([s, r]) => `${ex(r)},${ey(s)}`).join(' ');

    return (
      <g>
        <line x1={ex(0)} y1={ey(0)} x2={ex(0)} y2={ey(totalSpan)}
          stroke={COLORS.overhangStroke} strokeWidth={1} strokeDasharray="4,3" />
        <line x1={ex(-20)} y1={ey(eaveOverhang_mm)} x2={ex(rHeight * 0.3)} y2={ey(eaveOverhang_mm)}
          stroke={COLORS.footprintStroke} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={ex(-20)} y1={ey(eaveOverhang_mm + width_mm)} x2={ex(rHeight * 0.3)} y2={ey(eaveOverhang_mm + width_mm)}
          stroke={COLORS.footprintStroke} strokeWidth={1} strokeDasharray="3,3" />
        <polygon points={polyStr}
          fill={COLORS.roofFill} stroke={COLORS.roofStroke} strokeWidth={2} />
        <circle cx={ex(rHeight)} cy={ey(ridgeSpan)} r={3} fill={COLORS.ridge} />
        <text x={ex(rHeight / 2) + 8} y={ey(ridgeSpan / 2)}
          textAnchor="start" fontSize={10} fontWeight={600} fill={NEUTRAL.text}>
          {pitch_deg}°
        </text>
      </g>
    );
  }

  if (type === 'skillion') {
    const highRise = width_mm * tanPitch;
    const lowEaveRise = -(eaveOverhang_mm * tanPitch);
    const highEaveRise = highRise + eaveOverhang_mm * tanPitch;
    const thickness = es(200);

    return (
      <g>
        <line x1={ex(0)} y1={ey(0)} x2={ex(0)} y2={ey(totalSpan)}
          stroke={COLORS.overhangStroke} strokeWidth={1} strokeDasharray="4,3" />
        <line x1={ex(-20)} y1={ey(eaveOverhang_mm)} x2={ex(highRise * 0.5)} y2={ey(eaveOverhang_mm)}
          stroke={COLORS.footprintStroke} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={ex(-20)} y1={ey(eaveOverhang_mm + width_mm)} x2={ex(highRise * 0.8)} y2={ey(eaveOverhang_mm + width_mm)}
          stroke={COLORS.footprintStroke} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={ex(lowEaveRise)} y1={ey(0)} x2={ex(highEaveRise)} y2={ey(totalSpan)}
          stroke={COLORS.roofStroke} strokeWidth={3} />
        <line x1={ex(lowEaveRise) - thickness} y1={ey(0)} x2={ex(highEaveRise) - thickness} y2={ey(totalSpan)}
          stroke={COLORS.roofStroke} strokeWidth={1} strokeDasharray="4,3" />
        <line x1={ex(lowEaveRise)} y1={ey(0)} x2={ex(lowEaveRise) - thickness} y2={ey(0)}
          stroke={COLORS.roofStroke} strokeWidth={2} />
        <line x1={ex(highEaveRise)} y1={ey(totalSpan)} x2={ex(highEaveRise) - thickness} y2={ey(totalSpan)}
          stroke={COLORS.roofStroke} strokeWidth={2} />
        <text x={ex((lowEaveRise + highEaveRise) / 2) + 8} y={ey(totalSpan / 2)}
          textAnchor="start" fontSize={10} fontWeight={600} fill={NEUTRAL.text}>
          {pitch_deg}°
        </text>
      </g>
    );
  }

  // Flat
  const slabThickness = 242;
  return (
    <g>
      <rect x={ex(0)} y={ey(0)} width={es(slabThickness)} height={es(width_mm)}
        fill={COLORS.roofFill} stroke={COLORS.roofStroke} strokeWidth={2} />
      <text x={ex(slabThickness / 2)} y={ey(width_mm / 2) + 4}
        textAnchor="middle" fontSize={10} fontWeight={600} fill={NEUTRAL.text}>
        {slabThickness}mm
      </text>
    </g>
  );
}
