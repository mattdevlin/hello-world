import { useMemo, useRef, useState } from 'react';
import { computeProjectMagboardSheetsUnified } from '../utils/magboardOptimizer.js';
import PrintButton from './PrintButton.jsx';

// ── Color map by piece type ──
const TYPE_COLORS = {
  spline:      { fill: '#B3D9FF', stroke: '#3B82F6' },
  hspline:     { fill: '#DDD6FE', stroke: '#8B5CF6' },
  lintelPanel: { fill: '#FDE68A', stroke: '#F59E0B' },
  footerPanel: { fill: '#A7F3D0', stroke: '#10B981' },
  deduction:   { fill: '#FECACA', stroke: '#EF4444' },
};

const LEGEND_ITEMS = [
  { type: 'spline', label: 'Spline' },
  { type: 'hspline', label: 'H-Spline' },
  { type: 'lintelPanel', label: 'Lintel' },
  { type: 'footerPanel', label: 'Footer' },
  { type: 'deduction', label: 'Deduction' },
];

const MARGIN = { top: 40, right: 20, bottom: 20, left: 50 };
const MAX_CARD_WIDTH = 400;
const MAX_CARD_HEIGHT = 500;

function UtilBar({ pct }) {
  const pctNum = Math.round(pct * 100);
  const color = pctNum > 75 ? '#27ae60' : pctNum > 50 ? '#e67e22' : '#e74c3c';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pctNum}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 36, textAlign: 'right' }}>
        {pctNum}%
      </span>
    </div>
  );
}

function PieceRect({ piece, scale, ox, oy }) {
  const colors = TYPE_COLORS[piece.type] || { fill: '#ddd', stroke: '#999' };
  const x = ox + piece.placedX * scale;
  const y = oy + piece.placedY * scale;
  const w = piece.placedW * scale;
  const h = piece.placedH * scale;
  const showLabel = w > 30 && h > 16;
  const showDims = w > 40 && h > 28;

  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h}
        fill={colors.fill} fillOpacity={0.3}
        stroke={colors.stroke} strokeWidth={1}
      />
      {showLabel && (
        <text
          x={x + w / 2} y={y + h / 2 - (showDims ? 5 : 0)}
          textAnchor="middle" dominantBaseline="central"
          fontSize={7} fontWeight="bold" fill="#333"
        >
          {piece.label || piece.type}
        </text>
      )}
      {showDims && (
        <text
          x={x + w / 2} y={y + h / 2 + 7}
          textAnchor="middle" dominantBaseline="central"
          fontSize={6} fill="#666"
        >
          {piece.placedW}×{piece.placedH}
        </text>
      )}
    </g>
  );
}

function CutSheetCard({ sheet, index }) {
  const { sheetWidth, sheetHeight, pieces, utilization } = sheet;
  const scale = Math.min(
    (MAX_CARD_WIDTH - MARGIN.left - MARGIN.right) / sheetWidth,
    (MAX_CARD_HEIGHT - MARGIN.top - MARGIN.bottom) / sheetHeight
  );
  const svgW = sheetWidth * scale + MARGIN.left + MARGIN.right;
  const svgH = sheetHeight * scale + MARGIN.top + MARGIN.bottom;
  const ox = MARGIN.left;
  const oy = MARGIN.top;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontWeight: 'bold', fontSize: 13, color: '#333' }}>
          Cut Sheet {index + 1} — {sheetWidth}×{sheetHeight}mm
        </div>
        <UtilBar pct={utilization} />
      </div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
        {pieces.length} piece{pieces.length !== 1 ? 's' : ''}
      </div>
      <svg width={svgW} height={svgH} style={{ display: 'block' }}>
        {/* Sheet outline */}
        <rect x={ox} y={oy} width={sheetWidth * scale} height={sheetHeight * scale}
          fill="#f5f5f5" stroke="#333" strokeWidth={1.5} />
        {/* Width dim */}
        <text x={ox + (sheetWidth * scale) / 2} y={oy - 8}
          textAnchor="middle" fontSize={9} fill="#333">{sheetWidth}</text>
        {/* Height dim */}
        <text x={ox - 10} y={oy + (sheetHeight * scale) / 2 + 3}
          textAnchor="middle" fontSize={9} fill="#333"
          transform={`rotate(-90, ${ox - 10}, ${oy + (sheetHeight * scale) / 2 + 3})`}
        >{sheetHeight}</text>
        {/* Pieces */}
        {pieces.map((piece, pi) => (
          <PieceRect key={pi} piece={piece} scale={scale} ox={ox} oy={oy} />
        ))}
      </svg>
    </div>
  );
}

