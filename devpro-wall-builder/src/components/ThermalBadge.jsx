/**
 * Shared thermal comparison badge for collapsible section headers.
 * Used across Wall, Floor, and Roof builders for heat loss, timber %, and insulation % comparisons.
 */

const badgeStyle = { display: 'flex', gap: 12, fontSize: 12, fontWeight: 500, alignItems: 'baseline' };
const hintStyle = { fontSize: 11, color: '#E65100', fontStyle: 'italic' };
const GREEN = '#2E7D32';
const ORANGE = '#E65100';

/**
 * Heat loss badge: lower is better.
 * @param {number} devHL - DEVPRO heat loss (W/K)
 * @param {number} refHL - NZBC reference heat loss (W/K)
 */
export function HeatLossBadge({ devHL, refHL }) {
  const devBetter = devHL < refHL;
  const pctMore = devHL > 0 ? Math.round((refHL / devHL) * 100) : 0;
  return (
    <span style={badgeStyle}>
      <span style={{ color: devBetter ? GREEN : ORANGE }}>DEVPRO: {devHL.toFixed(2)} W/K</span>
      <span style={{ color: devBetter ? ORANGE : GREEN }}>NZBC: {refHL.toFixed(2)} W/K</span>
      {devBetter && <span style={hintStyle}>NZBC loses {pctMore}% more heat</span>}
    </span>
  );
}

/**
 * Timber fraction badge: lower is better (less thermal bridging).
 * @param {number} devTimber - DEVPRO timber percentage
 * @param {number} refTimber - NZBC reference timber percentage
 */
export function TimberBadge({ devTimber, refTimber }) {
  const devBetter = devTimber < refTimber;
  const pctMore = devTimber > 0 ? Math.round((refTimber / devTimber) * 100) : 0;
  return (
    <span style={badgeStyle}>
      <span style={{ color: devBetter ? GREEN : ORANGE }}>DEVPRO: {devTimber.toFixed(1)}% timber</span>
      <span style={{ color: devBetter ? ORANGE : GREEN }}>NZBC: {refTimber.toFixed(0)}% timber</span>
      {devBetter && <span style={hintStyle}>NZBC has {pctMore}% more thermal bridging</span>}
    </span>
  );
}

/**
 * Insulation fraction badge: higher is better.
 * @param {number} devIns - DEVPRO insulation percentage
 * @param {number} refIns - NZBC reference insulation percentage
 */
export function InsulationBadge({ devIns, refIns }) {
  const devBetter = devIns > refIns;
  const pctLess = refIns > 0 ? Math.round(((devIns - refIns) / refIns) * 100) : 0;
  return (
    <span style={badgeStyle}>
      <span style={{ color: devBetter ? GREEN : ORANGE }}>DEVPRO: {devIns.toFixed(1)}% insulation</span>
      <span style={{ color: devBetter ? ORANGE : GREEN }}>NZBC: {refIns.toFixed(0)}% insulation</span>
      {devBetter && <span style={hintStyle}>NZBC has {pctLess}% less insulation</span>}
    </span>
  );
}

/**
 * Stickframe comparison badge (wall-only): compares DEVPRO timber % to stickframe timber %.
 * @param {number} devTimber - DEVPRO timber percentage
 * @param {number} stickTimber - Stickframe timber percentage
 */
export function StickframeBadge({ devTimber, stickTimber }) {
  return (
    <span style={badgeStyle}>
      <span style={{ color: GREEN }}>DEVPRO: {devTimber.toFixed(1)}% timber</span>
      <span style={{ color: ORANGE }}>Stickframe: {stickTimber.toFixed(1)}% timber</span>
    </span>
  );
}
