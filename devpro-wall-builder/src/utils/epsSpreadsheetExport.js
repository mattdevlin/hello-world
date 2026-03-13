/**
 * EPS Spreadsheet Export — generates CSV files for EPS cut pieces.
 */

import { calculateWallLayout } from './calculator.js';
import { extractEpsPieces } from './epsOptimizer.js';

function escapeCsv(value) {
  let str = String(value);
  // Prevent CSV injection: prefix formula-triggering characters with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvContent(rows, headers) {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return lines.join('\n');
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

function piecesToRows(pieces, includeWallName = false) {
  return pieces.map(p => {
    const row = [];
    if (includeWallName) row.push(p.wallName);
    row.push(
      p.label,
      p.width,
      p.height,
      p.depth,
      ((p.width * p.height) / 1e6).toFixed(4),
    );
    return row;
  });
}

/**
 * Export EPS cuts for a single wall as CSV (from wall object).
 */
export function exportWallEpsCsv(wall, projectName) {
  const layout = calculateWallLayout(wall);
  exportWallEpsCsvFromLayout(layout, wall.name, projectName);
}

/**
 * Export EPS cuts for a single wall as CSV (from pre-computed layout).
 */
export function exportWallEpsCsvFromLayout(layout, wallName, projectName) {
  const pieces = extractEpsPieces(layout, wallName);

  if (pieces.length === 0) return;

  const headers = ['Label', 'Width (mm)', 'Height (mm)', 'Depth (mm)', 'Area (m²)'];
  const rows = piecesToRows(pieces, false);
  const csv = buildCsvContent(rows, headers);
  const prefix = projectName ? `${projectName} - ` : '';
  downloadCsv(csv, `${prefix}${wallName} - EPS Cuts ${formatTimestamp()}.csv`);
}

/**
 * Export EPS cuts for all walls as a single CSV.
 */
export function exportAllWallsEpsCsv(walls, projectName) {
  if (!walls || walls.length === 0) return;

  const allPieces = [];
  for (const wall of walls) {
    const layout = calculateWallLayout(wall);
    const pieces = extractEpsPieces(layout, wall.name);
    allPieces.push(...pieces);
  }

  if (allPieces.length === 0) return;

  const headers = ['Wall', 'Label', 'Width (mm)', 'Height (mm)', 'Depth (mm)', 'Area (m²)'];
  const rows = piecesToRows(allPieces, true);
  const csv = buildCsvContent(rows, headers);
  const prefix = projectName ? `${projectName} - ` : '';
  downloadCsv(csv, `${prefix}All Walls - EPS Cuts ${formatTimestamp()}.csv`);
}
