/**
 * EPS Benchmark — Old vs New algorithm comparison
 * Run: node test-eps-comparison.mjs
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

// Old algorithm (first-fit, single sort)
function oldShelfPack(pieces, slabW, slabH) {
  const sorted = [...pieces].sort((a, b) => {
    const aMax = Math.max(a.width, a.height);
    const bMax = Math.max(b.width, b.height);
    return bMax - aMax;
  });
  const slabs = [];
  for (const piece of sorted) {
    const orients = [{ w: piece.width, h: piece.height }];
    if (piece.width !== piece.height) orients.push({ w: piece.height, h: piece.width });
    orients.sort((a, b) => a.h - b.h);
    let placed = false;
    for (const o of orients) {
      if (o.w > slabW || o.h > slabH) continue;
      for (const slab of slabs) {
        for (const shelf of slab.shelves) {
          if (shelf.remainingW >= o.w && shelf.h >= o.h) {
            shelf.pieces.push({ ...piece, placedW: o.w, placedH: o.h });
            shelf.remainingW -= o.w;
            placed = true;
            break;
          }
        }
        if (placed) break;
        const usedH = slab.shelves.reduce((s, sh) => s + sh.h, 0);
        if (usedH + o.h <= slabH) {
          slab.shelves.push({ h: o.h, remainingW: slabW - o.w, pieces: [{ ...piece, placedW: o.w, placedH: o.h }] });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) {
      const o = orients.find(o => o.w <= slabW && o.h <= slabH) || orients[0];
      slabs.push({ shelves: [{ h: o.h, remainingW: slabW - o.w, pieces: [{ ...piece, placedW: o.w, placedH: o.h }] }] });
    }
  }
  return slabs;
}

function makeScenarios(h) {
  return {
    'Simple (no openings)': [
      { name: 'N', length_mm: 10000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
      { name: 'S', length_mm: 10000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
      { name: 'E', length_mm: 6000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
      { name: 'W', length_mm: 6000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
    ],
    'Typical (win+doors)': [
      { name: 'N', length_mm: 12000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'W01', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 1500 },
        { ref: 'W02', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5500 },
        { ref: 'W03', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 9500 },
      ]},
      { name: 'S', length_mm: 12000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'D01', type: 'door', width_mm: 1200, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2000 },
        { ref: 'W04', type: 'window', width_mm: 2400, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5000 },
        { ref: 'D02', type: 'door', width_mm: 1800, height_mm: 2100, sill_mm: 0, position_from_left_mm: 9000 },
      ]},
      { name: 'E', length_mm: 8000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'W05', type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1500, position_from_left_mm: 3500 },
      ]},
      { name: 'W', length_mm: 8000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'D03', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 3500 },
      ]},
    ],
    'Large (many openings)': [
      { name: 'N', length_mm: 16000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'W01', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 1500 },
        { ref: 'W02', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 5500 },
        { ref: 'W03', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 10000 },
        { ref: 'D01', type: 'door', width_mm: 1200, height_mm: 2100, sill_mm: 0, position_from_left_mm: 13500 },
      ]},
      { name: 'S', length_mm: 16000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'D02', type: 'door', width_mm: 3600, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2000 },
        { ref: 'W04', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 7500 },
        { ref: 'W05', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 10500 },
        { ref: 'D03', type: 'door', width_mm: 1800, height_mm: 2100, sill_mm: 0, position_from_left_mm: 13500 },
      ]},
      { name: 'E', length_mm: 10000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'W06', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 2000 },
        { ref: 'W07', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 6000 },
      ]},
      { name: 'W', length_mm: 10000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'D04', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 1500 },
        { ref: 'W08', type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1500, position_from_left_mm: 5000 },
        { ref: 'W09', type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1500, position_from_left_mm: 7500 },
      ]},
    ],
    'Small granny flat': [
      { name: 'N', length_mm: 6000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'W01', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 2400 },
      ]},
      { name: 'S', length_mm: 6000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'D01', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2550 },
      ]},
      { name: 'E', length_mm: 4800, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
      { name: 'W', length_mm: 4800, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [] },
    ],
    'Mixed profiles': [
      { name: 'N', length_mm: 14000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'W01', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 2000 },
        { ref: 'D01', type: 'door', width_mm: 1200, height_mm: 2100, sill_mm: 0, position_from_left_mm: 6500 },
        { ref: 'W02', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 10000 },
      ]},
      { name: 'S', length_mm: 14000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'D02', type: 'door', width_mm: 2400, height_mm: 2100, sill_mm: 0, position_from_left_mm: 1500 },
        { ref: 'W03', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5500 },
        { ref: 'W04', type: 'window', width_mm: 2400, height_mm: 1500, sill_mm: 800, position_from_left_mm: 9500 },
      ]},
      { name: 'E-Gable', length_mm: 8000, height_mm: h, profile: WALL_PROFILES.GABLE, peak_height_mm: h + 1500, peak_position_mm: 4000, openings: [] },
      { name: 'W-Gable', length_mm: 8000, height_mm: h, profile: WALL_PROFILES.GABLE, peak_height_mm: h + 1500, peak_position_mm: 4000, openings: [
        { ref: 'W05', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 3400 },
      ]},
      { name: 'Int-1', length_mm: 6000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'D03', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2000 },
      ]},
      { name: 'Int-2', length_mm: 4000, height_mm: h, profile: WALL_PROFILES.STANDARD, openings: [
        { ref: 'D04', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 1500 },
      ]},
    ],
  };
}

function getPieces(scenarios) {
  const allPanel = [];
  const allSpline = [];
  for (const walls of Object.values(scenarios)) {
    for (const wall of walls) {
      const layout = calculateWallLayout(wall);
      const pieces = extractEpsPieces(layout, wall.name);
      allPanel.push(...pieces.filter(p => p.depth === 142));
      allSpline.push(...pieces.filter(p => p.depth === 120));
    }
  }
  return { allPanel, allSpline };
}

function analyze(packFn, pieces) {
  const slabs = packFn(pieces, SLAB_W, SLAB_H);
  const used = pieces.reduce((s, p) => s + p.width * p.height, 0);
  const total = slabs.length * SLAB_AREA;
  return {
    slabs: slabs.length,
    blocks: Math.ceil(slabs.length / PANEL_SLABS_PER_BLOCK),
    util: total > 0 ? used / total : 0,
    waste: total - used,
  };
}

for (const h of [2400, 2700]) {
  const scenarios = makeScenarios(h);
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${h}mm WALLS — Old vs New Algorithm`);
  console.log(`${'═'.repeat(70)}`);
  console.log('  Scenario              │   Old Algo          │   New Algo          │ Saved');
  console.log('                        │ Slabs Blk   Util    │ Slabs Blk   Util    │ Slabs');
  console.log('  ──────────────────────┼─────────────────────┼─────────────────────┼──────');

  let totalOldSlabs = 0, totalNewSlabs = 0;
  let totalOldBlocks = 0, totalNewBlocks = 0;

  for (const [name, walls] of Object.entries(scenarios)) {
    const panel = [];
    for (const wall of walls) {
      const layout = calculateWallLayout(wall);
      const pieces = extractEpsPieces(layout, wall.name);
      panel.push(...pieces.filter(p => p.depth === 142));
    }

    const oldR = analyze(oldShelfPack, panel);
    const newR = analyze(shelfPack, panel);
    const saved = oldR.slabs - newR.slabs;

    totalOldSlabs += oldR.slabs;
    totalNewSlabs += newR.slabs;
    totalOldBlocks += oldR.blocks;
    totalNewBlocks += newR.blocks;

    const n = name.padEnd(22).substring(0, 22);
    const savedStr = saved > 0 ? `  -${saved}` : '   0';
    console.log(`  ${n} │ ${oldR.slabs.toString().padStart(5)} ${oldR.blocks.toString().padStart(3)} ${formatPct(oldR.util).padStart(7)} │ ${newR.slabs.toString().padStart(5)} ${newR.blocks.toString().padStart(3)} ${formatPct(newR.util).padStart(7)} │${savedStr}`);
  }

  console.log('  ──────────────────────┼─────────────────────┼─────────────────────┼──────');
  const savedTotal = totalOldSlabs - totalNewSlabs;
  const savedBlocks = totalOldBlocks - totalNewBlocks;
  console.log(`  TOTAL                 │ ${totalOldSlabs.toString().padStart(5)} ${totalOldBlocks.toString().padStart(3)}             │ ${totalNewSlabs.toString().padStart(5)} ${totalNewBlocks.toString().padStart(3)}             │  -${savedTotal}`);
  console.log(`  Block savings: ${savedBlocks} fewer blocks (${(savedBlocks / totalOldBlocks * 100).toFixed(1)}%)`);
}
