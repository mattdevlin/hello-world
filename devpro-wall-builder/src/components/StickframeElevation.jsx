import { useRef, useState } from 'react';
import PrintButton from './PrintButton.jsx';

const MARGIN = { top: 60, right: 40, bottom: 110, left: 60 };
const MAX_SVG_WIDTH = 1200;
const MAX_SVG_HEIGHT = 500;

// ── Line hierarchy (AS1100 / ISO 128) ──
const W_HEAVY = 2;
const C_PRIMARY = '#222';
const W_MEDIUM = 1.2;
const C_STRUCTURE = '#444';
const W_LIGHT = 0.75;
const C_LIGHT = '#666';
const W_FINE = 0.5;

// Member fill colours
const FILL_PLATE = '#e8d5a8';    // warm timber — plates
const FILL_STUD = '#f0e6c8';     // lighter timber — studs
const FILL_LINTEL = '#d4b878';   // darker timber — lintels
const FILL_DWANG = '#e8dbb8';    // mid timber — dwangs
const FILL_TRIMMER = '#dcc898';  // trimmer studs
const FILL_CRIPPLE = '#f0e6c8';  // same as studs

const STROKE_PLATE = '#8B7355';
const STROKE_STUD = '#A0896B';
const STROKE_LINTEL = '#7A6240';
const STROKE_DWANG = '#A09070';
const STROKE_TRIMMER = '#907850';
const STROKE_CRIPPLE = '#B0A080';

// Opening
const FILL_OPENING = '#FFFFFF';
const STROKE_OPENING = '#999';

function getMemberStyle(type) {
  switch (type) {
    case 'bottom_plate':
    case 'top_plate_1':
    case 'top_plate_2':
      return { fill: FILL_PLATE, stroke: STROKE_PLATE, strokeWidth: W_MEDIUM };
    case 'stud':
    case 'end_stud':
      return { fill: FILL_STUD, stroke: STROKE_STUD, strokeWidth: W_MEDIUM };
    case 'king_stud':
      return { fill: FILL_STUD, stroke: STROKE_STUD, strokeWidth: W_MEDIUM };
    case 'trimmer_stud':
      return { fill: FILL_TRIMMER, stroke: STROKE_TRIMMER, strokeWidth: W_LIGHT };
    case 'lintel':
      return { fill: FILL_LINTEL, stroke: STROKE_LINTEL, strokeWidth: W_MEDIUM };
    case 'sill_trimmer':
      return { fill: FILL_PLATE, stroke: STROKE_PLATE, strokeWidth: W_LIGHT };
    case 'dwang':
      return { fill: FILL_DWANG, stroke: STROKE_DWANG, strokeWidth: W_FINE };
    case 'cripple_stud':
      return { fill: FILL_CRIPPLE, stroke: STROKE_CRIPPLE, strokeWidth: W_FINE };
    default:
      return { fill: '#eee', stroke: '#999', strokeWidth: W_FINE };
  }
}

