/**
 * Timber CSV Export — generates CSV for timber breakdown from FramingElevation.
 */

function escapeCsv(value) {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export timber breakdown as CSV.
 * @param {object} timberRatio — the timberRatio object from calculateTimberPercentage
 * @param {string} wallName
 * @param {string} projectName
 */
export function exportTimberCsv(timberRatio, wallName, projectName) {
  if (!timberRatio) return;

  const components = [
    ['Bottom Plate', timberRatio.breakdown.bottomPlate],
    ['Top Plates (×2)', timberRatio.breakdown.topPlates],
    ['End Plates', timberRatio.breakdown.endPlates],
    ['Sill Plates', timberRatio.breakdown.sillPlates],
    ['Jamb Plates', timberRatio.breakdown.jambPlates],
    ['Lintels', timberRatio.breakdown.lintels],
  ].filter(([, v]) => v > 0);

  const lines = [];
  // Header
  lines.push(['Component', 'Face Area (mm²)', 'Face Area (m²)'].map(escapeCsv).join(','));

  // Component rows
  for (const [label, areaMm2] of components) {
    lines.push([escapeCsv(label), areaMm2, (areaMm2 / 1e6).toFixed(3)].join(','));
  }

  // Blank separator
  lines.push(',,');

  // Summary rows
  lines.push([escapeCsv('Total Timber'), timberRatio.timberFaceArea, (timberRatio.timberFaceArea / 1e6).toFixed(3)].join(','));
  lines.push([escapeCsv('Net Wall Area'), timberRatio.effectiveWallArea, (timberRatio.effectiveWallArea / 1e6).toFixed(3)].join(','));
  lines.push([escapeCsv('Timber Fraction'), '', `${timberRatio.timberPercentage.toFixed(1)}%`].join(','));
  lines.push([escapeCsv('Insulation Fraction'), '', `${(100 - timberRatio.timberPercentage).toFixed(1)}%`].join(','));

  const csv = lines.join('\n');
  const prefix = projectName ? `${projectName} - ` : '';
  downloadCsv(csv, `${prefix}${wallName || 'Wall'} - Timber Breakdown ${formatTimestamp()}.csv`);
}
