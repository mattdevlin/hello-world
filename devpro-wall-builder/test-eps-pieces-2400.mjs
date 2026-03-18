/**
 * Quick diagnostic: what are the actual piece sizes for 2400mm walls?
 * Run: node test-eps-pieces-2400.mjs
 */
import { extractEpsPieces } from './src/utils/epsOptimizer.js';
import { shelfPack } from './src/utils/binPacking.js';
import { calculateWallLayout } from './src/utils/calculator.js';
import { WALL_PROFILES } from './src/utils/constants.js';

const SLAB_W = 4900, SLAB_H = 1220;

const walls = [
  {
    name: 'N', length_mm: 12000, height_mm: 2400, profile: WALL_PROFILES.STANDARD,
    openings: [
      { ref: 'W01', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 1500 },
      { ref: 'W02', type: 'window', width_mm: 1800, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5500 },
      { ref: 'W03', type: 'window', width_mm: 1200, height_mm: 1200, sill_mm: 900, position_from_left_mm: 9500 },
    ],
  },
  {
    name: 'S', length_mm: 12000, height_mm: 2400, profile: WALL_PROFILES.STANDARD,
    openings: [
      { ref: 'D01', type: 'door', width_mm: 1200, height_mm: 2100, sill_mm: 0, position_from_left_mm: 2000 },
      { ref: 'W04', type: 'window', width_mm: 2400, height_mm: 1200, sill_mm: 900, position_from_left_mm: 5000 },
      { ref: 'D02', type: 'door', width_mm: 1800, height_mm: 2100, sill_mm: 0, position_from_left_mm: 9000 },
    ],
  },
  {
    name: 'E', length_mm: 8000, height_mm: 2400, profile: WALL_PROFILES.STANDARD,
    openings: [
      { ref: 'W05', type: 'window', width_mm: 600, height_mm: 600, sill_mm: 1500, position_from_left_mm: 3500 },
    ],
  },
  {
    name: 'W', length_mm: 8000, height_mm: 2400, profile: WALL_PROFILES.STANDARD,
    openings: [
      { ref: 'D03', type: 'door', width_mm: 900, height_mm: 2100, sill_mm: 0, position_from_left_mm: 3500 },
    ],
  },
];

const allPanel = [];
const allSpline = [];

for (const wall of walls) {
  const layout = calculateWallLayout(wall);
  const pieces = extractEpsPieces(layout, wall.name);
  const panel = pieces.filter(p => p.depth === 142);
  const spline = pieces.filter(p => p.depth === 120);
  allPanel.push(...panel);
  allSpline.push(...spline);

  console.log(`\n${wall.name}:`);
  for (const p of panel) {
    console.log(`  Panel: ${p.label.padEnd(12)} ${p.width} × ${p.height}`);
  }
  for (const p of spline) {
    console.log(`  Spline: ${p.label.padEnd(12)} ${p.width} × ${p.height}`);
  }
}

// Show current packing
console.log('\n\n── Current shelf packing ──');
const slabs = shelfPack(allPanel, SLAB_W, SLAB_H);
for (let si = 0; si < slabs.length; si++) {
  const slab = slabs[si];
  let slabUsed = 0;
  console.log(`\n  Slab ${si + 1}:`);
  for (let shi = 0; shi < slab.shelves.length; shi++) {
    const shelf = slab.shelves[shi];
    const pcs = shelf.pieces.map(p => `${p.label}(${p.placedW}×${p.placedH})`).join(' + ');
    const usedW = shelf.pieces.reduce((s, p) => s + p.placedW, 0);
    console.log(`    Shelf ${shi + 1}: h=${shelf.h}, used=${usedW}/${SLAB_W}, remaining=${shelf.remainingW}  │ ${pcs}`);
    for (const p of shelf.pieces) slabUsed += p.placedW * p.placedH;
  }
  const usedH = slab.shelves.reduce((s, sh) => s + sh.h, 0);
  console.log(`    Total height: ${usedH}/${SLAB_H}, utilization: ${(slabUsed / (SLAB_W * SLAB_H) * 100).toFixed(1)}%`);
}
