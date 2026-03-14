import { useRef } from 'react';
import { COLORS, WINDOW_OVERHANG, BOTTOM_PLATE, TOP_PLATE, PANEL_GAP, PANEL_PITCH, SPLINE_WIDTH, HSPLINE_CLEARANCE, EPS_GAP, buildHSplineSegments } from '../utils/constants.js';
import PrintButton from './PrintButton.jsx';
import ExportDxfButton from './ExportDxfButton.jsx';

const HALF_SPLINE = SPLINE_WIDTH / 2; // 73mm each side of centre

const MARGIN = { top: 60, right: 40, bottom: 110, left: 60 };
const MAX_SVG_WIDTH = 1200;
const MAX_SVG_HEIGHT = 500;

// ── Line hierarchy (AS1100 / ISO 128 conventions) ──
// Heavy — primary outlines (wall boundary, openings)
const W_HEAVY = 2;
const C_PRIMARY = '#222';
// Medium — visible structural timber (lintel beams, plates)
const W_MEDIUM = 1.2;
const C_STRUCTURE = '#444';
// Light — panel edges, splines, zone boundaries
const W_LIGHT = 0.75;
const C_PANEL = '#666';
const C_ZONE = '#888';
// Fine — annotations, opening cross-hatching
const W_FINE = 0.5;
// Timber fill
const TIMBER_FILL = '#f0f0f0';

// Dash patterns
const DASH_PANEL = '8,4';       // panel joint edges
const DASH_HIDDEN = '4,2';      // hidden / secondary
const DASH_DOT = '8,3,2,3';     // zone boundaries (lintel/footer panels)

const LABEL_COLOR = '#555';

