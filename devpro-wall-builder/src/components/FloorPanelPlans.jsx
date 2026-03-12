import { useRef } from 'react';
import PrintButton from './PrintButton.jsx';

const CARD_W = 260;
const CARD_H = 300;
const PAD = 40;

export default function FloorPanelPlans({ layout, floorName, projectName }) {
  const sectionRef = useRef(null);
  if (!layout || !layout.panels || layout.panels.length === 0) return null;

  const { panels } = layout;

  return (
    <div ref={sectionRef} data-print-section style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>Panel Cut Plans — {floorName}</div>
        <PrintButton sectionRef={sectionRef} label="Panel Plans" projectName={projectName} wallName={floorName} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {panels.map((panel) => (
          <PanelCard key={panel.index} panel={panel} />
        ))}
      </div>
    </div>
  );
}

function PanelCard({ panel }) {
  const drawW = CARD_W - PAD * 2;
  const drawH = CARD_H - PAD * 2 - 30;
  const scaleX = drawW / (panel.width || 1);
  const scaleY = drawH / (panel.length || 1);
  const scale = Math.min(scaleX, scaleY);
  const w = panel.width * scale;
  const h = panel.length * scale;
  const ox = PAD + (drawW - w) / 2;
  const oy = PAD + 20 + (drawH - h) / 2;

  const hasClip = panel.clippedPolygon && panel.clippedPolygon.length >= 3;
  const hasCuts = panel.openingCuts.length > 0 || panel.recessCuts.length > 0;
  const label = `P${panel.index + 1}`;
  const subtitle = `${Math.round(panel.width)} × ${Math.round(panel.length)} mm`;
  const notes = [];
  if (panel.type === 'edge') notes.push('Edge');
  if (panel.openingCuts.length) notes.push(`Opens: ${panel.openingCuts.join(', ')}`);
  if (panel.recessCuts.length) notes.push(`Recess: ${panel.recessCuts.join(', ')}`);

  return (
    <div style={{
      width: CARD_W, background: '#fff', borderRadius: 6,
      border: `1px solid ${hasCuts ? '#e67e22' : '#e0e0e0'}`, overflow: 'hidden'
    }}>
      <svg width={CARD_W} height={CARD_H} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
        {/* Title */}
        <text x={CARD_W / 2} y={16} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#333">{label}</text>
        <text x={CARD_W / 2} y={30} textAnchor="middle" fontSize={10} fill="#888">{subtitle}</text>

        {/* Panel shape */}
        {hasClip ? (
          <polygon
            points={panel.clippedPolygon.map(pt =>
              `${ox + (pt.x - panel.x) * scale},${oy + h - (pt.y - panel.y) * scale}`
            ).join(' ')}
            fill="#4A90D9" fillOpacity={0.2} stroke="#2C5F8A" strokeWidth={1}
          />
        ) : (
          <rect x={ox} y={oy} width={w} height={h} fill="#4A90D9" fillOpacity={0.2} stroke="#2C5F8A" strokeWidth={1} />
        )}

        {/* Dimensions */}
        <text x={ox + w / 2} y={oy + h + 14} textAnchor="middle" fontSize={10} fill="#666">{Math.round(panel.width)}</text>
        <text x={ox - 6} y={oy + h / 2} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#666">{Math.round(panel.length)}</text>

        {/* Notes */}
        {notes.length > 0 && (
          <text x={CARD_W / 2} y={CARD_H - 8} textAnchor="middle" fontSize={9} fill="#888">
            {notes.join(' | ')}
          </text>
        )}
      </svg>
    </div>
  );
}
