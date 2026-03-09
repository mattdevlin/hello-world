import { useRef } from 'react';
import { COLORS, WINDOW_OVERHANG, BOTTOM_PLATE, TOP_PLATE, PANEL_GAP, PANEL_PITCH } from '../utils/constants.js';
import PrintButton from './PrintButton.jsx';

const SPLINE_WIDTH = 146; // mm
const HALF_SPLINE = SPLINE_WIDTH / 2; // 73mm each side of centre

const MARGIN = { top: 60, right: 40, bottom: 110, left: 60 };
const MAX_SVG_WIDTH = 1200;
const DASH = '6,3';
const STROKE_COLOR = '#333';
const LABEL_COLOR = '#555';
const PLATE_COLOR = '#888';

export default function FramingElevation({ layout, wallName }) {
  const sectionRef = useRef(null);
  if (!layout) return null;

  const { grossLength, height, maxHeight, panels, openings, footers, lintels, deductionLeft, deductionRight, isRaked, heightAt, courses, isMultiCourse } = layout;

  const drawWidth = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const scale = drawWidth / grossLength;
  const useHeight = maxHeight || height;
  const drawHeight = useHeight * scale;
  const svgWidth = MAX_SVG_WIDTH;
  const svgHeight = drawHeight + MARGIN.top + MARGIN.bottom;

  const s = (mm) => mm * scale;
  // Y coordinate: 0 is top of SVG draw area (maxHeight), bottom of wall is at maxHeight
  const yTop = (x) => useHeight - (heightAt ? heightAt(x) : height);
  const yBottom = useHeight;

  // Plate lines run full width but skip deduction zones
  const plateLeft = deductionLeft;
  const plateRight = grossLength - deductionRight;

  return (
    <div ref={sectionRef} data-print-section style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #ddd', marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px 0' }}>
        <PrintButton sectionRef={sectionRef} label="Framing" />
      </div>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ display: 'block', margin: '0 auto' }}
      >
        {/* Title */}
        <text x={svgWidth / 2} y={24} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333">
          {wallName || 'Wall'} — Framing Elevation
        </text>
        <text x={svgWidth / 2} y={42} textAnchor="middle" fontSize="12" fill="#666">
          {grossLength}mm × {height}mm{isRaked ? ` (max ${useHeight}mm)` : ''} | Bottom plate {BOTTOM_PLATE}mm, 2× top plate {TOP_PLATE}mm
        </text>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>

          {/* ── Wall outline (polygon for raked/gable) ── */}
          {(() => {
            const pts = [];
            const steps = isRaked ? Math.max(40, Math.round(grossLength / 50)) : 2;
            for (let i = 0; i <= steps; i++) {
              const x = (i / steps) * grossLength;
              pts.push(`${s(x)},${s(yTop(x))}`);
            }
            pts.push(`${s(grossLength)},${s(yBottom)}`);
            pts.push(`${0},${s(yBottom)}`);
            return (
              <polygon
                points={pts.join(' ')}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={1.5}
              />
            );
          })()}

          {/* ── Bottom plate line (45mm from base) ── */}
          <line
            x1={s(plateLeft)} y1={s(yBottom - BOTTOM_PLATE)}
            x2={s(plateRight)} y2={s(yBottom - BOTTOM_PLATE)}
            stroke={PLATE_COLOR}
            strokeWidth={1}
            strokeDasharray={DASH}
          />

          {/* ── Top plate lines (follow slope for raked/gable) ── */}
          {(() => {
            if (!isRaked) {
              return (
                <>
                  <line
                    x1={s(plateLeft)} y1={s(yTop(plateLeft) + TOP_PLATE)}
                    x2={s(plateRight)} y2={s(yTop(plateRight) + TOP_PLATE)}
                    stroke={PLATE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                  />
                  <line
                    x1={s(plateLeft)} y1={s(yTop(plateLeft) + TOP_PLATE * 2)}
                    x2={s(plateRight)} y2={s(yTop(plateRight) + TOP_PLATE * 2)}
                    stroke={PLATE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                  />
                </>
              );
            }
            // For raked/gable, draw plate lines as polylines following the slope
            const steps = Math.max(20, Math.round(grossLength / 100));
            const buildPlateLine = (offset) => {
              const points = [];
              for (let i = 0; i <= steps; i++) {
                const x = plateLeft + (i / steps) * (plateRight - plateLeft);
                points.push(`${s(x)},${s(yTop(x) + offset)}`);
              }
              return points.join(' ');
            };
            return (
              <>
                <polyline points={buildPlateLine(TOP_PLATE)} fill="none" stroke={PLATE_COLOR} strokeWidth={1} strokeDasharray={DASH} />
                <polyline points={buildPlateLine(TOP_PLATE * 2)} fill="none" stroke={PLATE_COLOR} strokeWidth={1} strokeDasharray={DASH} />
              </>
            );
          })()}

          {/* ── Corner deductions ── */}
          {deductionLeft > 0 && (
            <rect
              x={0}
              y={s(yTop(0))}
              width={s(deductionLeft)}
              height={s(yBottom - yTop(0))}
              fill="none"
              stroke={STROKE_COLOR}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          )}
          {deductionLeft > 0 && (
            <text x={s(deductionLeft / 2)} y={s(yBottom) + 14} textAnchor="middle" fontSize="9" fill="#999">
              -{deductionLeft}
            </text>
          )}
          {deductionLeft > 0 && (
            <rect
              x={s(deductionLeft)}
              y={s(yTop(deductionLeft) + TOP_PLATE * 2)}
              width={s(BOTTOM_PLATE)}
              height={s(yBottom - BOTTOM_PLATE - yTop(deductionLeft) - TOP_PLATE * 2)}
              fill="none"
              stroke={PLATE_COLOR}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          )}
          {deductionRight > 0 && (
            <rect
              x={s(grossLength - deductionRight)}
              y={s(yTop(grossLength))}
              width={s(deductionRight)}
              height={s(yBottom - yTop(grossLength))}
              fill="none"
              stroke={STROKE_COLOR}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          )}
          {deductionRight > 0 && (
            <text x={s(grossLength - deductionRight / 2)} y={s(yBottom) + 14} textAnchor="middle" fontSize="9" fill="#999">
              -{deductionRight}
            </text>
          )}
          {deductionRight > 0 && (
            <rect
              x={s(grossLength - deductionRight - BOTTOM_PLATE)}
              y={s(yTop(grossLength - deductionRight) + TOP_PLATE * 2)}
              width={s(BOTTOM_PLATE)}
              height={s(yBottom - BOTTOM_PLATE - yTop(grossLength - deductionRight) - TOP_PLATE * 2)}
              fill="none"
              stroke={PLATE_COLOR}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          )}

          {/* ── Panels ── */}
          {/* Draw panel edges as individual lines, skipping lintel/footer zones */}
          {panels.map((panel, i) => {
            const getExclusions = (xEdge) => {
              const zones = [];
              for (const l of lintels) {
                if (l.x < xEdge && xEdge < l.x + l.width) {
                  // Interpolate lintel height at this x position (trapezoid)
                  const hL = l.heightLeft != null ? l.heightLeft : l.height;
                  const hR = l.heightRight != null ? l.heightRight : l.height;
                  const t = l.width > 0 ? (xEdge - l.x) / l.width : 0;
                  const hAtX = hL + (hR - hL) * t;
                  const eTop = yBottom - l.y - hAtX;
                  const eBot = yBottom - l.y;
                  zones.push([eTop, eBot]);
                }
              }
              for (const f of footers) {
                if (f.x < xEdge && xEdge < f.x + f.width) {
                  zones.push([yBottom - f.height, yBottom]);
                }
              }
              zones.sort((a, b) => a[0] - b[0]);
              return zones;
            };

            const vertSegments = (xEdge) => {
              const excl = getExclusions(xEdge);
              const topY = yTop(xEdge);
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
            const panelMidH = (yTop(leftX) + yTop(rightX)) / 2;

            return (
              <g key={`panel-${i}`}>
                {/* Top edge (sloped for raked) */}
                <line
                  x1={s(leftX)} y1={s(yTop(leftX))}
                  x2={s(rightX)} y2={s(yTop(rightX))}
                  stroke={STROKE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                />
                {/* Bottom horizontal */}
                <line
                  x1={s(leftX)} y1={s(yBottom)}
                  x2={s(rightX)} y2={s(yBottom)}
                  stroke={STROKE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                />
                {/* Left vertical segments */}
                {leftSegs.map(([y1, y2], j) => (
                  <line key={`l-${j}`} x1={s(leftX)} y1={s(y1)} x2={s(leftX)} y2={s(y2)}
                    stroke={STROKE_COLOR} strokeWidth={1} strokeDasharray={DASH} />
                ))}
                {/* Right vertical segments */}
                {rightSegs.map(([y1, y2], j) => (
                  <line key={`r-${j}`} x1={s(rightX)} y1={s(y1)} x2={s(rightX)} y2={s(y2)}
                    stroke={STROKE_COLOR} strokeWidth={1} strokeDasharray={DASH} />
                ))}
                {/* Panel number */}
                <text
                  x={s(panel.x + panel.width / 2)}
                  y={s((panelMidH + yBottom) / 2) + 4}
                  textAnchor="middle" fontSize="10" fill={LABEL_COLOR}
                >
                  P{panel.index + 1}
                </text>
                {/* Panel base width */}
                <text
                  x={s(panel.x + panel.width / 2)}
                  y={s(yBottom) + 14}
                  textAnchor="middle" fontSize="9" fill="#999"
                >
                  {panel.width}
                </text>
              </g>
            );
          })}

          {/* ── Vertical plates at panel outer edges (45mm) ── */}
          {(() => {
            const plates = [];
            for (const panel of panels) {
              if (panel.type === 'end') {
                plates.push(panel.x + panel.width - BOTTOM_PLATE);
              }
              if (deductionRight === 0 && Math.abs(panel.x + panel.width - grossLength) < 1) {
                plates.push(grossLength - BOTTOM_PLATE);
              }
              if (deductionLeft === 0 && Math.abs(panel.x) < 1) {
                plates.push(0);
              }
            }
            const unique = [...new Set(plates)];
            return unique.map((plateX, i) => {
              const pTop = yTop(plateX) + TOP_PLATE * 2;
              const pH = yBottom - BOTTOM_PLATE - pTop;
              return pH > 0 ? (
                <rect
                  key={`edge-plate-${i}`}
                  x={s(plateX)}
                  y={s(pTop)}
                  width={s(BOTTOM_PLATE)}
                  height={s(pH)}
                  fill="none"
                  stroke={PLATE_COLOR}
                  strokeWidth={1}
                  strokeDasharray={DASH}
                />
              ) : null;
            });
          })()}

          {/* ── Panel joint splines (146mm centred on 5mm gap) ── */}
          {/* Skip joints that fall inside a lintel or footer (opening zones) */}
          {panels.slice(0, -1).map((panel, i) => {
            const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
            const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
            const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
            if (insideLintel || insideFooter) return null;

            const splineX = gapCentre - HALF_SPLINE;
            const splineY = yTop(gapCentre) + TOP_PLATE * 2;
            const splineH = yBottom - BOTTOM_PLATE - splineY;
            return splineH > 0 ? (
              <rect
                key={`joint-spline-${i}`}
                x={s(splineX)}
                y={s(splineY)}
                width={s(SPLINE_WIDTH)}
                height={s(splineH)}
                fill="none"
                stroke={PLATE_COLOR}
                strokeWidth={1}
                strokeDasharray={DASH}
              />
            ) : null;
          })}

          {/* ── Openings ── */}
          {openings.map((op, i) => (
            <g key={`opening-${i}`}>
              <rect
                x={s(op.x)}
                y={s(yBottom - op.y - op.drawHeight)}
                width={s(op.drawWidth)}
                height={s(op.drawHeight)}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={1.5}
                strokeDasharray={DASH}
              />
              <line
                x1={s(op.x)} y1={s(yBottom - op.y - op.drawHeight)}
                x2={s(op.x + op.drawWidth)} y2={s(yBottom - op.y)}
                stroke="#bbb" strokeWidth={0.5} strokeDasharray="4,3"
              />
              <line
                x1={s(op.x + op.drawWidth)} y1={s(yBottom - op.y - op.drawHeight)}
                x2={s(op.x)} y2={s(yBottom - op.y)}
                stroke="#bbb" strokeWidth={0.5} strokeDasharray="4,3"
              />
              <text
                x={s(op.x + op.drawWidth / 2)}
                y={s(yBottom - op.y - op.drawHeight / 2) + 4}
                textAnchor="middle" fontSize="10" fill={LABEL_COLOR} fontWeight="bold"
              >
                {op.ref}
              </text>
              <text
                x={s(op.x + op.drawWidth / 2)}
                y={s(yBottom - op.y - op.drawHeight / 2) + 16}
                textAnchor="middle" fontSize="8" fill="#999"
              >
                {op.width_mm}w × {op.height_mm}h
              </text>
            </g>
          ))}

          {/* ── Plates around openings ── */}
          {openings.map((op, i) => {
            const opTopY = s(yBottom - op.y - op.drawHeight);
            const opH = s(op.drawHeight);
            const hasSill = op.y > 0;
            const opMidX = op.x + op.drawWidth / 2;
            const splineTopY = yTop(opMidX) + TOP_PLATE * 2;
            const splineH = yBottom - BOTTOM_PLATE - splineTopY;
            return (
              <g key={`op-plates-${i}`}>
                {hasSill && (
                  <rect
                    x={s(op.x - BOTTOM_PLATE)}
                    y={s(yBottom - op.y)}
                    width={s(op.drawWidth + BOTTOM_PLATE * 2)}
                    height={s(BOTTOM_PLATE)}
                    fill="none" stroke={PLATE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                  />
                )}
                <rect
                  x={s(op.x - BOTTOM_PLATE)} y={opTopY}
                  width={s(BOTTOM_PLATE)} height={opH}
                  fill="none" stroke={PLATE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                />
                <rect
                  x={s(op.x + op.drawWidth)} y={opTopY}
                  width={s(BOTTOM_PLATE)} height={opH}
                  fill="none" stroke={PLATE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                />
                {hasSill && splineH > 0 && (
                  <rect
                    x={s(op.x - BOTTOM_PLATE - SPLINE_WIDTH)}
                    y={s(splineTopY)}
                    width={s(SPLINE_WIDTH)} height={s(splineH)}
                    fill="none" stroke={PLATE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                  />
                )}
                {hasSill && splineH > 0 && (
                  <rect
                    x={s(op.x + op.drawWidth + BOTTOM_PLATE)}
                    y={s(splineTopY)}
                    width={s(SPLINE_WIDTH)} height={s(splineH)}
                    fill="none" stroke={PLATE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                  />
                )}
              </g>
            );
          })}

          {/* ── Footer panels ── */}
          {footers.map((f, i) => (
            <g key={`footer-${i}`}>
              <rect
                x={s(f.x)}
                y={s(yBottom - f.height)}
                width={s(f.width)}
                height={s(f.height)}
                fill="none" stroke={STROKE_COLOR} strokeWidth={1} strokeDasharray={DASH}
              />
              <text
                x={s(f.x + f.width / 2)}
                y={s(yBottom - f.height / 2) + 3}
                textAnchor="middle" fontSize="8" fill={LABEL_COLOR}
              >
                Footer {f.ref}
              </text>
            </g>
          ))}

          {/* ── Lintels (trapezoid for raked/gable) ── */}
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
                <polygon points={pts} fill="none" stroke={STROKE_COLOR} strokeWidth={1} strokeDasharray={DASH} />
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

          {/* ── Running measurement ── */}
          <g>
            {(() => {
              const points = new Set([0, grossLength]);
              if (deductionLeft > 0) points.add(deductionLeft);
              if (deductionRight > 0) points.add(grossLength - deductionRight);

              panels.forEach(p => {
                if (p.type === 'lcut') {
                  if (p.side === 'left') {
                    // Only subtract overhang when opening has a footer (window with sill)
                    const adj = p.openBottom > 0 ? WINDOW_OVERHANG : 0;
                    points.add(Math.round(p.x + p.width - adj));
                  } else if (p.side === 'right') {
                    points.add(Math.round(p.x + p.width));
                  } else {
                    // Pier — right edge borders the right opening
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
              return sorted.map((pt, i) => (
                <g key={`rm-${i}`}>
                  <line x1={s(pt)} y1={tickY - 4} x2={s(pt)} y2={tickY + 4} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <text x={s(pt)} y={tickY + 14} textAnchor="middle" fontSize="9" fill={COLORS.DIMENSION}>
                    {pt}
                  </text>
                </g>
              ));
            })()}
          </g>

          {/* ── Total width dimension ── */}
          <g>
            <line x1={0} y1={s(yBottom) + 44} x2={s(grossLength)} y2={s(yBottom) + 44} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={0} y1={s(yBottom) + 39} x2={0} y2={s(yBottom) + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={s(grossLength)} y1={s(yBottom) + 39} x2={s(grossLength)} y2={s(yBottom) + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <text
              x={s(grossLength / 2)}
              y={s(yBottom) + 60}
              textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold"
            >
              {grossLength} mm
            </text>
          </g>

          {/* ── Height dimension — left ── */}
          <g>
            {(() => {
              const hLeftY = yTop(0);
              const midY = (hLeftY + yBottom) / 2;
              return (
                <>
                  <line x1={-20} y1={s(hLeftY)} x2={-20} y2={s(yBottom)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <line x1={-25} y1={s(hLeftY)} x2={-15} y2={s(hLeftY)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <line x1={-25} y1={s(yBottom)} x2={-15} y2={s(yBottom)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <text
                    x={-35} y={s(midY)}
                    textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold"
                    transform={`rotate(-90, -35, ${s(midY)})`}
                  >
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
                const hRightY = yTop(grossLength);
                const midY = (hRightY + yBottom) / 2;
                const rx = s(grossLength) + 20;
                return (
                  <>
                    <line x1={rx} y1={s(hRightY)} x2={rx} y2={s(yBottom)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                    <line x1={rx - 5} y1={s(hRightY)} x2={rx + 5} y2={s(hRightY)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                    <line x1={rx - 5} y1={s(yBottom)} x2={rx + 5} y2={s(yBottom)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                    <text
                      x={rx + 15} y={s(midY)}
                      textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold"
                      transform={`rotate(-90, ${rx + 15}, ${s(midY)})`}
                    >
                      {layout.heightRight || height} mm
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* ── Course join mid-plates (multi-course walls > 3050mm) ── */}
          {/* Rendered last so lines are visible on top of all framing detail */}
          {isMultiCourse && courses.slice(1).map((course, i) => {
            const joinY = yBottom - course.y;
            // Compute x-extent where wall height >= course.y
            const hL = heightAt ? heightAt(0) : height;
            const hR = heightAt ? heightAt(grossLength) : height;
            let x0, x1;
            if (hL >= course.y && hR >= course.y) {
              x0 = plateLeft; x1 = plateRight;
            } else if (hL >= course.y) {
              x0 = plateLeft;
              x1 = Math.min(plateRight, (course.y - hL) / (hR - hL) * grossLength);
            } else if (hR >= course.y) {
              x0 = Math.max(plateLeft, (course.y - hL) / (hR - hL) * grossLength);
              x1 = plateRight;
            } else {
              return null;
            }
            return (
              <g key={`course-join-${i}`}>
                <line
                  x1={s(x0)} y1={s(joinY)}
                  x2={s(x1)} y2={s(joinY)}
                  stroke="#E74C3C" strokeWidth={1.5} strokeDasharray={DASH}
                />
                <line
                  x1={s(x0)} y1={s(joinY + TOP_PLATE)}
                  x2={s(x1)} y2={s(joinY + TOP_PLATE)}
                  stroke="#E74C3C" strokeWidth={1} strokeDasharray={DASH}
                />
                <line
                  x1={s(x0)} y1={s(joinY - TOP_PLATE)}
                  x2={s(x1)} y2={s(joinY - TOP_PLATE)}
                  stroke="#E74C3C" strokeWidth={1} strokeDasharray={DASH}
                />
                <text
                  x={s(x1) + 6} y={s(joinY) + 4}
                  fontSize="8" fill="#E74C3C" fontWeight="bold"
                >
                  Mid-plate {course.y}
                </text>
              </g>
            );
          })}

        </g>
      </svg>
    </div>
  );
}
