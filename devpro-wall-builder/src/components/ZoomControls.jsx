const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const DEFAULT_IDX = 2; // 1×

export { ZOOM_STEPS, DEFAULT_IDX };

export default function ZoomControls({ zoomIdx, setZoomIdx, zoom }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={() => setZoomIdx(i => Math.max(0, i - 1))} disabled={zoomIdx === 0}
        aria-label="Zoom out"
        style={styles.btn}>-</button>
      <span style={styles.label}>{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoomIdx(i => Math.min(ZOOM_STEPS.length - 1, i + 1))} disabled={zoomIdx === ZOOM_STEPS.length - 1}
        aria-label="Zoom in"
        style={styles.btn}>+</button>
    </div>
  );
}

const styles = {
  btn: {
    width: 28,
    height: 28,
    border: '1px solid #ccc',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
  },
  label: {
    fontSize: 12,
    minWidth: 40,
    textAlign: 'center',
  },
};
