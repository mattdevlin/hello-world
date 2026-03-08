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
const SPLINE_EPS_FILL = '#CCE6FF';
const SPLINE_EPS_STROKE = '#6AACE6';
const MAGBOARD = 10; // mm each face

export default function EpsElevation({ layout, wallName }) {
  if (!layout) return null;

  const { grossLength, height, panels, openings, footers, lintels, deductionLeft, deductionRight } = layout;

  const drawWidth = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const scale = drawWidth / grossLength;
  const svgWidth = MAX_SVG_WIDTH;
  const svgHeight = height * scale + MARGIN.top + MARGIN.bottom;

  const s = (mm) => mm * scale;

  // EPS vertical bounds
  const epsTop = TOP_PLATE * 2 + EPS_INSET;
  const epsBottom = height - BOTTOM_PLATE - EPS_INSET;
  const epsHeight = epsBottom - epsTop;

  // ── Collect all exclusion zones (x-ranges where there's no EPS) ──
  // These are all splines, plates, and openings that occupy space inside panels.

  const exclusions = []; // array of [xLeft, xRight]

  // 1. Deduction plates (45mm, inside panel zone)
  if (deductionLeft > 0) {
    exclusions.push([deductionLeft, deductionLeft + BOTTOM_PLATE]);
  }
  if (deductionRight > 0) {
    exclusions.push([grossLength - deductionRight - BOTTOM_PLATE, grossLength - deductionRight]);
  }

  // 2. Joint splines (146mm centred on 5mm gap between panels)
  for (let i = 0; i < panels.length - 1; i++) {
    const panel = panels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    // Skip if inside opening zone (same logic as framing elevation)
    const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintel && !insideFooter) {
      exclusions.push([gapCentre - HALF_SPLINE, gapCentre + HALF_SPLINE]);
    }
  }

  // 3. Opening vertical plates (45mm) + splines (146mm) on each side
  for (const op of openings) {
    const hasSill = op.y > 0;
    // Left side: 45mm plate at op.x - 45 to op.x, spline at op.x - 45 - 146 to op.x - 45
    exclusions.push([op.x - BOTTOM_PLATE, op.x]); // left vertical plate
    if (hasSill) {
      exclusions.push([op.x - BOTTOM_PLATE - SPLINE_WIDTH, op.x - BOTTOM_PLATE]); // left spline
    }
    // Right side: 45mm plate at op.x+w to op.x+w+45, spline at op.x+w+45 to op.x+w+45+146
    exclusions.push([op.x + op.drawWidth, op.x + op.drawWidth + BOTTOM_PLATE]); // right vertical plate
    if (hasSill) {
      exclusions.push([op.x + op.drawWidth + BOTTOM_PLATE, op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH]); // right spline
    }
    // The opening itself (no EPS in the opening area)
    exclusions.push([op.x, op.x + op.drawWidth]);
  }

  // 4. Vertical plates at panel outer edges (45mm)
  for (const p of panels) {
    // End panels always have a plate at their trailing edge
    if (p.type === 'end') {
      exclusions.push([p.x + p.width - BOTTOM_PLATE, p.x + p.width]);
    }
    // Any panel at the wall edge gets a plate (when no deduction on that side)
    if (deductionRight === 0 && Math.abs(p.x + p.width - grossLength) < 1) {
      exclusions.push([grossLength - BOTTOM_PLATE, grossLength]);
    }
    if (deductionLeft === 0 && Math.abs(p.x) < 1) {
      exclusions.push([0, BOTTOM_PLATE]);
    }
  }

  // 5. Lintel areas (no EPS — timber lintels)
  for (const l of lintels) {
    exclusions.push([l.x, l.x + l.width]);
  }

  // Sort exclusions by start
  exclusions.sort((a, b) => a[0] - b[0]);

  // For a given panel x-range, find EPS segments (gaps between exclusions)
  const getEpsSegments = (panelLeft, panelRight) => {
    // Clip exclusions to panel range and merge overlapping
    const clipped = [];
    for (const [eL, eR] of exclusions) {
      const cL = Math.max(eL, panelLeft);
      const cR = Math.min(eR, panelRight);
      if (cL < cR) clipped.push([cL, cR]);
    }
    // Merge overlapping
    const merged = [];
    for (const zone of clipped) {
      if (merged.length > 0 && zone[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], zone[1]);
      } else {
        merged.push([...zone]);
      }
    }

    // Build segments between exclusions (with EPS_INSET from each boundary)
    const segs = [];
    let cursor = panelLeft + EPS_INSET; // inset from panel left edge

    for (const [eL, eR] of merged) {
      const segRight = eL - EPS_INSET;
      if (cursor < segRight) {
        segs.push([cursor, segRight]);
      }
      cursor = eR + EPS_INSET;
    }

    // Final segment to panel right edge
    const segRight = panelRight - EPS_INSET;
    if (cursor < segRight) {
      segs.push([cursor, segRight]);
    }

    return segs;
  };

  // Footer EPS calculation — inset 10mm from splines it butts up to
  const getFooterEps = (f) => {
    const op = openings.find(o => o.ref === f.ref);
    if (!op) return null;

    const fEpsTop = height - op.y + BOTTOM_PLATE + EPS_INSET;
    const fEpsBot = height - BOTTOM_PLATE - EPS_INSET;
    if (fEpsBot <= fEpsTop) return null;

    // Left edge: check if footer butts up to left opening spline
    const leftSplineRight = op.x - BOTTOM_PLATE; // right edge of left spline area (plate + spline)
    let fEpsLeft;
    if (f.x < leftSplineRight) {
      // Footer extends under the left spline — inset from spline right edge
      fEpsLeft = leftSplineRight + EPS_INSET;
    } else {
      fEpsLeft = f.x + EPS_INSET;
    }

    // Right edge: check if footer butts up to right opening spline
    const rightSplineLeft = op.x + op.drawWidth + BOTTOM_PLATE; // left edge of right spline area
    let fEpsRight;
    if (f.x + f.width > rightSplineLeft) {
      // Footer extends under the right spline — inset from spline left edge
      fEpsRight = rightSplineLeft - EPS_INSET;
    } else {
      fEpsRight = f.x + f.width - EPS_INSET;
    }

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
            const segments = getEpsSegments(panel.x, panel.x + panel.width);

            // Build exclusion zones for vertical edges (skip lintels/footers)
            const getVertExclusions = (xEdge) => {
              const zones = [];
              for (const l of lintels) {
                if (l.x < xEdge && xEdge < l.x + l.width) {
                  const yTop = height - l.y - l.height;
                  const yBot = height - l.y;
                  zones.push([yTop, yBot]);
                }
              }
              for (const f of footers) {
                if (f.x < xEdge && xEdge < f.x + f.width) {
                  zones.push([height - f.height, height]);
                }
              }
              zones.sort((a, b) => a[0] - b[0]);
              return zones;
            };

            const vertSegments = (xEdge) => {
              const excl = getVertExclusions(xEdge);
              const segs = [];
              let cursor = 0;
              for (const [eTop, eBot] of excl) {
                if (cursor < eTop) segs.push([cursor, eTop]);
                cursor = Math.max(cursor, eBot);
              }
              if (cursor < height) segs.push([cursor, height]);
              return segs;
            };

            const leftX = panel.x;
            const rightX = panel.x + panel.width;
            const leftSegs = vertSegments(leftX);
            const rightSegs = vertSegments(rightX);

            return (
              <g key={`panel-${i}`}>
                {/* Panel outline — horizontal top & bottom */}
                <line x1={s(leftX)} y1={0} x2={s(rightX)} y2={0} stroke={STROKE_COLOR} strokeWidth={1} />
                <line x1={s(leftX)} y1={s(height)} x2={s(rightX)} y2={s(height)} stroke={STROKE_COLOR} strokeWidth={1} />
                {/* Left vertical segments (skip lintels/footers) */}
                {leftSegs.map(([y1, y2], j) => (
                  <line key={`l-${j}`} x1={s(leftX)} y1={s(y1)} x2={s(leftX)} y2={s(y2)} stroke={STROKE_COLOR} strokeWidth={1} />
                ))}
                {/* Right vertical segments (skip lintels/footers) */}
                {rightSegs.map(([y1, y2], j) => (
                  <line key={`r-${j}`} x1={s(rightX)} y1={s(y1)} x2={s(rightX)} y2={s(y2)} stroke={STROKE_COLOR} strokeWidth={1} />
                ))}
                {/* EPS core segments */}
                {segments.map(([segL, segR], j) => {
                  const w = segR - segL;
                  return w > 0 && epsHeight > 0 ? (
                    <rect
                      key={`eps-${j}`}
                      x={s(segL)} y={s(epsTop)}
                      width={s(w)} height={s(epsHeight)}
                      fill={EPS_FILL} stroke={EPS_STROKE} strokeWidth={1}
                    />
                  ) : null;
                })}
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

          {/* ── Spline EPS (120mm EPS inside 146mm splines) ── */}
          {(() => {
            const splineTop = TOP_PLATE * 2 + 10; // 10mm short of lowest top plate
            const splineH = height - BOTTOM_PLATE - TOP_PLATE * 2 - 10;
            const splineEpsX = MAGBOARD; // 10mm magboard inset from each edge in width
            const splineEpsW = SPLINE_WIDTH - MAGBOARD * 2; // 126mm EPS width in elevation
            const splines = [];

            // Joint splines
            for (let i = 0; i < panels.length - 1; i++) {
              const panel = panels[i];
              const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
              const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
              const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
              if (!insideLintel && !insideFooter) {
                splines.push({ x: gapCentre - HALF_SPLINE, label: `Joint P${panels[i].index + 1}/P${panels[i + 1].index + 1}` });
              }
            }

            // Opening splines (only for windows with sills)
            for (const op of openings) {
              const hasSill = op.y > 0;
              if (hasSill) {
                splines.push({ x: op.x - BOTTOM_PLATE - SPLINE_WIDTH, label: `${op.ref} L` });
                splines.push({ x: op.x + op.drawWidth + BOTTOM_PLATE, label: `${op.ref} R` });
              }
            }

            return splines.map((sp, i) => (
              <rect
                key={`spline-eps-${i}`}
                x={s(sp.x + splineEpsX)} y={s(splineTop)}
                width={s(splineEpsW)} height={s(splineH)}
                fill={SPLINE_EPS_FILL} stroke={SPLINE_EPS_STROKE} strokeWidth={1}
              />
            ));
          })()}

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
