import { useRef } from 'react';
import { COLORS, WINDOW_OVERHANG, BOTTOM_PLATE, TOP_PLATE, PANEL_GAP, SPLINE_WIDTH, HSPLINE_CLEARANCE, buildHSplineSegments } from '../utils/constants.js';
import PrintButton from './PrintButton.jsx';
import ExportDxfButton from './ExportDxfButton.jsx';

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

export default function EpsElevation({ layout, wallName, projectName }) {
  const sectionRef = useRef(null);
  const clipId = useRef(`eps-clip-${Math.random().toString(36).slice(2, 8)}`).current;
  if (!layout) return null;

  const { grossLength, height, maxHeight, panels, openings, footers, lintelPanels, deductionLeft, deductionRight, isRaked, heightAt, courses, isMultiCourse } = layout;

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
  // Use course 0 panels — x-positions are identical across courses
  const basePanels = panels.filter(p => (p.course ?? 0) === 0);
  for (let i = 0; i < basePanels.length - 1; i++) {
    const panel = basePanels[i];
    const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
    // Skip if inside opening zone (same logic as framing elevation)
    const insideLintel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
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
  for (const p of basePanels) {
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

  // 5. Lintel panel areas (lintel panels sit above timber lintels)
  for (const l of lintelPanels) {
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px 0', gap: 4 }}>
        <PrintButton sectionRef={sectionRef} label="EPS" projectName={projectName} wallName={wallName} />
        <ExportDxfButton layout={layout} wallName={wallName} projectName={projectName} planType="eps-elevation" />
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
          {grossLength}mm × {height}mm{isRaked ? ` (max ${useHeight}mm)` : ''} | EPS inset {EPS_INSET}mm from framing{isMultiCourse ? ` | ${courses.length} courses` : ''}
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
          {/* Use course 0 panels — internal multi-course rendering handles all courses */}
          {panels.filter(p => (p.course ?? 0) === 0).map((panel, i) => {
            const segments = getEpsSegments(panel.x, panel.x + panel.width);

            const getVertExclusions = (xEdge) => {
              const zones = [];
              for (const l of lintelPanels) {
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
                {/* Panel outline — sloped top & flat bottom (peaked for gable) */}
                {panel.peakHeight ? (<>
                  <line x1={s(leftX)} y1={s(yTopAt(leftX))} x2={s(panel.x + panel.peakXLocal)} y2={s(yTopAt(panel.x + panel.peakXLocal))} stroke={STROKE_COLOR} strokeWidth={1} />
                  <line x1={s(panel.x + panel.peakXLocal)} y1={s(yTopAt(panel.x + panel.peakXLocal))} x2={s(rightX)} y2={s(yTopAt(rightX))} stroke={STROKE_COLOR} strokeWidth={1} />
                </>) : (
                  <line x1={s(leftX)} y1={s(yTopAt(leftX))} x2={s(rightX)} y2={s(yTopAt(rightX))} stroke={STROKE_COLOR} strokeWidth={1} />
                )}
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
                      const plateBelow = isBottomCourse ? BOTTOM_PLATE : (HALF_SPLINE - EPS_INSET);
                      const plateAbove = isTopCourse ? TOP_PLATE * 2 : (HALF_SPLINE - EPS_INSET);
                      const cEpsBot = yBottom - course.y - plateBelow - EPS_INSET;

                      if (isRaked) {
                        // Sloped walls: polygon with per-vertex top edge + edge clipping
                        // Top course: bounded by wall slope
                        // Non-top courses: bounded by max(course boundary, wall slope)
                        const courseTopY = isTopCourse
                          ? -Infinity
                          : yBottom - course.y - course.height + plateAbove + EPS_INSET;

                        const epsTopAtX = (x) => {
                          const wallTop = yTopAt(x) + TOP_PLATE * 2 + EPS_INSET;
                          return isTopCourse ? wallTop : Math.max(courseTopY, wallTop);
                        };

                        const epsTopL = epsTopAtX(segL);
                        const epsTopR = epsTopAtX(segR);
                        const hL = cEpsBot - epsTopL;
                        const hR = cEpsBot - epsTopR;

                        // Both edges have no height — skip
                        if (hL <= 0 && hR <= 0) return null;

                        // Non-top courses: find kink where course boundary meets wall slope
                        // (peak vertices only apply to top course — peak is always above course join)
                        let kinkX = null;
                        if (!isTopCourse) {
                          const wallTopL = yTopAt(segL) + TOP_PLATE * 2 + EPS_INSET;
                          const wallTopR = yTopAt(segR) + TOP_PLATE * 2 + EPS_INSET;
                          const leftUsesCourse = courseTopY >= wallTopL;
                          const rightUsesCourse = courseTopY >= wallTopR;
                          if (leftUsesCourse !== rightUsesCourse) {
                            const yL = yTopAt(segL), yR = yTopAt(segR);
                            if (yR !== yL) {
                              const target = courseTopY - TOP_PLATE * 2 - EPS_INSET;
                              const t = (target - yL) / (yR - yL);
                              if (t > 0 && t < 1) {
                                kinkX = segL + t * (segR - segL);
                              }
                            }
                          }
                        }

                        const pts = [];

                        if (hL > 0 && hR > 0) {
                          // Both edges visible — full polygon
                          pts.push(`${s(segL)},${s(cEpsBot)}`);
                          pts.push(`${s(segR)},${s(cEpsBot)}`);
                          pts.push(`${s(segR)},${s(epsTopR)}`);
                          // Peak vertex (top course only)
                          if (isTopCourse && panel.peakHeight && panel.peakXLocal != null) {
                            const peakGX = panel.x + panel.peakXLocal;
                            if (peakGX > segL && peakGX < segR) {
                              pts.push(`${s(peakGX)},${s(epsTopAtX(peakGX))}`);
                            }
                          }
                          // Kink vertex (non-top courses only)
                          if (kinkX != null) {
                            pts.push(`${s(kinkX)},${s(courseTopY)}`);
                          }
                          pts.push(`${s(segL)},${s(epsTopL)}`);
                        } else if (hL > 0) {
                          // Right edge clipped — triangle ending at clipX
                          const clipX = segL + hL / (hL - hR) * (segR - segL);
                          pts.push(`${s(segL)},${s(cEpsBot)}`);
                          pts.push(`${s(clipX)},${s(cEpsBot)}`);
                          if (isTopCourse && panel.peakHeight && panel.peakXLocal != null) {
                            const peakGX = panel.x + panel.peakXLocal;
                            if (peakGX > segL && peakGX < clipX) {
                              pts.push(`${s(peakGX)},${s(epsTopAtX(peakGX))}`);
                            }
                          }
                          if (kinkX != null && kinkX < clipX) {
                            pts.push(`${s(kinkX)},${s(courseTopY)}`);
                          }
                          pts.push(`${s(segL)},${s(epsTopL)}`);
                        } else {
                          // Left edge clipped — triangle starting at clipX
                          const clipX = segL + hL / (hL - hR) * (segR - segL);
                          pts.push(`${s(clipX)},${s(cEpsBot)}`);
                          pts.push(`${s(segR)},${s(cEpsBot)}`);
                          pts.push(`${s(segR)},${s(epsTopR)}`);
                          if (isTopCourse && panel.peakHeight && panel.peakXLocal != null) {
                            const peakGX = panel.x + panel.peakXLocal;
                            if (peakGX > clipX && peakGX < segR) {
                              pts.push(`${s(peakGX)},${s(epsTopAtX(peakGX))}`);
                            }
                          }
                          if (kinkX != null && kinkX > clipX) {
                            pts.push(`${s(kinkX)},${s(courseTopY)}`);
                          }
                        }

                        return pts.length >= 3 ? (
                          <polygon key={`eps-${j}-c${ci}`} points={pts.join(' ')} fill={EPS_FILL} stroke={EPS_STROKE} strokeWidth={1} />
                        ) : null;
                      }

                      // Flat walls: rect bounded by course boundary
                      const cEpsTop = isTopCourse
                        ? yTopAt(leftX) + (TOP_PLATE * 2) + EPS_INSET
                        : Math.max(
                            yBottom - course.y - course.height + plateAbove + EPS_INSET,
                            yTopAt(leftX) + TOP_PLATE * 2 + EPS_INSET
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

                  // Single-course: polygon for sloped walls, rect for flat
                  if (isRaked) {
                    const epsBot = yBottom - BOTTOM_PLATE - EPS_INSET;
                    const epsTopL = yTopAt(segL) + TOP_PLATE * 2 + EPS_INSET;
                    const epsTopR = yTopAt(segR) + TOP_PLATE * 2 + EPS_INSET;
                    if (epsTopL >= epsBot && epsTopR >= epsBot) return null;
                    let pts = `${s(segL)},${s(epsBot)} ${s(segR)},${s(epsBot)} ${s(segR)},${s(epsTopR)}`;
                    if (panel.peakHeight && panel.peakXLocal != null) {
                      const peakGX = panel.x + panel.peakXLocal;
                      if (peakGX > segL && peakGX < segR) {
                        pts += ` ${s(peakGX)},${s(yTopAt(peakGX) + TOP_PLATE * 2 + EPS_INSET)}`;
                      }
                    }
                    pts += ` ${s(segL)},${s(epsTopL)}`;
                    return <polygon key={`eps-${j}`} points={pts} fill={EPS_FILL} stroke={EPS_STROKE} strokeWidth={1} />;
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
                {/* Panel labels — one per course, positioned in each course's vertical region */}
                {(isMultiCourse ? courses : [{ y: 0, height }]).map((course, ci) => {
                  const cY = course.y;
                  const cTop = cY + course.height;
                  const panelCenterX = panel.x + panel.width / 2;
                  const wallHAtCenter = heightAt ? heightAt(panelCenterX) : height;
                  // Skip label if wall height at this panel doesn't reach this course (raked walls)
                  if (wallHAtCenter <= cY) return null;
                  // Clamp to cY so label stays within course when wall height < course bottom (raked walls)
                  const courseMidTop = Math.max(Math.min(wallHAtCenter, cTop), cY);
                  const courseMidY = (yBottom - cY + yBottom - courseMidTop) / 2;
                  const label = isMultiCourse ? `P${i + 1}·C${ci + 1}` : `P${i + 1}`;
                  return (
                    <text
                      key={`label-c${ci}`}
                      x={s(panelCenterX)}
                      y={s(courseMidY) + 4}
                      textAnchor="middle" fontSize={isMultiCourse ? 8 : 10} fill={LABEL_COLOR}
                    >
                      {label}
                    </text>
                  );
                })}
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

          {/* ── Lintels (timber beam + EPS fill above) ── */}
          {lintelPanels.map((l, i) => {
            const hL = l.heightLeft != null ? l.heightLeft : l.height;
            const hR = l.heightRight != null ? l.heightRight : l.height;
            const x1 = s(l.x);
            const x2 = s(l.x + l.width);
            const yBase = s(yBottom - l.y);
            const yTopL = s(yBottom - l.y - hL);
            const yTopR = s(yBottom - l.y - hR);
            const outlinePts = l.peakHeight
              ? `${x1},${yBase} ${x1},${yTopL} ${s(l.x + l.peakXLocal)},${s(yBottom - l.y - l.peakHeight)} ${x2},${yTopR} ${x2},${yBase}`
              : `${x1},${yBase} ${x1},${yTopL} ${x2},${yTopR} ${x2},${yBase}`;

            // Find the matching opening for spline positions
            const op = openings.find(o => o.ref === l.ref);
            const hasSill = op && op.y > 0;

            const midH = Math.max(hL, hR, l.peakHeight || 0) / 2;

            // Timber lintel and EPS fill (only when matching opening exists)
            let lintelLeft, lintelRight, lintelTop, lintelH;
            let epsPoly = null;
            if (op) {
              // Timber lintel spans between inner edges of opening splines/plates, with 10mm gap
              lintelH = l.lintelHeight || 200;
              lintelLeft = hasSill
                ? op.x - BOTTOM_PLATE - SPLINE_WIDTH + EPS_INSET  // 10mm inside left spline outer edge
                : op.x - BOTTOM_PLATE + EPS_INSET;                // 10mm inside left plate inner edge
              lintelRight = hasSill
                ? op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH - EPS_INSET  // 10mm inside right spline outer edge
                : op.x + op.drawWidth + BOTTOM_PLATE - EPS_INSET;               // 10mm inside right plate inner edge
              lintelTop = yBottom - l.y - lintelH;

              // Lintel panel EPS: fills the area above the timber lintel, inset 10mm from spline/plate inner edges
              const epsLeft = hasSill
                ? op.x - BOTTOM_PLATE - SPLINE_WIDTH + EPS_INSET  // 10mm inside spline outer edge
                : op.x - BOTTOM_PLATE + EPS_INSET;                // 10mm inside plate inner edge
              const epsRight = hasSill
                ? op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH - EPS_INSET  // 10mm inside spline outer edge
                : op.x + op.drawWidth + BOTTOM_PLATE - EPS_INSET;               // 10mm inside plate inner edge
              const epsBot = lintelTop - EPS_INSET;  // 10mm above timber lintel

              // EPS top follows wall slope (same as panel EPS logic)
              const epsTopAt = (x) => yTopAt(x) + TOP_PLATE * 2 + EPS_INSET;

              // Build EPS polygon (if there's space above the lintel)
              if (epsBot > epsTopAt(epsLeft) || epsBot > epsTopAt(epsRight)) {
                const epsTopL = epsTopAt(epsLeft);
                const epsTopR = epsTopAt(epsRight);

                if (isRaked && Math.abs(epsTopL - epsTopR) > 0.5) {
                  // Raked/gable: polygon with angled top
                  const pts = [];
                  pts.push(`${s(epsLeft)},${s(epsBot)}`);
                  pts.push(`${s(epsRight)},${s(epsBot)}`);
                  if (epsTopR < epsBot) pts.push(`${s(epsRight)},${s(epsTopR)}`);
                  // Gable peak vertex
                  if (l.peakHeight && l.peakXLocal != null) {
                    const peakGX = l.x + l.peakXLocal;
                    if (peakGX > epsLeft && peakGX < epsRight) {
                      const peakTopY = epsTopAt(peakGX);
                      if (peakTopY < epsBot) pts.push(`${s(peakGX)},${s(peakTopY)}`);
                    }
                  }
                  if (epsTopL < epsBot) pts.push(`${s(epsLeft)},${s(epsTopL)}`);
                  if (pts.length >= 3) {
                    epsPoly = <polygon points={pts.join(' ')} fill={EPS_FILL} stroke={EPS_STROKE} strokeWidth={1} />;
                  }
                } else {
                  // Flat: simple rect
                  const epsTopY = Math.min(epsTopL, epsTopR);
                  const epsH = epsBot - epsTopY;
                  if (epsH > 0) {
                    epsPoly = (
                      <rect
                        x={s(epsLeft)} y={s(epsTopY)}
                        width={s(epsRight - epsLeft)} height={s(epsH)}
                        fill={EPS_FILL} stroke={EPS_STROKE} strokeWidth={1}
                      />
                    );
                  }
                }
              }
            }

            return (
              <g key={`lintel-panel-${i}`}>
                {/* Lintel panel outline */}
                <polygon points={outlinePts} fill="none" stroke={STROKE_COLOR} strokeWidth={1} />
                {/* Timber lintel */}
                {op && (
                  <rect
                    x={s(lintelLeft)} y={s(lintelTop)}
                    width={s(lintelRight - lintelLeft)} height={s(lintelH)}
                    fill="none" stroke={STROKE_COLOR} strokeWidth={1}
                  />
                )}
                {/* EPS above lintel */}
                {epsPoly}
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

            for (let i = 0; i < basePanels.length - 1; i++) {
              const panel = basePanels[i];
              const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
              const insideLintel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
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
              // Vertical splines run full height — no split at course joins
              const epsXL = sp.xPos + splineEpsX;
              const epsXR = epsXL + splineEpsW;
              const spTopL = yTopAt(epsXL) + TOP_PLATE * 2 + EPS_INSET;
              const spTopR = yTopAt(epsXR) + TOP_PLATE * 2 + EPS_INSET;
              const spBot = yBottom - BOTTOM_PLATE - EPS_INSET;
              if (spTopL >= spBot && spTopR >= spBot) return null;

              if (!isRaked || Math.abs(spTopL - spTopR) < 0.5) {
                const spTop = Math.min(spTopL, spTopR);
                return (spBot - spTop) > 0 ? (
                  <rect
                    key={`spline-eps-${i}`}
                    x={s(epsXL)} y={s(spTop)}
                    width={s(splineEpsW)} height={s(spBot - spTop)}
                    fill={SPLINE_EPS_FILL} stroke={SPLINE_EPS_STROKE} strokeWidth={1}
                  />
                ) : null;
              }

              // Raked/gable: polygon with angled top
              const pts = [];
              pts.push(`${s(epsXL)},${s(spBot)}`);
              pts.push(`${s(epsXR)},${s(spBot)}`);
              if (spTopR < spBot) pts.push(`${s(epsXR)},${s(spTopR)}`);
              if (spTopL < spBot) pts.push(`${s(epsXL)},${s(spTopL)}`);
              return pts.length >= 3 ? (
                <polygon
                  key={`spline-eps-${i}`}
                  points={pts.join(' ')}
                  fill={SPLINE_EPS_FILL} stroke={SPLINE_EPS_STROKE} strokeWidth={1}
                />
              ) : null;
            });
          })()}

          {/* ── Horizontal spline EPS at course joints (multi-course only) ── */}
          {isMultiCourse && courses.length > 1 && (() => {
            const splineEpsInset = MAGBOARD; // 10mm magboard each face
            const jointHasSpline = [];
            for (let i = 0; i < basePanels.length - 1; i++) {
              const gapCentre = basePanels[i].x + basePanels[i].width + PANEL_GAP / 2;
              const insideLintel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
              const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
              jointHasSpline.push(!insideLintel && !insideFooter);
            }
            return courses.slice(1).map((course, ci) => {
              const joinY = yBottom - course.y;
              // EPS sits inside the spline, inset by magboard thickness on top/bottom
              const epsY = joinY - HALF_SPLINE + splineEpsInset;
              const epsH = SPLINE_WIDTH - 2 * splineEpsInset;
              if (epsH <= 0) return null;
              return basePanels.map((panel, pi) => {
                let leftEdge;
                if (pi > 0 && jointHasSpline[pi - 1]) {
                  const gc = basePanels[pi - 1].x + basePanels[pi - 1].width + PANEL_GAP / 2;
                  leftEdge = gc + HALF_SPLINE;
                } else {
                  leftEdge = panel.x + BOTTOM_PLATE;
                }
                let rightEdge;
                if (pi < basePanels.length - 1 && jointHasSpline[pi]) {
                  const gc = panel.x + panel.width + PANEL_GAP / 2;
                  rightEdge = gc - HALF_SPLINE;
                } else {
                  rightEdge = panel.x + panel.width - BOTTOM_PLATE;
                }

                // Split around lintel panels, openings, opening plates & splines
                const splineLeft = leftEdge + HSPLINE_CLEARANCE;
                const splineRight = rightEdge - HSPLINE_CLEARANCE;
                const segs = buildHSplineSegments(splineLeft, splineRight, lintelPanels, openings);
                if (segs.length === 0) return null;

                return segs.map(([segL, segR], si) => {
                  // No extra x-inset: HSPLINE_CLEARANCE already provides
                  // EPS_INSET from boundaries, matching the panel EPS width
                  const epsXL = segL;
                  const epsXR = segR;
                  if (epsXR <= epsXL) return null;

                  const epsTopY = epsY;
                  const epsBotY = epsY + epsH;

                  if (!isRaked) {
                    return (
                      <rect
                        key={`hspline-eps-c${ci}-p${pi}-s${si}`}
                        x={s(epsXL)} y={s(epsTopY)}
                        width={s(epsXR - epsXL)} height={s(epsH)}
                        fill={SPLINE_EPS_FILL} stroke={SPLINE_EPS_STROKE} strokeWidth={1}
                      />
                    );
                  }

                  // Raked/gable: polygon clipped against wall clearance
                  // (2*TOP_PLATE + EPS_INSET inset from wall top edge)
                  const clAt = (x) => yTopAt(x) + 2 * TOP_PLATE + EPS_INSET;

                  // Key x-positions where clearance slope changes (gable peak)
                  const breakXs = [epsXL, epsXR];
                  if (panel.peakHeight && panel.peakXLocal != null) {
                    const px = panel.x + panel.peakXLocal;
                    if (px > epsXL && px < epsXR) breakXs.push(px);
                  }
                  breakXs.sort((a, b) => a - b);

                  // Find where clearance crosses epsBotY (visibility limit)
                  // and epsTopY (where clipping starts)
                  const botCrossings = [];
                  const topCrossings = [];
                  for (let k = 0; k < breakXs.length - 1; k++) {
                    const x1 = breakXs[k], x2 = breakXs[k + 1];
                    const c1 = clAt(x1), c2 = clAt(x2);
                    for (const [thr, arr] of [[epsBotY, botCrossings], [epsTopY, topCrossings]]) {
                      if ((c1 - thr) * (c2 - thr) < 0) {
                        const t = (thr - c1) / (c2 - c1);
                        arr.push(x1 + t * (x2 - x1));
                      }
                    }
                  }

                  // Determine visible x-range (where clearance < epsBotY)
                  let vL = epsXL, vR = epsXR;
                  if (clAt(epsXL) >= epsBotY) {
                    if (botCrossings.length === 0) return null;
                    vL = Math.min(...botCrossings);
                  }
                  if (clAt(epsXR) >= epsBotY) {
                    if (botCrossings.length === 0) return null;
                    vR = Math.max(...botCrossings);
                  }
                  if (vR <= vL) return null;

                  // Build polygon clockwise: bottom edge → right → top edge → left
                  const pts = [];

                  // Bottom edge
                  pts.push(`${s(vL)},${s(epsBotY)}`);
                  pts.push(`${s(vR)},${s(epsBotY)}`);

                  // Right edge up (skip if vR is a bottom crossing — it tapers to a point)
                  if (clAt(vR) < epsBotY - 0.5) {
                    pts.push(`${s(vR)},${s(Math.max(epsTopY, clAt(vR)))}`);
                  }

                  // Top edge from right to left: add peak + top crossings within visible range
                  const topEdgeXs = [];
                  for (const x of topCrossings) {
                    if (x > vL + 0.5 && x < vR - 0.5) topEdgeXs.push(x);
                  }
                  if (panel.peakHeight && panel.peakXLocal != null) {
                    const px = panel.x + panel.peakXLocal;
                    if (px > vL + 0.5 && px < vR - 0.5 && clAt(px) > epsTopY) {
                      topEdgeXs.push(px);
                    }
                  }
                  topEdgeXs.sort((a, b) => b - a); // right to left
                  for (const x of topEdgeXs) {
                    pts.push(`${s(x)},${s(Math.max(epsTopY, clAt(x)))}`);
                  }

                  // Left edge (skip if vL is a bottom crossing — it tapers to a point)
                  if (clAt(vL) < epsBotY - 0.5) {
                    pts.push(`${s(vL)},${s(Math.max(epsTopY, clAt(vL)))}`);
                  }

                  return pts.length >= 3 ? (
                    <polygon
                      key={`hspline-eps-c${ci}-p${pi}-s${si}`}
                      points={pts.join(' ')}
                      fill={SPLINE_EPS_FILL} stroke={SPLINE_EPS_STROKE} strokeWidth={1}
                    />
                  ) : null;
              });
              });
            });
          })()}

          </g>{/* end wall-clip */}

          {/* Course join lines removed — visible on External Elevation instead */}

          {/* ── Running measurement ── */}
          <g>
            {(() => {
              const points = new Set([0, grossLength]);
              if (deductionLeft > 0) points.add(deductionLeft);
              if (deductionRight > 0) points.add(grossLength - deductionRight);
              // Use course 0 panels for measurement ticks (same x-positions across courses)
              basePanels.forEach(p => {
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
