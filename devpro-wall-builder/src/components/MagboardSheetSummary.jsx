import { useState, useMemo } from 'react';
import { computeProjectMagboardSheets } from '../utils/magboardOptimizer.js';

export default function MagboardSheetSummary({ walls }) {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => {
    if (!walls || walls.length === 0) return null;
    return computeProjectMagboardSheets(walls);
  }, [walls]);

  if (!result) return null;

  const {
    panelSheetCount, panelSheets2700, panelSheets3000,
    cutPieceCount, cutSheets2700, cutSheets3000, cutUtilization,
    total2700, total3000, totalSheets,
    totalLintels, totalFooters, totalSplines, totalDeductions,
    perWall,
  } = result;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>Magboard Sheet Requirements</h3>
          <span style={styles.subtitle}>
            {panelSheetCount} panel + {cutSheets2700 + cutSheets3000} cut-piece sheet{cutSheets2700 + cutSheets3000 !== 1 ? 's' : ''}
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
              <div style={{ ...styles.cardValue, color: '#2C5F8A' }}>{total2700}</div>
              <div style={styles.cardUnit}>× 2700mm</div>
              <div style={styles.cardDetail}>
                {panelSheets2700} panel + {cutSheets2700} cut
              </div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#6AACE6' }}>{total3000}</div>
              <div style={styles.cardUnit}>× 3000mm</div>
              <div style={styles.cardDetail}>
                {panelSheets3000} panel + {cutSheets3000} cut
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
                        [totalSplines, totalLintels, totalFooters, totalDeductions].filter(Boolean).length
                      }>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          {cutSheets2700 + cutSheets3000}
                          <UtilBar pct={cutUtilization} />
                        </div>
                      </td>
                    </tr>
                  )}
                  {totalLintels > 0 && (
                    <tr style={styles.evenRow}>
                      <td style={styles.td}>Lintels</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{totalLintels}</td>
                    </tr>
                  )}
                  {totalFooters > 0 && (
                    <tr>
                      <td style={styles.td}>Footers</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{totalFooters}</td>
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
                  <th style={{ ...styles.th, textAlign: 'right' }}>Lintels</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Footers</th>
                </tr>
              </thead>
              <tbody>
                {perWall.map((w, i) => (
                  <tr key={w.wallId} style={i % 2 === 0 ? styles.evenRow : undefined}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{w.wallName}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.panelSheetCount}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.splineCount}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.lintelCount}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.footerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.sheetInfo}>
            Sheets: 1200 × 2700mm or 1200 × 3000mm (10mm thick).
            Each panel uses 2 full sheets (front + back face).
            Splines, lintels, footers, and deductions are bin-packed onto additional sheets.
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
    color: '#888',
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
    color: '#999',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardDetail: {
    fontSize: 11,
    color: '#888',
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
    color: '#999',
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
    color: '#999',
    fontStyle: 'italic',
    padding: '8px 0 0',
    borderTop: '1px solid #eee',
  },
};
