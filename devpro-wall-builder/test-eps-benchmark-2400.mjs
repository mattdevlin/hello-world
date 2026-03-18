/**
 * EPS Benchmark — 2400mm vs 2700mm wall height comparison
 *
 * Run: node test-eps-benchmark-2400.mjs
 */

import { extractEpsPieces, EPS_BLOCK, PANEL_SLABS_PER_BLOCK, SPLINE_SLABS_PER_BLOCK } from './src/utils/epsOptimizer.js';
import { shelfPack } from './src/utils/binPacking.js';
import { calculateWallLayout } from './src/utils/calculator.js';
import { WALL_PROFILES } from './src/utils/constants.js';

const SLAB_W = EPS_BLOCK.length;
const SLAB_H = EPS_BLOCK.width;
const SLAB_AREA = SLAB_W * SLAB_H;

function formatPct(r) { return (r * 100).toFixed(1) + '%'; }
function formatArea(mm2) { return (mm2 / 1e6).toFixed(2) + ' m²'; }

// Same scenarios at both 2400mm and 2700mm
function makeScenarios(h) {
  return {
    'Simple house (no openings)': [
      { name: 'N', length_mm: 10000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
      { name: 'S', length_mm: 10000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
      { name: 'E', length_mm: 6000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
      { name: 'W', length_mm: 6000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
    ],
    'Typical house (windows+doors)': [
      {
        name: 'N', length_mm: 12000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'W01', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 1500 },
          { ref: 'W02', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5500 },
          { ref: 'W03', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 9500 },
        ],
      },
      {
        name: 'S', length_mm: 12000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'D01', type: 'door', width_mm: 1200, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2000 },
          { ref: 'W04', type: 'window', width_mm: 2400, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5000 },
          { ref: 'D02', type: 'door', width_mm: 1800, height_mm: 2100, sill_mm: 0, position_from_left_mm: 9000 },
        ],
      },
      {
        name: 'E', length_mm: 8000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'W05', type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1500, position_from_left_mm: 3500 },
        ],
      },
      {
        name: 'W', length_mm: 8000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'D03', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 3500 },
        ],
      },
    ],
    'Large house (many openings)': [
      {
        name: 'N', length_mm: 16000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'W01', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 1500 },
          { ref: 'W02', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 5500 },
          { ref: 'W03', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 10000 },
          { ref: 'D01', type: 'door', width_mm: 1200, height_mm: 2100, sill_mm: 0, position_from_left_mm: 13500 },
        ],
      },
      {
        name: 'S', length_mm: 16000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'D02', type: 'door', width_mm: 3600, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2000 },
          { ref: 'W04', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 7500 },
          { ref: 'W05', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 10500 },
          { ref: 'D03', type: 'door', width_mm: 1800, height_mm: 2100, sill_mm: 0, position_from_left_mm: 13500 },
        ],
      },
      {
        name: 'E', length_mm: 10000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'W06', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 2000 },
          { ref: 'W07', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 6000 },
        ],
      },
      {
        name: 'W', length_mm: 10000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'D04', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 1500 },
          { ref: 'W08', type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1500, position_from_left_mm: 5000 },
          { ref: 'W09', type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1500, position_from_left_mm: 7500 },
        ],
      },
    ],
    'Small granny flat': [
      {
        name: 'N', length_mm: 6000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'W01', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 2400 },
        ],
      },
      {
        name: 'S', length_mm: 6000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'D01', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2550 },
        ],
      },
      { name: 'E', length_mm: 4800, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
      { name: 'W', length_mm: 4800, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
    ],
    'Mixed profiles house': [
      {
        name: 'N', length_mm: 14000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'W01', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 2000 },
          { ref: 'D01', type: 'door', width_mm: 1200, height_mm: 2100, sill_mm: 0, position_from_left_mm: 6500 },
          { ref: 'W02', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 10000 },
        ],
      },
      {
        name: 'S', length_mm: 14000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'D02', type: 'door', width_mm: 2400, height_mm: 2100, sill_mm: 0, position_from_left_mm: 1500 },
          { ref: 'W03', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5500 },
          { ref: 'W04', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 9500 },
        ],
      },
      {
        name: 'E-Gable', length_mm: 8000, height_mm: h, profile: WALL_PROFILES.GABLE,
        peak_height_mm: h + 1500, peak_position_mm: 4000,
        openings: [],
      },
      {
        name: 'W-Gable', length_mm: 8000, height_mm: h, profile: WALL_PROFILES.GABLE,
        peak_height_mm: h + 1500, peak_position_mm: 4000,
        openings: [
          { ref: 'W05', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 3400 },
        ],
      },
      {
        name: 'Interior-1', length_mm: 6000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'D03', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2000 },
        ],
      },
      {
        name: 'Interior-2', length_mm: 4000, height_mm: h, profile: WALL_PROFILES.STANDARD,
        openings: [
          { ref: 'D04', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 1500 },
        ],
      },
    ],
  };
}

