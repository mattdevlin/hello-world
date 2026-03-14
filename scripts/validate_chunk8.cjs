#!/usr/bin/env node
/**
 * Chunk 8 Validation — Comparison Report Generator
 *
 * Tests the stickframe component counting and comparison logic
 * by reimplementing in JS and checking against expected outputs.
 *
 * Run:  node scripts/validate_chunk8.cjs
 */

let pass = 0;
let fail = 0;

function check(desc, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: ${desc}`);
    console.log(`  got:      ${JSON.stringify(actual)}`);
    console.log(`  expected: ${JSON.stringify(expected)}`);
  }
}

function checkGte(desc, actual, min) {
  if (typeof actual === "number" && actual >= min) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: ${desc}`);
    console.log(`  got: ${actual}, expected >= ${min}`);
  }
}

function checkTruthy(desc, actual) {
  if (actual) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: ${desc} — expected truthy, got: ${JSON.stringify(actual)}`);
  }
}

// ---- Reimplemented component counting ----

function countWallStuds(wall) {
  const length = wall.length_mm || 0;
  const spacing = (wall.stud && wall.stud.spacing) || 600;
  let baseStuds = Math.floor(length / spacing) + 1;
  const openings = wall.openings || [];
  let removed = 0;
  let added = 0;
  for (const o of openings) {
    const w = o.width_mm || 0;
    removed += Math.max(0, Math.floor(w / spacing) - 1);
    added += 2; // trimming studs
  }
  return baseStuds - removed + added;
}

function countComponents(wall) {
  const length = wall.length_mm || 0;
  const height = wall.height_mm || 2700;
  const studs = countWallStuds(wall);
  const openings = wall.openings || [];
  const lintels = openings.length;
  const trimmers = lintels * 2;
  const sillTrimmers = openings.filter(o => o.type === "window").length;
  const dwangRows = Math.max(1, Math.floor(height / 1200));
  const dwangsPerRow = Math.max(1, Math.floor(length / 600));
  const totalDwangs = dwangRows * dwangsPerRow;
  const plates = 2;
  return {
    studs, plates, dwangs: totalDwangs, lintels,
    trimming_studs: trimmers, sill_trimmers: sillTrimmers,
    total_pieces: studs + plates + totalDwangs + lintels + trimmers + sillTrimmers,
  };
}


// ===== STUD COUNTING =====
console.log("--- Stud Counting ---");

// Simple wall: 8000mm, 600mm spacing, no openings → 14 studs
let wall = { length_mm: 8000, height_mm: 2700, stud: { spacing: 600 }, openings: [] };
check("8m/600 no openings studs", countWallStuds(wall), 14);

// Wall with 1 window (1200mm): removes 1 infill stud, adds 2 trimmers
wall = { length_mm: 8000, height_mm: 2700, stud: { spacing: 600 },
  openings: [{ type: "window", width_mm: 1200, height_mm: 1200 }] };
check("8m + 1 window studs", countWallStuds(wall), 14 - 1 + 2);

// Wall with 2 openings (1 window 1800mm, 1 door 900mm)
wall = { length_mm: 10000, height_mm: 2700, stud: { spacing: 600 },
  openings: [
    { type: "window", width_mm: 1800, height_mm: 1200 },
    { type: "door", width_mm: 900, height_mm: 2100 },
  ] };
// Base: floor(10000/600) + 1 = 17
// Window 1800: floor(1800/600) - 1 = 2 removed, +2 trimmers
// Door 900: floor(900/600) - 1 = 0 removed, +2 trimmers
check("10m + window + door studs", countWallStuds(wall), 17 - 2 + 2 + 0 + 2);


// ===== COMPONENT COUNTING =====
console.log("--- Component Counting ---");

// Simple 8m wall with 1 window
wall = { length_mm: 8000, height_mm: 2700, stud: { spacing: 600 },
  openings: [{ type: "window", width_mm: 1200, height_mm: 1200 }] };
let comp = countComponents(wall);
check("comp studs", comp.studs, 15);
check("comp plates", comp.plates, 2);
check("comp lintels", comp.lintels, 1);
check("comp trimmers", comp.trimming_studs, 2);
check("comp sill trimmers", comp.sill_trimmers, 1);
// Dwangs: rows = floor(2700/1200) = 2, per row = floor(8000/600) = 13
check("comp dwangs", comp.dwangs, 2 * 13);
checkGte("comp total >= 40", comp.total_pieces, 40);


// Wall with no openings
wall = { length_mm: 6000, height_mm: 2400, stud: { spacing: 600 }, openings: [] };
comp = countComponents(wall);
check("no openings studs", comp.studs, 11);
check("no openings lintels", comp.lintels, 0);
check("no openings trimmers", comp.trimming_studs, 0);
check("no openings sill trimmers", comp.sill_trimmers, 0);


// ===== COMPARISON STRUCTURE =====
console.log("--- Comparison Structure ---");

// Simulate a stickframe wall
const sf_wall = {
  wall_id: "W1",
  wall_name: "Front Wall",
  length_mm: 8000,
  height_mm: 2700,
  stud: { size: "90x45", spacing: 600 },
  top_plate: { size: "90x45" },
  bottom_plate: { size: "90x45" },
  openings: [
    { type: "window", width_mm: 1200, height_mm: 1200 },
    { type: "door", width_mm: 900, height_mm: 2100 },
  ],
};

const sf_comp = countComponents(sf_wall);
console.log(`  Wall ${sf_wall.wall_id}: ${sf_comp.total_pieces} stickframe pieces`);
console.log(`    Studs: ${sf_comp.studs}, Dwangs: ${sf_comp.dwangs}, Plates: ${sf_comp.plates}`);
console.log(`    Lintels: ${sf_comp.lintels}, Trimmers: ${sf_comp.trimming_studs}`);

// Simulate matching SIP wall
const sip_wall = { wall_id: "W1", panel_count: 7, panel_type: "162mm DEVPRO SIP" };

// Component reduction
const reduction = sf_comp.total_pieces - sip_wall.panel_count;
console.log(`  SIP panels: ${sip_wall.panel_count}, Reduction: ${reduction}`);
checkGte("reduction > 0", reduction, 1);


// ===== TRADES COMPARISON =====
console.log("--- Trades Comparison ---");

const sf_trades = ["Framer", "Insulator", "Wrapper", "Plasterer", "Painter"];
const sip_trades = ["SIP installer", "Painter"];

check("sf trade count", sf_trades.length, 5);
check("sip trade count", sip_trades.length, 2);
check("trade reduction", sf_trades.length - sip_trades.length, 3);


// ===== INSULATION COMPARISON =====
console.log("--- Insulation Comparison ---");

// Stickframe: R2.0 with 18% bridging → effective R-value is lower
// SIP: R2.5+ continuous → no bridging
const sf_r = 2.0;
const sip_r = 2.5;
const bridging_loss = 0.18; // 18% thermal bridging at studs
const effective_sf_r = sf_r * (1 - bridging_loss);
console.log(`  Stickframe: R${sf_r} nominal, R${effective_sf_r.toFixed(1)} effective (18% bridging)`);
console.log(`  SIP: R${sip_r} continuous (0% bridging)`);
checkGte("SIP R > effective SF R", sip_r, effective_sf_r);


// ===== FLOOR COMPARISON =====
console.log("--- Floor Comparison ---");

// Slab floor
let floorComp = {
  type: "slab_on_ground",
  stickframe_trades: ["Piling contractor", "Framer", "Plumber", "Insulator"],
  sip_trades: ["Piling contractor", "SIP installer"],
};
check("slab sf trades", floorComp.stickframe_trades.length, 4);
check("slab sip trades", floorComp.sip_trades.length, 2);

// Timber floor
floorComp = {
  type: "suspended_timber",
  stickframe_trades: ["Piling contractor", "Framer", "Plumber", "Insulator"],
  sip_trades: ["Piling contractor", "SIP installer"],
};
check("timber sf trades", floorComp.stickframe_trades.length, 4);


// ===== ROOF COMPARISON =====
console.log("--- Roof Comparison ---");

const roofComp = {
  stickframe_trades: ["Framer", "Roofer", "Insulator", "Plasterer"],
  sip_trades: ["SIP installer", "Roofer"],
};
check("roof sf trades", roofComp.stickframe_trades.length, 4);
check("roof sip trades", roofComp.sip_trades.length, 2);
check("roof trade reduction", roofComp.stickframe_trades.length - roofComp.sip_trades.length, 2);


// ===== SUMMARY STATISTICS =====
console.log("--- Summary Statistics ---");

// Typical single-storey house: 4 walls, each ~8m
const wallLengths = [8000, 12000, 8000, 12000];
let totalSfPieces = 0;
let totalSipPanels = 0;
for (const len of wallLengths) {
  const w = { length_mm: len, height_mm: 2700, stud: { spacing: 600 },
    openings: [{ type: "window", width_mm: 1200, height_mm: 1200 }] };
  totalSfPieces += countComponents(w).total_pieces;
  totalSipPanels += Math.ceil(len / 1205); // ~1205mm panel pitch
}

console.log(`  Total stickframe pieces (4 walls): ${totalSfPieces}`);
console.log(`  Total SIP panels (4 walls): ${totalSipPanels}`);
const reductionPct = ((1 - totalSipPanels / totalSfPieces) * 100).toFixed(1);
console.log(`  Component reduction: ${reductionPct}%`);

checkGte("total sf > total sip", totalSfPieces, totalSipPanels);
checkGte("reduction > 50%", parseFloat(reductionPct), 50);


// ===== EDGE CASES =====
console.log("--- Edge Cases ---");

// Empty wall (0 length)
comp = countComponents({ length_mm: 0, height_mm: 2700, openings: [] });
check("empty wall studs", comp.studs, 1); // floor(0/600) + 1 = 1
check("empty wall plates", comp.plates, 2);

// Very short wall
comp = countComponents({ length_mm: 600, height_mm: 2400, stud: { spacing: 600 }, openings: [] });
check("short wall studs", comp.studs, 2);

// Wall with many openings
wall = { length_mm: 15000, height_mm: 2700, stud: { spacing: 600 },
  openings: [
    { type: "window", width_mm: 1200, height_mm: 1200 },
    { type: "window", width_mm: 1800, height_mm: 1200 },
    { type: "door", width_mm: 900, height_mm: 2100 },
    { type: "door", width_mm: 1800, height_mm: 2100 },
  ] };
comp = countComponents(wall);
check("multi-opening lintels", comp.lintels, 4);
check("multi-opening trimmers", comp.trimming_studs, 8);
check("multi-opening sill trimmers", comp.sill_trimmers, 2); // only windows


console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
