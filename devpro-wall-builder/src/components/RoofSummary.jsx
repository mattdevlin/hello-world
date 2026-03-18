import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import StatCard from './StatCard.jsx';
import { BRAND } from '../utils/designTokens.js';
import { ROOF_EPS_DEPTH, SPLINE_WIDTH, MAGBOARD, PLY_SHEET_WIDTH, PLY_SHEET_HEIGHT } from '../utils/constants.js';
import { extractRoofPlyPieces } from '../utils/plyOptimizer.js';
import { shelfPack } from '../utils/binPacking.js';

function Row({ label, value }) {
  return (
    <tr>
      <td style={styles.rowLabel}>{label}</td>
      <td style={styles.rowValue}>{value}</td>
    </tr>
  );
}

export default function RoofSummary({ layout, roofName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout) return null;

  const {
    type, length_mm, width_mm, pitch_deg, totalPanels, fullPanels, cutPanels,
    totalSplines, totalPlanArea, totalPanelArea, internalRoofArea,
    ridgeLength, ridgeHeight,
    epsDepth, totalThickness, eaveOverhang_mm, eaveOverhangHigh_mm, eaveOverhangLow_mm, gableOverhang_mm, planes,
    panels, splines, longSplineEps, shortSplineEps, splineTotal,
  } = layout;

  const areaM2 = (totalPlanArea / 1e6).toFixed(2);
  const panelAreaM2 = (totalPanelArea / 1e6).toFixed(2);
  const internalAreaM2 = ((internalRoofArea || 0) / 1e6).toFixed(2);

  // EPS volume estimate
  const panelEpsDepth = epsDepth || ROOF_EPS_DEPTH;
  const panelEpsVol = panels.reduce((sum, p) => sum + p.width * p.length * panelEpsDepth, 0);
  const splineEpsW = SPLINE_WIDTH - MAGBOARD * 2;
  const splineEpsVol = splines.reduce((sum, s) => sum + splineEpsW * s.length * (s.totalDepth || splineTotal || 220), 0);
  const totalEpsM3 = ((panelEpsVol + splineEpsVol) / 1e9).toFixed(3);
  const hasShortSplines = splines.some(s => s.splineType === 'short');

  // Ply sheets for long splines
  const plyPieces = extractRoofPlyPieces(layout);
  const plySheets = plyPieces.length > 0 ? shelfPack(plyPieces, PLY_SHEET_HEIGHT, PLY_SHEET_WIDTH) : [];
  const plySheetCount = plySheets.length;

  // Glue area (both faces)
  const panelSA = panels.reduce((sum, p) => sum + p.width * p.length, 0);
  const splineSA = splines.reduce((sum, s) => sum + splineEpsW * s.length, 0);
  const totalGlueM2 = ((panelSA + splineSA) * 2 / 1e6).toFixed(2);

  return (
    <div ref={sectionRef} data-print-section style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Roof Summary — {roofName}</h3>
        <PrintButton sectionRef={sectionRef} label="Summary" projectName={projectName} wallName={roofName} />
      </div>

      <div style={styles.statsRow}>
        <StatCard label="Panels" value={totalPanels} unit="total" />
        <StatCard label="Sheets" value={totalPanels * 2} unit="mag boards" />
        <StatCard label="Splines" value={totalSplines} unit="total" color="#27ae60" />
        <StatCard label="EPS Volume" value={totalEpsM3} unit="m³" color="#2E7D32" />
        {plySheetCount > 0 && <StatCard label="Ply Sheets" value={plySheetCount} unit="12mm ply" color="#8B4513" />}
        <StatCard label="PU Glue Area" value={totalGlueM2} unit="m²" color="#E8A838" />
      </div>

      <div style={styles.columns}>
        <div style={styles.column}>
          <div style={styles.sectionLabel}>Roof Dimensions</div>
          <table style={styles.table}>
            <tbody>
              <Row label="Type" value={type.charAt(0).toUpperCase() + type.slice(1)} />
              <Row label="Footprint" value={`${length_mm} × ${width_mm} mm`} />
              <Row label="Pitch" value={`${pitch_deg}°`} />
              <Row label="Thickness" value={`${totalThickness} mm (${panelEpsDepth} mm EPS)`} />
              <Row label="Slope Area" value={`${areaM2} m²`} />
              <Row label="Internal Area (H1)" value={`${internalAreaM2} m²`} />
              <Row label="Panel Area" value={`${panelAreaM2} m²`} />
              <Row label="Planes" value={planes.length} />
              {ridgeLength > 0 && <Row label="Ridge Length" value={`${ridgeLength} mm`} />}
              {ridgeHeight > 0 && <Row label="Ridge Height" value={`${Math.round(ridgeHeight)} mm`} />}
              {type === 'skillion' ? (
                <>
                  {(eaveOverhangHigh_mm ?? eaveOverhang_mm) > 0 && <Row label="High-Side Eave" value={`${eaveOverhangHigh_mm ?? eaveOverhang_mm} mm`} />}
                  {(eaveOverhangLow_mm ?? eaveOverhang_mm) > 0 && <Row label="Low-Side Eave" value={`${eaveOverhangLow_mm ?? eaveOverhang_mm} mm`} />}
                </>
              ) : (
                eaveOverhang_mm > 0 && <Row label="Eave Overhang" value={`${eaveOverhang_mm} mm`} />
              )}
              {gableOverhang_mm > 0 && <Row label="Gable Overhang" value={`${gableOverhang_mm} mm`} />}
            </tbody>
          </table>
        </div>

        <div style={styles.column}>
          <div style={styles.sectionLabel}>Components</div>
          <table style={styles.table}>
            <tbody>
              <Row label="Total Panels" value={totalPanels} />
              <Row label="Full Panels" value={fullPanels} />
              <Row label="Cut Panels" value={cutPanels} />
              <Row label="Splines" value={totalSplines} />
              {longSplineEps && <Row label="Long Spline EPS" value={`${longSplineEps}mm`} />}
              {hasShortSplines && shortSplineEps && <Row label="Short Spline EPS" value={`${shortSplineEps}mm`} />}
              {plySheetCount > 0 && <Row label="Ply Sheets (12mm)" value={`${plySheetCount} sheets (${PLY_SHEET_HEIGHT}×${PLY_SHEET_WIDTH})`} />}
              <Row label="EPS Volume" value={`${totalEpsM3} m³`} />
              <Row label="PU Glue Area" value={`${totalGlueM2} m²`} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel details */}
      {panels.length > 0 && (
        <div style={styles.detailSection}>
          <div style={styles.sectionLabel}>Panel Details</div>
          <div style={styles.tableWrap}>
            <table style={styles.detailTable}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Plane</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Width</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Length</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Area (mm²)</th>
                  <th style={styles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {panels.map((p, i) => {
                  const area = Math.round(p.width * p.length);
                  const planeLayout = layout.planeLayouts.find(pl => pl.plane.index === p.planeIndex);
                  const planeLabel = planeLayout ? planeLayout.plane.label : `Plane ${p.planeIndex}`;
                  const notes = [];
                  if (p.penetrationCuts && p.penetrationCuts.length) {
                    notes.push(`Pen: ${p.penetrationCuts.join(', ')}`);
                  }
                  return (
                    <tr key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                      <td style={styles.td}>P{p.globalIndex + 1}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, background: p.type === 'full' ? '#4A90D9' : '#E8A838' }}>
                          {p.type}
                        </span>
                      </td>
                      <td style={styles.td}>{planeLabel}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{Math.round(p.width)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{Math.round(p.length)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{area.toLocaleString()}</td>
                      <td style={{ ...styles.td, color: '#636363' }}>
                        {notes.join(', ') || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
    padding: 24,
    border: '1px solid #e0e0e0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginBottom: 24,
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 24,
    marginBottom: 24,
  },
  column: {},
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#737373',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1px solid #eee',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  rowLabel: {
    padding: '5px 8px 5px 0',
    fontSize: 13,
    color: '#666',
    whiteSpace: 'nowrap',
  },
  rowValue: {
    padding: '5px 0',
    fontSize: 13,
    color: '#333',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  detailSection: {
    borderTop: '1px solid #eee',
    paddingTop: 20,
  },
  tableWrap: {
    overflowX: 'auto',
  },
  detailTable: {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '2px solid #e0e0e0',
    color: '#666',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '7px 12px',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
  },
  evenRow: {
    background: '#fafafa',
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
