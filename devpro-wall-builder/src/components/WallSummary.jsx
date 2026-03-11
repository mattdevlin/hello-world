import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import { PANEL_GAP, BOTTOM_PLATE, TOP_PLATE } from '../utils/constants.js';

const SPLINE_WIDTH = 146;
const HALF_SPLINE = SPLINE_WIDTH / 2;
const EPS_INSET = 10;
const PANEL_EPS_DEPTH = 142;   // 162mm panel minus 2×10mm magboard
const SPLINE_EPS_DEPTH = 120;  // 146mm spline minus 2×13mm mag (user: 140mm deep, 2×10mm mag = 120mm)

function StatCard({ label, value, unit, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color: color || '#2C5F8A' }}>{value}</div>
      <div style={styles.statUnit}>{unit}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={styles.sectionLabel}>{children}</div>;
}

function Row({ label, value, bold }) {
  return (
    <tr>
      <td style={styles.rowLabel}>{label}</td>
      <td style={styles.rowValue}>{bold ? <strong>{value}</strong> : value}</td>
    </tr>
  );
}

export default function WallSummary({ layout, wallName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout) return null;

  const { panels, openings, lintelPanels, footers, height, deductionLeft, deductionRight, grossLength, isRaked, courses, isMultiCourse } = layout;

  // ── Count splines ──
  // Use course 0 panels for joint detection (same x-positions across courses)
  const basePanels = panels.filter(p => (p.course ?? 0) === 0);
  const jointSplines = [];
  for (let i = 0; i < basePanels.length - 1; i++) {
    const gapCentre = basePanels[i].x + basePanels[i].width + PANEL_GAP / 2;
    const insideLintel = lintelPanels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintel && !insideFooter) jointSplines.push(gapCentre);
  }
  let openingSplineCount = 0;
  for (const op of openings) {
    if (op.y > 0) openingSplineCount += 2;
  }
  const splineCount = jointSplines.length + openingSplineCount;

  // ── EPS volume calculation ──
  const exclusions = [];
  if (deductionLeft > 0) exclusions.push([deductionLeft, deductionLeft + BOTTOM_PLATE]);
  if (deductionRight > 0) exclusions.push([grossLength - deductionRight - BOTTOM_PLATE, grossLength - deductionRight]);

  for (const gc of jointSplines) {
    exclusions.push([gc - HALF_SPLINE, gc + HALF_SPLINE]);
  }

  for (const op of openings) {
    const hasSill = op.y > 0;
    exclusions.push([op.x - BOTTOM_PLATE, op.x]);
    if (hasSill) exclusions.push([op.x - BOTTOM_PLATE - SPLINE_WIDTH, op.x - BOTTOM_PLATE]);
    exclusions.push([op.x + op.drawWidth, op.x + op.drawWidth + BOTTOM_PLATE]);
    if (hasSill) exclusions.push([op.x + op.drawWidth + BOTTOM_PLATE, op.x + op.drawWidth + BOTTOM_PLATE + SPLINE_WIDTH]);
    exclusions.push([op.x, op.x + op.drawWidth]);
  }

  for (const p of basePanels) {
    if (p.type === 'end') exclusions.push([p.x + p.width - BOTTOM_PLATE, p.x + p.width]);
    if (deductionRight === 0 && Math.abs(p.x + p.width - grossLength) < 1) exclusions.push([grossLength - BOTTOM_PLATE, grossLength]);
    if (deductionLeft === 0 && Math.abs(p.x) < 1) exclusions.push([0, BOTTOM_PLATE]);
  }

  for (const l of lintelPanels) exclusions.push([l.x, l.x + l.width]);

  exclusions.sort((a, b) => a[0] - b[0]);

  const getEpsSegments = (panelLeft, panelRight) => {
    const clipped = [];
    for (const [eL, eR] of exclusions) {
      const cL = Math.max(eL, panelLeft);
      const cR = Math.min(eR, panelRight);
      if (cL < cR) clipped.push([cL, cR]);
    }
    const merged = [];
    for (const zone of clipped) {
      if (merged.length > 0 && zone[0] <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], zone[1]);
      } else {
        merged.push([...zone]);
      }
    }
    const segs = [];
    let cursor = panelLeft + EPS_INSET;
    for (const [eL, eR] of merged) {
      const segRight = eL - EPS_INSET;
      if (cursor < segRight) segs.push([cursor, segRight]);
      cursor = eR + EPS_INSET;
    }
    const segRight = panelRight - EPS_INSET;
    if (cursor < segRight) segs.push([cursor, segRight]);
    return segs;
  };

  const epsTop = TOP_PLATE * 2 + EPS_INSET;
  const epsBottom = height - BOTTOM_PLATE - EPS_INSET;
  const stdEpsH = epsBottom - epsTop;

  let panelEpsVol = 0;
  let panelEpsSA = 0;
  for (const panel of basePanels) {
    const segments = getEpsSegments(panel.x, panel.x + panel.width);
    const panelEpsH = isRaked
      ? Math.round(((panel.heightLeft + panel.heightRight) / 2) - BOTTOM_PLATE - TOP_PLATE * 2 - EPS_INSET * 2)
      : stdEpsH;
    for (const seg of segments) {
      const w = Math.round(seg[1] - seg[0]);
      if (w > 0 && panelEpsH > 0) {
        panelEpsVol += w * panelEpsH * PANEL_EPS_DEPTH;
        panelEpsSA += w * panelEpsH;
      }
    }
  }

  const splineH = height - BOTTOM_PLATE - TOP_PLATE * 2 - 10;
  const splineEpsVol = splineCount * SPLINE_WIDTH * splineH * SPLINE_EPS_DEPTH;
  const splineEpsSA = splineCount * SPLINE_WIDTH * splineH;

  let footerEpsVol = 0;
  let footerEpsSA = 0;
  for (const f of footers) {
    const op = openings.find(o => o.ref === f.ref);
    if (!op) continue;
    const fEpsTop = height - op.y + BOTTOM_PLATE + EPS_INSET;
    const fEpsBot = height - BOTTOM_PLATE - EPS_INSET;
    if (fEpsBot <= fEpsTop) continue;
    const leftSplineRight = op.x - BOTTOM_PLATE;
    let fEpsLeft = f.x < leftSplineRight ? leftSplineRight + EPS_INSET : f.x + EPS_INSET;
    const rightSplineLeft = op.x + op.drawWidth + BOTTOM_PLATE;
    let fEpsRight = f.x + f.width > rightSplineLeft ? rightSplineLeft - EPS_INSET : f.x + f.width - EPS_INSET;
    if (fEpsRight <= fEpsLeft) continue;
    const fW = Math.round(fEpsRight - fEpsLeft);
    const fH = Math.round(fEpsBot - fEpsTop);
    footerEpsVol += fW * fH * PANEL_EPS_DEPTH;
    footerEpsSA += fW * fH;
  }

  const totalEpsVol = panelEpsVol + splineEpsVol + footerEpsVol;
  const totalEpsM3 = (totalEpsVol / 1e9).toFixed(3);

  const totalGlueArea = (panelEpsSA + splineEpsSA + footerEpsSA) * 2;
  const totalGlueM2 = (totalGlueArea / 1e6).toFixed(2);

  const profileLabel = layout.profile === 'raked' ? 'Raked' : layout.profile === 'gable' ? 'Gable' : 'Standard';
  const heightLabel = isRaked
    ? `${layout.heightLeft} (L) → ${layout.heightRight} (R)`
    : `${layout.height}`;

  return (
    <div ref={sectionRef} data-print-section style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Wall Summary — {wallName}</h3>
        <PrintButton sectionRef={sectionRef} label="Summary" projectName={projectName} wallName={wallName} />
      </div>

      {/* Key metrics */}
      <div style={styles.statsRow}>
        <StatCard label="Panels" value={layout.totalPanels} unit="total" />
        <StatCard label="Sheets" value={layout.totalPanels * 2} unit="mag boards" />
        {isMultiCourse && <StatCard label="Courses" value={courses.length} unit="stacked" color="#E74C3C" />}
        <StatCard label="EPS Volume" value={totalEpsM3} unit="m³" color="#2E7D32" />
        <StatCard label="PU Glue Area" value={totalGlueM2} unit="m²" color="#E8A838" />
      </div>

      {/* Detail sections in two columns */}
      <div style={styles.columns}>
        {/* Left column: Wall dimensions */}
        <div style={styles.column}>
          <SectionLabel>Wall Dimensions</SectionLabel>
          <table style={styles.table}>
            <tbody>
              <Row label="Gross Length" value={`${layout.grossLength} mm`} />
              <Row label="Net Length" value={`${layout.netLength} mm`} />
              <Row label="Deductions" value={`L: ${deductionLeft} / R: ${deductionRight} mm`} />
              <Row label="Profile" value={profileLabel} />
              <Row label="Height" value={`${heightLabel} mm`} />
              {layout.peakHeight !== undefined && (
                <Row label="Peak" value={`${layout.peakHeight} mm at ${layout.peakPosition} mm`} />
              )}
              {isMultiCourse && courses.map((c, i) => (
                <Row
                  key={`course-${i}`}
                  label={`Course ${i + 1}`}
                  value={`${c.height}mm (${c.sheetHeight}mm sheet)`}
                  bold
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column: Components */}
        <div style={styles.column}>
          <SectionLabel>Components</SectionLabel>
          <table style={styles.table}>
            <tbody>
              <Row label="Full Panels" value={layout.fullPanels} />
              <Row label="L-Cut Panels" value={layout.lcutPanels} />
              <Row label="End Panels" value={layout.endPanels} />
              <Row label="Openings" value={openings.length} />
              <Row label="Footers" value={footers.length} />
              <Row label="Lintel Panels" value={lintelPanels.length} />
              <Row label="Splines" value={splineCount} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel details table */}
      {panels.length > 0 && (() => {
        const posMap = new Map(basePanels.map((p, idx) => [p.x, idx]));
        return (
          <div style={styles.detailSection}>
            <SectionLabel>Panel Details</SectionLabel>
            <div style={styles.tableWrap}>
              <table style={styles.detailTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    {isMultiCourse && <th style={styles.th}>Course</th>}
                    <th style={styles.th}>Type</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Width</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Position</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>H Left</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>H Right</th>
                    <th style={styles.th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {panels.map((p, i) => {
                    const posIdx = posMap.get(p.x) ?? 0;
                    const courseIdx = p.course ?? 0;
                    const label = isMultiCourse ? `P${posIdx + 1}·C${courseIdx + 1}` : `P${posIdx + 1}`;
                    return (
                      <tr key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                        <td style={styles.td}>{label}</td>
                        {isMultiCourse && <td style={styles.td}>C{courseIdx + 1}</td>}
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, background: badgeColor(p.type) }}>
                            {p.type}
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.width}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.x}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.heightLeft}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.heightRight}</td>
                        <td style={{ ...styles.td, color: '#888' }}>{p.openingRefs ? `Opens: ${p.openingRefs.join(', ')}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
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
    border: '1px solid #e0e0e0',
    marginTop: 16,
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

  // Stat cards row
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginBottom: 24,
  },
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

  // Two-column layout
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
    color: '#999',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1px solid #eee',
  },

  // Key-value rows
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

  // Panel details
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
