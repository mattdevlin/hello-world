import { COLORS, WALL_THICKNESS, PANEL_GAP } from '../utils/constants.js';

const MARGIN = { top: 60, right: 40, bottom: 140, left: 60 };
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
                  y={s(height) - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill={COLORS.PANEL_LABEL}
                  fontWeight="bold"
                >
                  P{panel.index + 1}
                </text>
                {/* Panel width label */}
                <text
                  x={s(panel.x + panel.width / 2)}
                  y={s(height) - 22}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#666"
                >
                  {panel.width}
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
                opacity={0.6}
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
                opacity={0.5}
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

          {/* Running dimensions along bottom */}
          {(() => {
            // Build significant dimension points (skip gap edges to avoid clutter)
            const points = new Set();
            points.add(0);
            points.add(grossLength);

            // Deduction boundaries
            if (deductionLeft > 0) points.add(deductionLeft);
            if (deductionRight > 0) points.add(grossLength - deductionRight);

            // Panel left edges only (right edges are ~5mm from next left edge)
            for (const panel of panels) {
              points.add(panel.x);
            }
            // Last panel right edge
            if (panels.length > 0) {
              const last = panels[panels.length - 1];
              points.add(last.x + last.width);
            }

            const sorted = Array.from(points).sort((a, b) => a - b);
            // Remove near-duplicates (within 10mm)
            const filtered = sorted.filter((v, i) => i === 0 || v - sorted[i - 1] > 10);

            const tickY = s(height) + 10;
            const lineY = s(height) + 24;
            const labelY = s(height) + 40;

            return (
              <g>
                {/* Baseline */}
                <line x1={0} y1={lineY} x2={s(grossLength)} y2={lineY} stroke={COLORS.DIMENSION} strokeWidth={1.5} />

                {filtered.map((mm, i) => {
                  const x = s(mm);
                  const tooClose = i > 0 && s(mm - filtered[i - 1]) < 40;
                  return (
                    <g key={`dim-${i}`}>
                      {/* Tick mark */}
                      <line x1={x} y1={tickY} x2={x} y2={lineY + 6} stroke={COLORS.DIMENSION} strokeWidth={1.5} />
                      {/* Vertical guide line up to wall */}
                      <line x1={x} y1={0} x2={x} y2={tickY} stroke="#ccc" strokeWidth={0.5} strokeDasharray="3,4" />
                      {/* Label — rotate if too close to previous */}
                      <text
                        x={x}
                        y={tooClose ? labelY + 2 : labelY}
                        textAnchor={tooClose ? 'end' : 'middle'}
                        fontSize="10"
                        fill={COLORS.DIMENSION}
                        fontWeight={mm === 0 || mm === grossLength ? 'bold' : 'normal'}
                        transform={tooClose ? `rotate(-45, ${x}, ${labelY + 2})` : undefined}
                      >
                        {mm}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

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