function RemnantSheetCard({ sheet }) {
  const { sheetHeight, panelHeight, label, sourceName, remnantHeight, remnantPieces, remnantUtilization } = sheet;
  const sheetWidth = 1200;
  const scale = Math.min(
    (MAX_CARD_WIDTH - MARGIN.left - MARGIN.right) / sheetWidth,
    (MAX_CARD_HEIGHT - MARGIN.top - MARGIN.bottom) / sheetHeight
  );
  const svgW = sheetWidth * scale + MARGIN.left + MARGIN.right;
  const svgH = sheetHeight * scale + MARGIN.top + MARGIN.bottom;
  const ox = MARGIN.left;
  const oy = MARGIN.top;
  const panelH = panelHeight * scale;
  const remH = remnantHeight * scale;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontWeight: 'bold', fontSize: 13, color: '#333' }}>
          {label} — {sourceName} — {remnantHeight}mm remnant
        </div>
        <UtilBar pct={remnantUtilization} />
      </div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
        {remnantPieces.length} piece{remnantPieces.length !== 1 ? 's' : ''} in remnant strip
      </div>
      <svg width={svgW} height={svgH} style={{ display: 'block' }}>
        {/* Full sheet outline */}
        <rect x={ox} y={oy} width={sheetWidth * scale} height={sheetHeight * scale}
          fill="none" stroke="#333" strokeWidth={1.5} />
        {/* Panel area (gray) */}
        <rect x={ox} y={oy} width={sheetWidth * scale} height={panelH}
          fill="#e8e8e8" fillOpacity={0.5} stroke="none" />
        <text x={ox + (sheetWidth * scale) / 2} y={oy + panelH / 2}
          textAnchor="middle" dominantBaseline="central"
          fontSize={10} fill="#999">Panel Face ({panelHeight}mm)</text>
        {/* Remnant strip divider */}
        <line x1={ox} y1={oy + panelH} x2={ox + sheetWidth * scale} y2={oy + panelH}
          stroke="#666" strokeWidth={1} strokeDasharray="4,2" />
        {/* Remnant area */}
        <rect x={ox} y={oy + panelH} width={sheetWidth * scale} height={remH}
          fill="#f5f5f5" stroke="none" />
        {/* Remnant pieces — offset by panelHeight */}
        {remnantPieces.map((piece, pi) => (
          <PieceRect key={pi} piece={piece} scale={scale}
            ox={ox} oy={oy + panelH} />
        ))}
        {/* Dims */}
        <text x={ox + (sheetWidth * scale) / 2} y={oy - 8}
          textAnchor="middle" fontSize={9} fill="#333">{sheetWidth}</text>
        <text x={ox - 10} y={oy + (sheetHeight * scale) / 2 + 3}
          textAnchor="middle" fontSize={9} fill="#333"
          transform={`rotate(-90, ${ox - 10}, ${oy + (sheetHeight * scale) / 2 + 3})`}
        >{sheetHeight}</text>
      </svg>
    </div>
  );
}

