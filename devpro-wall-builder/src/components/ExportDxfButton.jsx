import { useCallback } from 'react';
import { exportEpsElevationDxf } from '../utils/epsElevationDxf.js';
import { exportFramingElevationDxf } from '../utils/framingElevationDxf.js';
import { exportEpsPlanDxf } from '../utils/epsPlanDxf.js';
import { exportExternalElevationDxf } from '../utils/externalElevationDxf.js';
import { exportPanelPlansDxf } from '../utils/panelPlansDxf.js';

const EXPORTERS = {
  'external-elevation': exportExternalElevationDxf,
  'eps-elevation': exportEpsElevationDxf,
  'framing': exportFramingElevationDxf,
  'eps-plans': exportEpsPlanDxf,
  'panel-plans': exportPanelPlansDxf,
};

const LABELS = {
  'external-elevation': 'Elevation',
  'eps-elevation': 'EPS Elevation',
  'framing': 'Framing',
  'eps-plans': 'EPS Cuts',
  'panel-plans': 'Panel Plans',
};

export default function ExportDxfButton({ layout, wallName, projectName, planType }) {
  const handleExport = useCallback(() => {
    const exporter = EXPORTERS[planType];
    if (exporter && layout) exporter(layout, wallName, projectName);
  }, [layout, wallName, projectName, planType]);

  if (!layout) return null;

  return (
    <button onClick={handleExport} style={styles.btn} className="no-print">
      DXF — {LABELS[planType] || planType}
    </button>
  );
}

const styles = {
  btn: {
    padding: '6px 16px',
    background: '#6B8E23',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
    marginLeft: 6,
  },
};