export default function FramingElevation({ layout, wallName, projectName, timberRatio }) {
  const sectionRef = useRef(null);
  if (!layout) return null;

  const { grossLength, height, maxHeight, panels, openings, footerPanels, lintelPanels, deductionLeft, deductionRight, isRaked, heightAt, courses, isMultiCourse } = layout;

  const drawWidth = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const scale = drawWidth / grossLength;
  const useHeight = maxHeight || height;
  const drawHeight = useHeight * scale;
  const svgWidth = MAX_SVG_WIDTH;
  const svgHeight = drawHeight + MARGIN.top + MARGIN.bottom;
  const displayHeight = Math.min(svgHeight, MAX_SVG_HEIGHT);

  const s = (mm) => mm * scale;
  // Y coordinate: 0 is top of SVG draw area (maxHeight), bottom of wall is at maxHeight
  const yTop = (x) => useHeight - (heightAt ? heightAt(x) : height);
  const yBottom = useHeight;

  // Plate lines run full width but skip deduction zones
  const plateLeft = deductionLeft;
  const plateRight = grossLength - deductionRight;

  // Render a vertical spline rect or raked polygon
  const renderSpline = (xL, xR, topL, topR, bot, key) => {
    if (topL >= bot && topR >= bot) return null;
    if (!isRaked || Math.abs(topL - topR) < 0.5) {
      const topY = Math.min(topL, topR);
      return (bot - topY) > 0 ? (
        <rect key={key} x={s(xL)} y={s(topY)} width={s(xR - xL)} height={s(bot - topY)}
          fill="none" stroke={C_ZONE} strokeWidth={W_LIGHT} strokeDasharray={DASH_HIDDEN} />
      ) : null;
    }
    const pts = [];
    pts.push(`${s(xL)},${s(bot)}`);
    pts.push(`${s(xR)},${s(bot)}`);
    if (topR < bot) pts.push(`${s(xR)},${s(topR)}`);
    if (topL < bot) pts.push(`${s(xL)},${s(topL)}`);
    return pts.length >= 3 ? (
      <polygon key={key} points={pts.join(' ')}
        fill="none" stroke={C_ZONE} strokeWidth={W_LIGHT} strokeDasharray={DASH_HIDDEN} />
    ) : null;
  };

  return (
    <div ref={sectionRef} data-print-section style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #ddd' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '8px 12px 0', gap: 4 }}>
        <PrintButton sectionRef={sectionRef} label="Framing" projectName={projectName} wallName={wallName} />
        <ExportDxfButton layout={layout} wallName={wallName} projectName={projectName} planType="framing" />
      </div>
      <svg
        width={svgWidth}
        height={displayHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
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
                stroke={C_PRIMARY}
                strokeWidth={W_HEAVY}
              />
            );
          })()}

          {/* ── Bottom plate (45mm from base) ── */}
          <rect
            x={s(plateLeft)} y={s(yBottom - BOTTOM_PLATE)}
            width={s(plateRight - plateLeft)} height={s(BOTTOM_PLATE)}
            fill={TIMBER_FILL} stroke={C_STRUCTURE} strokeWidth={W_MEDIUM}
          />

          {/* ── Top plate lines (follow slope for raked/gable) ── */}
          {(() => {
            if (!isRaked) {
              const tpY = yTop(plateLeft);
              return (
                <>
                  <rect
                    x={s(plateLeft)} y={s(tpY)}
                    width={s(plateRight - plateLeft)} height={s(TOP_PLATE)}
                    fill={TIMBER_FILL} stroke={C_STRUCTURE} strokeWidth={W_MEDIUM}
                  />
                  <rect
                    x={s(plateLeft)} y={s(tpY + TOP_PLATE)}
                    width={s(plateRight - plateLeft)} height={s(TOP_PLATE)}
                    fill={TIMBER_FILL} stroke={C_STRUCTURE} strokeWidth={W_MEDIUM}
                  />
                </>
              );
            }
            // For raked/gable, draw plate bands as filled polygons following the slope
            const steps = Math.max(20, Math.round(grossLength / 100));
            const buildPlateBand = (topOffset, botOffset) => {
              const pts = [];
              for (let i = 0; i <= steps; i++) {
                const x = plateLeft + (i / steps) * (plateRight - plateLeft);
                pts.push(`${s(x)},${s(yTop(x) + topOffset)}`);
              }
              for (let i = steps; i >= 0; i--) {
                const x = plateLeft + (i / steps) * (plateRight - plateLeft);
                pts.push(`${s(x)},${s(yTop(x) + botOffset)}`);
              }
              return pts.join(' ');
            };
            return (
              <>
                <polygon points={buildPlateBand(0, TOP_PLATE)} fill={TIMBER_FILL} stroke={C_STRUCTURE} strokeWidth={W_MEDIUM} />
                <polygon points={buildPlateBand(TOP_PLATE, TOP_PLATE * 2)} fill={TIMBER_FILL} stroke={C_STRUCTURE} strokeWidth={W_MEDIUM} />
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
              stroke={C_PANEL}
              strokeWidth={W_LIGHT}
              strokeDasharray={DASH_HIDDEN}
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
              fill={TIMBER_FILL}
              stroke={C_STRUCTURE}
              strokeWidth={W_MEDIUM}
            />
          )}
          {deductionRight > 0 && (
            <rect
              x={s(grossLength - deductionRight)}
              y={s(yTop(grossLength))}
              width={s(deductionRight)}
              height={s(yBottom - yTop(grossLength))}
              fill="none"
              stroke={C_PANEL}
              strokeWidth={W_LIGHT}
              strokeDasharray={DASH_HIDDEN}
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
              fill={TIMBER_FILL}
              stroke={C_STRUCTURE}
              strokeWidth={W_MEDIUM}
            />
          )}

          {/* ── Panels ── */}
          {/* Draw panel edges as individual lines, skipping lintel panel/footer panel zones */}
          {/* Use course 0 panels for structural lines (same x-positions across courses) */}
          {(() => {
            const basePanels = panels.filter(p => (p.course ?? 0) === 0);
            const posMap = new Map(basePanels.map((p, idx) => [p.x, idx]));

            return (
              <>
                {/* Structural edge lines — from course 0 only (edges span full wall height) */}
                {basePanels.map((panel, i) => {
                  const getExclusions = (xEdge) => {
                    const zones = [];
                    for (const l of lintelPanels) {
                      if (l.x < xEdge && xEdge < l.x + l.width) {
                        const hL = l.heightLeft != null ? l.heightLeft : l.height;
                        const hR = l.heightRight != null ? l.heightRight : l.height;
                        const t = l.width > 0 ? (xEdge - l.x) / l.width : 0;
                        const hAtX = hL + (hR - hL) * t;
                        const eTop = yBottom - l.y - hAtX;
                        const eBot = yBottom - l.y;
                        zones.push([eTop, eBot]);
                      }
                    }
                    for (const f of footerPanels) {
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

                  return (
                    <g key={`panel-edge-${i}`}>
                      {/* Top edge (sloped for raked, peaked for gable) */}
                      {panel.peakHeight ? (<>
                        <line x1={s(leftX)} y1={s(yTop(leftX))} x2={s(panel.x + panel.peakXLocal)} y2={s(yTop(panel.x + panel.peakXLocal))} stroke={C_PANEL} strokeWidth={W_LIGHT} strokeDasharray={DASH_PANEL} />
                        <line x1={s(panel.x + panel.peakXLocal)} y1={s(yTop(panel.x + panel.peakXLocal))} x2={s(rightX)} y2={s(yTop(rightX))} stroke={C_PANEL} strokeWidth={W_LIGHT} strokeDasharray={DASH_PANEL} />
                      </>) : (
                        <line x1={s(leftX)} y1={s(yTop(leftX))} x2={s(rightX)} y2={s(yTop(rightX))} stroke={C_PANEL} strokeWidth={W_LIGHT} strokeDasharray={DASH_PANEL} />
                      )}
                      {/* Bottom horizontal */}
                      <line
                        x1={s(leftX)} y1={s(yBottom)}
                        x2={s(rightX)} y2={s(yBottom)}
                        stroke={C_PANEL} strokeWidth={W_LIGHT} strokeDasharray={DASH_PANEL}
                      />
                      {/* Left vertical segments */}
                      {leftSegs.map(([y1, y2], j) => (
                        <line key={`l-${j}`} x1={s(leftX)} y1={s(y1)} x2={s(leftX)} y2={s(y2)}
                          stroke={C_PANEL} strokeWidth={W_LIGHT} strokeDasharray={DASH_PANEL} />
                      ))}
                      {/* Right vertical segments */}
                      {rightSegs.map(([y1, y2], j) => (
                        <line key={`r-${j}`} x1={s(rightX)} y1={s(y1)} x2={s(rightX)} y2={s(y2)}
                          stroke={C_PANEL} strokeWidth={W_LIGHT} strokeDasharray={DASH_PANEL} />
                      ))}
                      {/* Panel base width — only from course 0 */}
                      <text
                        x={s(panel.x + panel.width / 2)}
                        y={s(yBottom) + 14}
                        textAnchor="middle" fontSize="9" fill="#999"
                      >
                        {panel.baseWidth}
                      </text>
                    </g>
                  );
                })}
                {/* Course boundary lines — horizontal edges where panels from different courses meet */}
                {isMultiCourse && courses.slice(1).map((course, ci) => {
                  const boundaryY = yBottom - course.y;
                  return basePanels.map((panel, pi) => {
                    const pLeft = panel.x;
                    const pRight = panel.x + panel.width;

                    // Clip to wall extents: skip if wall top is below the boundary at both edges
                    if (yTop(pLeft) >= boundaryY && yTop(pRight) >= boundaryY) return null;

                    // Clamp x-range to where wall is tall enough for this boundary
                    let xL = pLeft;
                    let xR = pRight;
                    if (heightAt) {
                      // For raked/gable, find where the wall height crosses the course boundary
                      // heightAt(x) gives wall height; course.y is boundary height from floor
                      // Wall extends above boundary where heightAt(x) > course.y
                      if (yTop(pLeft) >= boundaryY) {
                        // Left edge is outside wall — find crossing point
                        for (let x = pLeft; x <= pRight; x += 1) {
                          if (yTop(x) < boundaryY) { xL = x; break; }
                        }
                      }
                      if (yTop(pRight) >= boundaryY) {
                        for (let x = pRight; x >= pLeft; x -= 1) {
                          if (yTop(x) < boundaryY) { xR = x; break; }
                        }
                      }
                    }
                    if (xR <= xL) return null;

                    // Split into segments that skip lintel panel zones
                    const excl = [];
                    for (const l of lintelPanels) {
                      const lLeft = l.x;
                      const lRight = l.x + l.width;
                      // Lintel overlaps this panel's x-range and spans the boundary y
                      const lTop = yBottom - l.y - Math.max(l.heightLeft ?? l.height, l.heightRight ?? l.height, l.peakHeight ?? 0);
                      const lBot = yBottom - l.y;
                      if (lRight > xL && lLeft < xR && lTop <= boundaryY && lBot >= boundaryY) {
                        excl.push([Math.max(lLeft, xL), Math.min(lRight, xR)]);
                      }
                    }
                    excl.sort((a, b) => a[0] - b[0]);

                    // Build visible segments
                    const segs = [];
                    let cursor = xL;
                    for (const [eL, eR] of excl) {
                      if (cursor < eL) segs.push([cursor, eL]);
                      cursor = Math.max(cursor, eR);
                    }
                    if (cursor < xR) segs.push([cursor, xR]);

                    return segs.map(([segL, segR], si) => (
                      <line
                        key={`course-edge-c${ci}-p${pi}-s${si}`}
                        x1={s(segL)} y1={s(boundaryY)}
                        x2={s(segR)} y2={s(boundaryY)}
                        stroke={C_PANEL} strokeWidth={W_LIGHT} strokeDasharray={DASH_PANEL}
                      />
                    ));
                  });
                })}
                {/* Panel labels — per course, positioned in each course's vertical region */}
                {panels.map((panel, i) => {
                  const courseIdx = panel.course ?? 0;
                  const course = courses?.[courseIdx];
                  const cY = course?.y ?? 0;
                  const cTop = cY + (course?.height ?? height);
                  const panelCenterX = panel.x + panel.width / 2;

                  // Vertical center of this course region
                  // Clamp to cY so label stays within course when wall height < course bottom (raked walls)
                  const courseMidTop = Math.max(Math.min(heightAt ? heightAt(panelCenterX) : height, cTop), cY);
                  const courseMidY = (yBottom - cY + yBottom - courseMidTop) / 2;

                  const posIdx = posMap.get(panel.x) ?? 0;
                  const label = isMultiCourse ? `P${posIdx + 1}·C${courseIdx + 1}` : `P${posIdx + 1}`;

                  return (
                    <text
                      key={`panel-label-${i}`}
                      x={s(panelCenterX)}
                      y={s(courseMidY) + 4}
                      textAnchor="middle" fontSize={isMultiCourse ? 8 : 10} fill={LABEL_COLOR}
                    >
                      {label}
                    </text>
                  );
                })}
              </>
            );
          })()}

          {/* ── Vertical plates at wall boundary edges (45mm) ── */}
          {(() => {
            const basePanels = panels.filter(p => (p.course ?? 0) === 0);
            const plates = [];
            for (const panel of basePanels) {
              // Edge plates only at wall boundaries — not mid-wall "end" remainder panels
              if (panel.type === 'end') {
                const atLeft = deductionLeft > 0 && Math.abs(panel.x - (deductionLeft + PANEL_GAP)) < 10;
                const atRight = Math.abs(panel.x + panel.width - grossLength) < 10;
                if (atLeft || atRight) {
                  plates.push(panel.x + panel.width - BOTTOM_PLATE);
                }
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
                  fill={TIMBER_FILL}
                  stroke={C_STRUCTURE}
                  strokeWidth={W_MEDIUM}
                />
              ) : null;
            });
          })()}

          {/* ── Panel joint splines (146mm centred on 5mm gap) ── */}
          {/* Skip joints that fall inside a lintel panel or footer panel (opening zones) */}
          {/* Use course 0 panels — x-positions are identical across courses */}
          {panels.filter(p => (p.course ?? 0) === 0).slice(0, -1).map((panel, i) => {
            const gapCentre = panel.x + panel.width + PANEL_GAP / 2;
            const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
            const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
            if (insideLintelPanel || insideFooterPanel) return null;

            const spXL = gapCentre - HALF_SPLINE;
            const spXR = gapCentre + HALF_SPLINE;
            const spTopL = yTop(spXL) + TOP_PLATE * 2;
            const spTopR = yTop(spXR) + TOP_PLATE * 2;
            const spBot = yBottom - BOTTOM_PLATE;

            return renderSpline(spXL, spXR, spTopL, spTopR, spBot, `joint-spline-${i}`);
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
                stroke={C_PRIMARY}
                strokeWidth={W_HEAVY}
              />
              <line
                x1={s(op.x)} y1={s(yBottom - op.y - op.drawHeight)}
                x2={s(op.x + op.drawWidth)} y2={s(yBottom - op.y)}
                stroke="#bbb" strokeWidth={W_FINE} strokeDasharray="4,3"
              />
              <line
                x1={s(op.x + op.drawWidth)} y1={s(yBottom - op.y - op.drawHeight)}
                x2={s(op.x)} y2={s(yBottom - op.y)}
                stroke="#bbb" strokeWidth={W_FINE} strokeDasharray="4,3"
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
            const hasSill = op.y > 0;
            return (
              <g key={`op-plates-${i}`}>
                {/* Window sill plate — sits at sill height, opening width + 45mm each end */}
                {op.sillPlate && (
                  <rect
                    x={s(op.sillPlate.x)}
                    y={s(yBottom - op.sillPlate.y)}
                    width={s(op.sillPlate.width)}
                    height={s(op.sillPlate.height)}
                    fill={TIMBER_FILL} stroke={C_STRUCTURE} strokeWidth={W_MEDIUM}
                  />
                )}
                {/* Window jamb plates — sit on sill plate, each side of opening */}
                {op.leftJamb && (
                  <rect
                    x={s(op.leftJamb.x)}
                    y={s(yBottom - op.leftJamb.y - op.leftJamb.height)}
                    width={s(op.leftJamb.width)}
                    height={s(op.leftJamb.height)}
                    fill={TIMBER_FILL} stroke={C_STRUCTURE} strokeWidth={W_MEDIUM}
                  />
                )}
                {op.rightJamb && (
                  <rect
                    x={s(op.rightJamb.x)}
                    y={s(yBottom - op.rightJamb.y - op.rightJamb.height)}
                    width={s(op.rightJamb.width)}
                    height={s(op.rightJamb.height)}
                    fill={TIMBER_FILL} stroke={C_STRUCTURE} strokeWidth={W_MEDIUM}
                  />
                )}
                {/* Door/garage jamb plates — sit on top of bottom plate */}
                {!hasSill && (
                  <>
                    <rect
                      x={s(op.x - BOTTOM_PLATE)}
                      y={s(yBottom - op.y - op.drawHeight)}
                      width={s(BOTTOM_PLATE)} height={s(op.drawHeight - BOTTOM_PLATE)}
                      fill={TIMBER_FILL} stroke={C_STRUCTURE} strokeWidth={W_MEDIUM}
                    />
                    <rect
                      x={s(op.x + op.drawWidth)}
                      y={s(yBottom - op.y - op.drawHeight)}
                      width={s(BOTTOM_PLATE)} height={s(op.drawHeight - BOTTOM_PLATE)}
                      fill={TIMBER_FILL} stroke={C_STRUCTURE} strokeWidth={W_MEDIUM}
                    />
                  </>
                )}
                {(() => {
                  const spBot = yBottom - BOTTOM_PLATE;
                  const lSpXL = op.x - BOTTOM_PLATE - SPLINE_WIDTH;
                  const lSpXR = op.x - BOTTOM_PLATE;
                  const rSpXL = op.x + op.drawWidth + BOTTOM_PLATE;
                  const rSpXR = rSpXL + SPLINE_WIDTH;
                  return (
                    <>
                      {renderSpline(lSpXL, lSpXR, yTop(lSpXL) + TOP_PLATE * 2, yTop(lSpXR) + TOP_PLATE * 2, spBot, `op-spline-l-${i}`)}
                      {renderSpline(rSpXL, rSpXR, yTop(rSpXL) + TOP_PLATE * 2, yTop(rSpXR) + TOP_PLATE * 2, spBot, `op-spline-r-${i}`)}
                    </>
                  );
                })()}
              </g>
            );
          })}

          {/* ── Footer panels ── */}
          {footerPanels.map((f, i) => (
            <g key={`footer-panel-${i}`}>
              <rect
                x={s(f.x)}
                y={s(yBottom - f.height)}
                width={s(f.width)}
                height={s(f.height)}
                fill="none" stroke={C_PANEL} strokeWidth={W_LIGHT} strokeDasharray={DASH_PANEL}
              />
              <text
                x={s(f.x + f.width / 2)}
                y={s(yBottom - f.height / 2) + 3}
                textAnchor="middle" fontSize="8" fill={LABEL_COLOR}
              >
                Footer Panel {f.ref}
              </text>
              <text
                x={s(f.x + f.width / 2)}
                y={s(yBottom) + 14}
                textAnchor="middle" fontSize="9" fill="#999"
              >
                {f.baseWidth}
              </text>
            </g>
          ))}

          {/* ── Lintel panels (trapezoid for raked/gable, with timber lintel) ── */}
          {lintelPanels.map((l, i) => {
            const hL = l.heightLeft != null ? l.heightLeft : l.height;
            const hR = l.heightRight != null ? l.heightRight : l.height;
            const x1 = s(l.x);
            const x2 = s(l.x + l.width);
            const yBase = s(yBottom - l.y);
            const yTopL = s(yBottom - l.y - hL);
            const yTopR = s(yBottom - l.y - hR);
            const pts = l.peakHeight
              ? `${x1},${yBase} ${x1},${yTopL} ${s(l.x + l.peakXLocal)},${s(yBottom - l.y - l.peakHeight)} ${x2},${yTopR} ${x2},${yBase}`
              : `${x1},${yBase} ${x1},${yTopL} ${x2},${yTopR} ${x2},${yBase}`;
            const midH = Math.max(hL, hR, l.peakHeight || 0) / 2;

            // Timber lintel rect (spans between jamb plates)
            const op = openings.find(o => o.ref === l.ref);
            const lintelH = l.lintelHeight || 200;
            let lintelEl = null;
            if (op) {
              const lintelLeft = op.x - BOTTOM_PLATE + EPS_GAP;
              const lintelRight = op.x + op.drawWidth + BOTTOM_PLATE - EPS_GAP;
              const lintelTop = yBottom - l.y - lintelH;
              const lintelW = lintelRight - lintelLeft;
              if (lintelW > 0 && lintelH > 0) {
                lintelEl = (
                  <rect
                    x={s(lintelLeft)} y={s(lintelTop)}
                    width={s(lintelW)} height={s(lintelH)}
                    fill={TIMBER_FILL} stroke={C_PRIMARY} strokeWidth={1.5}
                  />
                );
              }
            }

            return (
              <g key={`lintel-panel-${i}`}>
                <polygon points={pts} fill="none" stroke={C_PANEL} strokeWidth={W_LIGHT} strokeDasharray={DASH_PANEL} />
                {lintelEl}
                <text
                  x={s(l.x + l.width / 2)}
                  y={s(yBottom - l.y - midH / 2) + 3}
                  textAnchor="middle" fontSize="8" fill={LABEL_COLOR}
                >
                  Lintel Panel {l.ref}
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

              // Use course 0 panels for measurement ticks (same x-positions across courses)
              panels.filter(p => (p.course ?? 0) === 0).forEach(p => {
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
              footerPanels.forEach(f => points.add(Math.round(f.x + f.width)));
              openings.forEach(op => {
                points.add(Math.round(op.x));
                points.add(Math.round(op.x + op.drawWidth));
              });

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

          {/* ── Horizontal splines at course joints (multi-course only) ── */}
          {isMultiCourse && courses.length > 1 && (() => {
            // Use course 0 panels for x-positions (identical across courses)
            const basePanels = panels.filter(p => (p.course ?? 0) === 0);
            // Determine which joints have vertical splines
            const jointHasSpline = [];
            for (let i = 0; i < basePanels.length - 1; i++) {
              const gapCentre = basePanels[i].x + basePanels[i].width + PANEL_GAP / 2;
              const insideLintelPanel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
              const insideFooterPanel = footerPanels.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
              jointHasSpline.push(!insideLintelPanel && !insideFooterPanel);
            }
            return courses.slice(1).map((course, ci) => {
              const joinY = yBottom - course.y;
              const spTopY = joinY - HALF_SPLINE;
              const spBotY = joinY + HALF_SPLINE;
              return basePanels.map((panel, pi) => {
                // Left boundary
                let leftEdge;
                if (pi > 0 && jointHasSpline[pi - 1]) {
                  const gc = basePanels[pi - 1].x + basePanels[pi - 1].width + PANEL_GAP / 2;
                  leftEdge = gc + HALF_SPLINE;
                } else {
                  leftEdge = panel.x + BOTTOM_PLATE;
                }
                // Right boundary
                let rightEdge;
                if (pi < basePanels.length - 1 && jointHasSpline[pi]) {
                  const gc = panel.x + panel.width + PANEL_GAP / 2;
                  rightEdge = gc - HALF_SPLINE;
                } else {
                  rightEdge = panel.x + panel.width - BOTTOM_PLATE;
                }

                const splineLeft = leftEdge + HSPLINE_CLEARANCE;
                const splineRight = rightEdge - HSPLINE_CLEARANCE;
                const segs = buildHSplineSegments(splineLeft, splineRight, lintelPanels, openings);
                if (segs.length === 0) return null;

                return segs.map(([segL, segR], si) => {
                  if (segR <= segL) return null;

                  if (!isRaked) {
                    return (
                      <rect
                        key={`hspline-c${ci}-p${pi}-s${si}`}
                        x={s(segL)}
                        y={s(spTopY)}
                        width={s(segR - segL)}
                        height={s(SPLINE_WIDTH)}
                        fill="none"
                        stroke={C_ZONE}
                        strokeWidth={W_LIGHT}
                        strokeDasharray={DASH_HIDDEN}
                      />
                    );
                  }

                  // Raked/gable: polygon clipped against wall clearance
                  const clAt = (x) => yTop(x) + TOP_PLATE * 2;

                  // Key x-positions where clearance slope changes (gable peak)
                  const breakXs = [segL, segR];
                  if (panel.peakHeight && panel.peakXLocal != null) {
                    const px = panel.x + panel.peakXLocal;
                    if (px > segL && px < segR) breakXs.push(px);
                  }
                  breakXs.sort((a, b) => a - b);

                  // Find where clearance crosses spBotY and spTopY
                  const botCrossings = [];
                  const topCrossings = [];
                  for (let k = 0; k < breakXs.length - 1; k++) {
                    const x1 = breakXs[k], x2 = breakXs[k + 1];
                    const c1 = clAt(x1), c2 = clAt(x2);
                    for (const [thr, arr] of [[spBotY, botCrossings], [spTopY, topCrossings]]) {
                      if ((c1 - thr) * (c2 - thr) < 0) {
                        const t = (thr - c1) / (c2 - c1);
                        arr.push(x1 + t * (x2 - x1));
                      }
                    }
                  }

                  // Determine visible x-range (where clearance < spBotY)
                  let vL = segL, vR = segR;
                  if (clAt(segL) >= spBotY) {
                    if (botCrossings.length === 0) return null;
                    vL = Math.min(...botCrossings);
                  }
                  if (clAt(segR) >= spBotY) {
                    if (botCrossings.length === 0) return null;
                    vR = Math.max(...botCrossings);
                  }
                  if (vR <= vL) return null;

                  // Build polygon
                  const pts = [];
                  pts.push(`${s(vL)},${s(spBotY)}`);
                  pts.push(`${s(vR)},${s(spBotY)}`);
                  if (clAt(vR) < spBotY - 0.5) {
                    pts.push(`${s(vR)},${s(Math.max(spTopY, clAt(vR)))}`);
                  }
                  const topEdgeXs = [];
                  for (const x of topCrossings) {
                    if (x > vL + 0.5 && x < vR - 0.5) topEdgeXs.push(x);
                  }
                  if (panel.peakHeight && panel.peakXLocal != null) {
                    const px = panel.x + panel.peakXLocal;
                    if (px > vL + 0.5 && px < vR - 0.5 && clAt(px) > spTopY) {
                      topEdgeXs.push(px);
                    }
                  }
                  topEdgeXs.sort((a, b) => b - a);
                  for (const x of topEdgeXs) {
                    pts.push(`${s(x)},${s(Math.max(spTopY, clAt(x)))}`);
                  }
                  if (clAt(vL) < spBotY - 0.5) {
                    pts.push(`${s(vL)},${s(Math.max(spTopY, clAt(vL)))}`);
                  }

                  return pts.length >= 3 ? (
                    <polygon
                      key={`hspline-c${ci}-p${pi}-s${si}`}
                      points={pts.join(' ')}
                      fill="none"
                      stroke={C_ZONE}
                      strokeWidth={W_LIGHT}
                      strokeDasharray={DASH_HIDDEN}
                    />
                  ) : null;
                });
              });
            });
          })()}

          {/* Course join mid-plates removed — visible on External Elevation instead */}

        </g>
      </svg>
      {timberRatio && (
        <div style={timberInfoStyles.panel}>
          <div style={timberInfoStyles.header}>
            <span style={timberInfoStyles.title}>Thermal Bridging — Timber Fraction</span>
            <span style={timberInfoStyles.pct}>{timberRatio.timberPercentage.toFixed(1)}% timber</span>
            <span style={timberInfoStyles.sep}>|</span>
            <span style={{ ...timberInfoStyles.pct, color: '#2E7D32' }}>{timberRatio.insulationPercentage.toFixed(1)}% insulation</span>
          </div>
          <div style={timberInfoStyles.row}>
            <table style={timberInfoStyles.table}>
              <thead>
                <tr>
                  <th style={timberInfoStyles.th}>Component</th>
                  <th style={{ ...timberInfoStyles.th, textAlign: 'right' }}>Face Area (m²)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Bottom Plate', timberRatio.breakdown.bottomPlate],
                  ['Top Plates (×2)', timberRatio.breakdown.topPlates],
                  ['End Plates', timberRatio.breakdown.endPlates],
                  ['Sill Plates', timberRatio.breakdown.sillPlates],
                  ['Jamb Plates', timberRatio.breakdown.jambPlates],
                  ['Lintels', timberRatio.breakdown.lintels],
                ].filter(([, v]) => v > 0).map(([label, v], i) => (
                  <tr key={i} style={i % 2 === 0 ? { background: '#fafafa' } : undefined}>
                    <td style={timberInfoStyles.td}>{label}</td>
                    <td style={{ ...timberInfoStyles.td, textAlign: 'right' }}>{(v / 1e6).toFixed(3)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #ccc' }}>
                  <td style={{ ...timberInfoStyles.td, fontWeight: 700 }}>Total Timber</td>
                  <td style={{ ...timberInfoStyles.td, textAlign: 'right', fontWeight: 700 }}>{(timberRatio.timberFaceArea / 1e6).toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
            <div style={timberInfoStyles.summary}>
              <div style={timberInfoStyles.summaryRow}><span>Gross wall area:</span><span>{(timberRatio.grossWallArea / 1e6).toFixed(2)} m²</span></div>
              <div style={timberInfoStyles.summaryRow}><span>Opening area:</span><span>{(timberRatio.openingArea / 1e6).toFixed(2)} m²</span></div>
              <div style={{ ...timberInfoStyles.summaryRow, fontWeight: 700 }}><span>Effective wall area:</span><span>{(timberRatio.effectiveWallArea / 1e6).toFixed(2)} m²</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const timberInfoStyles = {
  panel: {
    margin: '0 12px 12px',
    padding: '10px 14px',
    background: '#f8f9fa',
    borderRadius: 6,
    border: '1px solid #e0e0e0',
    fontSize: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontWeight: 700,
    fontSize: 12,
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginRight: 'auto',
  },
  pct: {
    fontSize: 14,
    fontWeight: 700,
    color: '#D84315',
  },
  sep: {
    color: '#ccc',
    fontSize: 14,
  },
  row: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  table: {
    borderCollapse: 'collapse',
    fontSize: 11,
    flex: '0 0 auto',
  },
  th: {
    textAlign: 'left',
    padding: '3px 10px',
    borderBottom: '2px solid #ddd',
    color: '#666',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  td: {
    padding: '3px 10px',
    borderBottom: '1px solid #eee',
    color: '#333',
  },
  summary: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    fontSize: 11,
    color: '#555',
    paddingTop: 2,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
  },
};
