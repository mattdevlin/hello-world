import { COLORS, WINDOW_OVERHANG, BOTTOM_PLATE, TOP_PLATE } from '../utils/constants.js';

const MARGIN = { top: 60, right: 40, bottom: 110, left: 60 };
const MAX_SVG_WIDTH = 1200;
const DASH = '6,3';
const STROKE_COLOR = '#333';
const LABEL_COLOR = '#555';
const PLATE_COLOR = '#888';

export default function FramingElevation({ layout, wallName }) {
  if (!layout) return null;

  const { grossLength, height, panels, openings, footers, lintels, deductionLeft, deductionRight } = layout;

  // Total height includes bottom plate + panels + two top plates
  const totalHeight = BOTTOM_PLATE + height + TOP_PLATE * 2;

  const drawWidth = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const scale = drawWidth / grossLength;
  const drawHeight = totalHeight * scale;
  const svgWidth = MAX_SVG_WIDTH;
  const svgHeight = drawHeight + MARGIN.top + MARGIN.bottom;

  const s = (mm) => mm * scale;

  // Y origin: bottom of SVG drawing area = bottom of bottom plate
  // Bottom plate sits at bottom, panels sit on top of bottom plate,
  // two top plates sit on top of panels.
  // SVG y=0 is top, so:
  //   top plate 2 top:    y = 0
  //   top plate 1 top:    y = s(TOP_PLATE)
  //   panel top:          y = s(TOP_PLATE * 2)
  //   panel bottom:       y = s(TOP_PLATE * 2 + height)
  //   bottom plate top:   y = s(TOP_PLATE * 2 + height)
  //   bottom plate bottom:y = s(totalHeight)

  const topPlatesY = 0;
  const panelTopY = s(TOP_PLATE * 2);
  const panelBottomY = s(TOP_PLATE * 2 + height);
  const bottomPlateY = panelBottomY;

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
          {wallName || 'Wall'} — Framing Elevation
        </text>
        <text x={svgWidth / 2} y={42} textAnchor="middle" fontSize="12" fill="#666">
          {grossLength}mm × {totalHeight}mm (incl. plates)
        </text>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>

          {/* ── Bottom plate ── */}
          <rect
            x={0}
            y={bottomPlateY}
            width={s(grossLength)}
            height={s(BOTTOM_PLATE)}
            fill="none"
            stroke={PLATE_COLOR}
            strokeWidth={1.5}
          />
          <text
            x={s(grossLength) + 8}
            y={bottomPlateY + s(BOTTOM_PLATE) / 2 + 3}
            fontSize="9"
            fill={PLATE_COLOR}
          >
            Bottom Plate {BOTTOM_PLATE}mm
          </text>

          {/* ── Top plate 1 (lower) ── */}
          <rect
            x={0}
            y={s(TOP_PLATE)}
            width={s(grossLength)}
            height={s(TOP_PLATE)}
            fill="none"
            stroke={PLATE_COLOR}
            strokeWidth={1.5}
          />
          <text
            x={s(grossLength) + 8}
            y={s(TOP_PLATE) + s(TOP_PLATE) / 2 + 3}
            fontSize="9"
            fill={PLATE_COLOR}
          >
            Top Plate 1 {TOP_PLATE}mm
          </text>

          {/* ── Top plate 2 (upper) ── */}
          <rect
            x={0}
            y={0}
            width={s(grossLength)}
            height={s(TOP_PLATE)}
            fill="none"
            stroke={PLATE_COLOR}
            strokeWidth={1.5}
          />
          <text
            x={s(grossLength) + 8}
            y={s(TOP_PLATE) / 2 + 3}
            fontSize="9"
            fill={PLATE_COLOR}
          >
            Top Plate 2 {TOP_PLATE}mm
          </text>

          {/* ── Wall outline (panel zone only) ── */}
          <rect
            x={0}
            y={panelTopY}
            width={s(grossLength)}
            height={s(height)}
            fill="none"
            stroke={STROKE_COLOR}
            strokeWidth={1.5}
          />

          {/* ── Corner deductions ── */}
          {deductionLeft > 0 && (
            <rect
              x={0}
              y={panelTopY}
              width={s(deductionLeft)}
              height={s(height)}
              fill="none"
              stroke={STROKE_COLOR}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          )}
          {deductionLeft > 0 && (
            <text x={s(deductionLeft / 2)} y={panelBottomY + 14} textAnchor="middle" fontSize="9" fill="#999">
              -{deductionLeft}
            </text>
          )}
          {deductionRight > 0 && (
            <rect
              x={s(grossLength - deductionRight)}
              y={panelTopY}
              width={s(deductionRight)}
              height={s(height)}
              fill="none"
              stroke={STROKE_COLOR}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          )}
          {deductionRight > 0 && (
            <text x={s(grossLength - deductionRight / 2)} y={panelBottomY + 14} textAnchor="middle" fontSize="9" fill="#999">
              -{deductionRight}
            </text>
          )}

          {/* ── Panels ── */}
          {panels.map((panel, i) => (
            <g key={`panel-${i}`}>
              <rect
                x={s(panel.x)}
                y={panelTopY}
                width={s(panel.width)}
                height={s(height)}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={1}
                strokeDasharray={DASH}
              />
              {/* Panel number */}
              <text
                x={s(panel.x + panel.width / 2)}
                y={panelTopY + s(height / 2) + 4}
                textAnchor="middle"
                fontSize="10"
                fill={LABEL_COLOR}
              >
                P{panel.index + 1}
              </text>
              {/* Panel base width */}
              <text
                x={s(panel.x + panel.width / 2)}
                y={panelBottomY + 14}
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
          ))}

          {/* ── Openings ── */}
          {openings.map((op, i) => (
            <g key={`opening-${i}`}>
              <rect
                x={s(op.x)}
                y={panelTopY + s(height - op.y - op.drawHeight)}
                width={s(op.drawWidth)}
                height={s(op.drawHeight)}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={1.5}
                strokeDasharray={DASH}
              />
              {/* Cross lines */}
              <line
                x1={s(op.x)} y1={panelTopY + s(height - op.y - op.drawHeight)}
                x2={s(op.x + op.drawWidth)} y2={panelTopY + s(height - op.y)}
                stroke="#bbb" strokeWidth={0.5} strokeDasharray="4,3"
              />
              <line
                x1={s(op.x + op.drawWidth)} y1={panelTopY + s(height - op.y - op.drawHeight)}
                x2={s(op.x)} y2={panelTopY + s(height - op.y)}
                stroke="#bbb" strokeWidth={0.5} strokeDasharray="4,3"
              />
              {/* Label */}
              <text
                x={s(op.x + op.drawWidth / 2)}
                y={panelTopY + s(height - op.y - op.drawHeight / 2) + 4}
                textAnchor="middle"
                fontSize="10"
                fill={LABEL_COLOR}
                fontWeight="bold"
              >
                {op.ref}
              </text>
              <text
                x={s(op.x + op.drawWidth / 2)}
                y={panelTopY + s(height - op.y - op.drawHeight / 2) + 16}
                textAnchor="middle"
                fontSize="8"
                fill="#999"
              >
                {op.width_mm}w × {op.height_mm}h
              </text>
            </g>
          ))}

          {/* ── Footer panels ── */}
          {footers.map((f, i) => (
            <g key={`footer-${i}`}>
              <rect
                x={s(f.x)}
                y={panelTopY + s(height - f.height)}
                width={s(f.width)}
                height={s(f.height)}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={1}
                strokeDasharray={DASH}
              />
              <text
                x={s(f.x + f.width / 2)}
                y={panelTopY + s(height - f.height / 2) + 3}
                textAnchor="middle"
                fontSize="8"
                fill={LABEL_COLOR}
              >
                Footer {f.ref}
              </text>
            </g>
          ))}

          {/* ── Lintels ── */}
          {lintels.map((l, i) => (
            <g key={`lintel-${i}`}>
              <rect
                x={s(l.x)}
                y={panelTopY + s(height - l.y - l.height)}
                width={s(l.width)}
                height={s(l.height)}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={1}
                strokeDasharray={DASH}
              />
              <text
                x={s(l.x + l.width / 2)}
                y={panelTopY + s(height - l.y - l.height / 2) + 3}
                textAnchor="middle"
                fontSize="8"
                fill={LABEL_COLOR}
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
                  if (p.side === 'left') {
                    points.add(Math.round(p.x + p.width - WINDOW_OVERHANG));
                  } else if (p.side === 'right') {
                    points.add(Math.round(p.x + p.width));
                  } else {
                    points.add(Math.round(p.x + p.width - WINDOW_OVERHANG));
                  }
                } else {
                  points.add(Math.round(p.x + p.width));
                }
              });
              footers.forEach(f => points.add(Math.round(f.x + f.width)));

              const sorted = [...points].sort((a, b) => a - b);
              const tickY = panelBottomY + 22;
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
            <line x1={0} y1={panelBottomY + 44} x2={s(grossLength)} y2={panelBottomY + 44} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={0} y1={panelBottomY + 39} x2={0} y2={panelBottomY + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={s(grossLength)} y1={panelBottomY + 39} x2={s(grossLength)} y2={panelBottomY + 49} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <text
              x={s(grossLength / 2)}
              y={panelBottomY + 60}
              textAnchor="middle"
              fontSize="12"
              fill={COLORS.DIMENSION}
              fontWeight="bold"
            >
              {grossLength} mm
            </text>
          </g>

          {/* ── Total height dimension (including plates) — left ── */}
          <g>
            <line x1={-20} y1={0} x2={-20} y2={s(totalHeight)} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={-25} y1={0} x2={-15} y2={0} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <line x1={-25} y1={s(totalHeight)} x2={-15} y2={s(totalHeight)} stroke={COLORS.DIMENSION} strokeWidth={1} />
            <text
              x={-35}
              y={s(totalHeight / 2)}
              textAnchor="middle"
              fontSize="12"
              fill={COLORS.DIMENSION}
              fontWeight="bold"
              transform={`rotate(-90, -35, ${s(totalHeight / 2)})`}
            >
              {totalHeight} mm
            </text>
          </g>

          {/* ── Panel height dimension — far left ── */}
          <g>
            <line x1={-46} y1={panelTopY} x2={-46} y2={panelBottomY} stroke="#999" strokeWidth={0.5} />
            <line x1={-50} y1={panelTopY} x2={-42} y2={panelTopY} stroke="#999" strokeWidth={0.5} />
            <line x1={-50} y1={panelBottomY} x2={-42} y2={panelBottomY} stroke="#999" strokeWidth={0.5} />
            <text
              x={-54}
              y={panelTopY + s(height) / 2}
              textAnchor="middle"
              fontSize="9"
              fill="#999"
              transform={`rotate(-90, -54, ${panelTopY + s(height) / 2})`}
            >
              {height} panels
            </text>
          </g>

        </g>
      </svg>
    </div>
  );
}
