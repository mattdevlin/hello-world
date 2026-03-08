import { BOTTOM_PLATE, TOP_PLATE, PANEL_GAP } from '../utils/constants.js';

const SPLINE_WIDTH = 146;
const HALF_SPLINE = SPLINE_WIDTH / 2;
const EPS_INSET = 10;

const PLAN_MARGIN = { top: 50, right: 50, bottom: 30, left: 50 };
const PLAN_MAX_H = 340;
const DIM_OFFSET = 14;
const DIM_FONT = 10;
const LABEL_FONT = 12;

const EPS_FILL = '#B3D9FF';
const EPS_STROKE = '#4A90D9';

function RectCard({ width, height, title, subtitle }) {
  const availW = 220;
  const availH = PLAN_MAX_H - PLAN_MARGIN.top - PLAN_MARGIN.bottom;
  const sx = availW / width;
  const sy = availH / height;
  const scale = Math.min(sx, sy);

  const drawW = width * scale;
  const drawH = height * scale;
  const svgW = drawW + PLAN_MARGIN.left + PLAN_MARGIN.right;
  const svgH = drawH + PLAN_MARGIN.top + PLAN_MARGIN.bottom;

  const rx = PLAN_MARGIN.left;
  const ry = PLAN_MARGIN.top;

  return (
    <div style={cardStyle}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block' }}>
        <text x={svgW / 2} y={16} textAnchor="middle" fontSize={LABEL_FONT} fontWeight="bold" fill="#333">
          {title}
        </text>
        {subtitle && (
          <text x={svgW / 2} y={30} textAnchor="middle" fontSize={9} fill="#666">
            {subtitle}
          </text>
        )}
        <rect
          x={rx} y={ry}
          width={drawW} height={drawH}
          fill={EPS_FILL} fillOpacity={0.25}
          stroke={EPS_STROKE} strokeWidth={2}
        />
        {/* Top dimension */}
        <text x={rx + drawW / 2} y={ry - DIM_OFFSET} textAnchor="middle" fontSize={DIM_FONT} fill="#333">
          {Math.round(width)}
        </text>
        {/* Bottom dimension */}
        <text x={rx + drawW / 2} y={ry + drawH + DIM_OFFSET + 4} textAnchor="middle" fontSize={DIM_FONT} fill="#333">
          {Math.round(width)}
        </text>
        {/* Left dimension */}
        <text
          x={rx - DIM_OFFSET} y={ry + drawH / 2 + 3}
          textAnchor="middle" fontSize={DIM_FONT} fill="#333"
          transform={`rotate(-90, ${rx - DIM_OFFSET}, ${ry + drawH / 2 + 3})`}
        >
          {Math.round(height)}
        </text>
        {/* Right dimension */}
        <text
          x={rx + drawW + DIM_OFFSET} y={ry + drawH / 2 + 3}
          textAnchor="middle" fontSize={DIM_FONT} fill="#333"
          transform={`rotate(-90, ${rx + drawW + DIM_OFFSET}, ${ry + drawH / 2 + 3})`}
        >
          {Math.round(height)}
        </text>
      </svg>
    </div>
  );
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 6,
  display: 'inline-block',
  verticalAlign: 'top',
  margin: 6,
};

