import { useRef } from 'react';
import { COLORS, WALL_THICKNESS, PANEL_GAP, WINDOW_OVERHANG } from '../utils/constants.js';
import PrintButton from './PrintButton.jsx';

const MARGIN = { top: 60, right: 40, bottom: 110, left: 60 };
const MAX_SVG_WIDTH = 1200;

export default function WallDrawing({ layout, wallName }) {
  const sectionRef = useRef(null);
  if (!layout) return null;

  const {
    grossLength, height, maxHeight, panels, openings, footers, lintels,
    deductionLeft, deductionRight, isRaked, heightAt, profile,
    courses, isMultiCourse,
  } = layout;

  const drawWidth = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const scale = drawWidth / grossLength;
  const drawMaxH = (maxHeight || height) * scale;
  const svgWidth = MAX_SVG_WIDTH;
  const svgHeight = drawMaxH + MARGIN.top + MARGIN.bottom;

  const s = (mm) => mm * scale;
  // Y coordinate: 0 is at bottom of wall, SVG Y increases downward
  // So wall bottom is at drawMaxH, wall top at drawMaxH - wallHeight
  const yBottom = drawMaxH;
  const yTop = (x) => drawMaxH - (heightAt ? heightAt(x) : height) * scale;

  // Wall outline as polygon (bottom-left, top-left, ... top-right, bottom-right)
  function wallOutlinePoints() {
    const pts = [];
    pts.push(`${s(0)},${yBottom}`); // bottom-left
    // Top edge: sample points for smooth line
    const steps = Math.max(2, Math.ceil(grossLength / 50));
    for (let i = 0; i <= steps; i++) {
      const x = (grossLength * i) / steps;
      pts.push(`${s(x)},${yTop(x)}`);
    }
    pts.push(`${s(grossLength)},${yBottom}`); // bottom-right
    return pts.join(' ');
  }

  return (
    <div ref={sectionRef} data-print-section style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #ddd' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px 0' }}>
        <PrintButton sectionRef={sectionRef} label="Elevation" />
      </div>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ display: 'block', margin: '0 auto' }}
      >
        {/* Title */}
        <text x={svgWidth / 2} y={24} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333">
          {wallName || 'Wall'} — External Elevation View
          {isRaked ? ` (${profile})` : ''}
        </text>
        <text x={svgWidth / 2} y={42} textAnchor="middle" fontSize="12" fill="#666">
          {grossLength}mm × {isRaked ? `${layout.heightLeft}–${layout.heightRight}mm` : `${height}mm`}
          {' '}| {layout.totalPanels} panels ({layout.fullPanels} full, {layout.lcutPanels} L-cut, {layout.endPanels} end)
          {isMultiCourse && ` | ${courses.length} courses: ${courses.map(c => `${c.height}mm (${c.sheetHeight}mm sheet)`).join(' + ')}`}
        </text>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Wall outline */}
          <polygon
            points={wallOutlinePoints()}
            fill={COLORS.BACKGROUND}
            stroke={COLORS.WALL_OUTLINE}
            strokeWidth={2}
          />

          {/* Corner deductions */}
          {deductionLeft > 0 && (
            <>
              <polygon
                points={`${s(0)},${yBottom} ${s(0)},${yTop(0)} ${s(deductionLeft)},${yTop(deductionLeft)} ${s(deductionLeft)},${yBottom}`}
                fill="#ddd" stroke="#999" strokeWidth={1} strokeDasharray="4,2"
              />
              <text x={s(deductionLeft / 2)} y={yBottom + 14} textAnchor="middle" fontSize="9" fill="#999">
                -{deductionLeft}
              </text>
            </>
          )}
          {deductionRight > 0 && (
            <>
              <polygon
                points={`${s(grossLength - deductionRight)},${yBottom} ${s(grossLength - deductionRight)},${yTop(grossLength - deductionRight)} ${s(grossLength)},${yTop(grossLength)} ${s(grossLength)},${yBottom}`}
                fill="#ddd" stroke="#999" strokeWidth={1} strokeDasharray="4,2"
              />
              <text x={s(grossLength - deductionRight / 2)} y={yBottom + 14} textAnchor="middle" fontSize="9" fill="#999">
                -{deductionRight}
              </text>
            </>
          )}

          {/* Panels */}
          {panels.map((panel, i) => {
            let fill = COLORS.PANEL;
            let stroke = COLORS.PANEL_STROKE;
            if (panel.type === 'lcut') { fill = COLORS.LCUT; stroke = COLORS.LCUT_STROKE; }
            else if (panel.type === 'end') { fill = COLORS.END_CAP; stroke = COLORS.END_CAP_STROKE; }

            const pLeft = panel.x;
            const pRight = panel.x + panel.width;
            const pts = `${s(pLeft)},${yBottom} ${s(pLeft)},${yTop(pLeft)} ${s(pRight)},${yTop(pRight)} ${s(pRight)},${yBottom}`;

            return (
              <g key={`panel-${i}`}>
                <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={1} opacity={0.7} />
                {i < panels.length - 1 && (
                  <line
                    x1={s(pRight)} y1={yTop(pRight)}
                    x2={s(pRight)} y2={yBottom}
                    stroke="#aaa" strokeWidth={1} strokeDasharray="2,2"
                  />
                )}
                <text
                  x={s(pLeft + panel.width / 2)}
                  y={yBottom - s((panel.heightLeft || height) / 2) + 4}
                  textAnchor="middle" fontSize="11" fill={COLORS.PANEL_LABEL} fontWeight="bold"
                >
                  P{panel.index + 1}
                </text>
                <text x={s(pLeft + panel.width / 2)} y={yBottom + 14} textAnchor="middle" fontSize="9" fill="#999">
                  {panel.width}
                </text>
              </g>
            );
          })}

          {/* Openings */}
          {openings.map((op, i) => (
            <g key={`opening-${i}`}>
              <rect
                x={s(op.x)} y={yBottom - s(op.y + op.drawHeight)}
                width={s(op.drawWidth)} height={s(op.drawHeight)}
                fill={COLORS.OPENING} stroke={COLORS.OPENING_STROKE} strokeWidth={2}
              />
              <text
                x={s(op.x + op.drawWidth / 2)} y={yBottom - s(op.y + op.drawHeight / 2) + 4}
                textAnchor="middle" fontSize="11" fill="#333" fontWeight="bold"
              >
                {op.ref}
              </text>
              <text
                x={s(op.x + op.drawWidth / 2)} y={yBottom - s(op.y + op.drawHeight / 2) + 18}
                textAnchor="middle" fontSize="9" fill="#666"
              >
                {op.width_mm}w × {op.height_mm}h
              </text>
              <line x1={s(op.x)} y1={yBottom - s(op.y + op.drawHeight)} x2={s(op.x + op.drawWidth)} y2={yBottom - s(op.y)} stroke="#ccc" strokeWidth={1} />
              <line x1={s(op.x + op.drawWidth)} y1={yBottom - s(op.y + op.drawHeight)} x2={s(op.x)} y2={yBottom - s(op.y)} stroke="#ccc" strokeWidth={1} />
            </g>
          ))}

          {/* Footers */}
          {footers.map((f, i) => (
            <g key={`footer-${i}`}>
              <rect
                x={s(f.x)} y={yBottom - s(f.height)}
                width={s(f.width)} height={s(f.height)}
                fill={COLORS.FOOTER} stroke={COLORS.FOOTER_STROKE} strokeWidth={1.5}
              />
              <text
                x={s(f.x + f.width / 2)} y={yBottom - s(f.height / 2) + 4}
                textAnchor="middle" fontSize="8" fill="#2a5f2a" fontWeight="bold"
              >
                Footer {f.ref}
              </text>
              <text x={s(f.x + f.width / 2)} y={yBottom + 14} textAnchor="middle" fontSize="9" fill="#999">
                {f.width}
              </text>
            </g>
          ))}

          {/* Lintels (trapezoid for raked/gable) */}
          {lintels.map((l, i) => {
            const hL = l.heightLeft != null ? l.heightLeft : l.height;
            const hR = l.heightRight != null ? l.heightRight : l.height;
            const x1 = s(l.x);
            const x2 = s(l.x + l.width);
            const yBase = yBottom - s(l.y);
            const yTopL = yBottom - s(l.y + hL);
            const yTopR = yBottom - s(l.y + hR);
            const pts = `${x1},${yBase} ${x1},${yTopL} ${x2},${yTopR} ${x2},${yBase}`;
            const midH = (hL + hR) / 2;
            return (
              <g key={`lintel-${i}`}>
                <polygon points={pts} fill={COLORS.LINTEL} stroke={COLORS.LINTEL_STROKE} strokeWidth={1.5} />
                <text
                  x={s(l.x + l.width / 2)} y={yBottom - s(l.y + midH / 2) + 4}
                  textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold"
                >
                  Lintel {l.ref}
                </text>
              </g>
            );
          })}

          {/* Course join lines (multi-course walls > 3000mm) */}
          {isMultiCourse && courses.slice(1).map((course, i) => {
            const joinY = yBottom - s(course.y);
            return (
              <g key={`course-join-${i}`}>
                <line
                  x1={s(0)} y1={joinY}
                  x2={s(grossLength)} y2={joinY}
                  stroke="#E74C3C" strokeWidth={2} strokeDasharray="8,4"
                />
                <text
                  x={s(grossLength) + 8} y={joinY + 4}
                  fontSize="9" fill="#E74C3C" fontWeight="bold"
                >
                  {course.y}
                </text>
              </g>
            );
          })}

          {/* Running measurement */}
          <g>
            {(() => {
              const points = new Set([0, grossLength]);
              if (deductionLeft > 0) points.add(deductionLeft);
              if (deductionRight > 0) points.add(grossLength - deductionRight);
              panels.forEach(p => points.add(Math.round(p.x + p.width)));
              footers.forEach(f => points.add(Math.round(f.x + f.width)));
              const sorted = [...points].sort((a, b) => a - b);
              const tickY = yBottom + 22;
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

          {/* Total width dimension */}
          <g>
            <line x1={0} y1={yBottom + 44} x2={s(grossLength)} y2={yBottom + 44} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={0} y1={yBottom + 39} x2={0} y2={yBottom + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={s(grossLength)} y1={yBottom + 39} x2={s(grossLength)} y2={yBottom + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <text x={s(grossLength / 2)} y={yBottom + 60} textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold">
              {grossLength} mm
            </text>
          </g>

          {/* Height dimensions — left side */}
          <g>
            {(() => {
              const hL = heightAt ? heightAt(0) : height;
              return (
                <>
                  <line x1={-20} y1={yTop(0)} x2={-20} y2={yBottom} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <line x1={-25} y1={yTop(0)} x2={-15} y2={yTop(0)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <line x1={-25} y1={yBottom} x2={-15} y2={yBottom} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <text
                    x={-35} y={(yTop(0) + yBottom) / 2}
                    textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold"
                    transform={`rotate(-90, -35, ${(yTop(0) + yBottom) / 2})`}
                  >
                    {Math.round(hL)} mm
                  </text>
                </>
              );
            })()}
          </g>

          {/* Height dimension — right side (if raked/gable) */}
          {isRaked && (
            <g>
              {(() => {
                const hR = heightAt(grossLength);
                const xR = s(grossLength);
                return (
                  <>
                    <line x1={xR + 20} y1={yTop(grossLength)} x2={xR + 20} y2={yBottom} stroke={COLORS.DIMENSION} strokeWidth={1} />
                    <line x1={xR + 15} y1={yTop(grossLength)} x2={xR + 25} y2={yTop(grossLength)} stroke={COLORS.DIMENSION} strokeWidth={1} />
                    <line x1={xR + 15} y1={yBottom} x2={xR + 25} y2={yBottom} stroke={COLORS.DIMENSION} strokeWidth={1} />
                    <text
                      x={xR + 35} y={(yTop(grossLength) + yBottom) / 2}
                      textAnchor="middle" fontSize="12" fill={COLORS.DIMENSION} fontWeight="bold"
                      transform={`rotate(90, ${xR + 35}, ${(yTop(grossLength) + yBottom) / 2})`}
                    >
                      {Math.round(hR)} mm
                    </text>
                  </>
                );
              })()}
            </g>
          )}

          {/* Peak height dimension (gable) */}
          {profile === 'gable' && layout.peakPosition != null && (
            <g>
              {(() => {
                const px = layout.peakPosition;
                const ph = layout.peakHeight;
                return (
                  <>
                    <line x1={s(px)} y1={yTop(px)} x2={s(px)} y2={yTop(px) - 12} stroke={COLORS.DIMENSION} strokeWidth={1} strokeDasharray="3,2" />
                    <text x={s(px)} y={yTop(px) - 16} textAnchor="middle" fontSize="10" fill={COLORS.DIMENSION} fontWeight="bold">
                      Peak {ph}mm
                    </text>
                  </>
                );
              })()}
            </g>
          )}
        </g>

        {/* Legend */}
        <g transform={`translate(${MARGIN.left}, ${svgHeight - 20})`}>
          {[
            { color: COLORS.PANEL, label: 'Full Panel' },
            { color: COLORS.LCUT, label: 'L-Cut Panel' },
            { color: COLORS.END_CAP, label: 'End Panel' },
            { color: COLORS.FOOTER, label: 'Footer' },
            { color: COLORS.LINTEL, label: 'Lintel' },
          ].map((item, i) => (
            <g key={i} transform={`translate(${i * 120}, 0)`}>
              <rect x={0} y={-8} width={12} height={12} fill={item.color} opacity={0.7} stroke="#666" strokeWidth={0.5} />
              <text x={16} y={2} fontSize="10" fill="#555">{item.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
