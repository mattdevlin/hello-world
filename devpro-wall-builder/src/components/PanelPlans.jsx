import { useRef } from 'react';
import { WINDOW_OVERHANG, PANEL_GAP, COLORS, OPENING_TYPES, BOTTOM_PLATE, TOP_PLATE } from '../utils/constants.js';
import PrintButton from './PrintButton.jsx';

const SPLINE_WIDTH = 146;
const HALF_SPLINE = SPLINE_WIDTH / 2;

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
  const hL = panel.heightLeft || panel.height;
  const hR = panel.heightRight || panel.height;
  const H = Math.max(hL, hR);
  const ovh = WINDOW_OVERHANG;
  const gap = PANEL_GAP;

  if (panel.side === 'pier') {
    return computePierProfile(panel);
  }

  const isLeft = panel.side === 'left';
  const isWindow = panel.openingType === OPENING_TYPES.WINDOW;
  const sill = panel.openBottom + gap;
  const lintelStep = panel.openTop - gap;

  if (isLeft) {
    const totalW = panel.width;
    const base = totalW - ovh;
    // Interpolate top edge heights
    const topAtZero = hL;
    const topAtBase = hL + (hR - hL) * (base / totalW);

    if (isWindow && sill > 0) {
      const verts = [
        { x: 0, y: topAtZero },
        { x: base, y: topAtBase },
        { x: base, y: lintelStep },
        { x: totalW, y: lintelStep },
        { x: totalW, y: sill },
        { x: base, y: sill },
        { x: base, y: 0 },
        { x: 0, y: 0 },
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    } else {
      const verts = [
        { x: 0, y: topAtZero },
        { x: base, y: topAtBase },
        { x: base, y: lintelStep },
        { x: totalW, y: lintelStep },
        { x: totalW, y: 0 },
        { x: 0, y: 0 },
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    }
  } else {
    const totalW = panel.width;
    const topAtOvh = hL + (hR - hL) * (ovh / totalW);
    const topAtTotalW = hR;

    if (isWindow && sill > 0) {
      const verts = [
        { x: ovh, y: topAtOvh },
        { x: totalW, y: topAtTotalW },
        { x: totalW, y: 0 },
        { x: ovh, y: 0 },
        { x: ovh, y: sill },
        { x: 0, y: sill },
        { x: 0, y: lintelStep },
        { x: ovh, y: lintelStep },
      ];
      return { vertices: verts, profileWidth: totalW, profileHeight: H };
    } else {
      const verts = [
        { x: ovh, y: topAtOvh },
        { x: totalW, y: topAtTotalW },
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
 * Compute profile for a pier panel — L-cuts on both sides.
 * Left side has right-L-cut (leg extends left over left opening).
 * Right side has left-L-cut (leg extends right over right opening).
 */
function computePierProfile(panel) {
  const hL = panel.heightLeft || panel.height;
  const hR = panel.heightRight || panel.height;
  const H = Math.max(hL, hR);
  const ovh = WINDOW_OVERHANG;
  const gap = PANEL_GAP;
  const totalW = panel.width;
  const base = totalW - 2 * ovh;

  // Left opening (right L-cut side)
  const lIsWindow = panel.openingType === OPENING_TYPES.WINDOW;
  const lSill = panel.openBottom + gap;
  const lLintel = panel.openTop - gap;

  // Right opening (left L-cut side)
  const rIsWindow = panel.rightOpeningType === OPENING_TYPES.WINDOW;
  const rSill = panel.rightOpenBottom + gap;
  const rLintel = panel.rightOpenTop - gap;

  // Build vertices clockwise from top-left of the base.
  // Left leg (x=0..ovh), base (x=ovh..ovh+base), right leg (x=ovh+base..totalW).
  // Legs only reach up to their respective lintel heights, not full H.
  const verts = [];

  // ── Top of base, then step down to right leg ──
  const topAtOvh = hL + (hR - hL) * (ovh / totalW);
  const topAtOvhBase = hL + (hR - hL) * ((ovh + base) / totalW);
  verts.push({ x: ovh, y: topAtOvh });
  verts.push({ x: ovh + base, y: topAtOvhBase });
  verts.push({ x: ovh + base, y: rLintel });

  // ── Right leg: descend with right opening cutout ──
  if (rIsWindow && rSill > 0) {
    verts.push({ x: totalW, y: rLintel });
    verts.push({ x: totalW, y: rSill });
    verts.push({ x: ovh + base, y: rSill });
    verts.push({ x: ovh + base, y: 0 });
  } else {
    verts.push({ x: totalW, y: rLintel });
    verts.push({ x: totalW, y: 0 });
  }

  // ── Bottom edge (right to left) ──
  verts.push({ x: ovh, y: 0 });

  // ── Left leg: ascend with left opening cutout ──
  if (lIsWindow && lSill > 0) {
    verts.push({ x: ovh, y: lSill });
    verts.push({ x: 0, y: lSill });
    verts.push({ x: 0, y: lLintel });
    verts.push({ x: ovh, y: lLintel });
  } else {
    verts.push({ x: ovh, y: lLintel });
    verts.push({ x: 0, y: lLintel });
    verts.push({ x: ovh, y: lLintel });
  }

  return { vertices: verts, profileWidth: totalW, profileHeight: H };
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
function ProfileCard({ vertices, profileWidth, profileHeight, fill, title, subtitle, qty, courseLineY }) {
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
        {courseLineY != null && courseLineY > 0 && courseLineY < profileHeight && (() => {
          const ly = PLAN_MARGIN.top + (profileHeight - courseLineY) * scale;
          return (
            <line
              x1={PLAN_MARGIN.left} y1={ly}
              x2={PLAN_MARGIN.left + drawW} y2={ly}
              stroke="#E74C3C" strokeWidth={1.5} strokeDasharray="6,3"
            />
          );
        })()}
        {qty > 1 && (
          <>
            <rect x={svgW - 36} y={4} width={32} height={18} rx={9} fill={fill} fillOpacity={0.85} />
            <text x={svgW - 20} y={16} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#fff">
              ×{qty}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * L-cut panel plan card.
 */
function LcutPlanCard({ panel, courseLineY }) {
  const profile = computeLcutProfile(panel);
  const panelLabel = `P${panel.index + 1}`;
  const isPier = panel.side === 'pier';
  const sideLabel = isPier ? 'pier' : panel.side === 'left' ? 'left' : 'right';
  const openingInfo = `${panel.openingRefs.join(', ')} | ${isPier ? 'pier' : panel.openingType}`;
  const sheetInfo = panel.sheetHeight ? ` | ${panel.sheetHeight}mm sheet` : '';
  return (
    <ProfileCard
      {...profile}
      fill={COLORS.LCUT}
      title={`${panelLabel} — ${isPier ? 'Pier' : 'L-Cut'} (${sideLabel})`}
      subtitle={`${openingInfo}${sheetInfo}`}
      qty={2}
      courseLineY={courseLineY}
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
      qty={2}
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
      qty={2}
    />
  );
}

/**
 * End panel plan card — rectangle or trapezoid for raked.
 */
function EndPanelCard({ panel, courseLineY }) {
  const W = panel.width;
  const hL = panel.heightLeft || panel.height;
  const hR = panel.heightRight || panel.height;
  const maxH = Math.max(hL, hR);
  const verts = [
    { x: 0, y: hL },
    { x: W, y: hR },
    { x: W, y: 0 },
    { x: 0, y: 0 },
  ];
  const heightInfo = hL !== hR ? `${hL}mm → ${hR}mm` : undefined;
  const sheetInfo = panel.sheetHeight ? `${panel.sheetHeight}mm sheet` : undefined;
  const subtitle = [heightInfo, sheetInfo].filter(Boolean).join(' | ');
  return (
    <ProfileCard
      vertices={verts}
      profileWidth={W}
      profileHeight={maxH}
      fill={COLORS.END_CAP}
      title={`P${panel.index + 1} — End`}
      subtitle={subtitle || undefined}
      qty={2}
      courseLineY={courseLineY}
    />
  );
}

/**
 * Full panel plan card — rectangle or trapezoid for raked.
 * Only shown when raked (standard full panels are stock sheets).
 */
function FullPanelCard({ panel, courseLineY }) {
  const W = panel.width;
  const hL = panel.heightLeft || panel.height;
  const hR = panel.heightRight || panel.height;
  const maxH = Math.max(hL, hR);
  const verts = [
    { x: 0, y: hL },
    { x: W, y: hR },
    { x: W, y: 0 },
    { x: 0, y: 0 },
  ];
  const heightInfo = `${hL}mm → ${hR}mm`;
  const sheetInfo = panel.sheetHeight ? `${panel.sheetHeight}mm sheet` : '';
  return (
    <ProfileCard
      vertices={verts}
      profileWidth={W}
      profileHeight={maxH}
      fill={COLORS.PANEL}
      title={`P${panel.index + 1} — Full (raked)`}
      subtitle={sheetInfo ? `${heightInfo} | ${sheetInfo}` : heightInfo}
      qty={2}
      courseLineY={courseLineY}
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
      qty={2}
    />
  );
}

/**
 * Wall spline magboard card — simple rectangle.
 */
function SplineMagboardCard({ label, splineHeight, totalQty }) {
  const W = SPLINE_WIDTH;
  const H = splineHeight;
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
      fill="#7FB3D8"
      title={label}
      subtitle={`${W} × ${H} mm`}
      qty={totalQty}
    />
  );
}

/**
 * Top course panel card — rectangle cut from sheet for upper course.
 */
function TopCourseCard({ panel, courseHeight, sheetHeight }) {
  const W = panel.width;
  const H = courseHeight;
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
      fill="#E74C3C"
      title={`P${panel.index + 1} — Top Course`}
      subtitle={`${W} × ${H}mm (from ${sheetHeight}mm sheet)`}
      qty={2}
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

export default function PanelPlans({ layout, wallName }) {
  const sectionRef = useRef(null);
  if (!layout) return null;

  const panels = layout.panels || [];
  const isRaked = layout.isRaked;
  const isMultiCourse = layout.isMultiCourse;
  const courses = layout.courses || [];
  const lcutPanels = panels.filter(p => p.type === 'lcut');
  const endPanels = panels.filter(p => p.type === 'end');
  // Raked full panels need CNC cuts (angled top), show them in plans
  const rakedFullPanels = isRaked ? panels.filter(p => p.type === 'full' && p.heightLeft !== p.heightRight) : [];
  const lintels = layout.lintels || [];
  const footers = layout.footers || [];
  const openings = layout.openings || [];
  const dedLeft = layout.deductionLeft || 0;
  const dedRight = layout.deductionRight || 0;
  const wallH = layout.height;

  // ── Wall spline magboard pieces ──
  const splineH = wallH - BOTTOM_PLATE - TOP_PLATE * 2 - 10; // 10mm short of lowest top plate
  const splinePieces = [];

  // Joint splines
  for (let i = 0; i < panels.length - 1; i++) {
    const panel = panels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintel && !insideFooter) {
      splinePieces.push({ label: `Spline P${panels[i].index + 1}/P${panels[i + 1].index + 1}` });
    }
  }

  // Opening splines (only for windows with sills)
  for (const op of openings) {
    if (op.y > 0) {
      splinePieces.push({ label: `Spline ${op.ref} L` });
      splinePieces.push({ label: `Spline ${op.ref} R` });
    }
  }

  // For multi-course walls, collect panels that individually need multi-course cuts
  const topCoursePanels = panels.filter(p => p.isMultiCourse);
  const upperCourses = courses.length > 1 ? courses.slice(1) : [];

  const hasContent = lcutPanels.length || endPanels.length || rakedFullPanels.length
    || lintels.length || footers.length || dedLeft > 0 || dedRight > 0 || splinePieces.length
    || topCoursePanels.length;
  if (!hasContent) return null;

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, border: '1px solid #ddd', padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#333' }}>
          CNC Panel Plans {wallName && `— ${wallName}`}
          {isMultiCourse && ` (${courses.length} courses)`}
        </h3>
        <PrintButton sectionRef={sectionRef} label="Panel Plans" />
      </div>

      {isMultiCourse && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#FFF5F5', border: '1px solid #FDD', borderRadius: 4, fontSize: 13 }}>
          <strong style={{ color: '#E74C3C' }}>Multi-course wall:</strong>{' '}
          {(() => {
            const on2745 = panels.filter(p => !p.isMultiCourse && p.sheetHeight === 2745).length;
            const on3050 = panels.filter(p => !p.isMultiCourse && p.sheetHeight === 3050).length;
            const multiCount = topCoursePanels.length;
            const parts = [];
            if (on2745 > 0) parts.push(`${on2745} panel${on2745 !== 1 ? 's' : ''} on 2745mm sheets`);
            if (on3050 > 0) parts.push(`${on3050} panel${on3050 !== 1 ? 's' : ''} on 3050mm sheets`);
            if (multiCount > 0) parts.push(`${multiCount} panel${multiCount !== 1 ? 's' : ''} split at ${courses[1]?.y}mm (2 courses)`);
            return parts.join(', ');
          })()}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {dedLeft > 0 && (
          <DeductionCard side="left" width={dedLeft} height={wallH} />
        )}
        {rakedFullPanels.map((panel, i) => (
          <FullPanelCard key={`full-raked-${i}`} panel={panel} courseLineY={panel.isMultiCourse ? courses[1]?.y : undefined} />
        ))}
        {lcutPanels.map((panel, i) => (
          <LcutPlanCard key={`lcut-${i}`} panel={panel} courseLineY={panel.isMultiCourse ? courses[1]?.y : undefined} />
        ))}
        {endPanels.map((panel, i) => (
          <EndPanelCard key={`end-${i}`} panel={panel} courseLineY={panel.isMultiCourse ? courses[1]?.y : undefined} />
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
        {splinePieces.length > 0 && (
          <SplineMagboardCard label="Splines" splineHeight={splineH} totalQty={splinePieces.length * 2} />
        )}
      </div>

      {/* Top course panels (multi-course only) */}
      {topCoursePanels.length > 0 && upperCourses.map((course, ci) => (
        <div key={`upper-course-${ci}`}>
          <h4 style={{ margin: '16px 0 8px', fontSize: 14, color: '#E74C3C' }}>
            Course {ci + 2} Panels — cut from {course.sheetHeight}mm sheets ({course.height}mm tall)
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {topCoursePanels.map((panel, i) => (
              <TopCourseCard
                key={`top-course-${ci}-${i}`}
                panel={panel}
                courseHeight={course.height}
                sheetHeight={course.sheetHeight}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
