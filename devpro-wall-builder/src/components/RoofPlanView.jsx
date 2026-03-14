import { useRef } from 'react';
import { NEUTRAL } from '../utils/designTokens.js';

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
};

export default function RoofPlanView({ layout, roofName, projectName }) {
  const svgRef = useRef(null);

  if (!layout) return null;

  const {
    type, length_mm, width_mm, pitch_deg,
    eaveOverhang_mm, gableOverhang_mm, ridgeOffset_mm,
    ridgeHeight,
    planeLayouts, penetrations,
    panelDirection,
  } = layout;

  // ── Plan view dimensions ──
  const totalPlanW = type === 'flat' ? length_mm : length_mm + 2 * gableOverhang_mm;
  const totalPlanH = type === 'flat' ? width_mm : width_mm + 2 * eaveOverhang_mm;
  const oxFoot = type === 'flat' ? 0 : gableOverhang_mm;
  const oyFoot = type === 'flat' ? 0 : eaveOverhang_mm;

  // ── Elevation dimensions (end view, looking along ridge) ──
  // "elevSpan" = eave-to-eave span (will run vertically, aligned with plan Y)
  // "elevRise" = ridge height above eave line (will run horizontally to the right)
  const elevSpan = type === 'flat' ? width_mm : width_mm + 2 * eaveOverhang_mm;
  const elevRiseRaw = type === 'flat' ? 300 : ridgeHeight + eaveOverhang_mm * Math.tan((pitch_deg * Math.PI) / 180);
  const elevRise = Math.max(elevRiseRaw, 300);

  // ── Layout: plan on left, rotated elevation on right ──
  const margin = 60;
  const gap = 80;
  const maxTotalWidth = 1100;

  // Plan scale: fit plan in ~60% of available width
  const availW = maxTotalWidth - 2 * margin - gap;
  const planAllocW = availW * 0.6;
  const planScale = Math.min(planAllocW / totalPlanW, 500 / totalPlanH);

  const planW = totalPlanW * planScale;
  const planH = totalPlanH * planScale;

  // Elevation scale: span maps to vertical (must match plan height for alignment)
  // and rise maps to horizontal
  const elevScale = Math.min(planH / elevSpan, (availW * 0.4) / elevRise, planScale);
  const elevSpanPx = elevSpan * elevScale;
  const elevRisePx = elevRise * elevScale;

  const svgW = margin + planW + gap + elevRisePx + margin;
  const svgH = Math.max(planH, elevSpanPx) + 2 * margin + 20;

  // Plan coordinate helpers
  const px = (x) => margin + x * planScale;
  const py = (y) => margin + 20 + y * planScale;
  const ps = (w) => w * planScale;

  // Elevation coordinate helpers — rotated 90° left:
  //   elevation "span" → SVG Y (top=0 eave, bottom=full span), aligned with plan
  //   elevation "rise"  → SVG X (left=baseline, right=peak)
  const elevOriginX = margin + planW + gap;
  const elevTopY = margin + 20; // top of elevation area
  // Vertically center elevation with plan
  const elevOffsetY = elevTopY + (planH - elevSpanPx) / 2;
  // ex: converts elevation rise (height above baseline) to SVG X
  const ex = (rise) => elevOriginX + rise * elevScale;
  // ey: converts elevation span position to SVG Y (0=top eave)
  const ey = (spanPos) => elevOffsetY + spanPos * elevScale;
  const es = (w) => w * elevScale;

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgW} ${svgH}`}
        width={Math.min(svgW, maxTotalWidth)}
        style={{ background: '#FAFAFA', border: '1px solid #e0e0e0', borderRadius: 8 }}
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
              <rect
                key={`panel-${pi}-${idx}`}
                x={px(ppx)} y={py(ppy)}
                width={ps(ppw)} height={ps(pph)}
                fill={COLORS.panel} stroke={COLORS.panelStroke}
                strokeWidth={0.5} opacity={0.7}
              />
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
  );
}

/**
 * Render the end elevation profile (rotated 90° left).
 *
 * Coordinate mapping:
 *   ex(rise) → SVG X  (height above baseline goes rightward)
 *   ey(span) → SVG Y  (eave-to-eave goes downward, aligned with plan Y)
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

    // Triangle points: [span, rise]
    const pts = [
      [0, leftEaveRise],          // top eave
      [ridgeSpan, rHeight],       // ridge
      [totalSpan, rightEaveRise], // bottom eave
    ];
    const polyStr = pts.map(([s, r]) => `${ex(r)},${ey(s)}`).join(' ');

    return (
      <g>
        {/* Baseline (vertical) */}
        <line x1={ex(0)} y1={ey(0)} x2={ex(0)} y2={ey(totalSpan)}
          stroke={COLORS.overhangStroke} strokeWidth={1} strokeDasharray="4,3" />
        {/* Building width markers (horizontal dashes) */}
        <line x1={ex(-20)} y1={ey(eaveOverhang_mm)} x2={ex(rHeight * 0.3)} y2={ey(eaveOverhang_mm)}
          stroke={COLORS.footprintStroke} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={ex(-20)} y1={ey(eaveOverhang_mm + width_mm)} x2={ex(rHeight * 0.3)} y2={ey(eaveOverhang_mm + width_mm)}
          stroke={COLORS.footprintStroke} strokeWidth={1} strokeDasharray="3,3" />
        {/* Roof profile */}
        <polygon points={polyStr}
          fill={COLORS.roofFill} stroke={COLORS.roofStroke} strokeWidth={2} />
        {/* Ridge mark */}
        <circle cx={ex(rHeight)} cy={ey(ridgeSpan)} r={3} fill={COLORS.ridge} />
        {/* Pitch label */}
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
        {/* Baseline */}
        <line x1={ex(0)} y1={ey(0)} x2={ex(0)} y2={ey(totalSpan)}
          stroke={COLORS.overhangStroke} strokeWidth={1} strokeDasharray="4,3" />
        {/* Building width markers */}
        <line x1={ex(-20)} y1={ey(eaveOverhang_mm)} x2={ex(highRise * 0.5)} y2={ey(eaveOverhang_mm)}
          stroke={COLORS.footprintStroke} strokeWidth={1} strokeDasharray="3,3" />
        <line x1={ex(-20)} y1={ey(eaveOverhang_mm + width_mm)} x2={ex(highRise * 0.8)} y2={ey(eaveOverhang_mm + width_mm)}
          stroke={COLORS.footprintStroke} strokeWidth={1} strokeDasharray="3,3" />
        {/* Top surface slope */}
        <line x1={ex(lowEaveRise)} y1={ey(0)} x2={ex(highEaveRise)} y2={ey(totalSpan)}
          stroke={COLORS.roofStroke} strokeWidth={3} />
        {/* Bottom surface (offset by thickness in X) */}
        <line x1={ex(lowEaveRise) - thickness} y1={ey(0)} x2={ex(highEaveRise) - thickness} y2={ey(totalSpan)}
          stroke={COLORS.roofStroke} strokeWidth={1} strokeDasharray="4,3" />
        {/* End caps */}
        <line x1={ex(lowEaveRise)} y1={ey(0)} x2={ex(lowEaveRise) - thickness} y2={ey(0)}
          stroke={COLORS.roofStroke} strokeWidth={2} />
        <line x1={ex(highEaveRise)} y1={ey(totalSpan)} x2={ex(highEaveRise) - thickness} y2={ey(totalSpan)}
          stroke={COLORS.roofStroke} strokeWidth={2} />
        {/* Pitch label */}
        <text x={ex((lowEaveRise + highEaveRise) / 2) + 8} y={ey(totalSpan / 2)}
          textAnchor="start" fontSize={10} fontWeight={600} fill={NEUTRAL.text}>
          {pitch_deg}°
        </text>
      </g>
    );
  }

  // Flat: horizontal slab (drawn as vertical strip in rotated view)
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