function runScenarios(scenarios) {
  const results = [];
  for (const [name, walls] of Object.entries(scenarios)) {
    const allPanel = [];
    const allSpline = [];
    for (const wall of walls) {
      const layout = calculateWallLayout(wall);
      const pieces = extractEpsPieces(layout, wall.name);
      allPanel.push(...pieces.filter(p => p.depth === 142));
      allSpline.push(...pieces.filter(p => p.depth === 120));
    }
    const panelSlabs = shelfPack(allPanel, SLAB_W, SLAB_H);
    const splineSlabs = shelfPack(allSpline, SLAB_W, SLAB_H);

    const panelUsed = allPanel.reduce((s, p) => s + p.width * p.height, 0);
    const splineUsed = allSpline.reduce((s, p) => s + p.width * p.height, 0);
    const panelTotal = panelSlabs.length * SLAB_AREA;
    const splineTotal = splineSlabs.length * SLAB_AREA;

    // Show piece dimensions for first scenario
    const heights = allPanel.map(p => p.height).sort((a, b) => a - b);
    const widths = allPanel.map(p => p.width).sort((a, b) => a - b);

    results.push({
      name,
      panelPieces: allPanel.length,
      splinePieces: allSpline.length,
      panelSlabs: panelSlabs.length,
      splineSlabs: splineSlabs.length,
      panelBlocks: Math.ceil(panelSlabs.length / PANEL_SLABS_PER_BLOCK),
      splineBlocks: Math.ceil(splineSlabs.length / SPLINE_SLABS_PER_BLOCK),
      panelUtil: panelTotal > 0 ? panelUsed / panelTotal : 0,
      splineUtil: splineTotal > 0 ? splineUsed / splineTotal : 0,
      panelWaste: panelTotal - panelUsed,
      splineWaste: splineTotal - splineUsed,
      pieceH: heights.length > 0 ? `${heights[0]}-${heights[heights.length - 1]}` : '-',
      pieceW: widths.length > 0 ? `${widths[0]}-${widths[widths.length - 1]}` : '-',
    });
  }
  return results;
}

// Run both heights
const results2700 = runScenarios(makeScenarios(2700));
const results2400 = runScenarios(makeScenarios(2400));

// Print comparison
console.log('╔═══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║              EPS Benchmark — 2400mm vs 2700mm Wall Height Comparison                ║');
console.log('╠═══════════════════════════════════════════════════════════════════════════════════════╣');
console.log(`║  Slab: ${SLAB_W} × ${SLAB_H} mm    Panel slabs/block: ${PANEL_SLABS_PER_BLOCK}    Spline slabs/block: ${SPLINE_SLABS_PER_BLOCK}               ║`);
console.log('╚═══════════════════════════════════════════════════════════════════════════════════════╝');

console.log('\n  2700mm walls — EPS piece height: 2700 - 45 - 90 - 20 = 2545mm');
console.log('  2400mm walls — EPS piece height: 2400 - 45 - 90 - 20 = 2245mm');
console.log(`  Slab length: ${SLAB_W}mm → 2 × 2245 = 4490 fits! 2 × 2545 = 5090 does NOT fit.`);

console.log('\n  ┌──────────────────────────┬──────────────────────────────┬──────────────────────────────┐');
console.log('  │                          │      2700mm walls            │      2400mm walls            │');
console.log('  │ Scenario                 │ Slabs Blocks PnlUtil Waste  │ Slabs Blocks PnlUtil Waste   │');
console.log('  ├──────────────────────────┼──────────────────────────────┼──────────────────────────────┤');

let totalBlocks2700 = 0, totalBlocks2400 = 0;
let totalWaste2700 = 0, totalWaste2400 = 0;

for (let i = 0; i < results2700.length; i++) {
  const a = results2700[i];
  const b = results2400[i];
  const name = a.name.padEnd(24).substring(0, 24);
  totalBlocks2700 += a.panelBlocks + a.splineBlocks;
  totalBlocks2400 += b.panelBlocks + b.splineBlocks;
  totalWaste2700 += a.panelWaste;
  totalWaste2400 += b.panelWaste;

  const col2700 = `${a.panelSlabs.toString().padStart(5)} ${a.panelBlocks.toString().padStart(6)} ${formatPct(a.panelUtil).padStart(7)} ${formatArea(a.panelWaste).padStart(8)}`;
  const col2400 = `${b.panelSlabs.toString().padStart(5)} ${b.panelBlocks.toString().padStart(6)} ${formatPct(b.panelUtil).padStart(7)} ${formatArea(b.panelWaste).padStart(8)}`;
  console.log(`  │ ${name} │ ${col2700} │ ${col2400}  │`);
}

console.log('  ├──────────────────────────┼──────────────────────────────┼──────────────────────────────┤');
console.log(`  │ TOTAL                    │ Blocks: ${totalBlocks2700.toString().padStart(3)}  Waste: ${formatArea(totalWaste2700).padStart(8)} │ Blocks: ${totalBlocks2400.toString().padStart(3)}  Waste: ${formatArea(totalWaste2400).padStart(8)}  │`);
console.log('  └──────────────────────────┴──────────────────────────────┴──────────────────────────────┘');

const blockSaved = totalBlocks2700 - totalBlocks2400;
const wasteSaved = totalWaste2700 - totalWaste2400;
console.log(`\n  Savings with 2400mm: ${blockSaved} fewer blocks, ${formatArea(wasteSaved)} less panel waste`);
console.log(`  Block reduction: ${((blockSaved / totalBlocks2700) * 100).toFixed(1)}%`);
console.log(`  Waste reduction: ${((wasteSaved / totalWaste2700) * 100).toFixed(1)}%`);

// Show piece height info
console.log('\n  Panel piece height ranges:');
for (let i = 0; i < results2700.length; i++) {
  console.log(`    ${results2700[i].name.padEnd(24)} 2700mm wall: h=${results2700[i].pieceH}   2400mm wall: h=${results2400[i].pieceH}`);
}
