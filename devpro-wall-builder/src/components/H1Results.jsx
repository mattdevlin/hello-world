export default function H1Results({ results }) {
  if (!results) return null;
  if (results.error) {
    return <div style={styles.error}>{results.error}</div>;
  }

  const { compliant, glazingRatio, glazingRatioOk, hlReference, hlProposed,
    margin, marginPercent, minimumChecks, breakdown, referenceBreakdown } = results;

  return (
    <div style={styles.container}>
      {/* Pass/Fail Banner */}
      <div style={compliant ? styles.passBanner : styles.failBanner}>
        <span style={styles.bannerIcon}>{compliant ? '\u2713' : '\u2717'}</span>
        <span style={styles.bannerText}>
          {compliant ? 'COMPLIANT' : 'NOT COMPLIANT'}
        </span>
        <span style={styles.bannerMargin}>
          {margin > 0 ? '+' : ''}{marginPercent}% ({margin > 0 ? '+' : ''}{margin} W/K)
        </span>
      </div>

      {/* Glazing Ratio */}
      <div style={styles.checkRow}>
        <span style={glazingRatioOk ? styles.checkPass : styles.checkFail}>
          {glazingRatioOk ? '\u2713' : '\u2717'}
        </span>
        <span>Glazing ratio: <strong>{glazingRatio}%</strong> (max 40%)</span>
      </div>

      {/* Heat Loss Comparison Table */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Element</th>
            <th style={styles.thRight}>Area (m\u00B2)</th>
            <th style={styles.thRight}>Proposed R</th>
            <th style={styles.thRight}>Proposed HL</th>
            <th style={styles.thRight}>Reference HL</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Roof', 'roof', 'roof'],
            ['Wall', 'wall', 'wall'],
            ['Glazing', 'glazing', 'glazing'],
            ['Doors (opaque)', 'doorOpaque', null],
            ['Skylights', 'skylight', null],
            ['Floor (slab)', 'floorSlab', 'floorSlab'],
            ['Floor (other)', 'floorOther', 'floorOther'],
          ].map(([label, propKey, refKey]) => {
            const b = breakdown[propKey] || { area: 0, weightedR: 0, heatLoss: 0 };
            const r = refKey && referenceBreakdown[refKey] ? referenceBreakdown[refKey] : null;
            if (b.area === 0 && (!r || r.area === 0)) return null;
            return (
              <tr key={propKey}>
                <td style={styles.td}>{label}</td>
                <td style={styles.tdRight}>{b.area.toFixed(1)}</td>
                <td style={styles.tdRight}>{b.weightedR > 0 ? `R${b.weightedR.toFixed(2)}` : '—'}</td>
                <td style={styles.tdRight}>{b.heatLoss.toFixed(1)}</td>
                <td style={styles.tdRight}>{r ? r.heatLoss.toFixed(1) : '—'}</td>
              </tr>
            );
          })}
          <tr style={styles.totalRow}>
            <td style={{ ...styles.td, fontWeight: 700 }}>Total</td>
            <td style={styles.tdRight}></td>
            <td style={styles.tdRight}></td>
            <td style={{ ...styles.tdRight, fontWeight: 700 }}>{hlProposed}</td>
            <td style={{ ...styles.tdRight, fontWeight: 700 }}>{hlReference}</td>
          </tr>
        </tbody>
      </table>

      {/* Minimum R-value Checks */}
      <h4 style={styles.sectionTitle}>Minimum R-value Checks</h4>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Element</th>
            <th style={styles.thRight}>Minimum</th>
            <th style={styles.thRight}>Actual</th>
            <th style={styles.thRight}>Status</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(minimumChecks).map(([key, check]) => (
            <tr key={key}>
              <td style={styles.td}>{formatCheckName(key)}</td>
              <td style={styles.tdRight}>R{check.required.toFixed(1)}</td>
              <td style={styles.tdRight}>
                {check.actual !== null ? `R${check.actual.toFixed(2)}` : '—'}
              </td>
              <td style={styles.tdRight}>
                <span style={check.met ? styles.checkPass : styles.checkFail}>
                  {check.met ? '\u2713 Pass' : '\u2717 Fail'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCheckName(key) {
  const names = {
    roof: 'Roof',
    wall: 'Wall',
    floorOther: 'Floor (suspended)',
    heatedCeiling: 'Heated ceiling',
    heatedWall: 'Heated wall',
    heatedFloor: 'Heated floor',
  };
  return names[key] || key;
}

const styles = {
  container: {
    marginTop: 16,
  },
  error: {
    padding: '16px 20px',
    background: '#fff5f5',
    color: '#c62828',
    borderRadius: 8,
    border: '1px solid #fdd',
    fontSize: 14,
    fontWeight: 500,
    marginTop: 16,
  },
  passBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 24px',
    background: '#E8F5E9',
    borderRadius: 8,
    border: '2px solid #4CAF50',
    marginBottom: 16,
  },
  failBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 24px',
    background: '#FFEBEE',
    borderRadius: 8,
    border: '2px solid #EF5350',
    marginBottom: 16,
  },
  bannerIcon: {
    fontSize: 24,
    fontWeight: 700,
  },
  bannerText: {
    fontSize: 18,
    fontWeight: 700,
    flex: 1,
  },
  bannerMargin: {
    fontSize: 14,
    fontWeight: 600,
    color: '#555',
  },
  checkRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    fontSize: 14,
    marginBottom: 12,
  },
  checkPass: {
    color: '#2E7D32',
    fontWeight: 700,
  },
  checkFail: {
    color: '#c62828',
    fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
    margin: '20px 0 8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    background: '#fff',
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid #e0e0e0',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    background: '#f5f6f8',
    fontWeight: 600,
    color: '#555',
    borderBottom: '1px solid #e0e0e0',
  },
  thRight: {
    textAlign: 'right',
    padding: '8px 12px',
    background: '#f5f6f8',
    fontWeight: 600,
    color: '#555',
    borderBottom: '1px solid #e0e0e0',
  },
  td: {
    padding: '6px 12px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
  },
  tdRight: {
    textAlign: 'right',
    padding: '6px 12px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
  },
  totalRow: {
    background: '#f8f9fa',
  },
};
