import { useState, useMemo } from 'react';
import { computeProjectMagboardSheets, computeProjectMagboardSheetsWithFloors } from '../utils/magboardOptimizer.js';

export default function MagboardSheetSummary({ walls, floors }) {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => {
    if ((!walls || walls.length === 0) && (!floors || floors.length === 0)) return null;
    if (floors && floors.length > 0) {
      return computeProjectMagboardSheetsWithFloors(walls || [], floors);
    }
    return computeProjectMagboardSheets(walls);
  }, [walls, floors]);

  if (!result) return null;

  const {
    panelSheetCount, panelSheets2745, panelSheets3050,
    cutPieceCount, cutSheets2745, cutSheets3050, cutUtilization,
    total2745, total3050, totalSheets,
    totalLintelPanels, totalFooterPanels, totalSplines, totalDeductions,
    perWall,
  } = result;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>Magboard Sheet Requirements</h3>
          <span style={styles.subtitle}>
            {panelSheetCount} panel + {cutSheets2745 + cutSheets3050} cut-piece sheet{cutSheets2745 + cutSheets3050 !== 1 ? 's' : ''}
            {result.hasFloors && ` + ${result.floorPanelSheetCount || 0} floor panels`}
          </span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.sheetCount}>{totalSheets}</span>
          <span style={styles.sheetLabel}>sheet{totalSheets !== 1 ? 's' : ''}</span>
          <span style={styles.arrow}>{expanded ? '\u25BC' : '\u25B6'}</span>
        </div>
      </div>

      {expanded && (
        <div style={styles.body}>
          {/* Summary cards */}
          <div style={styles.cards}>
            <div style={styles.card}>
              <div style={styles.cardValue}>{totalSheets}</div>
              <div style={styles.cardUnit}>sheets total</div>
              <div style={styles.cardDetail}>1200mm wide × 10mm thick</div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#2C5F8A' }}>{total2745}</div>
              <div style={styles.cardUnit}>× 2745mm</div>
              <div style={styles.cardDetail}>
                {panelSheets2745} panel + {cutSheets2745} cut
              </div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#6AACE6' }}>{total3050}</div>
              <div style={styles.cardUnit}>× 3050mm</div>
              <div style={styles.cardDetail}>
                {panelSheets3050} panel + {cutSheets3050} cut
              </div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#27ae60' }}>{panelSheetCount}</div>
              <div style={styles.cardUnit}>panel faces</div>
              <div style={styles.cardDetail}>2 per panel (front + back)</div>
            </div>
          </div>

          {/* Cut pieces breakdown */}
          {cutPieceCount > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Additional Cut Pieces</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Type</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Pieces</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Sheets Used</th>
                  </tr>
                </thead>
                <tbody>
                  {totalSplines > 0 && (
                    <tr>
                      <td style={styles.td}>Splines (146mm wide)</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{totalSplines}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }} rowSpan={
                        [totalSplines, totalLintelPanels, totalFooterPanels, totalDeductions].filter(Boolean).length
                      }>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          {cutSheets2745 + cutSheets3050}
                          <UtilBar pct={cutUtilization} />
                        </div>
                      </td>
                    </tr>
                  )}
                  {totalLintelPanels > 0 && (
                    <tr style={styles.evenRow}>
                      <td style={styles.td}>Lintel Panels</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{totalLintelPanels}</td>
                    </tr>
                  )}
                  {totalFooterPanels > 0 && (
                    <tr>
                      <td style={styles.td}>Footer Panels</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{totalFooterPanels}</td>
                    </tr>
                  )}
                  {totalDeductions > 0 && (
                    <tr style={styles.evenRow}>
                      <td style={styles.td}>End Wall Deductions</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{totalDeductions}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-wall breakdown */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Per-Wall Breakdown</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Wall</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Panel Sheets</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Splines</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Lintel Panels</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Footer Panels</th>
                </tr>
              </thead>
              <tbody>
                {perWall.map((w, i) => (
                  <tr key={w.wallId} style={i % 2 === 0 ? styles.evenRow : undefined}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{w.wallName}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.panelSheetCount}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.splineCount}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.lintelPanelCount}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.footerPanelCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-floor breakdown */}
          {result.hasFloors && result.perFloor?.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Per-Floor Breakdown</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Floor</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Panel Sheets</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Splines</th>
                  </tr>
                </thead>
                <tbody>
                  {result.perFloor.map((f, i) => (
                    <tr key={f.floorId} style={i % 2 === 0 ? styles.evenRow : undefined}>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{f.floorName}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{f.panelSheetCount}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{f.splineCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={styles.sheetInfo}>
            Sheets: 1200 × 2745mm or 3050mm (10mm thick).
            Each panel uses 2 full sheets (front + back face).
            Splines, lintel panels, footer panels, and deductions are bin-packed onto additional sheets.
          </div>
        </div>
      )}
    </div>
  );
}

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
    gap: 6,
  },
  sheetCount: {
    fontSize: 28,
    fontWeight: 700,
    color: '#8B4513',
    lineHeight: 1,
  },
  sheetLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  arrow: {
    fontSize: 10,
    color: '#666',
  },
  body: {
    padding: '16px 20px',
    borderTop: '1px solid #eee',
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
    marginBottom: 20,
  },
  card: {
    background: '#f8f9fa',
    borderRadius: 6,
    padding: '14px 12px',
    textAlign: 'center',
    border: '1px solid #eee',
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1a1a1a',
    lineHeight: 1.1,
  },
  cardUnit: {
    fontSize: 11,
    color: '#737373',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardDetail: {
    fontSize: 11,
    color: '#636363',
    marginTop: 6,
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
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: '1px solid #eee',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '6px 10px',
    borderBottom: '2px solid #e0e0e0',
    color: '#666',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  td: {
    padding: '6px 10px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
  },
  evenRow: {
    background: '#fafafa',
  },
  sheetInfo: {
    fontSize: 11,
    color: '#737373',
    fontStyle: 'italic',
    padding: '8px 0 0',
    borderTop: '1px solid #eee',
  },
};
