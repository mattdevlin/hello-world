import { COLORS, WINDOW_OVERHANG, BOTTOM_PLATE, TOP_PLATE, PANEL_GAP } from '../utils/constants.js';

const SPLINE_WIDTH = 146;
const HALF_SPLINE = SPLINE_WIDTH / 2;
const EPS_INSET = 10; // mm recess from framing

const MARGIN = { top: 60, right: 40, bottom: 110, left: 60 };
const MAX_SVG_WIDTH = 1200;
const STROKE_COLOR = '#333';
const LABEL_COLOR = '#555';
const EPS_FILL = '#B3D9FF';
const EPS_STROKE = '#4A90D9';

export default function EpsElevation({ layout, wallName }) {
  if (!layout) return null;

  const { grossLength, height, panels, openings, footers, lintels, deductionLeft, deductionRight } = layout;

  const drawWidth = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const scale = drawWidth / grossLength;
  const svgWidth = MAX_SVG_WIDTH;
  const svgHeight = height * scale + MARGIN.top + MARGIN.bottom;

  const s = (mm) => mm * scale;

  // EPS vertical bounds (same for all panels)
  // Top: below lowest top plate + 10mm inset
  const epsTop = TOP_PLATE * 2 + EPS_INSET;
  // Bottom: above bottom plate + 10mm inset
  const epsBottom = height - BOTTOM_PLATE - EPS_INSET;
  const epsHeight = epsBottom - epsTop;

  // Determine left inset for each panel
  // - First panel after left deduction: 45mm deduction plate + 10mm
  // - Panel with spline on left (joint or opening): half-spline intrusion + 10mm
  // - Panel left edge at wall edge (no deduction): just 10mm
  const getLeftInset = (panel, i) => {
    // Check if adjacent to left deduction
    if (i === 0 && deductionLeft > 0 && Math.abs(panel.x - deductionLeft) < 1) {
      return BOTTOM_PLATE + EPS_INSET; // 45mm plate + 10mm
    }

    // Check if there's a joint spline on the left (previous panel gap)
    if (i > 0) {
      const prevPanel = panels[i - 1];
      const gapCentre = prevPanel.x + prevPanel.width + PANEL_GAP / 2;
      // Check if this gap has a joint spline (not inside opening zone)
      const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
      const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
      if (!insideLintel && !insideFooter) {
        // Joint spline: half-spline extends into this panel from the gap
        return HALF_SPLINE + EPS_INSET;
      }
    }

    // Check if adjacent to a window opening spline on the left
    // (opening spline butts up to 45mm plate which is at op.x - 45)
    // The spline extends from op.x - 45 - 146 to op.x - 45
    // If panel.x is near op.x - 45 - 146, the spline is inside this panel
    for (const op of openings) {
      if (op.y <= 0) continue; // skip doors
      const splineLeft = op.x - BOTTOM_PLATE - SPLINE_WIDTH;
      if (Math.abs(panel.x - splineLeft) < 5) {
        // This panel's left edge aligns with the left side of the opening spline
        // No extra inset from spline on this side
      }
      // If panel right edge is near the spline, handled in right inset
    }

    return EPS_INSET;
  };

  const getRightInset = (panel, i) => {
    // Check if adjacent to right deduction
    if (i === panels.length - 1 && deductionRight > 0 &&
        Math.abs(panel.x + panel.width - (grossLength - deductionRight)) < 1) {
      return BOTTOM_PLATE + EPS_INSET; // 45mm plate + 10mm
    }

    // Check if there's a joint spline on the right (gap after this panel)
    if (i < panels.length - 1) {
      const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
      const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
      const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
      if (!insideLintel && !insideFooter) {
        return HALF_SPLINE + EPS_INSET;
      }
    }

    return EPS_INSET;
  };

  // For footer EPS: inset 10mm from all edges
  // Footer is bounded by sill plate on top and bottom plate at base
  const getFooterEps = (f) => {
    // Find the matching opening for this footer
    const op = openings.find(o => o.ref === f.ref);
    if (!op) return null;

    // Footer sits from wall base up to sill height
    // Top: sill plate (45mm) sits at op.y from base, so footer EPS top = op.y - EPS_INSET (below sill plate)
    // Actually the sill plate top is at height - op.y in wall coords from top
    // Footer EPS: inset 10mm from footer edges
    // Footer has: x, width, height (from base)
    // The sill plate is at top of footer area (height - op.y to height - op.y + 45)
    // So EPS top is below sill plate: height - op.y + BOTTOM_PLATE + EPS_INSET...
    // Wait: the sill plate sits at the bottom of the opening (height - op.y),
    // going DOWN into the footer by 45mm. So sill plate bottom = height - op.y + BOTTOM_PLATE
    // Footer EPS top = sill plate bottom + 10mm = height - op.y + BOTTOM_PLATE + EPS_INSET

    // But actually the footer goes from base (height) up to sill (height - f.height)
    // In wall mm from top: footer top = height - f.height, footer bottom = height
    // The sill plate sits just below the opening at y = height - op.y (top of sill plate, going down 45mm)
    // So sill plate occupies: height - op.y to height - op.y + BOTTOM_PLATE (in mm from top of wall)

    // Footer EPS:
    // Top: below sill plate = height - op.y + BOTTOM_PLATE + EPS_INSET (from wall top)
    // Bottom: above bottom plate = height - BOTTOM_PLATE - EPS_INSET (from wall top)
    // Left: footer left + 10mm (or + spline if opening vertical plate/spline is there)
    // Right: footer right - 10mm

    const fEpsTop = height - op.y + BOTTOM_PLATE + EPS_INSET;
    const fEpsBot = height - BOTTOM_PLATE - EPS_INSET;
    if (fEpsBot <= fEpsTop) return null;

    const fEpsLeft = f.x + EPS_INSET;
    const fEpsRight = f.x + f.width - EPS_INSET;
    if (fEpsRight <= fEpsLeft) return null;

    return {
      x: fEpsLeft,
      y: fEpsTop,
      width: fEpsRight - fEpsLeft,
      height: fEpsBot - fEpsTop,
    };
  };

  return (
    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #ddd', marginTop: 16 }}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ display: 'block', margin: '0 auto' }}
      >
        {/* Title */}
        <text x={svgWidth / 2} y={24} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333">
          {wallName || 'Wall'} — EPS Elevation
        </text>
        <text x={svgWidth / 2} y={42} textAnchor="middle" fontSize="12" fill="#666">
          {grossLength}mm × {height}mm | EPS inset {EPS_INSET}mm from framing
        </text>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>

          {/* ── Wall outline ── */}
          <rect
            x={0} y={0}
            width={s(grossLength)} height={s(height)}
            fill="none" stroke={STROKE_COLOR} strokeWidth={1.5}
          />

          {/* ── Corner deductions ── */}
          {deductionLeft > 0 && (
            <rect
              x={0} y={0}
              width={s(deductionLeft)} height={s(height)}
              fill="none" stroke={STROKE_COLOR} strokeWidth={1}
            />
          )}
          {deductionRight > 0 && (
            <rect
              x={s(grossLength - deductionRight)} y={0}
              width={s(deductionRight)} height={s(height)}
              fill="none" stroke={STROKE_COLOR} strokeWidth={1}
            />
          )}

          {/* ── Panels with EPS cores ── */}
          {panels.map((panel, i) => {
            const leftInset = getLeftInset(panel, i);
            const rightInset = getRightInset(panel, i);

            const epsX = panel.x + leftInset;
            const epsW = panel.width - leftInset - rightInset;

            return (
              <g key={`panel-${i}`}>
                {/* Panel outline (solid) */}
                <rect
                  x={s(panel.x)} y={0}
                  width={s(panel.width)} height={s(height)}
                  fill="none" stroke={STROKE_COLOR} strokeWidth={1}
                />
                {/* EPS core */}
                {epsW > 0 && epsHeight > 0 && (
                  <rect
                    x={s(epsX)} y={s(epsTop)}
                    width={s(epsW)} height={s(epsHeight)}
                    fill={EPS_FILL} stroke={EPS_STROKE} strokeWidth={1}
                  />
                )}
                {/* Panel number */}
                <text
                  x={s(panel.x + panel.width / 2)}
                  y={s(height / 2) + 4}
                  textAnchor="middle" fontSize="10" fill={LABEL_COLOR}
                >
                  P{panel.index + 1}
                </text>
              </g>
            );
          })}

          {/* ── Openings (solid outline) ── */}
          {openings.map((op, i) => (
            <g key={`opening-${i}`}>
              <rect
                x={s(op.x)} y={s(height - op.y - op.drawHeight)}
                width={s(op.drawWidth)} height={s(op.drawHeight)}
                fill="none" stroke={STROKE_COLOR} strokeWidth={1.5}
              />
              <text
                x={s(op.x + op.drawWidth / 2)}
                y={s(height - op.y - op.drawHeight / 2) + 4}
                textAnchor="middle" fontSize="10" fill={LABEL_COLOR} fontWeight="bold"
              >
                {op.ref}
              </text>
            </g>
          ))}

          {/* ── Footer panels with EPS ── */}
          {footers.map((f, i) => {
            const fEps = getFooterEps(f);
            return (
              <g key={`footer-${i}`}>
                {/* Footer outline (solid) */}
                <rect
                  x={s(f.x)} y={s(height - f.height)}
                  width={s(f.width)} height={s(f.height)}
                  fill="none" stroke={STROKE_COLOR} strokeWidth={1}
                />
                {/* Footer EPS */}
                {fEps && (
                  <rect
                    x={s(fEps.x)} y={s(fEps.y)}
                    width={s(fEps.width)} height={s(fEps.height)}
                    fill={EPS_FILL} stroke={EPS_STROKE} strokeWidth={1}
                  />
                )}
                <text
                  x={s(f.x + f.width / 2)}
                  y={s(height - f.height / 2) + 3}
                  textAnchor="middle" fontSize="8" fill={LABEL_COLOR}
                >
                  Footer {f.ref}
                </text>
              </g>
            );
          })}

          {/* ── Lintels (solid outline, no EPS — timber by default) ── */}
          {lintels.map((l, i) => (
            <g key={`lintel-${i}`}>
              <rect
                x={s(l.x)} y={s(height - l.y - l.height)}
                width={s(l.width)} height={s(l.height)}
                fill="none" stroke={STROKE_COLOR} strokeWidth={1}
              />
              <text
                x={s(l.x + l.width / 2)}
                y={s(height - l.y - l.height / 2) + 3}
                textAnchor="middle" fontSize="8" fill={LABEL_COLOR}
              >
                Lintel {l.ref}
              </text>
            </g>
          ))}

          {/* ── Running measurement ── */}
          <g>
            {(() => {
              const points = new Set([0, grossLength]);
              if (deductionLeft > 0) points.add(deductionLeft);
              if (deductionRight > 0) points.add(grossLength - deductionRight);
              panels.forEach(p => {
                if (p.type === 'lcut') {
                  if (p.side === 'left') points.add(Math.round(p.x + p.width - WINDOW_OVERHANG));
                  else if (p.side === 'right') points.add(Math.round(p.x + p.width));
                  else points.add(Math.round(p.x + p.width - WINDOW_OVERHANG));
                } else {
                  points.add(Math.round(p.x + p.width));
                }
              });
              footers.forEach(f => points.add(Math.round(f.x + f.width)));
              const sorted = [...points].sort((a, b) => a - b);
              const tickY = s(height) + 22;
              return sorted.map((pt, j) => (
                <g key={`rm-${j}`}>
                  <line x1={s(pt)} y1={tickY - 4} x2={s(pt)} y2={tickY + 4} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <text x={s(pt)} y={tickY + 14} textAnchor="middle" fontSize="9" fill={COLORS.DIMENSION}>{pt}</text>
                </g>
              ));
            })()}
          </g>

          {/* ── Total width dimension ── */}
          <g>
            <line x1={0} y1={s(height) + 44} x2={s(grossLength)} y2={s(height) + 44} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={0} y1={s(height) + 39} x2={0} y2={s(height) + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={s(grossLength)} y1={s(height) + 39} x2={s(grossLength)} y2={s(height) + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <text x={s(grossLength / 2)} y={s(height) + 60} textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold">
              {grossLength} mm
            </text>
          </g>

          {/* ── Height dimension ── */}
          <g>
            <line x1={-20} y1={0} x2={-20} y2={s(height)} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={-25} y1={0} x2={-15} y2={0} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={-25} y1={s(height)} x2={-15} y2={s(height)} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <text x={-35} y={s(height / 2)} textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold"
              transform={`rotate(-90, -35, ${s(height / 2)})`}>
              {height} mm
            </text>
          </g>

        </g>
      </svg>
    </div>
  );
}
