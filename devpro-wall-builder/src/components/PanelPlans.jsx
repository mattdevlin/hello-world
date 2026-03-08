import { WINDOW_OVERHANG, PANEL_GAP, COLORS, OPENING_TYPES } from '../utils/constants.js';

const PLAN_MARGIN = { top: 40, right: 50, bottom: 30, left: 50 };
const PLAN_MAX_H = 320;
const DIM_OFFSET = 18;
const DIM_FONT = 10;
const LABEL_FONT = 12;

/**
 * Compute the profile vertices for a panel plan view.
 * Origin is bottom-left of bounding box. Y increases upward.
 *
 * Returns { vertices, width, height, edges }
 *   vertices: [{x,y}] clockwise from top-left
 *   edges: [{from,to,length,dir}] for dimension labelling
 */
function computeProfile(panel) {
  const H = panel.height;
  const W = panel.width;

  if (panel.type !== 'lcut') {
    // Simple rectangle
    const verts = [
      { x: 0, y: H },
      { x: W, y: H },
      { x: W, y: 0 },
      { x: 0, y: 0 },
    ];
    return { vertices: verts, profileWidth: W, profileHeight: H };
  }

  // L-cut panel
  // The lintel/footer zones are NOTCHED at base width (separate lintel/footer pieces sit there).
  // The opening zone has a TAB extending into the opening by ovh (to frame the window/door).
  const ovh = WINDOW_OVERHANG;
  const isLeft = panel.side === 'left';
  const isWindow = panel.openingType === OPENING_TYPES.WINDOW;
  const sill = panel.openBottom;         // sill height (includes 5mm gap)
  const openTop = panel.openTop;         // top of opening
  const lintelDepth = H - openTop;       // from top of wall to top of opening

  if (isLeft) {
    // Base is on the left, tab extends right into opening
    const base = panel.openLeft - panel.x;
    const totalW = base + ovh;

    if (isWindow && sill > 0) {
      // 8-vertex: base width at lintel (top) and footer (bottom), wider at window zone
      const verts = [
        { x: 0, y: H },                    // top-left
        { x: base, y: H },                 // top-right (lintel zone, base width)
        { x: base, y: openTop },           // down through lintel zone
        { x: totalW, y: openTop },         // step RIGHT — tab into opening
        { x: totalW, y: sill },            // down through window zone (wider)
        { x: base, y: sill },              // step LEFT — back to base
        { x: base, y: 0 },                 // down through footer zone
        { x: 0, y: 0 },                    // bottom-left
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    } else {
      // 6-vertex door L-cut: base width at lintel (top), wider below (door to floor)
      const verts = [
        { x: 0, y: H },                    // top-left
        { x: base, y: H },                 // top-right (lintel zone)
        { x: base, y: openTop },           // down through lintel zone
        { x: totalW, y: openTop },         // step RIGHT — tab into opening
        { x: totalW, y: 0 },               // down to floor (door goes to floor)
        { x: 0, y: 0 },                    // bottom-left
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    }
  } else {
    // Right L-cut: base on right, tab extends left into opening
    const base = (panel.x + panel.width) - panel.openRight;
    const totalW = base + ovh;

    if (isWindow && sill > 0) {
      // 8-vertex: base width at lintel (top) and footer (bottom), wider at window zone
      const verts = [
        { x: ovh, y: H },                  // top-left (lintel zone, at ovh offset)
        { x: totalW, y: H },               // top-right
        { x: totalW, y: 0 },               // bottom-right
        { x: ovh, y: 0 },                  // bottom-left (footer zone, at ovh offset)
        { x: ovh, y: sill },               // up through footer zone
        { x: 0, y: sill },                 // step LEFT — tab into opening
        { x: 0, y: openTop },              // up through window zone (wider)
        { x: ovh, y: openTop },            // step RIGHT — back to base
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    } else {
      // 6-vertex door L-cut: base width at lintel (top), wider below (door to floor)
      const verts = [
        { x: ovh, y: H },                  // top-left (lintel zone)
        { x: totalW, y: H },               // top-right
        { x: totalW, y: 0 },               // bottom-right
        { x: 0, y: 0 },                    // bottom-left (door zone, full width)
        { x: 0, y: openTop },              // up through door zone
        { x: ovh, y: openTop },            // step RIGHT — lintel notch
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    }
  }
}

/**
 * Render a single panel plan SVG with outline and dimension labels.
 */
function PanelPlanCard({ panel }) {
  const profile = computeProfile(panel);
  const { vertices, profileWidth, profileHeight } = profile;

  // Scale to fit
  const availW = 220;
  const availH = PLAN_MAX_H - PLAN_MARGIN.top - PLAN_MARGIN.bottom;
  const sx = availW / profileWidth;
  const sy = availH / profileHeight;
  const scale = Math.min(sx, sy);

  const drawW = profileWidth * scale;
  const drawH = profileHeight * scale;
  const svgW = drawW + PLAN_MARGIN.left + PLAN_MARGIN.right;
  const svgH = drawH + PLAN_MARGIN.top + PLAN_MARGIN.bottom;

  // Transform: flip Y (SVG y goes down, our coords y goes up)
  const tx = (pt) => ({
    x: PLAN_MARGIN.left + pt.x * scale,
    y: PLAN_MARGIN.top + (profileHeight - pt.y) * scale,
  });

  const points = vertices.map(tx);
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';

  // Panel label
  const panelLabel = `P${panel.index + 1}`;
  const typeLabel = panel.type === 'full' ? 'Full' : panel.type === 'end' ? 'End' : 'L-Cut';
  let fill = COLORS.PANEL;
  if (panel.type === 'lcut') fill = COLORS.LCUT;
  else if (panel.type === 'end') fill = COLORS.END_CAP;

  // Build dimension annotations from vertices
  const dims = [];
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
      // Horizontal edge
      const isTop = a.y === profileHeight;
      const isBottom = a.y === 0;
      let yOff;
      if (isTop) yOff = -DIM_OFFSET;
      else if (isBottom) yOff = DIM_OFFSET + 4;
      else {
        // Step edge — label above or below depending on position
        const inTopHalf = my < PLAN_MARGIN.top + drawH / 2;
        yOff = inTopHalf ? -DIM_OFFSET + 2 : DIM_OFFSET + 2;
      }
      dims.push(
        <text key={`dim-${i}`} x={mx} y={my + yOff} textAnchor="middle" fontSize={DIM_FONT} fill="#333">
          {len}
        </text>
      );
    } else if (Math.abs(dx) < 0.1) {
      // Vertical edge — place label on the outside of the shape
      const minX = Math.min(...vertices.map(v => v.x));
      const maxX = Math.max(...vertices.map(v => v.x));
      const isOuterLeft = a.x === minX;
      const isOuterRight = a.x === maxX;
      let xOff;
      if (isOuterLeft) {
        xOff = -DIM_OFFSET;
      } else if (isOuterRight) {
        xOff = DIM_OFFSET;
      } else {
        // Inner vertical edge — place on the side with more space
        xOff = a.x < (minX + maxX) / 2 ? -DIM_OFFSET : DIM_OFFSET;
      }
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

  return (
    <div style={cardStyle}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block' }}>
        {/* Title */}
        <text x={svgW / 2} y={16} textAnchor="middle" fontSize={LABEL_FONT} fontWeight="bold" fill="#333">
          {panelLabel} — {typeLabel}{panel.type === 'lcut' ? ` (${panel.side})` : ''}
        </text>
        {panel.type === 'lcut' && (
          <text x={svgW / 2} y={30} textAnchor="middle" fontSize={9} fill="#666">
            {panel.openingRefs.join(', ')} | {panel.openingType}
          </text>
        )}

        {/* Panel shape */}
        <path d={pathD} fill={fill} fillOpacity={0.15} stroke={fill} strokeWidth={2} />

        {/* Dimension labels */}
        {dims}
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

export default function PanelPlans({ layout }) {
  if (!layout || !layout.panels.length) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #ddd', padding: 16, marginTop: 16 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#333' }}>
        Individual Panel Plans
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {layout.panels.map((panel, i) => (
          <PanelPlanCard key={i} panel={panel} />
        ))}
      </div>
    </div>
  );
}