export default function EpsCutPlans({ layout }) {
  if (!layout) return null;

  const { height, panels, openings, footers, lintels, deductionLeft, deductionRight } = layout;

  // EPS vertical bounds (same as EpsElevation)
  const epsTop = TOP_PLATE * 2 + EPS_INSET;
  const epsBottom = height - BOTTOM_PLATE - EPS_INSET;
  const epsHeight = epsBottom - epsTop;
  if (epsHeight <= 0) return null;

  // ── Build exclusion zones (same logic as EpsElevation) ──
  const exclusions = [];

  if (deductionLeft > 0) {
    exclusions.push([deductionLeft, deductionLeft + BOTTOM_PLATE]);
  }
  if (deductionRight > 0) {
    exclusions.push([layout.grossLength - deductionRight - BOTTOM_PLATE, layout.grossLength - deductionRight]);
  }

  for (let i = 0; i < panels.length - 1; i++) {
    const panel = panels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintel && !insideFooter) {
      exclusions.push([gapCentre - HALF_SPLINE, gapCentre + HALF_SPLINE]);
    }
  }

  for (const op of openings) {
    const hasSill = op.y > 0;
    exclusions.push([op.x - BOTTOM_PLATE, op.x]);
    if (hasSill) {
      exclusions.push([op.x - BOTTOM_PLATE - SPLINE_WIDTH, op.x - BOTTOM_PLATE]);
    }
    exclusions.push([op.x + op.drawWidth, op.x + op.drawWidth + BOTTOM_PLATE]);
    if (hasSill) {
      exclusions.push([op.x + op.drawWidth + BOTTOM_PLATE, op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH]);
    }
    exclusions.push([op.x, op.x + op.drawWidth]);
  }

  for (const p of panels) {
    if (p.type === 'end') {
      exclusions.push([p.x + p.width - BOTTOM_PLATE, p.x + p.width]);
    }
  }

  for (const l of lintels) {
    exclusions.push([l.x, l.x + l.width]);
  }

  exclusions.sort((a, b) => a[0] - b[0]);

  const getEpsSegments = (panelLeft, panelRight) => {
    const clipped = [];
    for (const [eL, eR] of exclusions) {
      const cL = Math.max(eL, panelLeft);
      const cR = Math.min(eR, panelRight);
      if (cL < cR) clipped.push([cL, cR]);
    }
    const merged = [];
    for (const zone of clipped) {
      if (merged.length > 0 && zone[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], zone[1]);
      } else {
        merged.push([...zone]);
      }
    }
    const segs = [];
    let cursor = panelLeft + EPS_INSET;
    for (const [eL, eR] of merged) {
      const segRight = eL - EPS_INSET;
      if (cursor < segRight) segs.push([cursor, segRight]);
      cursor = eR + EPS_INSET;
    }
    const segRight = panelRight - EPS_INSET;
    if (cursor < segRight) segs.push([cursor, segRight]);
    return segs;
  };

  const getFooterEps = (f) => {
    const op = openings.find(o => o.ref === f.ref);
    if (!op) return null;
    const fEpsTop = height - op.y + BOTTOM_PLATE + EPS_INSET;
    const fEpsBot = height - BOTTOM_PLATE - EPS_INSET;
    if (fEpsBot <= fEpsTop) return null;
    const leftSplineRight = op.x - BOTTOM_PLATE;
    let fEpsLeft = f.x < leftSplineRight ? leftSplineRight + EPS_INSET : f.x + EPS_INSET;
    const rightSplineLeft = op.x + op.drawWidth + BOTTOM_PLATE;
    let fEpsRight = f.x + f.width > rightSplineLeft ? rightSplineLeft - EPS_INSET : f.x + f.width - EPS_INSET;
    if (fEpsRight <= fEpsLeft) return null;
    return { width: fEpsRight - fEpsLeft, height: fEpsBot - fEpsTop };
  };

  // ── Build list of EPS cut pieces ──
  const pieces = [];

  panels.forEach((panel) => {
    const segments = getEpsSegments(panel.x, panel.x + panel.width);
    segments.forEach((seg, j) => {
      const w = Math.round(seg[1] - seg[0]);
      if (w > 0) {
        const label = segments.length > 1
          ? `P${panel.index + 1} (${String.fromCharCode(97 + j)})`
          : `P${panel.index + 1}`;
        pieces.push({ label, width: w, height: epsHeight });
      }
    });
  });

  footers.forEach((f) => {
    const fEps = getFooterEps(f);
    if (fEps) {
      pieces.push({ label: `Footer ${f.ref}`, width: Math.round(fEps.width), height: Math.round(fEps.height) });
    }
  });

  if (pieces.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #ddd', padding: 16, marginTop: 16 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#333' }}>
        EPS Cut Plans
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {pieces.map((piece, i) => (
          <RectCard
            key={`eps-cut-${i}`}
            width={piece.width}
            height={piece.height}
            title={piece.label}
            subtitle={`${piece.width} × ${piece.height} mm`}
          />
        ))}
      </div>
    </div>
  );
}
