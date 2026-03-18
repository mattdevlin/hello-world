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
    eaveOverhang_mm, eaveOverhangHigh_mm, eaveOverhangLow_mm,
    gableOverhang_mm, ridgeOffset_mm,
    ridgeHeight, totalPanels,
    planeLayouts, penetrations,
    panelDirection,
  } = layout;

  // Resolve high/low eave overhangs (skillion uses separate values, others symmetric)
  const highEave = type === 'skillion' ? (eaveOverhangHigh_mm ?? eaveOverhang_mm) : eaveOverhang_mm;
  const lowEave = type === 'skillion' ? (eaveOverhangLow_mm ?? eaveOverhang_mm) : eaveOverhang_mm;

  // ── Plan view dimensions ──
  const totalPlanW = type === 'flat' ? length_mm : length_mm + 2 * gableOverhang_mm;
  const totalPlanH = type === 'flat' ? width_mm : (type === 'skillion' ? width_mm + highEave + lowEave : width_mm + 2 * eaveOverhang_mm);
  const oxFoot = type === 'flat' ? 0 : gableOverhang_mm;
  const oyFoot = type === 'flat' ? 0 : (type === 'skillion' ? highEave : eaveOverhang_mm);

  // ── Elevation dimensions (end view, looking along ridge) ──
  const elevSpan = type === 'flat' ? width_mm : (type === 'skillion' ? width_mm + highEave + lowEave : width_mm + 2 * eaveOverhang_mm);
  const tanPitchForElev = Math.tan((pitch_deg * Math.PI) / 180);
  const elevRiseRaw = type === 'flat' ? 300 : (type === 'skillion'
    ? ridgeHeight + highEave * tanPitchForElev
    : ridgeHeight + eaveOverhang_mm * tanPitchForElev);
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

  // Helper: compute plan-view coordinates for a panel
  const cosPitch = type === 'flat' ? 1 : Math.cos((pitch_deg * Math.PI) / 180);
  function panelPlanCoords(panel, plane) {
    const { u, v, width: pw, length: pl2 } = panel;
    if (type === 'flat') {
      if (panelDirection === 'along_ridge') return { ppx: u, ppy: v, ppw: pw, pph: pl2 };
      return { ppx: u, ppy: v, ppw: pl2, pph: pw };
    }
    if (type === 'gable') {
      // along_ridge: u/pw along ridge (X), v/pl2 along slope → projected to Y
      // eave_to_ridge: u/pl2 along ridge (X), v/pw along slope → projected to Y
      const ridgeW = panelDirection === 'along_ridge' ? pw : pl2;
      const slopePos = v * cosPitch;
      const slopeSize = (panelDirection === 'along_ridge' ? pl2 : pw) * cosPitch;
      let slopeY;
      if (plane.index === 0) {
        slopeY = oyFoot + width_mm / 2 + ridgeOffset_mm - slopePos - slopeSize;
      } else {
        slopeY = oyFoot + width_mm / 2 - ridgeOffset_mm + slopePos;
      }
      return { ppx: u, ppy: slopeY, ppw: ridgeW, pph: slopeSize };
    }
    // Skillion / mono
    if (panelDirection === 'along_ridge') {
      return { ppx: u, ppy: v * cosPitch, ppw: pw, pph: pl2 * cosPitch };
    }
    return { ppx: u, ppy: v * cosPitch, ppw: pl2, pph: pw * cosPitch };
  }

  // Collect X and Y edge positions for running measures
  const columnEdges = new Set();
  const rowEdges = new Set();
  planeLayouts.forEach(pl => {
    pl.panels.forEach(panel => {
      const { ppx, ppy, ppw, pph } = panelPlanCoords(panel, pl.plane);
      columnEdges.add(Math.round(ppx));
      columnEdges.add(Math.round(ppx + ppw));
      rowEdges.add(Math.round(ppy));
      rowEdges.add(Math.round(ppy + pph));
    });
  });
  const sortedColumnEdges = [...columnEdges].sort((a, b) => a - b);
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
            const { ppx, ppy, ppw, pph } = panelPlanCoords(panel, plane);
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

        {renderElevation(type, width_mm, eaveOverhang_mm, ridgeOffset_mm, pitch_deg, ridgeHeight, ex, ey, es, highEave, lowEave)}

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
function renderElevation(type, width_mm, eaveOverhang_mm, ridgeOffset_mm, pitch_deg, _ridgeHeight, ex, ey, es, highEave, lowEave) {
  const pitchRad = (pitch_deg * Math.PI) / 180;
  const tanPitch = Math.tan(pitchRad);
  const totalSpan = type === 'flat' ? width_mm : (type === 'skillion' ? width_mm + highEave + lowEave : width_mm + 2 * eaveOverhang_mm);

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
    // HIGH side at top (ey=0), LOW side at bottom (ey=totalSpan)
    // Matches architectural convention: left=high in end elevation
    const highRise = width_mm * tanPitch;
    const lowEaveRise = -(lowEave * tanPitch);
    const highEaveRise = highRise + highEave * tanPitch;
    const thickness = es(200);

    return (
      <g>
        <line x1={ex(0)} y1={ey(0)} x2={ex(0)} y2={ey(totalSpan)}
          stroke={COLORS.overhangStroke} strokeWidth={1} strokeDasharray="4,3" />
        {/* Wall ref lines: high wall at highEave from top, low wall at highEave + width */}
        <line x1={ex(-20)} y1={ey(highEave)} x2={ex(highRise * 0.8)} y2={ey(highEave)}
          stroke={COLORS.footprintStroke} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={ex(-20)} y1={ey(highEave + width_mm)} x2={ex(highRise * 0.5)} y2={ey(highEave + width_mm)}
          stroke={COLORS.footprintStroke} strokeWidth={1} strokeDasharray="3,3" />
        {/* Slope line: high eave tip (top) → low eave tip (bottom) */}
        <line x1={ex(highEaveRise)} y1={ey(0)} x2={ex(lowEaveRise)} y2={ey(totalSpan)}
          stroke={COLORS.roofStroke} strokeWidth={3} />
        <line x1={ex(highEaveRise) - thickness} y1={ey(0)} x2={ex(lowEaveRise) - thickness} y2={ey(totalSpan)}
          stroke={COLORS.roofStroke} strokeWidth={1} strokeDasharray="4,3" />
        <line x1={ex(highEaveRise)} y1={ey(0)} x2={ex(highEaveRise) - thickness} y2={ey(0)}
          stroke={COLORS.roofStroke} strokeWidth={2} />
        <line x1={ex(lowEaveRise)} y1={ey(totalSpan)} x2={ex(lowEaveRise) - thickness} y2={ey(totalSpan)}
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
