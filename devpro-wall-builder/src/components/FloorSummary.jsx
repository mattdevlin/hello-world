import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import StatCard from './StatCard.jsx';
import { FLOOR_THICKNESS, FLOOR_EPS_DEPTH, FLOOR_SPLINE_DEPTH, SPLINE_WIDTH, MAGBOARD } from '../utils/constants.js';

function Row({ label, value }) {
  return (
    <tr>
      <td style={styles.rowLabel}>{label}</td>
      <td style={styles.rowValue}>{value}</td>
    </tr>
  );
}

export default function FloorSummary({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const {
    panels, reinforcedSplines, unreinforcedSplines,
    openings, recesses, perimeterPlates, bearerLines,
    totalArea, perimeterLength, fullPanels, edgePanels,
    boundingBox: bb,
  } = layout;

  const splineCount = reinforcedSplines.length + unreinforcedSplines.length;
  const totalPanels = panels.length;

  // EPS volume estimate
  const panelEpsVol = panels.reduce((sum, p) => sum + p.width * p.length * FLOOR_EPS_DEPTH, 0);
  const splineEpsW = SPLINE_WIDTH - MAGBOARD * 2;
  const splineEpsVol = [...reinforcedSplines, ...unreinforcedSplines]
    .reduce((sum, s) => sum + splineEpsW * s.length * FLOOR_SPLINE_DEPTH, 0);
  const totalEpsM3 = ((panelEpsVol + splineEpsVol) / 1e9).toFixed(3);

  // Glue area (both faces)
  const panelSA = panels.reduce((sum, p) => sum + p.width * p.length, 0);
  const splineSA = [...reinforcedSplines, ...unreinforcedSplines]
    .reduce((sum, s) => sum + splineEpsW * s.length, 0);
  const totalGlueM2 = ((panelSA + splineSA) * 2 / 1e6).toFixed(2);

  return (
    <div ref={sectionRef} data-print-section style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Floor Summary — {floorName}</h3>
        <PrintButton sectionRef={sectionRef} label="Summary" projectName={projectName} wallName={floorName} />
      </div>

      <div style={styles.statsRow}>
        <StatCard label="Panels" value={totalPanels} unit="total" />
        <StatCard label="Sheets" value={totalPanels * 2} unit="mag boards" />
        <StatCard label="Splines" value={splineCount} unit="total" color="#27ae60" />
        <StatCard label="EPS Volume" value={totalEpsM3} unit="m³" color="#2E7D32" />
        <StatCard label="PU Glue Area" value={totalGlueM2} unit="m²" color="#E8A838" />
      </div>

      <div style={styles.columns}>
        <div style={styles.column}>
          <div style={styles.sectionLabel}>Floor Dimensions</div>
          <table style={styles.table}>
            <tbody>
              <Row label="Bounding Box" value={`${Math.round(bb.width)} × ${Math.round(bb.height)} mm`} />
              <Row label="Floor Area" value={`${(totalArea / 1e6).toFixed(2)} m²`} />
              <Row label="Perimeter" value={`${Math.round(perimeterLength)} mm`} />
              <Row label="Thickness" value={`${FLOOR_THICKNESS} mm`} />
              <Row label="EPS Depth" value={`${FLOOR_EPS_DEPTH} mm`} />
              <Row label="Polygon Points" value={layout.polygon.length} />
            </tbody>
          </table>
        </div>

        <div style={styles.column}>
          <div style={styles.sectionLabel}>Components</div>
          <table style={styles.table}>
            <tbody>
              <Row label="Full Panels" value={fullPanels} />
              <Row label="Edge Panels" value={edgePanels} />
              <Row label="Perimeter Plates" value={perimeterPlates.length} />
              <Row label="Reinforced Splines" value={reinforcedSplines.length} />
              <Row label="Unreinforced Splines" value={unreinforcedSplines.length} />
              <Row label="Openings" value={openings.length} />
              <Row label="Recesses" value={recesses.length} />
              <Row label="Bearer Lines" value={bearerLines.length} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel details */}
      {panels.length > 0 && (
        <div style={styles.detailSection}>
          <div style={styles.sectionLabel}>Panel Details</div>
          <div style={styles.tableWrap}>
            <table style={styles.detailTable}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Type</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Width</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Length</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Area (mm²)</th>
                  <th style={styles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {panels.map((p, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                    <td style={styles.td}>P{p.index + 1}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: p.type === 'full' ? '#4A90D9' : '#E8A838' }}>
                        {p.type}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{Math.round(p.width)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{Math.round(p.length)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{p.area.toLocaleString()}</td>
                    <td style={{ ...styles.td, color: '#636363' }}>
                      {[...p.openingCuts, ...p.recessCuts].join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: '#fff',
    borderRadius: 8,
    padding: 24,
    border: '1px solid #e0e0e0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    background: '#f8f9fa',
    borderRadius: 6,
    padding: '16px 12px',
    textAlign: 'center',
    border: '1px solid #eee',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
  },
  statUnit: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontWeight: 500,
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 24,
    marginBottom: 24,
  },
  column: {},
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#737373',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1px solid #eee',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  rowLabel: {
    padding: '5px 8px 5px 0',
    fontSize: 13,
    color: '#666',
    whiteSpace: 'nowrap',
  },
  rowValue: {
    padding: '5px 0',
    fontSize: 13,
    color: '#333',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  detailSection: {
    borderTop: '1px solid #eee',
    paddingTop: 20,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  detailTable: {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '2px solid #e0e0e0',
    color: '#666',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '7px 12px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
  },
  evenRow: {
    background: '#fafafa',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 3,
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
  },
};
