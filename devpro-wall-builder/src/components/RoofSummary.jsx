import { BRAND, NEUTRAL } from '../utils/designTokens.js';

export default function RoofSummary({ layout }) {
  if (!layout) return null;

  const {
    type, length_mm, width_mm, pitch_deg, totalPanels, fullPanels, cutPanels,
    totalSplines, totalPlanArea, totalPanelArea, internalRoofArea,
    ridgeLength, ridgeHeight,
    epsDepth, totalThickness, eaveOverhang_mm, gableOverhang_mm, planes,
  } = layout;

  const areaM2 = (totalPlanArea / 1e6).toFixed(2);
  const panelAreaM2 = (totalPanelArea / 1e6).toFixed(2);
  const internalAreaM2 = ((internalRoofArea || 0) / 1e6).toFixed(2);

  const stats = [
    { label: 'Type', value: type.charAt(0).toUpperCase() + type.slice(1) },
    { label: 'Footprint', value: `${length_mm} x ${width_mm} mm` },
    { label: 'Pitch', value: `${pitch_deg}°` },
    { label: 'Thickness', value: `${totalThickness} mm (${epsDepth} mm EPS)` },
    { label: 'Planes', value: planes.length },
    { label: 'Total Slope Area', value: `${areaM2} m²` },
    { label: 'Internal Area (H1)', value: `${internalAreaM2} m²` },
    { label: 'Panel Area', value: `${panelAreaM2} m²` },
    { label: 'Total Panels', value: totalPanels },
    { label: 'Full Panels', value: fullPanels },
    { label: 'Cut Panels', value: cutPanels },
    { label: 'Splines', value: totalSplines },
  ];

  if (ridgeLength > 0) {
    stats.push({ label: 'Ridge Length', value: `${ridgeLength} mm` });
  }
  if (ridgeHeight > 0) {
    stats.push({ label: 'Ridge Height', value: `${ridgeHeight} mm` });
  }
  if (eaveOverhang_mm > 0) {
    stats.push({ label: 'Eave Overhang', value: `${eaveOverhang_mm} mm` });
  }
  if (gableOverhang_mm > 0) {
    stats.push({ label: 'Gable Overhang', value: `${gableOverhang_mm} mm` });
  }

  return (
    <div style={styles.grid}>
      {stats.map(s => (
        <div key={s.label} style={styles.card}>
          <div style={styles.cardLabel}>{s.label}</div>
          <div style={styles.cardValue}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12,
  },
  card: {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    padding: '12px 16px',
    textAlign: 'center',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: NEUTRAL.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: 700,
    color: BRAND.roof,
  },
};
