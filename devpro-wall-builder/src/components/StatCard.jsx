export default function StatCard({ label, value, unit, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color: color || '#2C5F8A' }}>{value}</div>
      <div style={styles.statUnit}>{unit}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
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
    color: '#999',
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
};
