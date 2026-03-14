import { useState, useMemo } from 'react';
import { computeProjectGlue, computeProjectGlueWithFloors } from '../utils/glueCalculator.js';

export default function GlueSummary({ walls, floors }) {
  const [expanded, setExpanded] = useState(false);

  const { result, error } = useMemo(() => {
    if ((!walls || walls.length === 0) && (!floors || floors.length === 0)) return { result: null, error: null };
    try {
      if (floors && floors.length > 0) {
        return { result: computeProjectGlueWithFloors(walls || [], floors), error: null };
      }
      return { result: computeProjectGlue(walls), error: null };
    } catch (e) {
      console.error('GlueSummary error:', e);
      return { result: null, error: e.message };
    }
  }, [walls, floors]);

  if (error) {
    return (
      <div style={{ ...styles.container, padding: 16, color: '#e74c3c', fontSize: 13 }}>
        PU Glue calculation error: {error}
      </div>
    );
  }

  if (!result) return null;

  const {
    totalAreaM2, panelAreaM2, splineAreaM2, footerPanelAreaM2,
    totalKg, totalLitres,
    drumsNeeded, drumCapacityUsed, drumLitres,
    rateKgM2,
    perWall,
  } = result;

  const usedPct = Math.round(drumCapacityUsed * 100);

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>PU Glue — SabreBond PU6000</h3>
          <span style={styles.subtitle}>
            {totalAreaM2.toFixed(1)} m² bond area @ {rateKgM2 * 1000} g/m²
          </span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.drumCount}>{drumsNeeded}</span>
          <span style={styles.drumLabel}>drum{drumsNeeded !== 1 ? 's' : ''}</span>
          <DrumGauge pct={usedPct} />
          <span style={styles.arrow}>{expanded ? '\u25BC' : '\u25B6'}</span>
        </div>
      </div>

      {expanded && (
        <div style={styles.body}>
          {/* Summary cards */}
          <div style={styles.cards}>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#6A1B9A' }}>{drumsNeeded}</div>
              <div style={styles.cardUnit}>× {drumLitres}L drums</div>
              <div style={styles.cardDetail}>{usedPct}% of drum capacity used</div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#E8A838' }}>{totalLitres.toFixed(1)}</div>
              <div style={styles.cardUnit}>litres</div>
              <div style={styles.cardDetail}>{totalKg.toFixed(1)} kg (SG 1.1)</div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#2C5F8A' }}>{totalAreaM2.toFixed(1)}</div>
              <div style={styles.cardUnit}>m² bond area</div>
              <div style={styles.cardDetail}>both faces of all EPS</div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardValue}>{rateKgM2 * 1000}</div>
              <div style={styles.cardUnit}>g/m² rate</div>
              <div style={styles.cardDetail}>coverage rate</div>
            </div>
          </div>

          {/* Drum capacity gauge */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Drum Capacity</div>
            <div style={styles.gaugeRow}>
              <div style={styles.gaugeBarOuter} role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100}
                aria-label={`Drum capacity ${usedPct}% — ${usedPct > 90 ? 'efficient' : usedPct > 60 ? 'moderate' : 'low'} utilisation`}>
                <div style={{
                  ...styles.gaugeBarInner,
                  width: `${usedPct}%`,
                  background: usedPct > 90 ? '#27ae60' : usedPct > 60 ? '#e67e22' : '#e74c3c',
                }} />
              </div>
              <span style={styles.gaugePct}>{usedPct}% ({usedPct > 90 ? 'efficient' : usedPct > 60 ? 'moderate' : 'low'})</span>
            </div>
            <div style={styles.gaugeCaption}>
              {totalLitres.toFixed(1)}L required of {drumsNeeded * drumLitres}L ordered
              {drumsNeeded > 1 && ` (${drumsNeeded} × ${drumLitres}L)`}
              {usedPct < 100 && ` — ${((drumsNeeded * drumLitres) - totalLitres).toFixed(1)}L surplus`}
            </div>
          </div>

          {/* Area breakdown */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Bond Area Breakdown</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Component</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Area (m²)</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Glue (kg)</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Glue (L)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.td}>Panel EPS</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{panelAreaM2.toFixed(2)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{(panelAreaM2 * rateKgM2).toFixed(2)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{(panelAreaM2 * rateKgM2 / 1.1).toFixed(2)}</td>
                </tr>
                <tr style={styles.evenRow}>
                  <td style={styles.td}>Spline EPS</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{splineAreaM2.toFixed(2)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{(splineAreaM2 * rateKgM2).toFixed(2)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{(splineAreaM2 * rateKgM2 / 1.1).toFixed(2)}</td>
                </tr>
                {footerPanelAreaM2 > 0 && (
                  <tr>
                    <td style={styles.td}>Footer Panel EPS</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{footerPanelAreaM2.toFixed(2)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{(footerPanelAreaM2 * rateKgM2).toFixed(2)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{(footerPanelAreaM2 * rateKgM2 / 1.1).toFixed(2)}</td>
                  </tr>
                )}
                <tr style={styles.totalRow}>
                  <td style={{ ...styles.td, fontWeight: 700 }}>Total</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>{totalAreaM2.toFixed(2)}</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>{totalKg.toFixed(2)}</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>{totalLitres.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Per-wall breakdown */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Per-Wall Breakdown</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Wall</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Area (m²)</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Glue (kg)</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Glue (L)</th>
                </tr>
              </thead>
              <tbody>
                {perWall.map((w, i) => (
                  <tr key={w.wallId} style={i % 2 === 0 ? styles.evenRow : undefined}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{w.wallName}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.areaM2.toFixed(2)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.glueKg.toFixed(2)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.glueLitres.toFixed(2)}</td>
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
                    <th style={{ ...styles.th, textAlign: 'right' }}>Area (m²)</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Glue (kg)</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Glue (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.perFloor.map((f, i) => (
                    <tr key={f.floorId} style={i % 2 === 0 ? styles.evenRow : undefined}>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{f.floorName}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{f.areaM2.toFixed(2)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{f.glueKg.toFixed(2)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{f.glueLitres.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={styles.info}>
            SabreBond PU6000 — {rateKgM2 * 1000}g/m² application rate, SG 1.1, {drumLitres}L drums.
            Glue applied to both faces of every EPS piece (panels, splines, footer panels).
          </div>
        </div>
      )}
    </div>
  );
}

/** Small circular drum gauge showing percentage used */
function DrumGauge({ pct }) {
  const r = 14;
  const cx = 16;
  const cy = 16;
  const circ = 2 * Math.PI * r;
  const filled = circ * (pct / 100);
  const color = pct > 75 ? '#27ae60' : pct > 50 ? '#e67e22' : '#e74c3c';

  return (
    <svg width={32} height={32} style={{ marginLeft: 4 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eee" strokeWidth={3} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fontWeight={700} fill={color}>
        {pct}%
      </text>
    </svg>
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
  drumCount: {
    fontSize: 28,
    fontWeight: 700,
    color: '#6A1B9A',
    lineHeight: 1,
  },
  drumLabel: {
    fontSize: 12,
    color: '#666',
  },
  arrow: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
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
  gaugeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  gaugeBarOuter: {
    flex: 1,
    height: 16,
    background: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  gaugeBarInner: {
    height: '100%',
    borderRadius: 8,
    transition: 'width 0.3s ease',
  },
  gaugePct: {
    fontSize: 16,
    fontWeight: 700,
    color: '#333',
    minWidth: 48,
    textAlign: 'right',
  },
  gaugeCaption: {
    fontSize: 12,
    color: '#636363',
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
  totalRow: {
    background: '#f0f0f0',
  },
  info: {
    fontSize: 11,
    color: '#737373',
    fontStyle: 'italic',
    padding: '8px 0 0',
    borderTop: '1px solid #eee',
  },
};
