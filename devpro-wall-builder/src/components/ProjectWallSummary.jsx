import { useMemo } from 'react';
import { calculateWallLayout } from '../utils/calculator.js';
import { exportCombinedElevationDxf } from '../utils/combinedElevationDxf.js';

export default function ProjectWallSummary({ walls, projectName }) {
  const wallData = useMemo(() => {
    return walls.map(w => {
      const layout = calculateWallLayout(w);
      return {
        name: w.name,
        length: w.length_mm,
        height: w.height_mm,
        profile: w.profile === 'raked' ? 'Raked' : w.profile === 'gable' ? 'Gable' : 'Standard',
        openings: w.openings?.length || 0,
        panels: layout.totalPanels,
      };
    });
  }, [walls]);

  return (
    <div style={styles.card}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Wall Name</th>
            <th style={styles.th}>Dimensions (L x H)</th>
            <th style={styles.th}>Profile</th>
            <th style={styles.thCenter}>Openings</th>
            <th style={styles.thCenter}>Panels</th>
          </tr>
        </thead>
        <tbody>
          {wallData.map((w, i) => (
            <tr key={i}>
              <td style={styles.td}>{w.name}</td>
              <td style={styles.td}>{w.length} x {w.height} mm</td>
              <td style={styles.td}>{w.profile}</td>
              <td style={styles.tdCenter}>{w.openings}</td>
              <td style={styles.tdCenter}>{w.panels}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={styles.actions}>
        <button
          onClick={() => exportCombinedElevationDxf(walls, projectName)}
          style={styles.exportBtn}
        >
          Export Combined DXF
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e0e0e0',
    padding: 20,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 600,
    color: '#555',
    fontSize: 12,
  },
  thCenter: {
    textAlign: 'center',
    padding: '8px 12px',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 600,
    color: '#555',
    fontSize: 12,
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
  },
  tdCenter: {
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
    textAlign: 'center',
  },
  actions: {
    marginTop: 16,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  exportBtn: {
    padding: '8px 16px',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
};
