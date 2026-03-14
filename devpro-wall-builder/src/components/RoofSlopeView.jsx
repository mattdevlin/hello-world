import { NEUTRAL } from '../utils/designTokens.js';
import { PANEL_GAP, SPLINE_WIDTH } from '../utils/constants.js';

const COLORS = {
  panel: '#B3D4F0',
  panelStroke: '#5B8DB8',
  panelLabel: '#1a1a1a',
  spline: '#A5D6A7',
  splineStroke: '#4CAF50',
  penetration: '#FFE082',
  penetrationStroke: '#F9A825',
  background: '#FAFAFA',
  outline: '#333',
};

export default function RoofSlopeView({ layout, roofName, projectName }) {
  if (!layout) return null;

  const { planeLayouts, panelDirection, penetrations } = layout;

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
        />
      ))}
    </div>
  );
}

function SlopePlane({ planeLayout, panelDirection, penetrations, roofName, projectName }) {
  const { plane, panels, splines } = planeLayout;
  const { uLength, vLength, label } = plane;

  const margin = 60;
  const maxSvgWidth = 900;
  const scale = Math.min((maxSvgWidth - 2 * margin) / uLength, (600 - 2 * margin) / vLength, 0.15);
  const svgW = uLength * scale + 2 * margin;
  const svgH = vLength * scale + 2 * margin;

  const sx = (x) => margin + x * scale;
  const sy = (y) => margin + y * scale;
  const sw = (w) => w * scale;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      width={Math.min(svgW, maxSvgWidth)}
      style={{ background: COLORS.background, border: '1px solid #e0e0e0', borderRadius: 8 }}
    >
      {/* Title */}
      <text x={svgW / 2} y={20} textAnchor="middle" fontSize={13} fontWeight={600} fill={NEUTRAL.text}>
        {projectName} — {roofName} — {label} (Unfolded)
      </text>

      {/* Plane outline */}
      <rect
        x={sx(0)} y={sy(0)}
        width={sw(uLength)} height={sw(vLength)}
        fill="none" stroke={COLORS.outline} strokeWidth={2}
      />

      {/* Panels */}
      {panels.map((panel, i) => {
        let px, py, pw, ph;
        if (panelDirection === 'along_ridge') {
          px = panel.u; py = panel.v; pw = panel.width; ph = panel.length;
        } else {
          px = panel.v; py = panel.u; pw = panel.length; ph = panel.width;
        }
        return (
          <g key={`panel-${i}`}>
            <rect
              x={sx(px)} y={sy(py)}
              width={sw(pw)} height={sw(ph)}
              fill={COLORS.panel} stroke={COLORS.panelStroke}
              strokeWidth={0.5}
            />
            {sw(pw) > 30 && sw(ph) > 12 && (
              <text
                x={sx(px + pw / 2)} y={sy(py + ph / 2) + 4}
                textAnchor="middle" fontSize={Math.min(10, sw(pw) / 4)}
                fill={COLORS.panelLabel}
              >
                P{panel.globalIndex + 1}
              </text>
            )}
          </g>
        );
      })}

      {/* Splines */}
      {splines.map((spline, i) => {
        let sx2, sy2, sw2, sh2;
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
        return (
          <rect
            key={`spline-${i}`}
            x={sx(sx2)} y={sy(sy2)}
            width={sw(sw2)} height={sw(sh2)}
            fill={COLORS.spline} stroke={COLORS.splineStroke}
            strokeWidth={0.5} opacity={0.6}
          />
        );
      })}

      {/* Penetrations */}
      {penetrations.map((pen, i) => {
        if (pen.type === 'pipe') {
          const r = (pen.diameter_mm || 100) / 2;
          return (
            <circle
              key={`pen-${i}`}
              cx={sx(pen.position_x_mm)} cy={sy(pen.position_y_mm)}
              r={sw(r)}
              fill={COLORS.penetration} stroke={COLORS.penetrationStroke} strokeWidth={1}
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

      {/* Dimensions */}
      <text x={sx(uLength / 2)} y={sy(vLength) + 16} textAnchor="middle" fontSize={11} fill={NEUTRAL.textMuted}>
        U: {Math.round(uLength)} mm
      </text>
      <text
        x={sx(uLength) + 16} y={sy(vLength / 2)}
        textAnchor="middle" fontSize={11} fill={NEUTRAL.textMuted}
        transform={`rotate(90, ${sx(uLength) + 16}, ${sy(vLength / 2)})`}
      >
        V: {Math.round(vLength)} mm
      </text>
    </svg>
  );
}
