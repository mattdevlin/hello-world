import { useState, useMemo, useEffect } from 'react';
import { calculateRoofLayout } from '../utils/roofCalculator.js';
import { calculateProjectPrice } from '../utils/priceCalculator.js';

export default function ProjectRoofSummary({ roofs }) {
  const roofData = useMemo(() => {
    return roofs.map(r => {
      const layout = calculateRoofLayout(r);
      return {
        name: r.name,
        length: r.length_mm,
        width: r.width_mm,
        type: r.type === 'gable' ? 'Gable' : r.type === 'skillion' ? 'Skillion' : 'Flat',
        pitch: r.pitch_deg,
        penetrations: r.penetrations?.length || 0,
        panels: layout.error ? 0 : layout.totalPanels,
        planArea: layout.error ? 0 : layout.totalPlanArea,
      };
    });
  }, [roofs]);

  const totalAreaM2 = useMemo(() => {
    return roofData.reduce((sum, r) => sum + r.planArea, 0) / 1e6;
  }, [roofData]);

  const [price, setPrice] = useState(null);

  useEffect(() => {
    if (roofs.length === 0) return;
    let cancelled = false;
    calculateProjectPrice([], [], roofs).then(result => {
      if (!cancelled) setPrice(result);
    });
    return () => { cancelled = true; };
  }, [roofs]);

  const dollarPerSqm = price && totalAreaM2 > 0
    ? (price.totalExGst / totalAreaM2).toFixed(2)
    : null;

  return (
    <div style={styles.card}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Roof Name</th>
            <th style={styles.th}>Dimensions (L x W)</th>
            <th style={styles.th}>Type</th>
            <th style={styles.thCenter}>Pitch</th>
            <th style={styles.thCenter}>Penetrations</th>
            <th style={styles.thCenter}>Panels</th>
          </tr>
        </thead>
        <tbody>
          {roofData.map((r, i) => (
            <tr key={i}>
              <td style={styles.td}>{r.name}</td>
              <td style={styles.td}>{r.length} x {r.width} mm</td>
              <td style={styles.td}>{r.type}</td>
              <td style={styles.tdCenter}>{r.pitch}°</td>
              <td style={styles.tdCenter}>{r.penetrations}</td>
              <td style={styles.tdCenter}>{r.panels}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {roofs.length > 0 && (
        <div style={styles.totalsRow}>
          <div style={styles.statBlock}>
            <div style={styles.statLabel}>Total Roof Area</div>
            <div style={styles.statValue}>{totalAreaM2.toFixed(1)} m²</div>
          </div>
          <div style={styles.statBlock}>
            <div style={styles.statLabel}>Total Roof Price (incl GST)</div>
            <div style={styles.statValue}>
              {price ? `$${price.totalIncGst.toLocaleString()}` : '...'}
            </div>
          </div>
          <div style={styles.statBlock}>
            <div style={styles.statLabel}>$/m² (ex GST)</div>
            <div style={styles.statValue}>
              {dollarPerSqm ? `$${dollarPerSqm}` : '...'}
            </div>
          </div>
        </div>
      )}
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
  totalsRow: {
    display: 'flex',
    gap: 24,
    marginTop: 16,
    padding: '14px 16px',
    background: '#f7f9fb',
    borderRadius: 6,
    border: '1px solid #e8ecf0',
  },
  statBlock: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#777',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#8D6E63',
  },
};
