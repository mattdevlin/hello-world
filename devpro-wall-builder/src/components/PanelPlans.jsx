import { WINDOW_OVERHANG, PANEL_GAP, COLORS, OPENING_TYPES } from '../utils/constants.js';

const PLAN_MARGIN = { top: 58, right: 50, bottom: 30, left: 50 };
const PLAN_MAX_H = 340;
const DIM_OFFSET = 14;
const DIM_FONT = 10;
const LABEL_FONT = 12;

/**
 * Compute the profile vertices for an L-cut panel plan view.
 * Origin is bottom-left of bounding box. Y increases upward.
 */
function computeLcutProfile(panel) {
  const H = panel.height;
  const ovh = WINDOW_OVERHANG;
  const gap = PANEL_GAP;
  const isLeft = panel.side === 'left';
  const isWindow = panel.openingType === OPENING_TYPES.WINDOW;
  // Step positions include 5mm gap: sill step is 5mm above footer, lintel step is 5mm below lintel
  const sill = panel.openBottom + gap;
  const lintelStep = panel.openTop - gap;

  if (isLeft) {
    const base = panel.openLeft - panel.x;
    const totalW = base + ovh;

    if (isWindow && sill > 0) {
      // 8-vertex: base width at lintel (top) and footer (bottom), wider at window zone
      const verts = [
        { x: 0, y: H },
        { x: base, y: H },
        { x: base, y: lintelStep },
        { x: totalW, y: lintelStep },
        { x: totalW, y: sill },
        { x: base, y: sill },
        { x: base, y: 0 },
        { x: 0, y: 0 },
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    } else {
      // 6-vertex door L-cut: base width at lintel, wider below
      const verts = [
        { x: 0, y: H },
        { x: base, y: H },
        { x: base, y: lintelStep },
        { x: totalW, y: lintelStep },
        { x: totalW, y: 0 },
        { x: 0, y: 0 },
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    }
  } else {
    const base = (panel.x + panel.width) - panel.openRight;
    const totalW = base + ovh;

    if (isWindow && sill > 0) {
      // 8-vertex: base width at lintel (top) and footer (bottom), wider at window zone
      const verts = [
        { x: ovh, y: H },
        { x: totalW, y: H },
        { x: totalW, y: 0 },
        { x: ovh, y: 0 },
        { x: ovh, y: sill },
        { x: 0, y: sill },
        { x: 0, y: lintelStep },
        { x: ovh, y: lintelStep },
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    } else {
      // 6-vertex door L-cut: base width at lintel, wider below
      const verts = [
        { x: ovh, y: H },
        { x: totalW, y: H },
        { x: totalW, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: lintelStep },
        { x: ovh, y: lintelStep },
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    }
  }
}

/**
 * Render dimension labels for a set of vertices.
 */
function buildDimLabels(vertices, profileWidth, profileHeight, scale, drawH, tx) {
  const dims = [];
  const minX = Math.min(...vertices.map(v => v.x));
  const maxX = Math.max(...vertices.map(v => v.x));

  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const pa = tx(a);
    const pb = tx(b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.round(Math.sqrt(dx * dx + dy * dy));
    if (len === 0) continue;

    const mx = (pa.x + pb.x) / 2;
    const my = (pa.y + pb.y) / 2;

    if (Math.abs(dy) < 0.1) {
      const isTop = a.y === profileHeight;
      const isBottom = a.y === 0;
      let yOff;
      if (isTop) yOff = -DIM_OFFSET;
      else if (isBottom) yOff = DIM_OFFSET + 4;
      else {
        const inTopHalf = my < PLAN_MARGIN.top + drawH / 2;
        yOff = inTopHalf ? -DIM_OFFSET + 2 : DIM_OFFSET + 2;
      }
      dims.push(
        <text key={`dim-${i}`} x={mx} y={my + yOff} textAnchor="middle" fontSize={DIM_FONT} fill="#333">
          {len}
        </text>
      );
    } else if (Math.abs(dx) < 0.1) {
      const isOuterLeft = a.x === minX;
      const isOuterRight = a.x === maxX;
      let xOff;
      if (isOuterLeft) xOff = -DIM_OFFSET;
      else if (isOuterRight) xOff = DIM_OFFSET;
      else xOff = a.x < (minX + maxX) / 2 ? -DIM_OFFSET : DIM_OFFSET;
      dims.push(
        <text
          key={`dim-${i}`}
          x={mx + xOff}
          y={my + 3}
          textAnchor="middle"
          fontSize={DIM_FONT}
          fill="#333"
          transform={`rotate(-90, ${mx + xOff}, ${my + 3})`}
        >
          {len}
        </text>
      );
    }
  }
  return dims;
}

/**
 * Shared SVG card renderer for any profile shape.
 */
function ProfileCard({ vertices, profileWidth, profileHeight, fill, title, subtitle }) {
  const availW = 220;
  const availH = PLAN_MAX_H - PLAN_MARGIN.top - PLAN_MARGIN.bottom;
  const sx = availW / profileWidth;
  const sy = availH / profileHeight;
  const scale = Math.min(sx, sy);

  const drawW = profileWidth * scale;
  const drawH = profileHeight * scale;
  const svgW = drawW + PLAN_MARGIN.left + PLAN_MARGIN.right;
  const svgH = drawH + PLAN_MARGIN.top + PLAN_MARGIN.bottom;

  const tx = (pt) => ({
    x: PLAN_MARGIN.left + pt.x * scale,
    y: PLAN_MARGIN.top + (profileHeight - pt.y) * scale,
  });

  const points = vertices.map(tx);
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';
  const dims = buildDimLabels(vertices, profileWidth, profileHeight, scale, drawH, tx);

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
        <path d={pathD} fill={fill} fillOpacity={0.15} stroke={fill} strokeWidth={2} />
        {dims}
      </svg>
    </div>
  );
}

/**
 * L-cut panel plan card.
 */
function LcutPlanCard({ panel }) {
  const profile = computeLcutProfile(panel);
  const panelLabel = `P${panel.index + 1}`;
  const sideLabel = panel.side === 'left' ? 'left' : 'right';
  return (
    <ProfileCard
      {...profile}
      fill={COLORS.LCUT}
      title={`${panelLabel} — L-Cut (${sideLabel})`}
      subtitle={`${panel.openingRefs.join(', ')} | ${panel.openingType}`}
    />
  );
}

/**
 * Lintel plan card — simple rectangle.
 */
function LintelPlanCard({ lintel }) {
  const W = lintel.width;
  const H = lintel.height;
  const verts = [
    { x: 0, y: H },
    { x: W, y: H },
    { x: W, y: 0 },
    { x: 0, y: 0 },
  ];
  return (
    <ProfileCard
      vertices={verts}
      profileWidth={W}
      profileHeight={H}
      fill={COLORS.LINTEL}
      title={`${lintel.ref} — Lintel`}
    />
  );
}

/**
 * Footer plan card — simple rectangle.
 */
function FooterPlanCard({ footer }) {
  const W = footer.width;
  const H = footer.height;
  const verts = [
    { x: 0, y: H },
    { x: W, y: H },
    { x: W, y: 0 },
    { x: 0, y: 0 },
  ];
  return (
    <ProfileCard
      vertices={verts}
      profileWidth={W}
      profileHeight={H}
      fill={COLORS.FOOTER}
      title={`${footer.ref} — Footer`}
    />
  );
}

/**
 * End panel plan card — simple rectangle (cut from stock).
 */
function EndPanelCard({ panel }) {
  const W = panel.width;
  const H = panel.height;
  const verts = [
    { x: 0, y: H },
    { x: W, y: H },
    { x: W, y: 0 },
    { x: 0, y: 0 },
  ];
  return (
    <ProfileCard
      vertices={verts}
      profileWidth={W}
      profileHeight={H}
      fill={COLORS.END_CAP}
      title={`P${panel.index + 1} — End`}
    />
  );
}

/**
 * Deduction end-wall piece — simple rectangle.
 */
function DeductionCard({ side, width, height }) {
  const verts = [
    { x: 0, y: height },
    { x: width, y: height },
    { x: width, y: 0 },
    { x: 0, y: 0 },
  ];
  return (
    <ProfileCard
      vertices={verts}
      profileWidth={width}
      profileHeight={height}
      fill={COLORS.PANEL}
      title={`End Wall (${side})`}
    />
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

export default function PanelPlans({ layout }) {
  if (!layout) return null;

  const lcutPanels = layout.panels.filter(p => p.type === 'lcut');
  const endPanels = layout.panels.filter(p => p.type === 'end');
  const lintels = layout.lintels || [];
  const footers = layout.footers || [];
  const dedLeft = layout.deductionLeft || 0;
  const dedRight = layout.deductionRight || 0;
  const wallH = layout.height;

  const hasContent = lcutPanels.length || endPanels.length || lintels.length
    || footers.length || dedLeft > 0 || dedRight > 0;
  if (!hasContent) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #ddd', padding: 16, marginTop: 16 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#333' }}>
        CNC Panel Plans
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {dedLeft > 0 && (
          <DeductionCard side="left" width={dedLeft} height={wallH} />
        )}
        {lcutPanels.map((panel, i) => (
          <LcutPlanCard key={`lcut-${i}`} panel={panel} />
        ))}
        {endPanels.map((panel, i) => (
          <EndPanelCard key={`end-${i}`} panel={panel} />
        ))}
        {dedRight > 0 && (
          <DeductionCard side="right" width={dedRight} height={wallH} />
        )}
        {lintels.map((lintel, i) => (
          <LintelPlanCard key={`lintel-${i}`} lintel={lintel} />
        ))}
        {footers.map((footer, i) => (
          <FooterPlanCard key={`footer-${i}`} footer={footer} />
        ))}
      </div>
    </div>
  );
}
