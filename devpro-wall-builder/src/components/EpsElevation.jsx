import { useRef } from 'react';
import { COLORS, WINDOW_OVERHANG, BOTTOM_PLATE, TOP_PLATE, PANEL_GAP } from '../utils/constants.js';
import PrintButton from './PrintButton.jsx';

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
  const sectionRef = useRef(null);
  const clipId = useRef(`eps-clip-${Math.random().toString(36).slice(2, 8)}`).current;
  if (!layout) return null;

  const { grossLength, height, maxHeight, panels, openings, footers, lintels, deductionLeft, deductionRight, isRaked, heightAt, courses, isMultiCourse } = layout;

  const useHeight = maxHeight || height;
  const drawWidth = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const scale = drawWidth / grossLength;
  const svgWidth = MAX_SVG_WIDTH;
  const svgHeight = useHeight * scale + MARGIN.top + MARGIN.bottom;

  const s = (mm) => mm * scale;
  const yTopAt = (x) => useHeight - (heightAt ? heightAt(x) : height);
  const yBottom = useHeight;

  // EPS vertical bounds (for standard walls)
  const epsTop = TOP_PLATE * 2 + EPS_INSET;
  const epsBottom_std = height - BOTTOM_PLATE - EPS_INSET;
  const epsHeight = epsBottom_std - epsTop;

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

    const fEpsTop = yBottom - op.y + BOTTOM_PLATE + EPS_INSET;
    const fEpsBot = yBottom - BOTTOM_PLATE - EPS_INSET;
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
    <div ref={sectionRef} data-print-section style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #ddd', marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px 0' }}>
        <PrintButton sectionRef={sectionRef} label="EPS" />
      </div>
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
          {grossLength}mm × {height}mm{isRaked ? ` (max ${useHeight}mm)` : ''} | EPS inset {EPS_INSET}mm from framing
        </text>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>

          {/* ── Wall outline & clip path (polygon for raked/gable) ── */}
          {(() => {
            const pts = [];
            const steps = isRaked ? Math.max(40, Math.round(grossLength / 50)) : 2;
            for (let i = 0; i <= steps; i++) {
              const x = (i / steps) * grossLength;
              pts.push(`${s(x)},${s(yTopAt(x))}`);
            }
            pts.push(`${s(grossLength)},${s(yBottom)}`);
            pts.push(`${0},${s(yBottom)}`);
            const pointsStr = pts.join(' ');
            return (
              <>
                <defs>
                  <clipPath id={clipId}>
                    <polygon points={pointsStr} />
                  </clipPath>
                </defs>
                <polygon points={pointsStr} fill="none" stroke={STROKE_COLOR} strokeWidth={1.5} />
              </>
            );
          })()}

          {/* ── Corner deductions ── */}
          {deductionLeft > 0 && (
            <rect
              x={0} y={s(yTopAt(0))}
              width={s(deductionLeft)} height={s(yBottom - yTopAt(0))}
              fill="none" stroke={STROKE_COLOR} strokeWidth={1}
            />
          )}
          {deductionRight > 0 && (
            <rect
              x={s(grossLength - deductionRight)} y={s(yTopAt(grossLength))}
              width={s(deductionRight)} height={s(yBottom - yTopAt(grossLength))}
              fill="none" stroke={STROKE_COLOR} strokeWidth={1}
            />
          )}

          {/* Clip EPS fills to wall outline (prevents overflow on raked/gable walls) */}
          <g clipPath={`url(#${clipId})`}>

          {/* ── Panels with EPS cores ── */}
          {panels.map((panel, i) => {
            const segments = getEpsSegments(panel.x, panel.x + panel.width);

            const getVertExclusions = (xEdge) => {
              const zones = [];
              for (const l of lintels) {
                if (l.x < xEdge && xEdge < l.x + l.width) {
                  const hL = l.heightLeft != null ? l.heightLeft : l.height;
                  const hR = l.heightRight != null ? l.heightRight : l.height;
                  const t = l.width > 0 ? (xEdge - l.x) / l.width : 0;
                  const hAtX = hL + (hR - hL) * t;
                  zones.push([yBottom - l.y - hAtX, yBottom - l.y]);
                }
              }
              for (const f of footers) {
                if (f.x < xEdge && xEdge < f.x + f.width) {
                  zones.push([yBottom - f.height, yBottom]);
                }
              }
              // Multi-course: exclude the plate zone at each course join
              // Only where the wall at this x is tall enough to reach the join
              if (isMultiCourse && courses.length > 1) {
                for (let ci = 1; ci < courses.length; ci++) {
                  const joinY = yBottom - courses[ci].y;
                  if (yTopAt(xEdge) < joinY - TOP_PLATE) {
                    zones.push([joinY - TOP_PLATE, joinY + TOP_PLATE]);
                  }
                }
              }
              zones.sort((a, b) => a[0] - b[0]);
              return zones;
            };

            const vertSegments = (xEdge) => {
              const excl = getVertExclusions(xEdge);
              const topY = yTopAt(xEdge);
              const segs = [];
              let cursor = topY;
              for (const [eTop, eBot] of excl) {
                if (cursor < eTop) segs.push([cursor, eTop]);
                cursor = Math.max(cursor, eBot);
              }
              if (cursor < yBottom) segs.push([cursor, yBottom]);
              return segs;
            };

            const leftX = panel.x;
            const rightX = panel.x + panel.width;
            const leftSegs = vertSegments(leftX);
            const rightSegs = vertSegments(rightX);
            const panelMidH = (yTopAt(leftX) + yTopAt(rightX)) / 2;
            // Shortest side (highest yTopAt) — EPS rectangle must stay below top plates at every point
            const panelShortTopY = Math.max(yTopAt(leftX), yTopAt(rightX));

            // Per-panel EPS bounds for raked walls — use shortest side so EPS stays under lowest top plate
            const pEpsTop = (isRaked ? panelShortTopY : yTopAt(leftX)) + TOP_PLATE * 2 + EPS_INSET;
            const pEpsBot = yBottom - BOTTOM_PLATE - EPS_INSET;
            const pEpsH = pEpsBot - pEpsTop;

            return (
              <g key={`panel-${i}`}>
                {/* Panel outline — sloped top & flat bottom */}
                <line x1={s(leftX)} y1={s(yTopAt(leftX))} x2={s(rightX)} y2={s(yTopAt(rightX))} stroke={STROKE_COLOR} strokeWidth={1} />
                <line x1={s(leftX)} y1={s(yBottom)} x2={s(rightX)} y2={s(yBottom)} stroke={STROKE_COLOR} strokeWidth={1} />
                {leftSegs.map(([y1, y2], j) => (
                  <line key={`l-${j}`} x1={s(leftX)} y1={s(y1)} x2={s(leftX)} y2={s(y2)} stroke={STROKE_COLOR} strokeWidth={1} />
                ))}
                {rightSegs.map(([y1, y2], j) => (
                  <line key={`r-${j}`} x1={s(rightX)} y1={s(y1)} x2={s(rightX)} y2={s(y2)} stroke={STROKE_COLOR} strokeWidth={1} />
                ))}
                {/* EPS core segments */}
                {segments.map(([segL, segR], j) => {
                  const w = segR - segL;
                  if (w <= 0) return null;

                  // Multi-course: split EPS into separate pieces per course
                  if (isMultiCourse && courses.length > 1) {
                    return courses.map((course, ci) => {
                      const isBottomCourse = ci === 0;
                      const isTopCourse = ci === courses.length - 1;
                      const plateBelow = isBottomCourse ? BOTTOM_PLATE : TOP_PLATE;
                      const plateAbove = isTopCourse ? TOP_PLATE * 2 : TOP_PLATE;

                      // Use shortest side — EPS rect must stay below top plates at every point
                      const wallTopHere = isRaked ? panelShortTopY : yTopAt(leftX);
                      const cEpsBot = yBottom - course.y - plateBelow - EPS_INSET;
                      const cEpsTop = isTopCourse
                        ? wallTopHere + plateAbove + EPS_INSET
                        : Math.max(
                            yBottom - course.y - course.height + plateAbove + EPS_INSET,
                            wallTopHere + TOP_PLATE * 2 + EPS_INSET
                          );
                      const cH = cEpsBot - cEpsTop;

                      return cH > 0 ? (
                        <rect
                          key={`eps-${j}-c${ci}`}
                          x={s(segL)} y={s(cEpsTop)}
                          width={s(w)} height={s(cH)}
                          fill={EPS_FILL} stroke={EPS_STROKE} strokeWidth={1}
                        />
                      ) : null;
                    });
                  }

                  return pEpsH > 0 ? (
                    <rect
                      key={`eps-${j}`}
                      x={s(segL)} y={s(pEpsTop)}
                      width={s(w)} height={s(pEpsH)}
                      fill={EPS_FILL} stroke={EPS_STROKE} strokeWidth={1}
                    />
                  ) : null;
                })}
                <text
                  x={s(panel.x + panel.width / 2)}
                  y={s((panelMidH + yBottom) / 2) + 4}
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
                x={s(op.x)} y={s(yBottom - op.y - op.drawHeight)}
                width={s(op.drawWidth)} height={s(op.drawHeight)}
                fill="none" stroke={STROKE_COLOR} strokeWidth={1.5}
              />
              <text
                x={s(op.x + op.drawWidth / 2)}
                y={s(yBottom - op.y - op.drawHeight / 2) + 4}
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
                <rect
                  x={s(f.x)} y={s(yBottom - f.height)}
                  width={s(f.width)} height={s(f.height)}
                  fill="none" stroke={STROKE_COLOR} strokeWidth={1}
                />
                {fEps && (
                  <rect
                    x={s(fEps.x)} y={s(fEps.y)}
                    width={s(fEps.width)} height={s(fEps.height)}
                    fill={EPS_FILL} stroke={EPS_STROKE} strokeWidth={1}
                  />
                )}
                <text
                  x={s(f.x + f.width / 2)}
                  y={s(yBottom - f.height / 2) + 3}
                  textAnchor="middle" fontSize="8" fill={LABEL_COLOR}
                >
                  Footer {f.ref}
                </text>
              </g>
            );
          })}

          {/* ── Lintels (trapezoid for raked/gable — magboard) ── */}
          {lintels.map((l, i) => {
            const hL = l.heightLeft != null ? l.heightLeft : l.height;
            const hR = l.heightRight != null ? l.heightRight : l.height;
            const x1 = s(l.x);
            const x2 = s(l.x + l.width);
            const yBase = s(yBottom - l.y);
            const yTopL = s(yBottom - l.y - hL);
            const yTopR = s(yBottom - l.y - hR);
            const pts = `${x1},${yBase} ${x1},${yTopL} ${x2},${yTopR} ${x2},${yBase}`;
            const midH = (hL + hR) / 2;
            return (
              <g key={`lintel-${i}`}>
                <polygon points={pts} fill="none" stroke={STROKE_COLOR} strokeWidth={1} />
                <text
                  x={s(l.x + l.width / 2)}
                  y={s(yBottom - l.y - midH / 2) + 3}
                  textAnchor="middle" fontSize="8" fill={LABEL_COLOR}
                >
                  Lintel {l.ref}
                </text>
              </g>
            );
          })}

          {/* ── Spline EPS (120mm EPS inside 146mm splines) ── */}
          {(() => {
            const splineEpsX = MAGBOARD;
            const splineEpsW = SPLINE_WIDTH - MAGBOARD * 2;
            const splines = [];

            for (let i = 0; i < panels.length - 1; i++) {
              const panel = panels[i];
              const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
              const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
              const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
              if (!insideLintel && !insideFooter) {
                splines.push({ xPos: gapCentre - HALF_SPLINE, cx: gapCentre });
              }
            }

            for (const op of openings) {
              if (op.y > 0) {
                const lx = op.x - BOTTOM_PLATE - SPLINE_WIDTH;
                splines.push({ xPos: lx, cx: lx + SPLINE_WIDTH / 2 });
                const rx = op.x + op.drawWidth + BOTTOM_PLATE;
                splines.push({ xPos: rx, cx: rx + SPLINE_WIDTH / 2 });
              }
            }

            return splines.map((sp, i) => {
              // Multi-course: split spline EPS per course
              if (isMultiCourse && courses.length > 1) {
                return courses.map((course, ci) => {
                  const isBottomCourse = ci === 0;
                  const isTopCourse = ci === courses.length - 1;
                  const plateBelow = isBottomCourse ? BOTTOM_PLATE : TOP_PLATE;
                  const plateAbove = isTopCourse ? TOP_PLATE * 2 : TOP_PLATE;

                  const splineWallTop = yTopAt(sp.cx);
                  const cEpsBot = yBottom - course.y - plateBelow - EPS_INSET;
                  const cEpsTop = isTopCourse
                    ? splineWallTop + plateAbove + EPS_INSET
                    : Math.max(
                        yBottom - course.y - course.height + plateAbove + EPS_INSET,
                        splineWallTop + TOP_PLATE * 2 + EPS_INSET
                      );
                  const cH = cEpsBot - cEpsTop;

                  return cH > 0 ? (
                    <rect
                      key={`spline-eps-${i}-c${ci}`}
                      x={s(sp.xPos + splineEpsX)} y={s(cEpsTop)}
                      width={s(splineEpsW)} height={s(cH)}
                      fill={SPLINE_EPS_FILL} stroke={SPLINE_EPS_STROKE} strokeWidth={1}
                    />
                  ) : null;
                });
              }

              const spTop = yTopAt(sp.cx) + TOP_PLATE * 2 + EPS_INSET;
              const spH = yBottom - BOTTOM_PLATE - spTop;
              return spH > 0 ? (
                <rect
                  key={`spline-eps-${i}`}
                  x={s(sp.xPos + splineEpsX)} y={s(spTop)}
                  width={s(splineEpsW)} height={s(spH)}
                  fill={SPLINE_EPS_FILL} stroke={SPLINE_EPS_STROKE} strokeWidth={1}
                />
              ) : null;
            });
          })()}

          {/* ── Course join lines (multi-course walls > 3000mm) ── */}
          {/* Rendered inside clipPath so wall outline clips the line on raked/gable walls */}
          {isMultiCourse && courses.slice(1).map((course, i) => {
            const joinY = yBottom - course.y;
            return (
              <g key={`course-join-${i}`}>
                <line
                  x1={s(0)} y1={s(joinY)}
                  x2={s(grossLength)} y2={s(joinY)}
                  stroke="#E74C3C" strokeWidth={2} strokeDasharray="8,4"
                />
              </g>
            );
          })}

          </g>{/* end wall-clip */}

          {/* Course join label (outside clip so it's always visible) */}
          {isMultiCourse && courses.slice(1).map((course, i) => {
            const joinY = yBottom - course.y;
            // Find rightmost x where wall height >= course.y for label placement
            let labelX = grossLength;
            if (heightAt) {
              const step = grossLength / 200;
              for (let x = grossLength; x >= 0; x -= step) {
                if (heightAt(x) >= course.y) { labelX = x; break; }
              }
            }
            return (
              <text
                key={`course-label-${i}`}
                x={s(labelX) + 8} y={s(joinY) + 4}
                fontSize="8" fill="#E74C3C" fontWeight="bold"
              >
                {course.y}
              </text>
            );
          })}

          {/* ── Running measurement ── */}
          <g>
            {(() => {
              const points = new Set([0, grossLength]);
              if (deductionLeft > 0) points.add(deductionLeft);
              if (deductionRight > 0) points.add(grossLength - deductionRight);
              panels.forEach(p => {
                if (p.type === 'lcut') {
                  if (p.side === 'left') {
                    const adj = p.openBottom > 0 ? WINDOW_OVERHANG : 0;
                    points.add(Math.round(p.x + p.width - adj));
                  } else if (p.side === 'right') {
                    points.add(Math.round(p.x + p.width));
                  } else {
                    const adj = p.rightOpenBottom > 0 ? WINDOW_OVERHANG : 0;
                    points.add(Math.round(p.x + p.width - adj));
                  }
                } else {
                  points.add(Math.round(p.x + p.width));
                }
              });
              footers.forEach(f => points.add(Math.round(f.x + f.width)));
              const sorted = [...points].sort((a, b) => a - b);
              const tickY = s(yBottom) + 22;
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
            <line x1={0} y1={s(yBottom) + 44} x2={s(grossLength)} y2={s(yBottom) + 44} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={0} y1={s(yBottom) + 39} x2={0} y2={s(yBottom) + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={s(grossLength)} y1={s(yBottom) + 39} x2={s(grossLength)} y2={s(yBottom) + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <text x={s(grossLength / 2)} y={s(yBottom) + 60} textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold">
              {grossLength} mm
            </text>
          </g>

          {/* ── Height dimension — left ── */}
          <g>
            {(() => {
              const hLeftY = yTopAt(0);
              const midY = (hLeftY + yBottom) / 2;
              return (
                <>
                  <line x1={-20} y1={s(hLeftY)} x2={-20} y2={s(yBottom)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <line x1={-25} y1={s(hLeftY)} x2={-15} y2={s(hLeftY)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <line x1={-25} y1={s(yBottom)} x2={-15} y2={s(yBottom)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <text x={-35} y={s(midY)} textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold"
                    transform={`rotate(-90, -35, ${s(midY)})`}>
                    {layout.heightLeft || height} mm
                  </text>
                </>
              );
            })()}
          </g>

          {/* ── Height dimension — right (for raked/gable) ── */}
          {isRaked && (
            <g>
              {(() => {
                const hRightY = yTopAt(grossLength);
                const midY = (hRightY + yBottom) / 2;
                const rx = s(grossLength) + 20;
                return (
                  <>
                    <line x1={rx} y1={s(hRightY)} x2={rx} y2={s(yBottom)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                    <line x1={rx - 5} y1={s(hRightY)} x2={rx + 5} y2={s(hRightY)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                    <line x1={rx - 5} y1={s(yBottom)} x2={rx + 5} y2={s(yBottom)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                    <text x={rx + 15} y={s(midY)} textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold"
                      transform={`rotate(-90, ${rx + 15}, ${s(midY)})`}>
                      {layout.heightRight || height} mm
                    </text>
                  </>
                );
              })()}
            </g>
          )}

        </g>
      </svg>
    </div>
  );
}
