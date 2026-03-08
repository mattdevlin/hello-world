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

  const drawWidth = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const scale = drawWidth / grossLength;
  const drawHeight = height * scale;
  const svgWidth = MAX_SVG_WIDTH;
  const svgHeight = drawHeight + MARGIN.top + MARGIN.bottom;

  const s = (mm) => mm * scale;

  // Plate lines run full width but skip deduction zones
  const plateLeft = deductionLeft;
  const plateRight = grossLength - deductionRight;

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
          {grossLength}mm × {height}mm | Bottom plate {BOTTOM_PLATE}mm, 2× top plate {TOP_PLATE}mm
        </text>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>

          {/* ── Wall outline ── */}
          <rect
            x={0}
            y={0}
            width={s(grossLength)}
            height={s(height)}
            fill="none"
            stroke={STROKE_COLOR}
            strokeWidth={1.5}
          />

          {/* ── Bottom plate line (45mm from base) ── */}
          <line
            x1={s(plateLeft)} y1={s(height - BOTTOM_PLATE)}
            x2={s(plateRight)} y2={s(height - BOTTOM_PLATE)}
            stroke={PLATE_COLOR}
            strokeWidth={1}
            strokeDasharray={DASH}
          />

          {/* ── Top plate 1 (45mm from top) ── */}
          <line
            x1={s(plateLeft)} y1={s(TOP_PLATE)}
            x2={s(plateRight)} y2={s(TOP_PLATE)}
            stroke={PLATE_COLOR}
            strokeWidth={1}
            strokeDasharray={DASH}
          />

          {/* ── Top plate 2 (90mm from top) ── */}
          <line
            x1={s(plateLeft)} y1={s(TOP_PLATE * 2)}
            x2={s(plateRight)} y2={s(TOP_PLATE * 2)}
            stroke={PLATE_COLOR}
            strokeWidth={1}
            strokeDasharray={DASH}
          />

          {/* ── Corner deductions ── */}
          {deductionLeft > 0 && (
            <rect
              x={0}
              y={0}
              width={s(deductionLeft)}
              height={s(height)}
              fill="none"
              stroke={STROKE_COLOR}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          )}
          {deductionLeft > 0 && (
            <text x={s(deductionLeft / 2)} y={s(height) + 14} textAnchor="middle" fontSize="9" fill="#999">
              -{deductionLeft}
            </text>
          )}
          {/* Vertical plate at left deduction (45mm, between bottom plate and lowest top plate) */}
          {deductionLeft > 0 && (
            <rect
              x={s(deductionLeft)}
              y={s(TOP_PLATE * 2)}
              width={s(BOTTOM_PLATE)}
              height={s(height - BOTTOM_PLATE - TOP_PLATE * 2)}
              fill="none"
              stroke={PLATE_COLOR}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          )}
          {deductionRight > 0 && (
            <rect
              x={s(grossLength - deductionRight)}
              y={0}
              width={s(deductionRight)}
              height={s(height)}
              fill="none"
              stroke={STROKE_COLOR}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          )}
          {deductionRight > 0 && (
            <text x={s(grossLength - deductionRight / 2)} y={s(height) + 14} textAnchor="middle" fontSize="9" fill="#999">
              -{deductionRight}
            </text>
          )}
          {/* Vertical plate at right deduction (45mm, between bottom plate and lowest top plate) */}
          {deductionRight > 0 && (
            <rect
              x={s(grossLength - deductionRight - BOTTOM_PLATE)}
              y={s(TOP_PLATE * 2)}
              width={s(BOTTOM_PLATE)}
              height={s(height - BOTTOM_PLATE - TOP_PLATE * 2)}
              fill="none"
              stroke={PLATE_COLOR}
              strokeWidth={1}
              strokeDasharray={DASH}
            />
          )}

          {/* ── Panels ── */}
          {/* Draw panel edges as individual lines, skipping lintel/footer zones */}
          {panels.map((panel, i) => {
            // Build exclusion zones (in wall mm from top, as SVG y ranges)
            // For a vertical edge at xEdge, find lintels/footers that span it
            const getExclusions = (xEdge) => {
              const zones = [];
              for (const l of lintels) {
                if (l.x < xEdge && xEdge < l.x + l.width) {
                  // Lintel: top of wall down to bottom of lintel
                  // l.y is distance from bottom of wall to top of lintel
                  // l.height is lintel height downward from l.y
                  const yTop = height - l.y - l.height;
                  const yBot = height - l.y;
                  zones.push([yTop, yBot]);
                }
              }
              for (const f of footers) {
                if (f.x < xEdge && xEdge < f.x + f.width) {
                  // Footer sits at bottom of wall, f.height tall
                  zones.push([height - f.height, height]);
                }
              }
              // Sort by start
              zones.sort((a, b) => a[0] - b[0]);
              return zones;
            };

            // Build vertical line segments that skip exclusion zones
            const vertSegments = (xEdge) => {
              const excl = getExclusions(xEdge);
              const segs = [];
              let cursor = 0;
              for (const [eTop, eBot] of excl) {
                if (cursor < eTop) {
                  segs.push([cursor, eTop]);
                }
                cursor = Math.max(cursor, eBot);
              }
              if (cursor < height) {
                segs.push([cursor, height]);
              }
              return segs;
            };

            const leftX = panel.x;
            const rightX = panel.x + panel.width;
            const leftSegs = vertSegments(leftX);
            const rightSegs = vertSegments(rightX);

            return (
              <g key={`panel-${i}`}>
                {/* Top horizontal */}
                <line
                  x1={s(leftX)} y1={0}
                  x2={s(rightX)} y2={0}
                  stroke={STROKE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                />
                {/* Bottom horizontal */}
                <line
                  x1={s(leftX)} y1={s(height)}
                  x2={s(rightX)} y2={s(height)}
                  stroke={STROKE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                />
                {/* Left vertical segments */}
                {leftSegs.map(([y1, y2], j) => (
                  <line
                    key={`l-${j}`}
                    x1={s(leftX)} y1={s(y1)}
                    x2={s(leftX)} y2={s(y2)}
                    stroke={STROKE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                  />
                ))}
                {/* Right vertical segments */}
                {rightSegs.map(([y1, y2], j) => (
                  <line
                    key={`r-${j}`}
                    x1={s(rightX)} y1={s(y1)}
                    x2={s(rightX)} y2={s(y2)}
                    stroke={STROKE_COLOR} strokeWidth={1} strokeDasharray={DASH}
                  />
                ))}
                {/* Panel number */}
                <text
                  x={s(panel.x + panel.width / 2)}
                  y={s(height / 2) + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill={LABEL_COLOR}
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

          {/* ── Openings ── */}
          {openings.map((op, i) => (
            <g key={`opening-${i}`}>
              <rect
                x={s(op.x)}
                y={s(height - op.y - op.drawHeight)}
                width={s(op.drawWidth)}
                height={s(op.drawHeight)}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={1.5}
                strokeDasharray={DASH}
              />
              {/* Cross lines */}
              <line
                x1={s(op.x)} y1={s(height - op.y - op.drawHeight)}
                x2={s(op.x + op.drawWidth)} y2={s(height - op.y)}
                stroke="#bbb" strokeWidth={0.5} strokeDasharray="4,3"
              />
              <line
                x1={s(op.x + op.drawWidth)} y1={s(height - op.y - op.drawHeight)}
                x2={s(op.x)} y2={s(height - op.y)}
                stroke="#bbb" strokeWidth={0.5} strokeDasharray="4,3"
              />
              {/* Label */}
              <text
                x={s(op.x + op.drawWidth / 2)}
                y={s(height - op.y - op.drawHeight / 2) + 4}
                textAnchor="middle"
                fontSize="10"
                fill={LABEL_COLOR}
                fontWeight="bold"
              >
                {op.ref}
              </text>
              <text
                x={s(op.x + op.drawWidth / 2)}
                y={s(height - op.y - op.drawHeight / 2) + 16}
                textAnchor="middle"
                fontSize="8"
                fill="#999"
              >
                {op.width_mm}w × {op.height_mm}h
              </text>
            </g>
          ))}

          {/* ── Vertical plates around openings (45mm, inside adjacent panels) ── */}
          {openings.map((op, i) => {
            const opTopY = s(height - op.y - op.drawHeight);
            const opH = s(op.drawHeight);
            return (
              <g key={`op-plates-${i}`}>
                {/* Left vertical plate */}
                <rect
                  x={s(op.x - BOTTOM_PLATE)}
                  y={opTopY}
                  width={s(BOTTOM_PLATE)}
                  height={opH}
                  fill="none"
                  stroke={PLATE_COLOR}
                  strokeWidth={1}
                  strokeDasharray={DASH}
                />
                {/* Right vertical plate */}
                <rect
                  x={s(op.x + op.drawWidth)}
                  y={opTopY}
                  width={s(BOTTOM_PLATE)}
                  height={opH}
                  fill="none"
                  stroke={PLATE_COLOR}
                  strokeWidth={1}
                  strokeDasharray={DASH}
                />
              </g>
            );
          })}

          {/* ── Footer panels ── */}
          {footers.map((f, i) => (
            <g key={`footer-${i}`}>
              <rect
                x={s(f.x)}
                y={s(height - f.height)}
                width={s(f.width)}
                height={s(f.height)}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={1}
                strokeDasharray={DASH}
              />
              <text
                x={s(f.x + f.width / 2)}
                y={s(height - f.height / 2) + 3}
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
                y={s(height - l.y - l.height)}
                width={s(l.width)}
                height={s(l.height)}
                fill="none"
                stroke={STROKE_COLOR}
                strokeWidth={1}
                strokeDasharray={DASH}
              />
              <text
                x={s(l.x + l.width / 2)}
                y={s(height - l.y - l.height / 2) + 3}
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
              const tickY = s(height) + 22;
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

          {/* ── Height dimension — left ── */}
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
      </svg>
    </div>
  );
}
