import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import { PANEL_GAP, BOTTOM_PLATE, TOP_PLATE } from '../utils/constants.js';

const SPLINE_WIDTH = 146;
const HALF_SPLINE = SPLINE_WIDTH / 2;
const EPS_INSET = 10;
const PANEL_EPS_DEPTH = 142;   // 162mm panel minus 2×10mm magboard
const SPLINE_EPS_DEPTH = 120;  // 146mm spline minus 2×13mm mag (user: 140mm deep, 2×10mm mag = 120mm)

export default function WallSummary({ layout, wallName }) {
  const sectionRef = useRef(null);
  if (!layout) return null;

  const { panels, openings, lintels, footers, height, deductionLeft, deductionRight, grossLength, isRaked } = layout;

  // ── Count splines ──
  const jointSplines = [];
  for (let i = 0; i < panels.length - 1; i++) {
    const gapCentre = panels[i].x + panels[i].width + PANEL_GAP / 2;
    const insideLintel = lintels.some(l => gapCentre > l.x && gapCentre < l.x + l.width);
    const insideFooter = footers.some(f => gapCentre > f.x && gapCentre < f.x + f.width);
    if (!insideLintel && !insideFooter) jointSplines.push(gapCentre);
  }
  let openingSplineCount = 0;
  for (const op of openings) {
    if (op.y > 0) openingSplineCount += 2;
  }
  const splineCount = jointSplines.length + openingSplineCount;

  // ── EPS volume calculation ──
  // Panel EPS: build exclusion zones, compute segments per panel
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

  for (const p of panels) {
    if (p.type === 'end') exclusions.push([p.x + p.width - BOTTOM_PLATE, p.x + p.width]);
    if (deductionRight === 0 && Math.abs(p.x + p.width - grossLength) < 1) exclusions.push([grossLength - BOTTOM_PLATE, grossLength]);
    if (deductionLeft === 0 && Math.abs(p.x) < 1) exclusions.push([0, BOTTOM_PLATE]);
  }

  for (const l of lintels) exclusions.push([l.x, l.x + l.width]);

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

  // Panel EPS volume
  let panelEpsVol = 0;
  for (const panel of panels) {
    const segments = getEpsSegments(panel.x, panel.x + panel.width);
    const panelEpsH = isRaked
      ? Math.round(((panel.heightLeft + panel.heightRight) / 2) - BOTTOM_PLATE - TOP_PLATE * 2 - EPS_INSET * 2)
      : stdEpsH;
    for (const seg of segments) {
      const w = Math.round(seg[1] - seg[0]);
      if (w > 0 && panelEpsH > 0) {
        panelEpsVol += w * panelEpsH * PANEL_EPS_DEPTH;
      }
    }
  }

  // Spline EPS volume
  const splineH = height - BOTTOM_PLATE - TOP_PLATE * 2 - 10;
  const splineEpsVol = splineCount * SPLINE_WIDTH * splineH * SPLINE_EPS_DEPTH;

  // Footer EPS volume
  let footerEpsVol = 0;
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
    footerEpsVol += Math.round(fEpsRight - fEpsLeft) * Math.round(fEpsBot - fEpsTop) * PANEL_EPS_DEPTH;
  }

  const totalEpsVol = panelEpsVol + splineEpsVol + footerEpsVol;
  const totalEpsM3 = (totalEpsVol / 1e9).toFixed(3);

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
          <tr style={styles.dividerRow}><td colSpan={2}></td></tr>
          <tr><td style={styles.labelCell}>Total EPS Volume</td><td style={styles.valueCell}><strong>{totalEpsM3} m³</strong></td></tr>
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