export default function StickframeElevation({ stickframeLayout, wallName, projectName }) {
  const sectionRef = useRef(null);
  const [showTimberInfo, setShowTimberInfo] = useState(true);

  if (!stickframeLayout || !stickframeLayout.members || stickframeLayout.members.length === 0) return null;

  const { grossLength, wallHeight, netLength, deductionLeft, deductionRight, members, thermalRatio } = stickframeLayout;

  const drawWidth = MAX_SVG_WIDTH - MARGIN.left - MARGIN.right;
  const scale = drawWidth / grossLength;
  const drawHeight = wallHeight * scale;
  const svgWidth = MAX_SVG_WIDTH;
  const svgHeight = drawHeight + MARGIN.top + MARGIN.bottom;
  const displayHeight = Math.min(svgHeight, MAX_SVG_HEIGHT);

  const s = (mm) => mm * scale;

  // Sort members for draw order: plates first (bottom), then studs, then dwangs, then openings framing
  const drawOrder = ['bottom_plate', 'top_plate_1', 'top_plate_2', 'lintel', 'sill_trimmer', 'dwang', 'cripple_stud', 'stud', 'end_stud', 'king_stud', 'trimmer_stud'];
  const sortedMembers = [...members].sort((a, b) => {
    const ai = drawOrder.indexOf(a.type);
    const bi = drawOrder.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Count members by type for summary
  const memberCounts = {};
  for (const m of members) {
    memberCounts[m.type] = (memberCounts[m.type] || 0) + 1;
  }

  return (
    <div ref={sectionRef} data-print-section style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #ddd' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '8px 12px 0', gap: 4 }}>
        {thermalRatio && (
          <label className="no-print" style={{ fontSize: 12, color: '#666', cursor: 'pointer', marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={showTimberInfo} onChange={e => setShowTimberInfo(e.target.checked)} />
            Show timber %
          </label>
        )}
        <PrintButton sectionRef={sectionRef} label="Stickframe" projectName={projectName} wallName={wallName} />
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
          {wallName || 'Wall'} — NZS 3604 Stickframe Elevation
        </text>
        <text x={svgWidth / 2} y={42} textAnchor="middle" fontSize="12" fill="#666">
          {grossLength}mm × {wallHeight}mm | 90×45 SG8 @ 600mm centres | {members.length} members
        </text>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>

          {/* ── Wall outline ── */}
          <rect
            x={0} y={0}
            width={s(grossLength)} height={s(wallHeight)}
            fill="none"
            stroke={C_PRIMARY}
            strokeWidth={W_HEAVY}
          />

          {/* ── Deduction zones ── */}
          {deductionLeft > 0 && (
            <>
              <rect
                x={0} y={0}
                width={s(deductionLeft)} height={s(wallHeight)}
                fill="none" stroke={C_LIGHT} strokeWidth={W_LIGHT}
                strokeDasharray="4,2"
              />
              <text x={s(deductionLeft / 2)} y={s(wallHeight) + 14} textAnchor="middle" fontSize="9" fill="#999">
                -{deductionLeft}
              </text>
            </>
          )}
          {deductionRight > 0 && (
            <>
              <rect
                x={s(grossLength - deductionRight)} y={0}
                width={s(deductionRight)} height={s(wallHeight)}
                fill="none" stroke={C_LIGHT} strokeWidth={W_LIGHT}
                strokeDasharray="4,2"
              />
              <text x={s(grossLength - deductionRight / 2)} y={s(wallHeight) + 14} textAnchor="middle" fontSize="9" fill="#999">
                -{deductionRight}
              </text>
            </>
          )}

          {/* ── Opening voids ── */}
          {/* Opening framing is drawn via the member rects below */}

          {/* ── Members ── */}
          {sortedMembers.map((m, i) => {
            const style = getMemberStyle(m.type);
            return (
              <rect
                key={`${m.type}-${i}`}
                x={s(m.x)}
                y={s(m.y)}
                width={s(m.width)}
                height={s(m.height)}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
              />
            );
          })}

          {/* ── Dimension line: total length ── */}
          <line x1={0} y1={s(wallHeight) + 28} x2={s(grossLength)} y2={s(wallHeight) + 28}
            stroke="#333" strokeWidth={0.5} markerStart="url(#arrowL)" markerEnd="url(#arrowR)" />
          <text x={s(grossLength / 2)} y={s(wallHeight) + 42} textAnchor="middle" fontSize="11" fill="#333">
            {grossLength}mm
          </text>

          {/* ── Dimension line: height ── */}
          <line x1={-16} y1={0} x2={-16} y2={s(wallHeight)}
            stroke="#333" strokeWidth={0.5} />
          <text x={-22} y={s(wallHeight / 2)} textAnchor="middle" fontSize="10" fill="#333"
            transform={`rotate(-90, -22, ${s(wallHeight / 2)})`}>
            {wallHeight}mm
          </text>

          {/* ── Member count legend ── */}
          <text x={0} y={s(wallHeight) + 60} fontSize="10" fill="#666">
            {[
              memberCounts.stud && `${(memberCounts.stud || 0) + (memberCounts.end_stud || 0) + (memberCounts.king_stud || 0)} studs`,
              memberCounts.trimmer_stud && `${memberCounts.trimmer_stud} trimmers`,
              memberCounts.cripple_stud && `${memberCounts.cripple_stud} cripples`,
              memberCounts.dwang && `${memberCounts.dwang} dwangs`,
              memberCounts.lintel && `${memberCounts.lintel} lintels`,
              `3 plates`,
            ].filter(Boolean).join(' | ')}
          </text>
        </g>

        {/* Arrow markers */}
        <defs>
          <marker id="arrowL" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
            <path d="M 6 0 L 0 3 L 6 6" fill="none" stroke="#333" strokeWidth="0.5" />
          </marker>
          <marker id="arrowR" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6" fill="none" stroke="#333" strokeWidth="0.5" />
          </marker>
        </defs>
      </svg>

      {/* ── Thermal ratio panel ── */}
      {showTimberInfo && thermalRatio && (
        <div style={timberInfoStyles.panel}>
          <div style={timberInfoStyles.header}>
            <span style={timberInfoStyles.title}>Thermal Bridging — Stickframe Timber Fraction</span>
            <span style={timberInfoStyles.pct}>{thermalRatio.timberPercentage.toFixed(1)}% timber</span>
            <span style={timberInfoStyles.sep}>|</span>
            <span style={{ ...timberInfoStyles.pct, color: '#2E7D32' }}>{thermalRatio.insulationPercentage.toFixed(1)}% insulation</span>
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
                  ['Plates (bottom + 2× top)', thermalRatio.breakdown.plates],
                  ['Studs (end + regular + king)', thermalRatio.breakdown.studs],
                  ['Dwangs (nogs)', thermalRatio.breakdown.dwangs],
                  ['Lintels', thermalRatio.breakdown.lintels],
                  ['Trimmers + sills', thermalRatio.breakdown.trimmers],
                  ['Cripple studs', thermalRatio.breakdown.crippleStuds],
                ].filter(([, v]) => v > 0).map(([label, v], i) => (
                  <tr key={i} style={i % 2 === 0 ? { background: '#fafafa' } : undefined}>
                    <td style={timberInfoStyles.td}>{label}</td>
                    <td style={{ ...timberInfoStyles.td, textAlign: 'right' }}>{(v / 1e6).toFixed(3)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #ccc' }}>
                  <td style={{ ...timberInfoStyles.td, fontWeight: 700 }}>Total Timber</td>
                  <td style={{ ...timberInfoStyles.td, textAlign: 'right', fontWeight: 700 }}>{(thermalRatio.timberFaceArea / 1e6).toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
            <div style={timberInfoStyles.summary}>
              <div style={timberInfoStyles.summaryRow}><span>Gross wall area:</span><span>{(thermalRatio.grossWallArea / 1e6).toFixed(2)} m²</span></div>
              <div style={timberInfoStyles.summaryRow}><span>Opening area:</span><span>{(thermalRatio.openingArea / 1e6).toFixed(2)} m²</span></div>
              <div style={{ ...timberInfoStyles.summaryRow, fontWeight: 700 }}><span>Effective wall area:</span><span>{(thermalRatio.effectiveWallArea / 1e6).toFixed(2)} m²</span></div>
              <div style={{ ...timberInfoStyles.summaryRow, marginTop: 6, color: '#333' }}>
                <span>Total members:</span><span>{members.length}</span>
              </div>
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
