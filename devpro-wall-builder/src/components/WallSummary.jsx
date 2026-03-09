import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import { PANEL_GAP } from '../utils/constants.js';

export default function WallSummary({ layout, wallName }) {
  const sectionRef = useRef(null);
  if (!layout) return null;

  // Count splines — same logic as PanelPlans
  const { panels, openings, lintels, footers } = layout;
  let splineCount = 0;
  for (let i = 0; i < panels.length - 1; i++) {
    const gapCentre = panels[i].x + panels[i].width + PANEL_GAP / 2;
    const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintel && !insideFooter) splineCount++;
  }
  for (const op of openings) {
    if (op.y > 0) splineCount += 2; // left + right spline for windows with sills
  }

  return (
    <div ref={sectionRef} data-print-section style={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ ...styles.heading, margin: 0 }}>Panel Summary — {wallName}</h3>
        <PrintButton sectionRef={sectionRef} label="Summary" />
      </div>
      <table style={styles.table}>
        <tbody>
          <tr><td style={styles.labelCell}>Gross Length</td><td style={styles.valueCell}>{layout.grossLength} mm</td></tr>
          <tr><td style={styles.labelCell}>Deductions</td><td style={styles.valueCell}>L: {layout.deductionLeft}mm, R: {layout.deductionRight}mm</td></tr>
          <tr><td style={styles.labelCell}>Net Length</td><td style={styles.valueCell}>{layout.netLength} mm</td></tr>
          <tr><td style={styles.labelCell}>Profile</td><td style={styles.valueCell}>{layout.profile === 'raked' ? 'Raked' : layout.profile === 'gable' ? 'Gable' : 'Standard'}</td></tr>
          <tr><td style={styles.labelCell}>Height</td><td style={styles.valueCell}>
            {layout.isRaked
              ? `${layout.heightLeft}mm (L) → ${layout.heightRight}mm (R)`
              : `${layout.height} mm`}
          </td></tr>
          {layout.peakHeight !== undefined && (
            <tr><td style={styles.labelCell}>Peak</td><td style={styles.valueCell}>{layout.peakHeight}mm at {layout.peakPosition}mm from left</td></tr>
          )}
          <tr style={styles.dividerRow}><td colSpan={2}></td></tr>
          <tr><td style={styles.labelCell}>Total Panels</td><td style={styles.valueCell}><strong>{layout.totalPanels}</strong></td></tr>
          <tr><td style={styles.labelCell}>Sheets</td><td style={styles.valueCell}><strong>{layout.totalPanels * 2}</strong></td></tr>
          <tr><td style={styles.labelCell}>Full Panels</td><td style={styles.valueCell}>{layout.fullPanels}</td></tr>
          <tr><td style={styles.labelCell}>L-Cut Panels</td><td style={styles.valueCell}>{layout.lcutPanels}</td></tr>
          <tr><td style={styles.labelCell}>End Panels</td><td style={styles.valueCell}>{layout.endPanels}</td></tr>
          <tr style={styles.dividerRow}><td colSpan={2}></td></tr>
          <tr><td style={styles.labelCell}>Openings</td><td style={styles.valueCell}>{layout.openings.length}</td></tr>
          <tr><td style={styles.labelCell}>Footer Panels</td><td style={styles.valueCell}>{layout.footers.length}</td></tr>
          <tr><td style={styles.labelCell}>Lintels</td><td style={styles.valueCell}>{layout.lintels.length}</td></tr>
          <tr><td style={styles.labelCell}>Splines</td><td style={styles.valueCell}>{splineCount}</td></tr>
        </tbody>
      </table>

      {layout.panels.length > 0 && (
        <>
          <h4 style={styles.subHeading}>Panel Details</h4>
          <table style={styles.detailTable}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Width (mm)</th>
                <th style={styles.th}>Position (mm)</th>
                {layout.isRaked && <th style={styles.th}>H Left (mm)</th>}
                {layout.isRaked && <th style={styles.th}>H Right (mm)</th>}
                <th style={styles.th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {layout.panels.map((p, i) => (
                <tr key={i} style={i % 2 === 0 ? styles.evenRow : {}}>
                  <td style={styles.td}>P{p.index + 1}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: badgeColor(p.type) }}>
                      {p.type}
                    </span>
                  </td>
                  <td style={styles.td}>{p.width}</td>
                  <td style={styles.td}>{p.x}</td>
                  {layout.isRaked && <td style={styles.td}>{p.heightLeft}</td>}
                  {layout.isRaked && <td style={styles.td}>{p.heightRight}</td>}
                  <td style={styles.td}>{p.openingRefs ? `Opens: ${p.openingRefs.join(', ')}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function badgeColor(type) {
  switch (type) {
    case 'full': return '#4A90D9';
    case 'lcut': return '#E8A838';
    case 'end': return '#9B59B6';
    default: return '#999';
  }
}

const styles = {
  container: {
    background: '#fff',
    borderRadius: 8,
    padding: 24,
    border: '1px solid #ddd',
    marginTop: 16,
  },
  heading: {
    margin: '0 0 16px 0',
    fontSize: 16,
    color: '#333',
  },
  subHeading: {
    margin: '20px 0 8px 0',
    fontSize: 14,
    color: '#555',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    maxWidth: 400,
  },
  labelCell: {
    padding: '6px 12px 6px 0',
    fontSize: 13,
    color: '#666',
  },
  valueCell: {
    padding: '6px 0',
    fontSize: 13,
    color: '#333',
    textAlign: 'right',
  },
  dividerRow: {
    height: 8,
  },
  detailTable: {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '2px solid #ddd',
    color: '#555',
    fontSize: 12,
    fontWeight: 600,
  },
  td: {
    padding: '6px 12px',
    borderBottom: '1px solid #eee',
  },
  evenRow: {
    background: '#f9f9f9',
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