export default function MagboardCutPlans({ walls, floors, roofs, projectName }) {
  const sectionRef = useRef(null);
  const [expanded, setExpanded] = useState(true);

  const result = useMemo(() => {
    if ((!walls || walls.length === 0) && (!floors || floors.length === 0) && (!roofs || roofs.length === 0)) return null;
    return computeProjectMagboardSheetsUnified(walls || [], floors || [], roofs || []);
  }, [walls, floors, roofs]);

  if (!result) return null;

  const { packedSheets, panelFaceSheets, savingsVsSeparate, piecesInRemnants } = result;
  const totalCutSheets = packedSheets.length;
  const avgUtilization = totalCutSheets > 0
    ? packedSheets.reduce((s, sh) => s + sh.utilization, 0) / totalCutSheets
    : 0;

  // Only show if there are cut pieces to visualize
  if (totalCutSheets === 0 && panelFaceSheets.length === 0) return null;

  return (
    <div ref={sectionRef} data-print-section>
      <div style={styles.container}>
        <div style={styles.header} onClick={() => setExpanded(!expanded)}>
          <div style={styles.headerLeft}>
            <h3 style={styles.title}>Magboard Cut Plans</h3>
            <span style={styles.subtitle}>
              {totalCutSheets} cut sheet{totalCutSheets !== 1 ? 's' : ''}
              {panelFaceSheets.length > 0 && ` · ${panelFaceSheets.length} remnant sheet${panelFaceSheets.length !== 1 ? 's' : ''}`}
              {avgUtilization > 0 && ` · ${Math.round(avgUtilization * 100)}% avg utilization`}
            </span>
          </div>
          <div style={styles.headerRight}>
            <PrintButton sectionRef={sectionRef} label="Magboard Cut Plans" projectName={projectName} />
            <span style={styles.arrow}>{expanded ? '\u25BC' : '\u25B6'}</span>
          </div>
        </div>

        {expanded && (
          <div style={styles.body}>
            {/* Legend */}
            <div style={styles.legend}>
              {LEGEND_ITEMS.map(item => (
                <div key={item.type} style={styles.legendItem}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 2,
                    background: TYPE_COLORS[item.type].fill,
                    border: `2px solid ${TYPE_COLORS[item.type].stroke}`,
                  }} />
                  <span style={{ fontSize: 11, color: '#555' }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Savings badge */}
            {(savingsVsSeparate > 0 || piecesInRemnants > 0) && (
              <div style={styles.savingsBadge}>
                {savingsVsSeparate > 0 && (
                  <span>Unified packing saved {savingsVsSeparate} sheet{savingsVsSeparate !== 1 ? 's' : ''}</span>
                )}
                {savingsVsSeparate > 0 && piecesInRemnants > 0 && <span> · </span>}
                {piecesInRemnants > 0 && (
                  <span>{piecesInRemnants} piece{piecesInRemnants !== 1 ? 's' : ''} placed in panel remnants</span>
                )}
              </div>
            )}

            {/* Remnant sheets */}
            {panelFaceSheets.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionLabel}>Panel Sheets with Remnant Usage</div>
                <div style={styles.cardGrid}>
                  {panelFaceSheets.map((sheet, i) => (
                    <RemnantSheetCard key={i} sheet={sheet} />
                  ))}
                </div>
              </div>
            )}

            {/* Cut piece sheets */}
            {totalCutSheets > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionLabel}>Cut Piece Sheets</div>
                <div style={styles.cardGrid}>
                  {packedSheets.map((sheet, i) => (
                    <CutSheetCard key={i} sheet={sheet} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 14,
};

const styles = {
  container: {
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e0e0e0',
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    cursor: 'pointer',
    userSelect: 'none',
    background: '#f8f9fa',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 12,
    color: '#636363',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  arrow: {
    fontSize: 10,
    color: '#666',
  },
  body: {
    padding: '16px 20px',
    borderTop: '1px solid #eee',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
    padding: '8px 12px',
    background: '#f8f9fa',
    borderRadius: 6,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  savingsBadge: {
    padding: '6px 12px',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    color: '#065f46',
    marginBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#737373',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1px solid #eee',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: 12,
  },
};
