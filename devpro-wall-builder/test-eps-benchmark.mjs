/**
 * EPS Block Optimizer — Benchmark
 *
 * Tests the current bin packing algorithm against realistic house scenarios
 * and reports waste / utilization metrics for each EPS category.
 *
 * Run: node test-eps-benchmark.mjs
 */

import { extractEpsPieces, EPS_BLOCK, PANEL_SLABS_PER_BLOCK, SPLINE_SLABS_PER_BLOCK } from './src/utils/epsOptimizer.js';
import { shelfPack } from './src/utils/binPacking.js';
import { calculateWallLayout } from './src/utils/calculator.js';
import { WALL_PROFILES } from './src/utils/constants.js';

const SLAB_W = EPS_BLOCK.length;   // 4900
const SLAB_H = EPS_BLOCK.width;    // 1220
const SLAB_AREA = SLAB_W * SLAB_H; // 5,978,000 mm²

// ─────────────────────────────────────────────────────────────
// Test scenarios — representative NZ residential walls
// ─────────────────────────────────────────────────────────────

const scenarios = {
  'Simple house (4 walls, no openings)': [
    { name: 'N', length_mm: 10000, height_mm: 2700, profile: WALL_PROFILES.STANDARD, openings: [] },
    { name: 'S', length_mm: 10000, height_mm: 2700, profile: WALL_PROFILES.STANDARD, openings: [] },
    { name: 'E', length_mm: 6000, height_mm: 2700, profile: WALL_PROFILES.STANDARD, openings: [] },
    { name: 'W', length_mm: 6000, height_mm: 2700, profile: WALL_PROFILES.STANDARD, openings: [] },
  ],

  'Typical house (windows + doors)': [
    {
      name: 'N', length_mm: 12000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'W01', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 1500 },
        { ref: 'W02', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5500 },
        { ref: 'W03', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 9500 },
      ],
    },
    {
      name: 'S', length_mm: 12000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'D01', type: 'door', width_mm: 1200, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2000 },
        { ref: 'W04', type: 'window', width_mm: 2400, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5000 },
        { ref: 'D02', type: 'door', width_mm: 1800, height_mm: 2100, sill_mm: 0, position_from_left_mm: 9000 },
      ],
    },
    {
      name: 'E', length_mm: 8000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'W05', type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1500, position_from_left_mm: 3500 },
      ],
    },
    {
      name: 'W', length_mm: 8000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'D03', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 3500 },
      ],
    },
  ],

  'Large house (many openings)': [
    {
      name: 'N', length_mm: 16000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'W01', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 1500 },
        { ref: 'W02', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 5500 },
        { ref: 'W03', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 10000 },
        { ref: 'D01', type: 'door', width_mm: 1200, height_mm: 2100, sill_mm: 0, position_from_left_mm: 13500 },
      ],
    },
    {
      name: 'S', length_mm: 16000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'D02', type: 'door', width_mm: 3600, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2000 },
        { ref: 'W04', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 7500 },
        { ref: 'W05', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 10500 },
        { ref: 'D03', type: 'door', width_mm: 1800, height_mm: 2100, sill_mm: 0, position_from_left_mm: 13500 },
      ],
    },
    {
      name: 'E', length_mm: 10000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'W06', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 2000 },
        { ref: 'W07', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 6000 },
      ],
    },
    {
      name: 'W', length_mm: 10000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'D04', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 1500 },
        { ref: 'W08', type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1500, position_from_left_mm: 5000 },
        { ref: 'W09', type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1500, position_from_left_mm: 7500 },
      ],
    },
  ],

  'Gable end walls': [
    {
      name: 'N-Gable', length_mm: 8000, height_mm: 2700, profile: WALL_PROFILES.GABLE,
      peak_height_mm: 4500, peak_position_mm: 4000,
      openings: [
        { ref: 'W01', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 3400 },
      ],
    },
    {
      name: 'S-Gable', length_mm: 8000, height_mm: 2700, profile: WALL_PROFILES.GABLE,
      peak_height_mm: 4500, peak_position_mm: 4000,
      openings: [],
    },
    { name: 'E', length_mm: 12000, height_mm: 2700, profile: WALL_PROFILES.STANDARD, openings: [] },
    { name: 'W', length_mm: 12000, height_mm: 2700, profile: WALL_PROFILES.STANDARD, openings: [] },
  ],

  'Raked wall scenario': [
    {
      name: 'N-Raked', length_mm: 10000, height_mm: 2400, height_right_mm: 3200,
      profile: WALL_PROFILES.RAKED,
      openings: [
        { ref: 'W01', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 2000 },
        { ref: 'W02', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 6500 },
      ],
    },
    {
      name: 'S-Raked', length_mm: 10000, height_mm: 3200, height_right_mm: 2400,
      profile: WALL_PROFILES.RAKED,
      openings: [
        { ref: 'D01', type: 'door', width_mm: 1800, height_mm: 2100, sill_mm: 0, position_from_left_mm: 4000 },
      ],
    },
    { name: 'E', length_mm: 6000, height_mm: 2400, profile: WALL_PROFILES.STANDARD, openings: [] },
    { name: 'W', length_mm: 6000, height_mm: 3200, profile: WALL_PROFILES.STANDARD, openings: [] },
  ],

  'Small granny flat': [
    {
      name: 'N', length_mm: 6000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'W01', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 2400 },
      ],
    },
    {
      name: 'S', length_mm: 6000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'D01', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2550 },
      ],
    },
    { name: 'E', length_mm: 4800, height_mm: 2700, profile: WALL_PROFILES.STANDARD, openings: [] },
    { name: 'W', length_mm: 4800, height_mm: 2700, profile: WALL_PROFILES.STANDARD, openings: [] },
  ],

  'Mixed profiles house': [
    {
      name: 'N', length_mm: 14000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'W01', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 2000 },
        { ref: 'D01', type: 'door', width_mm: 1200, height_mm: 2100, sill_mm: 0, position_from_left_mm: 6500 },
        { ref: 'W02', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 10000 },
      ],
    },
    {
      name: 'S', length_mm: 14000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'D02', type: 'door', width_mm: 2400, height_mm: 2100, sill_mm: 0, position_from_left_mm: 1500 },
        { ref: 'W03', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5500 },
        { ref: 'W04', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 9500 },
      ],
    },
    {
      name: 'E-Gable', length_mm: 8000, height_mm: 2700, profile: WALL_PROFILES.GABLE,
      peak_height_mm: 4200, peak_position_mm: 4000,
      openings: [],
    },
    {
      name: 'W-Gable', length_mm: 8000, height_mm: 2700, profile: WALL_PROFILES.GABLE,
      peak_height_mm: 4200, peak_position_mm: 4000,
      openings: [
        { ref: 'W05', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 3400 },
      ],
    },
    {
      name: 'Interior-1', length_mm: 6000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'D03', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2000 },
      ],
    },
    {
      name: 'Interior-2', length_mm: 4000, height_mm: 2700, profile: WALL_PROFILES.STANDARD,
      openings: [
        { ref: 'D04', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 1500 },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// Run benchmark
// ─────────────────────────────────────────────────────────────

function analyzeSlabWaste(slabs, slabW, slabH) {
  const slabArea = slabW * slabH;
  let totalUsed = 0;
  let totalWaste = 0;
  const perSlab = [];

  for (const slab of slabs) {
    let slabUsed = 0;
    for (const shelf of slab.shelves) {
      for (const piece of shelf.pieces) {
        slabUsed += piece.placedW * piece.placedH;
      }
    }
    const slabWaste = slabArea - slabUsed;
    totalUsed += slabUsed;
    totalWaste += slabWaste;
    perSlab.push({
      used: slabUsed,
      waste: slabWaste,
      utilization: slabUsed / slabArea,
    });
  }

  return {
    slabCount: slabs.length,
    totalUsed,
    totalWaste,
    utilization: slabs.length > 0 ? totalUsed / (slabs.length * slabArea) : 0,
    perSlab,
  };
}

function formatArea(mm2) {
  return (mm2 / 1e6).toFixed(2) + ' m²';
}

function formatPct(ratio) {
  return (ratio * 100).toFixed(1) + '%';
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           EPS Block Optimizer — Benchmark Report           ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  Slab size: ${SLAB_W} × ${SLAB_H} mm (${formatArea(SLAB_AREA)})              ║`);
console.log(`║  Panel slabs/block: ${PANEL_SLABS_PER_BLOCK}    Spline slabs/block: ${SPLINE_SLABS_PER_BLOCK}        ║`);
console.log('╚══════════════════════════════════════════════════════════════╝');

const allResults = [];

for (const [scenarioName, walls] of Object.entries(scenarios)) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${scenarioName}`);
  console.log(`${'═'.repeat(60)}`);

  const allPanelPieces = [];
  const allSplinePieces = [];

  for (const wall of walls) {
    const layout = calculateWallLayout(wall);
    const pieces = extractEpsPieces(layout, wall.name);
    const panelP = pieces.filter(p => p.depth === 142);
    const splineP = pieces.filter(p => p.depth === 120);
    allPanelPieces.push(...panelP);
    allSplinePieces.push(...splineP);

    console.log(`  ${wall.name}: ${panelP.length} panel pieces, ${splineP.length} spline pieces`);
  }

  // Pack panel EPS
  const panelSlabs = shelfPack(allPanelPieces, SLAB_W, SLAB_H);
  const panelAnalysis = analyzeSlabWaste(panelSlabs, SLAB_W, SLAB_H);

  // Pack spline EPS
  const splineSlabs = shelfPack(allSplinePieces, SLAB_W, SLAB_H);
  const splineAnalysis = analyzeSlabWaste(splineSlabs, SLAB_W, SLAB_H);

  const panelBlocks = Math.ceil(panelAnalysis.slabCount / PANEL_SLABS_PER_BLOCK);
  const splineBlocks = Math.ceil(splineAnalysis.slabCount / SPLINE_SLABS_PER_BLOCK);

  console.log(`\n  ┌─ Panel EPS (142mm) ──────────────────────────────┐`);
  console.log(`  │  Pieces: ${allPanelPieces.length.toString().padStart(4)}                                      │`);
  console.log(`  │  Slabs:  ${panelAnalysis.slabCount.toString().padStart(4)}  →  Blocks: ${panelBlocks.toString().padStart(3)}                     │`);
  console.log(`  │  Used:   ${formatArea(panelAnalysis.totalUsed).padStart(10)}                            │`);
  console.log(`  │  Waste:  ${formatArea(panelAnalysis.totalWaste).padStart(10)}                            │`);
  console.log(`  │  Utilization: ${formatPct(panelAnalysis.utilization).padStart(6)}                           │`);
  console.log(`  └──────────────────────────────────────────────────┘`);

  console.log(`  ┌─ Spline EPS (120mm) ─────────────────────────────┐`);
  console.log(`  │  Pieces: ${allSplinePieces.length.toString().padStart(4)}                                      │`);
  console.log(`  │  Slabs:  ${splineAnalysis.slabCount.toString().padStart(4)}  →  Blocks: ${splineBlocks.toString().padStart(3)}                     │`);
  console.log(`  │  Used:   ${formatArea(splineAnalysis.totalUsed).padStart(10)}                            │`);
  console.log(`  │  Waste:  ${formatArea(splineAnalysis.totalWaste).padStart(10)}                            │`);
  console.log(`  │  Utilization: ${formatPct(splineAnalysis.utilization).padStart(6)}                           │`);
  console.log(`  └──────────────────────────────────────────────────┘`);

  // Per-slab breakdown for panel EPS
  if (panelAnalysis.perSlab.length > 0) {
    console.log(`\n  Panel slab utilization breakdown:`);
    panelAnalysis.perSlab.forEach((s, i) => {
      const bar = '█'.repeat(Math.round(s.utilization * 40));
      const empty = '░'.repeat(40 - Math.round(s.utilization * 40));
      console.log(`    Slab ${(i + 1).toString().padStart(2)}: ${bar}${empty} ${formatPct(s.utilization).padStart(6)}  waste: ${formatArea(s.waste)}`);
    });
  }

  // Per-slab breakdown for spline EPS
  if (splineAnalysis.perSlab.length > 0) {
    console.log(`\n  Spline slab utilization breakdown:`);
    splineAnalysis.perSlab.forEach((s, i) => {
      const bar = '█'.repeat(Math.round(s.utilization * 40));
      const empty = '░'.repeat(40 - Math.round(s.utilization * 40));
      console.log(`    Slab ${(i + 1).toString().padStart(2)}: ${bar}${empty} ${formatPct(s.utilization).padStart(6)}  waste: ${formatArea(s.waste)}`);
    });
  }

  // Piece size distribution for panel EPS
  if (allPanelPieces.length > 0) {
    const widths = allPanelPieces.map(p => p.width).sort((a, b) => a - b);
    const heights = allPanelPieces.map(p => p.height).sort((a, b) => a - b);
    const areas = allPanelPieces.map(p => p.width * p.height).sort((a, b) => a - b);
    console.log(`\n  Panel piece dimensions:`);
    console.log(`    Width:  min=${widths[0]}  max=${widths[widths.length - 1]}  median=${widths[Math.floor(widths.length / 2)]}`);
    console.log(`    Height: min=${heights[0]}  max=${heights[heights.length - 1]}  median=${heights[Math.floor(heights.length / 2)]}`);
    console.log(`    Area:   min=${formatArea(areas[0])}  max=${formatArea(areas[areas.length - 1])}  median=${formatArea(areas[Math.floor(areas.length / 2)])}`);
  }

  allResults.push({
    scenario: scenarioName,
    panelPieces: allPanelPieces.length,
    splinePieces: allSplinePieces.length,
    panelSlabs: panelAnalysis.slabCount,
    splineSlabs: splineAnalysis.slabCount,
    panelBlocks,
    splineBlocks,
    totalBlocks: panelBlocks + splineBlocks,
    panelUtilization: panelAnalysis.utilization,
    splineUtilization: splineAnalysis.utilization,
    panelWaste: panelAnalysis.totalWaste,
    splineWaste: splineAnalysis.totalWaste,
  });
}

// ─────────────────────────────────────────────────────────────
// Summary table
// ─────────────────────────────────────────────────────────────

console.log(`\n\n${'═'.repeat(70)}`);
console.log('  SUMMARY TABLE');
console.log(`${'═'.repeat(70)}`);
console.log('  Scenario                        │ PnlBlk │ SplBlk │ Total │ PnlUtil │ SplUtil');
console.log('  ────────────────────────────────┼────────┼────────┼───────┼─────────┼────────');

let totalPanelWaste = 0;
let totalSplineWaste = 0;
let totalBlocksAll = 0;

for (const r of allResults) {
  const name = r.scenario.padEnd(32).substring(0, 32);
  console.log(`  ${name} │ ${r.panelBlocks.toString().padStart(6)} │ ${r.splineBlocks.toString().padStart(6)} │ ${r.totalBlocks.toString().padStart(5)} │ ${formatPct(r.panelUtilization).padStart(7)} │ ${formatPct(r.splineUtilization).padStart(7)}`);
  totalPanelWaste += r.panelWaste;
  totalSplineWaste += r.splineWaste;
  totalBlocksAll += r.totalBlocks;
}

console.log('  ────────────────────────────────┼────────┼────────┼───────┼─────────┼────────');
console.log(`  Total panel waste across all scenarios: ${formatArea(totalPanelWaste)}`);
console.log(`  Total spline waste across all scenarios: ${formatArea(totalSplineWaste)}`);
console.log(`  Total blocks across all scenarios: ${totalBlocksAll}`);

console.log(`\n  Key insight: Compare panel vs spline utilization.`);
console.log(`  Lower utilization = more room for algorithm improvement.\n`);
