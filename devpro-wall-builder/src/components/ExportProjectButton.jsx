import { useState, useCallback } from 'react';
import { exportProjectZip } from '../utils/projectExporter.js';

export default function ExportProjectButton({ projectName, walls, floors }) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleExport = useCallback(async () => {
    if (exporting || (!walls?.length && !floors?.length)) return;

    setExporting(true);
    const totalItems = (walls?.length || 0) * 5 + (floors?.length || 0) * 4;
    setProgress({ current: 0, total: totalItems });

    try {
      await exportProjectZip(projectName, walls || [], (current, total) => {
        setProgress({ current, total });
      }, floors || []);
    } catch (err) {
      console.error('Project export failed:', err);
      alert('Export failed. See console for details.');
    } finally {
      setExporting(false);
    }
  }, [exporting, projectName, walls, floors]);

  if (!walls?.length && !floors?.length) return null;

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      aria-busy={exporting}
      style={{
        ...styles.btn,
        ...(exporting ? styles.btnDisabled : {}),
      }}
    >
      {exporting
        ? `Exporting... (${progress.current}/${progress.total})`
        : 'Export All DXFs'}
    </button>
  );
}

const styles = {
  btn: {
    padding: '10px 20px',
    background: '#6B8E23',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'wait',
  },
};
