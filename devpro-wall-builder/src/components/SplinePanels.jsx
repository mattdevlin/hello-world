import { useRef } from 'react';
import { PLY_SHEET_HEIGHT, PLY_SHEET_WIDTH, SPLINE_WIDTH, MAGBOARD, ROOF_SPLINE_PLY } from '../utils/constants.js';
import PrintButton from './PrintButton.jsx';

const STRIPS_PER_PANEL = Math.floor(PLY_SHEET_WIDTH / SPLINE_WIDTH); // 8

const MARGIN = { top: 50, right: 30, bottom: 30, left: 50 };
const MAX_SVG_W = 700;
const DIM_FONT = 9;
const LABEL_FONT = 8;

const PIECE_FILL = '#B3D9FF';
const PIECE_STROKE = '#4A90D9';
const WASTE_FILL = '#f0f0f0';
const STRIP_STROKE = '#ccc';

function compositionLabel(epsDepth, hasPly) {
  const layers = [`${MAGBOARD}mm mag`];
  layers.push(`${epsDepth}mm EPS`);
  if (hasPly) layers.push(`${ROOF_SPLINE_PLY}mm ply`);
  layers.push(`${MAGBOARD}mm mag`);
  return layers.join(' + ');
}

function SplinePanelCard({ panel }) {
  const { epsDepth, hasPly, strips, wasteWidth, panelIndex } = panel;
  const stripCount = strips.length;

  // Scale to fit
  const drawW = PLY_SHEET_WIDTH;
  const drawH = PLY_SHEET_HEIGHT;
  const availW = MAX_SVG_W - MARGIN.left - MARGIN.right;
  const availH = 300;
  const scale = Math.min(availW / drawW, availH / drawH);

  const svgW = drawW * scale + MARGIN.left + MARGIN.right;
  const svgH = drawH * scale + MARGIN.top + MARGIN.bottom;
  const ox = MARGIN.left;
  const oy = MARGIN.top;

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 4, color: '#333' }}>
        Spline Panel {panelIndex + 1} — {compositionLabel(epsDepth, hasPly)}
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
        {stripCount} strip{stripCount !== 1 ? 's' : ''} of {SPLINE_WIDTH}mm
        {wasteWidth > 0 && ` · ${wasteWidth}mm rip waste`}
      </div>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block' }}>
        {/* Panel outline */}
        <rect
          x={ox} y={oy}
          width={drawW * scale} height={drawH * scale}
          fill="none" stroke="#333" strokeWidth={1.5}
        />

        {/* Width dimension (top) */}
        <text x={ox + (drawW * scale) / 2} y={oy - 8} textAnchor="middle" fontSize={DIM_FONT} fill="#333">
          {PLY_SHEET_WIDTH}
        </text>
        {/* Height dimension (left) */}
        <text
          x={ox - 10} y={oy + (drawH * scale) / 2 + 3}
          textAnchor="middle" fontSize={DIM_FONT} fill="#333"
          transform={`rotate(-90, ${ox - 10}, ${oy + (drawH * scale) / 2 + 3})`}
        >
          {PLY_SHEET_HEIGHT}
        </text>

        {/* Strips */}
        {strips.map((strip, si) => {
          const sx = ox + si * SPLINE_WIDTH * scale;
          const sw = SPLINE_WIDTH * scale;
          return (
            <g key={si}>
              {/* Strip background */}
              <rect x={sx} y={oy} width={sw} height={drawH * scale} fill={WASTE_FILL} stroke={STRIP_STROKE} strokeWidth={0.5} />

              {/* Pieces in this strip */}
              {strip.pieces.map((piece, pi) => {
                const py = oy + piece.offset * scale;
                const ph = piece.length * scale;
                return (
                  <g key={pi}>
                    <rect
                      x={sx + 1} y={py + 1}
                      width={sw - 2} height={ph - 2}
                      fill={PIECE_FILL} fillOpacity={0.5}
                      stroke={PIECE_STROKE} strokeWidth={1}
                    />
                    {/* Piece label */}
                    {ph > 14 && (
                      <text
                        x={sx + sw / 2} y={py + ph / 2 - 4}
                        textAnchor="middle" fontSize={LABEL_FONT} fill="#333" fontWeight="bold"
                      >
                        {piece.label}
                      </text>
                    )}
                    {/* Piece length */}
                    {ph > 14 && (
                      <text
                        x={sx + sw / 2} y={py + ph / 2 + 7}
                        textAnchor="middle" fontSize={LABEL_FONT} fill="#666"
                      >
                        {piece.length}mm
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Strip number */}
              <text
                x={sx + sw / 2} y={oy + drawH * scale + 14}
                textAnchor="middle" fontSize={DIM_FONT} fill="#999"
              >
                {si + 1}
              </text>
            </g>
          );
        })}

        {/* Waste strip (after 8 strips) */}
        {wasteWidth > 0 && stripCount > 0 && (
          <rect
            x={ox + stripCount * SPLINE_WIDTH * scale} y={oy}
            width={wasteWidth * scale} height={drawH * scale}
            fill="#fdd" fillOpacity={0.4} stroke="#d99" strokeWidth={0.5}
          />
        )}
      </svg>
    </div>
  );
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
};

export default function SplinePanels({ splinePanels, systemLabel, name, projectName }) {
  const sectionRef = useRef(null);

  if (!splinePanels || splinePanels.length === 0) return null;

  const totalStrips = splinePanels.reduce((s, p) => s + p.strips.length, 0);
  const totalPieces = splinePanels.reduce((s, p) => s + p.strips.reduce((ss, st) => ss + st.pieces.length, 0), 0);

  return (
    <div ref={sectionRef} data-print-section>
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #ddd', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#333' }}>
            Spline Panels {name && `— ${name}`}
          </h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <PrintButton sectionRef={sectionRef} label={`Spline Panels${systemLabel ? ` (${systemLabel})` : ''}`} projectName={projectName} wallName={name} />
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
          {splinePanels.length} panel{splinePanels.length !== 1 ? 's' : ''} · {totalStrips} strip{totalStrips !== 1 ? 's' : ''} · {totalPieces} piece{totalPieces !== 1 ? 's' : ''}
        </div>
        {splinePanels.map((panel) => (
          <SplinePanelCard key={panel.panelIndex} panel={panel} />
        ))}
      </div>
    </div>
  );
}
