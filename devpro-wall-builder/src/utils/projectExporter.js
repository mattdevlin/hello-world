/**
 * Project-level export: bundles all DXF files for every wall into a zip.
 *
 * Uses existing build*Dxf() functions to generate Drawing objects,
 * converts them to DXF strings via toDxfString(), and packs into a zip
 * using jszip.
 */
import JSZip from 'jszip';
import { calculateWallLayout } from './calculator.js';
import { calculateFloorLayout } from './floorCalculator.js';
import { toDxfString } from './dxfExporter.js';
import { buildExternalElevationDxf } from './externalElevationDxf.js';
import { buildFramingElevationDxf } from './framingElevationDxf.js';
import { buildEpsElevationDxf } from './epsElevationDxf.js';
import { buildEpsPlanDxf } from './epsPlanDxf.js';
import { buildPanelPlansDxf } from './panelPlansDxf.js';
import { buildFloorPlanDxf } from './floorPlanDxf.js';
import { buildFloorFramingDxf } from './floorFramingDxf.js';
import { buildFloorEpsPlanDxf } from './floorEpsPlanDxf.js';
import { buildFloorPanelPlansDxf } from './floorPanelPlansDxf.js';

const DXF_TYPES = [
  { key: 'External Elevation', build: buildExternalElevationDxf },
  { key: 'Framing Elevation',  build: buildFramingElevationDxf },
  { key: 'EPS Elevation',      build: buildEpsElevationDxf },
  { key: 'EPS Cut Plans',      build: buildEpsPlanDxf },
  { key: 'Panel Plans',        build: buildPanelPlansDxf },
];

const FLOOR_DXF_TYPES = [
  { key: 'Floor Plan',          build: buildFloorPlanDxf },
  { key: 'Floor Framing',       build: buildFloorFramingDxf },
  { key: 'Floor EPS Plan',      build: buildFloorEpsPlanDxf },
  { key: 'Floor Panel Plans',   build: buildFloorPanelPlansDxf },
];

/**
 * Sanitize a string for use in filenames (remove characters illegal on Windows).
 */
function sanitize(name) {
  return (name || 'Untitled').replace(/[<>:"/\\|?*]/g, '_');
}

/**
 * Export all DXF files for every wall in a project as a zip.
 *
 * @param {string} projectName - Display name for the project
 * @param {Array} walls - Array of wall objects from storage
 * @param {function} onProgress - Optional callback(current, total) for UI updates
 * @returns {Promise<void>}
 */
export async function exportProjectZip(projectName, walls, onProgress, floors = []) {
  const zip = new JSZip();
  const safeProjName = sanitize(projectName);
  const total = walls.length * DXF_TYPES.length + floors.length * FLOOR_DXF_TYPES.length;
  let current = 0;

  for (const wall of walls) {
    const layout = calculateWallLayout(wall);
    const safeWallName = sanitize(wall.name);
    const wallFolder = zip.folder(safeWallName);

    for (const { key, build } of DXF_TYPES) {
      const drawing = build(layout, wall.name);
      const dxfStr = toDxfString(drawing);
      const filename = `${safeProjName} ${safeWallName} ${key}.dxf`;
      wallFolder.file(filename, dxfStr);

      current++;
      if (onProgress) onProgress(current, total);
    }
  }

  for (const floor of floors) {
    const layout = calculateFloorLayout(floor);
    if (layout.error) continue;
    const safeFloorName = sanitize(floor.name);
    const floorFolder = zip.folder(safeFloorName);

    for (const { key, build } of FLOOR_DXF_TYPES) {
      const drawing = build(layout, floor.name);
      const dxfStr = toDxfString(drawing);
      const filename = `${safeProjName} ${safeFloorName} ${key}.dxf`;
      floorFolder.file(filename, dxfStr);

      current++;
      if (onProgress) onProgress(current, total);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `${safeProjName} DXF Export.zip`;

  // Standard blob download — guarantees .zip extension
  if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
