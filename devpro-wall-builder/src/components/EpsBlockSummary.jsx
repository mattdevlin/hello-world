import { useState, useMemo } from 'react';
import { computeProjectEpsBlocks, computeProjectEpsBlocksWithFloors, computeProjectEpsBlocksWithRoofs, EPS_BLOCK, PANEL_SLABS_PER_BLOCK, SPLINE_SLABS_PER_BLOCK } from '../utils/epsOptimizer.js';
import { FLOOR_PANEL_SLABS_PER_BLOCK, FLOOR_SPLINE_SLABS_PER_BLOCK, FLOOR_EPS_DEPTH, FLOOR_SPLINE_DEPTH } from '../utils/constants.js';
import { exportWallEpsCsv, exportAllWallsEpsCsv } from '../utils/epsSpreadsheetExport.js';

export default function EpsBlockSummary({ walls, floors, roofs, projectName }) {
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => {
    if ((!walls || walls.length === 0) && (!floors || floors.length === 0) && (!roofs || roofs.length === 0)) return null;
    if ((roofs && roofs.length > 0)) {
      return computeProjectEpsBlocksWithRoofs(walls || [], floors || [], roofs);
    }
    if (floors && floors.length > 0) {
      return computeProjectEpsBlocksWithFloors(walls || [], floors);
    }
    return computeProjectEpsBlocks(walls);
  }, [walls, floors, roofs]);

  if (!result) return null;

  const {
    panelPieces, splinePieces, panelSlabCount, splineSlabCount,
    panelBlocks, splineBlocks, totalBlocks,
    panelUtilization, splineUtilization,
    totalPieces, totalVolumeM3, perWall,
  } = result;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>EPS Block Requirements</h3>
          <span style={styles.subtitle}>
            {totalPieces} pieces across {walls.length} wall{walls.length !== 1 ? 's' : ''}
            {result.hasFloors && result.perFloor?.length > 0 && ` + ${result.perFloor.length} floor${result.perFloor.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.blockCount}>{totalBlocks}</span>
          <span style={styles.blockLabel}>block{totalBlocks !== 1 ? 's' : ''}</span>
          <span style={styles.arrow}>{expanded ? '\u25BC' : '\u25B6'}</span>
        </div>
      </div>

      {expanded && (
        <div style={styles.body}>
          {/* Summary cards */}
          <div style={styles.cards}>
            <div style={styles.card}>
              <div style={styles.cardValue}>{totalBlocks}</div>
              <div style={styles.cardUnit}>blocks total</div>
              <div style={styles.cardDetail}>
                {EPS_BLOCK.length} × {EPS_BLOCK.width} × {EPS_BLOCK.depth} mm
              </div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#2C5F8A' }}>{panelBlocks}</div>
              <div style={styles.cardUnit}>panel EPS</div>
              <div style={styles.cardDetail}>
                {panelSlabCount} slab{panelSlabCount !== 1 ? 's' : ''} @ 142mm
                ({PANEL_SLABS_PER_BLOCK}/block)
              </div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#6AACE6' }}>{splineBlocks}</div>
              <div style={styles.cardUnit}>spline EPS</div>
              <div style={styles.cardDetail}>
                {splineSlabCount} slab{splineSlabCount !== 1 ? 's' : ''} @ 120mm
                ({SPLINE_SLABS_PER_BLOCK}/block)
              </div>
            </div>
            <div style={styles.card}>
              <div style={{ ...styles.cardValue, color: '#27ae60' }}>{totalVolumeM3}</div>
              <div style={styles.cardUnit}>m³ EPS used</div>
              <div style={styles.cardDetail}>
                {totalPieces} cut pieces
              </div>
            </div>
          </div>

          {/* Slab utilization */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Slab Utilization</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Type</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Pieces</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Slabs</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Blocks</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Utilization</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.td}>Panel EPS (142mm)</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{panelPieces.length}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{panelSlabCount}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{panelBlocks}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <UtilBar pct={panelUtilization} />
                  </td>
                </tr>
                <tr style={styles.evenRow}>
                  <td style={styles.td}>Spline EPS (120mm)</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{splinePieces.length}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{splineSlabCount}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{splineBlocks}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <UtilBar pct={splineUtilization} />
                  </td>
                </tr>
                {result.hasFloors && (
                  <>
                    <tr>
                      <td style={styles.td}>Floor Panel EPS ({FLOOR_EPS_DEPTH}mm)</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{result.floorPanelPieces?.length || 0}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{result.floorPanelSlabCount || 0}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{result.floorPanelBlocks || 0}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <UtilBar pct={result.floorPanelUtilization || 0} />
                      </td>
                    </tr>
                    <tr style={styles.evenRow}>
                      <td style={styles.td}>Floor Spline EPS ({FLOOR_SPLINE_DEPTH}mm)</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{result.floorSplinePieces?.length || 0}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{result.floorSplineSlabCount || 0}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{result.floorSplineBlocks || 0}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <UtilBar pct={result.floorSplineUtilization || 0} />
                      </td>
                    </tr>
                  </>
                )}
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
                  <th style={{ ...styles.th, textAlign: 'right' }}>Panel Pieces</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Panel Area</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Spline Pieces</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Spline Area</th>
                </tr>
              </thead>
              <tbody>
                {perWall.map((w, i) => (
                  <tr key={w.wallId} style={i % 2 === 0 ? styles.evenRow : undefined}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {w.wallName}
                        <button
                          onClick={() => {
                            const wall = walls.find(wl => wl.id === w.wallId);
                            if (wall) exportWallEpsCsv(wall, projectName);
                          }}
                          style={styles.csvBtn}
                        >
                          CSV
                        </button>
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.panelCount}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{(w.panelArea / 1e6).toFixed(2)} m²</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{w.splineCount}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{(w.splineArea / 1e6).toFixed(2)} m²</td>
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
                    <th style={{ ...styles.th, textAlign: 'right' }}>Panel Pieces</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Panel Area</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Spline Pieces</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Spline Area</th>
                  </tr>
                </thead>
                <tbody>
                  {result.perFloor.map((f, i) => (
                    <tr key={f.floorId} style={i % 2 === 0 ? styles.evenRow : undefined}>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{f.floorName}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{f.panelCount}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{(f.panelArea / 1e6).toFixed(2)} m²</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{f.splineCount}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{(f.splineArea / 1e6).toFixed(2)} m²</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Download all */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => exportAllWallsEpsCsv(walls, projectName)} style={styles.downloadAllBtn}>
              Download all EPS cuts
            </button>
          </div>

          {/* Block info */}
          <div style={styles.blockInfo}>
            Block: {EPS_BLOCK.length} × {EPS_BLOCK.width} × {EPS_BLOCK.depth} mm
            — yields {PANEL_SLABS_PER_BLOCK} panel slabs (142mm) or {SPLINE_SLABS_PER_BLOCK} spline slabs (120mm) per block.
            Each slab is {EPS_BLOCK.length} × {EPS_BLOCK.width} mm for piece cutting.
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
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
  blockCount: {
    fontSize: 28,
    fontWeight: 700,
    color: '#2C5F8A',
    lineHeight: 1,
  },
  blockLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  arrow: {
    fontSize: 10,
    color: '#666',
  },

  // Body
  body: {
    padding: '16px 20px',
    borderTop: '1px solid #eee',
  },

  // Cards
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

  // Sections
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

  // Table
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

  // Block info
  blockInfo: {
    fontSize: 11,
    color: '#737373',
    fontStyle: 'italic',
    padding: '8px 0 0',
    borderTop: '1px solid #eee',
  },

  // CSV buttons
  csvBtn: {
    padding: '2px 6px',
    background: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 600,
    lineHeight: 1.4,
  },
  downloadAllBtn: {
    padding: '8px 16px',
    background: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
};
