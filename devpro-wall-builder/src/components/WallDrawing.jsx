import { COLORS, WALL_THICKNESS, PANEL_GAP, WINDOW_OVERHANG } from '../utils/constants.js';

const MARGIN = { top: 60, right: 40, bottom: 110, left: 60 };
const MAX_SVG_WIDTH = 1200;

export default function WallDrawing({ layout, wallName }) {
  if (!layout) return null;

  const { grossLength, height, panels, openings, footers, lintels, deductionLeft, deductionRight } = layout;

  // Scale to fit SVG
  const drawWidth = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const scale = drawWidth / grossLength;
  const drawHeight = height * scale;
  const svgWidth = MAX_SVG_WIDTH;
  const svgHeight = drawHeight + MARGIN.top + MARGIN.bottom;

  const s = (mm) => mm * scale; // scale helper

  return (
    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #ddd' }}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ display: 'block', margin: '0 auto' }}
      >
        {/* Title */}
        <text x={svgWidth / 2} y={24} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333">
          {wallName || 'Wall'} — External Elevation View
        </text>
        <text x={svgWidth / 2} y={42} textAnchor="middle" fontSize="12" fill="#666">
          {grossLength}mm × {height}mm | {layout.totalPanels} panels ({layout.fullPanels} full, {layout.lcutPanels} L-cut, {layout.endPanels} end)
        </text>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Wall outline */}
          <rect
            x={0}
            y={0}
            width={s(grossLength)}
            height={s(height)}
            fill={COLORS.BACKGROUND}
            stroke={COLORS.WALL_OUTLINE}
            strokeWidth={2}
          />

          {/* Corner deductions */}
          {deductionLeft > 0 && (
            <rect
              x={0}
              y={0}
              width={s(deductionLeft)}
              height={s(height)}
              fill="#ddd"
              stroke="#999"
              strokeWidth={1}
              strokeDasharray="4,2"
            />
          )}
          {deductionLeft > 0 && (
            <text x={s(deductionLeft / 2)} y={s(height) + 14} textAnchor="middle" fontSize="9" fill="#999">
              -{deductionLeft}
            </text>
          )}
          {deductionRight > 0 && (
            <rect
              x={s(grossLength - deductionRight)}
              y={0}
              width={s(deductionRight)}
              height={s(height)}
              fill="#ddd"
              stroke="#999"
              strokeWidth={1}
              strokeDasharray="4,2"
            />
          )}
          {deductionRight > 0 && (
            <text x={s(grossLength - deductionRight / 2)} y={s(height) + 14} textAnchor="middle" fontSize="9" fill="#999">
              -{deductionRight}
            </text>
          )}

          {/* Panels */}
          {panels.map((panel, i) => {
            let fill = COLORS.PANEL;
            let stroke = COLORS.PANEL_STROKE;
            if (panel.type === 'lcut') {
              fill = COLORS.LCUT;
              stroke = COLORS.LCUT_STROKE;
            } else if (panel.type === 'end') {
              fill = COLORS.END_CAP;
              stroke = COLORS.END_CAP_STROKE;
            }

            return (
              <g key={`panel-${i}`}>
                <rect
                  x={s(panel.x)}
                  y={0}
                  width={s(panel.width)}
                  height={s(height)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1}
                  opacity={0.7}
                />
                {/* Panel gap line */}
                {i < panels.length - 1 && (
                  <line
                    x1={s(panel.x + panel.width)}
                    y1={0}
                    x2={s(panel.x + panel.width)}
                    y2={s(height)}
                    stroke="#aaa"
                    strokeWidth={1}
                    strokeDasharray="2,2"
                  />
                )}
                {/* Panel number */}
                <text
                  x={s(panel.x + panel.width / 2)}
                  y={s(height / 2) + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fill={COLORS.PANEL_LABEL}
                  fontWeight="bold"
                >
                  P{panel.index + 1}
                </text>
                {/* Panel base width */}
                <text
                  x={s(panel.x + panel.width / 2)}
                  y={s(height) + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#999"
                >
                  {panel.type === 'lcut'
                    ? panel.side === 'pier'
                      ? panel.width - 2 * WINDOW_OVERHANG
                      : panel.width - WINDOW_OVERHANG
                    : panel.width}
                </text>
              </g>
            );
          })}

          {/* Openings */}
          {openings.map((op, i) => (
            <g key={`opening-${i}`}>
              <rect
                x={s(op.x)}
                y={s(height - op.y - op.drawHeight)}
                width={s(op.drawWidth)}
                height={s(op.drawHeight)}
                fill={COLORS.OPENING}
                stroke={COLORS.OPENING_STROKE}
                strokeWidth={2}
              />
              {/* Opening label */}
              <text
                x={s(op.x + op.drawWidth / 2)}
                y={s(height - op.y - op.drawHeight / 2) + 4}
                textAnchor="middle"
                fontSize="11"
                fill="#333"
                fontWeight="bold"
              >
                {op.ref}
              </text>
              <text
                x={s(op.x + op.drawWidth / 2)}
                y={s(height - op.y - op.drawHeight / 2) + 18}
                textAnchor="middle"
                fontSize="9"
                fill="#666"
              >
                {op.width_mm}w × {op.height_mm}h
              </text>
              {/* Cross lines for opening */}
              <line
                x1={s(op.x)} y1={s(height - op.y - op.drawHeight)}
                x2={s(op.x + op.drawWidth)} y2={s(height - op.y)}
                stroke="#ccc" strokeWidth={1}
              />
              <line
                x1={s(op.x + op.drawWidth)} y1={s(height - op.y - op.drawHeight)}
                x2={s(op.x)} y2={s(height - op.y)}
                stroke="#ccc" strokeWidth={1}
              />
            </g>
          ))}

          {/* Footer panels */}
          {footers.map((f, i) => (
            <g key={`footer-${i}`}>
              <rect
                x={s(f.x)}
                y={s(height - f.height)}
                width={s(f.width)}
                height={s(f.height)}
                fill={COLORS.FOOTER}
                stroke={COLORS.FOOTER_STROKE}
                strokeWidth={1.5}
                opacity={1}
              />
              <text
                x={s(f.x + f.width / 2)}
                y={s(height - f.height / 2) + 4}
                textAnchor="middle"
                fontSize="8"
                fill="#2a5f2a"
                fontWeight="bold"
              >
                Footer {f.ref}
              </text>
              <text
                x={s(f.x + f.width / 2)}
                y={s(height) + 14}
                textAnchor="middle"
                fontSize="9"
                fill="#999"
              >
                {f.width}
              </text>
            </g>
          ))}

          {/* Lintels */}
          {lintels.map((l, i) => (
            <g key={`lintel-${i}`}>
              <rect
                x={s(l.x)}
                y={s(height - l.y - l.height)}
                width={s(l.width)}
                height={s(l.height)}
                fill={COLORS.LINTEL}
                stroke={COLORS.LINTEL_STROKE}
                strokeWidth={1.5}
                opacity={1}
              />
              <text
                x={s(l.x + l.width / 2)}
                y={s(height - l.y - l.height / 2) + 4}
                textAnchor="middle"
                fontSize="8"
                fill="#fff"
                fontWeight="bold"
              >
                Lintel {l.ref}
              </text>
            </g>
          ))}

          {/* Running measurement from left edge */}
          <g>
            {(() => {
              const pointSet = new Set([0, grossLength]);

              // Deduction boundaries + gap after
              if (deductionLeft > 0) {
                pointSet.add(deductionLeft);
                pointSet.add(deductionLeft + PANEL_GAP);
              }
              if (deductionRight > 0) {
                pointSet.add(grossLength - deductionRight);
                pointSet.add(grossLength - deductionRight - PANEL_GAP);
              }

              // Panel BASE boundaries (exclude L-cut overhang)
              panels.forEach(p => {
                if (p.type === 'lcut') {
                  if (p.side === 'left') {
                    // overhang extends right over opening
                    pointSet.add(Math.round(p.x));
                    pointSet.add(Math.round(p.x + p.width - WINDOW_OVERHANG));
                  } else if (p.side === 'right') {
                    // overhang extends left over opening
                    pointSet.add(Math.round(p.x + WINDOW_OVERHANG));
                    pointSet.add(Math.round(p.x + p.width));
                  } else if (p.side === 'pier') {
                    // overhang on both sides
                    pointSet.add(Math.round(p.x + WINDOW_OVERHANG));
                    pointSet.add(Math.round(p.x + p.width - WINDOW_OVERHANG));
                  }
                } else {
                  pointSet.add(Math.round(p.x));
                  pointSet.add(Math.round(p.x + p.width));
                }
              });

              // Footer boundaries
              footers.forEach(f => {
                pointSet.add(Math.round(f.x));
                pointSet.add(Math.round(f.x + f.width));
              });

              const points = [...pointSet].sort((a, b) => a - b);
              const tickY = s(height) + 22;
              return points.map((pt, i) => (
                <g key={`rm-${i}`}>
                  <line x1={s(pt)} y1={tickY - 4} x2={s(pt)} y2={tickY + 4} stroke={COLORS.DIMENSION} strokeWidth={1} />
                  <text
                    x={s(pt)}
                    y={tickY + 14}
                    textAnchor="middle"
                    fontSize="9"
                    fill={COLORS.DIMENSION}
                  >
                    {pt}
                  </text>
                </g>
              ));
            })()}
          </g>

          {/* Total width dimension - bottom */}
          <g>
            <line x1={0} y1={s(height) + 44} x2={s(grossLength)} y2={s(height) + 44} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={0} y1={s(height) + 39} x2={0} y2={s(height) + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={s(grossLength)} y1={s(height) + 39} x2={s(grossLength)} y2={s(height) + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <text
              x={s(grossLength / 2)}
              y={s(height) + 60}
              textAnchor="middle"
              fontSize="12"
              fill={COLORS.DIMENSION}
              fontWeight="bold"
            >
              {grossLength} mm
            </text>
          </g>

          {/* Height dimension - left */}
          <g>
            <line x1={-20} y1={0} x2={-20} y2={s(height)} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={-25} y1={0} x2={-15} y2={0} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={-25} y1={s(height)} x2={-15} y2={s(height)} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <text
              x={-35}
              y={s(height / 2)}
              textAnchor="middle"
              fontSize="12"
              fill={COLORS.DIMENSION}
              fontWeight="bold"
              transform={`rotate(-90, -35, ${s(height / 2)})`}
            >
              {height} mm
            </text>
          </g>
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
