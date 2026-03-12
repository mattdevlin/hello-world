import { useState, useMemo } from 'react';
import { computeProjectTimber, computeProjectTimberRatio } from '../utils/timberCalculator.js';

export default function TimberTakeoffSummary({ walls, floors }) {
  const [expanded, setExpanded] = useState(false);

  const { result, error } = useMemo(() => {
    if ((!walls || walls.length === 0) && (!floors || floors.length === 0)) return { result: null, error: null };
    try {
      return { result: computeProjectTimber(walls || [], floors || []), error: null };
    } catch (e) {
      console.error('TimberTakeoffSummary error:', e);
      return { result: null, error: e.message };
    }
  }, [walls, floors]);

  const timberRatio = useMemo(() => {
    if (!walls || walls.length === 0) return null;
    try {
      return computeProjectTimberRatio(walls);
    } catch (e) {
      console.error('Timber ratio error:', e);
      return null;
    }
  }, [walls]);

  if (error) {
    return (
      <div style={{ ...styles.container, padding: 16, color: '#e74c3c', fontSize: 13 }}>
        Timber takeoff calculation error: {error}
      </div>
    );
  }

  if (!result) return null;

  const {
    totalPieces, totalLinealMetres, wallLinealMetres, floorLinealMetres,
    wallPieces, floorPieces, perWall, perFloor, hasFloors,
  } = result;

  // Group wall pieces by type for the breakdown table
  const typeOrder = ['bottom_plate', 'end_plate', 'window_sill', 'window_jamb', 'door_jamb', 'lintel', 'top_plate_1', 'top_plate_2'];
  const typeLabels = {
    bottom_plate: 'Bottom Plates',
    end_plate: 'End Plates',
    window_sill: 'Window Sill Plates',
    window_jamb: 'Window Jamb Plates',
    door_jamb: 'Door Jamb Plates',
    lintel: 'Lintels',
    top_plate_1: 'Top Plate 1',
    top_plate_2: 'Top Plate 2',
  };

  const groupedWallPieces = [];
  for (const t of typeOrder) {
    const items = wallPieces.filter(p => p.type === t);
    if (items.length > 0) groupedWallPieces.push({ type: t, label: typeLabels[t], items });
  }

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>Timber Takeoff — Prenail Schedule</h3>
          <span style={styles.subtitle}>
            {totalPieces} piece{totalPieces !== 1 ? 's' : ''} · {totalLinealMetres.toFixed(1)} lineal metres
          </span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.pieceCount}>{totalPieces}</span>
          <span style={styles.pieceLabel}>piece{totalPieces !== 1 ? 's' : ''}</span>
          <span style={styles.arrow}>{expanded ? '\u25BC' : '\u25B6'}</span>
        </div>
      </div>

      {expanded && (
        <div style={styles.body}>
          {/* Summary cards */}
          <div style={styles.cards}>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#5D4037' }}>{totalPieces}</div>
              <div style={styles.cardUnit}>total pieces</div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#E8A838' }}>{totalLinealMetres.toFixed(1)}</div>
              <div style={styles.cardUnit}>lineal metres</div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#2C5F8A' }}>{wallLinealMetres.toFixed(1)}</div>
              <div style={styles.cardUnit}>wall timber (m)</div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#6A1B9A' }}>{floorLinealMetres.toFixed(1)}</div>
              <div style={styles.cardUnit}>floor timber (m)</div>
            </div>
          </div>

          {/* Thermal Bridging — Timber Fraction */}
          {timberRatio && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Thermal Bridging — Timber Fraction</div>
              <div style={{ ...styles.cards, marginBottom: 12 }}>
                <div style={styles.card}>
                  <div style={{ ...styles.cardValue, color: '#D84315' }}>
                    {timberRatio.projectTimberPercentage.toFixed(1)}%
                  </div>
                  <div style={styles.cardUnit}>timber (avg)</div>
                </div>
                <div style={styles.card}>
                  <div style={{ ...styles.cardValue, color: '#2E7D32' }}>
                    {timberRatio.projectInsulationPercentage.toFixed(1)}%
                  </div>
                  <div style={styles.cardUnit}>insulation (avg)</div>
                </div>
                <div style={styles.card}>
                  <div style={{ ...styles.cardValue, color: '#555', fontSize: 18 }}>
                    {(timberRatio.totalEffectiveArea / 1e6).toFixed(1)} m²
                  </div>
                  <div style={styles.cardUnit}>effective wall area</div>
                </div>
              </div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Wall</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Effective Area (m²)</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Timber Area (m²)</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Timber %</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Insulation %</th>
                  </tr>
                </thead>
                <tbody>
                  {timberRatio.perWall.map((w, i) => (
                    <tr key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{w.wallName}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{(w.effectiveWallArea / 1e6).toFixed(2)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{(w.timberFaceArea / 1e6).toFixed(3)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#D84315' }}>{w.timberPercentage.toFixed(1)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#2E7D32' }}>{w.insulationPercentage.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Wall Timber */}
          {wallPieces.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Wall Timber</div>
              {groupedWallPieces.map(group => (
                <div key={group.type} style={{ marginBottom: 12 }}>
                  <div style={styles.groupLabel}>{group.label} ({group.items.length})</div>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Piece Label</th>
                        <th style={styles.th}>Section</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Length (mm)</th>
                        <th style={styles.th}>Wall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((p, i) => (
                        <tr key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                          <td style={styles.td}>{p.label}</td>
                          <td style={styles.td}>{p.section}</td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>{p.length}</td>
                          <td style={styles.td}>{p.wallName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Floor Timber */}
          {hasFloors && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Floor Timber</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Piece Label</th>
                    <th style={styles.th}>Section</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Length (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {floorPieces.map((p, i) => (
                    <tr key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                      <td style={styles.td}>{p.label}</td>
                      <td style={styles.td}>{p.section}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{p.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Roof Timber */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Roof Timber</div>
            <div style={styles.placeholder}>Roof timber calculation not yet available</div>
          </div>

          {/* Per-wall summary */}
          {perWall.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Per-Wall Summary</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Wall</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Pieces</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Lineal Metres</th>
                  </tr>
                </thead>
                <tbody>
                  {perWall.map((w, i) => (
                    <tr key={w.wallId} style={i % 2 === 0 ? styles.evenRow : undefined}>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{w.wallName}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{w.pieces}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{w.linealMetres.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-floor summary */}
          {perFloor.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Per-Floor Summary</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Floor</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Pieces</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Lineal Metres</th>
                  </tr>
                </thead>
                <tbody>
                  {perFloor.map((f, i) => (
                    <tr key={f.floorId} style={i % 2 === 0 ? styles.evenRow : undefined}>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{f.floorName}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{f.pieces}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{f.linealMetres.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={styles.info}>
            Wall plates: 140\u00D745mm. Lintels: 142mm wide \u00D7 opening lintel height.
            Max plate length 4800mm — longer pieces are split. Top plate joins staggered 600mm.
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
  pieceCount: {
    fontSize: 28,
    fontWeight: 700,
    color: '#5D4037',
    lineHeight: 1,
  },
  pieceLabel: {
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
    color: '#999',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
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
  groupLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#555',
    marginBottom: 4,
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
  placeholder: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    padding: '12px 0',
  },
  info: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    padding: '8px 0 0',
    borderTop: '1px solid #eee',
  },
};
