import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';
import { PANEL_WIDTH } from '../utils/constants.js';

export default function FloorOffcuts({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const offcuts = computeFloorOffcuts(layout);
  if (offcuts.length === 0) {
    return (
      <div ref={sectionRef} data-print-section style={styles.container}>
        <div style={styles.header}>
          <div style={styles.title}>Offcuts — {floorName}</div>
          <PrintButton sectionRef={sectionRef} label="Offcuts" projectName={projectName} wallName={floorName} />
        </div>
        <p style={{ color: '#636363', fontSize: 13, fontStyle: 'italic' }}>No significant offcuts generated.</p>
      </div>
    );
  }

  return (
    <div ref={sectionRef} data-print-section style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Offcuts — {floorName} ({offcuts.length} pieces)</div>
        <PrintButton sectionRef={sectionRef} label="Offcuts" projectName={projectName} wallName={floorName} />
      </div>

      <div style={styles.grid}>
        {offcuts.map((oc, i) => (
          <div key={i} style={styles.card}>
            <div style={styles.cardLabel}>{oc.source}</div>
            <div style={styles.cardDim}>{oc.width} × {oc.height} mm</div>
            <div style={styles.cardType}>{oc.type}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeFloorOffcuts(layout) {
  const offcuts = [];
  for (const panel of layout.panels) {
    // Stock remainder for undersized panels
    if (panel.width < PANEL_WIDTH && panel.width > 0) {
      const remainder = PANEL_WIDTH - panel.width;
      if (remainder > 50) {
        offcuts.push({
          width: Math.round(remainder),
          height: Math.round(panel.length),
          source: `P${panel.index + 1}`,
          type: 'stock remainder',
        });
      }
    }
  }
  return offcuts;
}

const styles = {
  container: {
    background: '#fff',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #e0e0e0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: '#333',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    background: '#f9f9f9',
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    padding: '10px 14px',
    minWidth: 120,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#333',
  },
  cardDim: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
    fontVariantNumeric: 'tabular-nums',
  },
  cardType: {
    fontSize: 10,
    color: '#737373',
    marginTop: 4,
    textTransform: 'uppercase',
  },
};
