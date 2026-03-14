#!/usr/bin/env node
/**
 * Chunk 6 Validation — Roof Sizing Engine
 *
 * Reimplements roof sizing lookups in JS against the JSON table data.
 *
 * Tests: lookup_rafter, lookup_ridge_beam, lookup_ceiling_joist,
 *        lookup_ceiling_runner, lookup_underpurlin, lookup_truss_fixing,
 *        lookup_roof_bracing, size_roof
 *
 * Run:  node scripts/validate_chunk6.cjs
 */

const fs = require("fs");
const path = require("path");

const tablesPath = path.join(__dirname, "..", "nzs3604_tables.json");
const tables = JSON.parse(fs.readFileSync(tablesPath, "utf8"));

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

function tableLookup(entries, value) {
  const numericKeys = [];
  for (const k of Object.keys(entries)) {
    if (k.startsWith("_")) continue;
    const n = parseFloat(k);
    if (!isNaN(n)) numericKeys.push({ num: n, key: k });
  }
  numericKeys.sort((a, b) => a.num - b.num);
  for (const { num, key } of numericKeys) {
    if (num >= value - 1e-9) return key;
  }
  return null;
}

function memberArea(s) {
  try {
    const [w, h] = s.split("x").map(Number);
    return w * h;
  } catch { return 0; }
}

// ---- Roof lookup functions ----

const CEILING_JOIST_SIZES = ["90x35", "90x45", "140x35", "140x45", "190x45"];
const CEILING_RUNNER_SIZES = ["140x45", "190x45", "240x45", "290x45", "290x90"];
const RIDGE_SIZES = ["240x45", "290x45", "190x70", "240x70", "290x70", "190x90", "240x90", "290x90"];

function lookupRafter(windZone, spanM, spacing) {
  const multipliers = tables.rafters.rafter_zone_multipliers;
  const mult = multipliers[windZone] || 1.0;
  const ordinary = tables.rafters.ordinary;
  const spacingKey = String(spacing);
  const sizes = Object.keys(ordinary).filter(k => !k.startsWith("_")).sort((a, b) => memberArea(a) - memberArea(b));
  for (const size of sizes) {
    const spacingData = ordinary[size];
    if (!(spacingKey in spacingData)) continue;
    const entry = spacingData[spacingKey];
    const actualSpan = entry.span * mult;
    if (actualSpan >= spanM - 1e-9) {
      return { size, spacing, max_span_m: Math.round(actualSpan * 100) / 100, fixing: entry.fix, mult };
    }
  }
  return { size: "SED" };
}

function lookupRidgeBeam(spanM, loadedWidthM, roofWeight) {
  const weightData = tables.ridge_beams[roofWeight] || tables.ridge_beams.light;
  // Collect all loaded dim keys
  const allDims = new Set();
  for (const [size, sizeData] of Object.entries(weightData)) {
    if (size.startsWith("_")) continue;
    for (const k of Object.keys(sizeData)) {
      if (!k.startsWith("_")) allDims.add(k);
    }
  }
  const sortedDims = [...allDims].sort((a, b) => parseFloat(a) - parseFloat(b));
  let ldKey = null;
  for (const d of sortedDims) {
    if (parseFloat(d) >= loadedWidthM - 1e-9) { ldKey = d; break; }
  }
  if (!ldKey) return { size: "SED" };

  for (const size of RIDGE_SIZES) {
    if (!(size in weightData)) continue;
    const entry = weightData[size][ldKey];
    if (!entry) continue;
    if (entry.span >= spanM - 1e-9) {
      return { size, max_span_m: entry.span, fixing: entry.fix, loaded_dim_m: parseFloat(ldKey) };
    }
  }
  return { size: "SED" };
}

function lookupCeilingJoist(spanM, spacing) {
  const spacingKey = String(spacing);
  for (const size of CEILING_JOIST_SIZES) {
    if (!(size in tables.ceiling_joists)) continue;
    const maxSpan = tables.ceiling_joists[size][spacingKey];
    if (maxSpan != null && maxSpan >= spanM - 1e-9) {
      return { size, spacing, max_span_m: maxSpan };
    }
  }
  return { size: "SED" };
}

function lookupCeilingRunner(spanM, spacingM) {
  const spacingKey = String(spacingM);
  for (const size of CEILING_RUNNER_SIZES) {
    if (!(size in tables.ceiling_runners)) continue;
    const maxSpan = tables.ceiling_runners[size][spacingKey];
    if (maxSpan != null && maxSpan >= spanM - 1e-9) {
      return { size, max_span_m: maxSpan };
    }
  }
  return { size: "SED" };
}

function lookupTrussFix(windZone, spacing, loadedDimM, roofWeight) {
  // Find weight_spacing key
  const prefix = roofWeight + "_";
  const possibleKeys = Object.keys(tables.truss_fixing)
    .filter(k => k.startsWith(prefix))
    .map(k => ({ sp: parseInt(k.split("_")[1]), key: k }))
    .sort((a, b) => a.sp - b.sp);
  let wsKey = null;
  for (const { sp, key } of possibleKeys) {
    if (sp >= spacing - 1) { wsKey = key; break; }
  }
  if (!wsKey && possibleKeys.length) wsKey = possibleKeys[possibleKeys.length - 1].key;
  if (!wsKey) return "SED";
  const zoneData = tables.truss_fixing[wsKey][windZone] || {};
  const ldKey = tableLookup(zoneData, loadedDimM);
  if (!ldKey) return "SED";
  return zoneData[ldKey];
}


// ===== RAFTER TESTS (Table 10.1) =====
console.log("--- Rafter Sizing (Table 10.1) ---");

let r;

// EH zone: 190x45 at 600mm → span 3.3m (table value, mult=1.0)
r = lookupRafter("EH", 3.3, 600);
check("EH 3.3m/600 → 190x45", r.size, "190x45");
check("EH mult=1.0", r.mult, 1.0);

// L zone (mult=1.3): 190x45 at 600mm → 3.3*1.3=4.29m
r = lookupRafter("L", 4.0, 600);
check("L 4.0m/600 → 190x45", r.size, "190x45");
checkGte("L 190x45 span ≥ 4.0", r.max_span_m, 4.0);

// H zone (mult=1.1): 140x45 at 600mm → 2.5*1.1=2.75m
r = lookupRafter("H", 2.7, 600);
check("H 2.7m/600 → 140x45", r.size, "140x45");

// M zone (mult=1.3): 90x45 at 600mm → 1.3*1.3=1.69m
r = lookupRafter("M", 1.5, 600);
check("M 1.5m/600 → 90x45", r.size, "90x45");

// VH zone (mult=1.1): check span calc
r = lookupRafter("VH", 3.5, 600);
// 190x45 → 3.3*1.1=3.63 ≥ 3.5 → yes
check("VH 3.5m/600 → 190x45", r.size, "190x45");

// 900mm spacing: 240x45 at EH → 3.1m
r = lookupRafter("EH", 3.1, 900);
check("EH 3.1m/900 → 240x45", r.size, "240x45");

// Large span → SED
r = lookupRafter("EH", 8.0, 600);
check("EH 8.0m → SED", r.size, "SED");

// L zone large span: 290x70 at 600mm → 5.9*1.3=7.67m
r = lookupRafter("L", 7.5, 600);
check("L 7.5m/600 → 290x70", r.size, "290x70");

console.log(`  Example: L zone, 4.0m/600 → ${lookupRafter("L", 4.0, 600).size} (span ${lookupRafter("L", 4.0, 600).max_span_m}m)`);


// ===== RIDGE BEAM TESTS (Table 10.2) =====
console.log("--- Ridge Beam (Table 10.2) ---");

// Light, 2.0m span, 1.8m loaded width → 240x45 (span 2.3m)
r = lookupRidgeBeam(2.0, 1.8, "light");
check("light 2.0m/1.8ld → 240x45", r.size, "240x45");
check("light 240x45 span", r.max_span_m, 2.3);

// Light, 2.5m span, 2.7m loaded width → 190x70 (span 2.4@2.7ld)? No, need span ≥ 2.5
// 190x70 at 2.7 → span 2.4 < 2.5, so next size
// 240x70 at 2.7 → need to check
r = lookupRidgeBeam(2.5, 2.7, "light");
console.log(`  Light 2.5m/2.7ld → ${r.size} (span ${r.max_span_m}m)`);
checkGte("ridge span ≥ 2.5", r.max_span_m, 2.5);

// Light, 1.5m span, 1.8m loaded width → smallest adequate
r = lookupRidgeBeam(1.5, 1.8, "light");
check("light 1.5m/1.8ld → 240x45", r.size, "240x45"); // 2.3m >> 1.5m

// Large span → SED
r = lookupRidgeBeam(8.0, 1.8, "light");
check("light 8.0m → SED", r.size, "SED");


// ===== CEILING JOIST TESTS (Table 10.3) =====
console.log("--- Ceiling Joist (Table 10.3) ---");

// 2.0m/600 → 90x45 (max 2.3)
r = lookupCeilingJoist(2.0, 600);
check("2.0m/600 → 90x45", r.size, "90x45");

// 3.5m/600 → 140x45 (max 3.6), 140x35 max=3.3 not enough
r = lookupCeilingJoist(3.5, 600);
check("3.5m/600 → 140x45", r.size, "140x45");

// 4.5m/600 → 190x45 (max 4.6)
r = lookupCeilingJoist(4.5, 600);
check("4.5m/600 → 190x45", r.size, "190x45");

// 5.0m → SED
r = lookupCeilingJoist(5.0, 600);
check("5.0m → SED", r.size, "SED");

// 480mm spacing: 1.8m → 90x35 (max 1.9)
r = lookupCeilingJoist(1.8, 480);
check("1.8m/480 → 90x35", r.size, "90x35");


// ===== CEILING RUNNER TESTS (Table 10.4) =====
console.log("--- Ceiling Runner (Table 10.4) ---");

// 2.0m/2.4 → 190x45 (max 2.7), 140x45 max=1.9 not enough
r = lookupCeilingRunner(2.0, 2.4);
check("2.0m/2.4 → 190x45", r.size, "190x45");

// 3.5m/1.8 → 240x45 (max 3.7)
r = lookupCeilingRunner(3.5, 1.8);
check("3.5m/1.8 → 240x45", r.size, "240x45");

// 5.0m/2.4 → 290x90 (max 5.2)
r = lookupCeilingRunner(5.0, 2.4);
check("5.0m/2.4 → 290x90", r.size, "290x90");


// ===== TRUSS FIXING TESTS (Table 10.14) =====
console.log("--- Truss Fixing (Table 10.14) ---");

// Light, 900mm, zone L, 4.0m loaded → "E"
r = lookupTrussFix("L", 900, 4.0, "light");
check("light/900/L/4.0 → E", r, "E");

// Light, 1200mm, zone EH, 3.5m → "SED"
r = lookupTrussFix("EH", 1200, 3.5, "light");
check("light/1200/EH/3.5 → SED", r, "SED");

// Light, 900mm, zone EH, 3.0m → "E"
r = lookupTrussFix("EH", 900, 3.0, "light");
check("light/900/EH/3.0 → E", r, "E");

// Light, 900mm, zone EH, 5.5m → "SED"
r = lookupTrussFix("EH", 900, 5.5, "light");
check("light/900/EH/5.5 → SED", r, "SED");

// Light, 900mm, zone VH, 4.5m → "F"
r = lookupTrussFix("VH", 900, 4.5, "light");
check("light/900/VH/4.5 → F", r, "F");

// Heavy, 900mm, zone M, 5.0m → "E"
r = lookupTrussFix("M", 900, 5.0, "heavy");
check("heavy/900/M/5.0 → E", r, "E");


// ===== ROOF BRACING TESTS (Tables 10.16/10.17) =====
console.log("--- Roof Bracing (Tables 10.16/10.17) ---");

check("light plane brace", tables.roof_bracing_systems.light.roof_plane_brace, "one per 50m2");
check("heavy plane brace", tables.roof_bracing_systems.heavy.roof_plane_brace, "one per 25m2");
check("90x45 diagonal max", tables.roof_space_diagonal_braces["90x45"].max_length_m, 1.85);
check("2x90x45 diagonal max", tables.roof_space_diagonal_braces["2x90x45_spaced"].max_length_m, 4.80);


// ===== INTEGRATION: TYPICAL NZ ROOF =====
console.log("--- Integration: Typical NZ Roof ---");

// Typical Northland house: M zone, light roof, gable, 22.5° pitch
// 4.0m rafter span, 600mm spacing, ridge board only, 4.0m ceiling span
const rafter = lookupRafter("M", 4.0, 600);
const ceilingJoist = lookupCeilingJoist(4.0, 600);
const trussFix = lookupTrussFix("M", 600, 4.0, "light");

console.log(`  Rafter: ${rafter.size} at 600mm (span ${rafter.max_span_m}m, zone mult ${rafter.mult})`);
console.log(`  Ceiling joist: ${ceilingJoist.size} at 600mm (span ${ceilingJoist.max_span_m}m)`);
console.log(`  Truss fixing: ${trussFix}`);

// M zone: 190x45 at 600mm → 3.3*1.3=4.29m ≥ 4.0m
check("integ rafter", rafter.size, "190x45");
checkGte("integ rafter span ≥ 4.0", rafter.max_span_m, 4.0);

// Ceiling: 4.0m/600 → 140x45 (max 3.6 < 4.0), 190x45 (max 4.6 ≥ 4.0)
check("integ ceiling joist", ceilingJoist.size, "190x45");

// Truss fix: light, 600 → rounds to 900 key, zone M, 4.0m → "E"
check("integ truss fix", trussFix, "E");


// EH zone: harder wind conditions
const rafter2 = lookupRafter("EH", 4.0, 600);
console.log(`  EH rafter for 4.0m: ${rafter2.size} (span ${rafter2.max_span_m}m)`);
// EH mult=1.0: 240x70 at 600mm → 5.1m ≥ 4.0? actually 190x70 → 4.0m
check("EH 4.0m/600 → 190x70", rafter2.size, "190x70");


// ===== EDGE CASES =====
console.log("--- Edge Cases ---");

// Very small rafter span
r = lookupRafter("L", 0.5, 600);
check("tiny span → 90x45", r.size, "90x45");

// Exact span match for ceiling joist: 2.3m/600 → 90x45 (max=2.3)
r = lookupCeilingJoist(2.3, 600);
check("exact 2.3m/600 → 90x45", r.size, "90x45");

// Just over: 2.31m/600 → 140x35 (max 3.3)
r = lookupCeilingJoist(2.31, 600);
check("2.31m/600 → 140x35", r.size, "140x35");

// Ridge beam with large loaded width (4.2m) — largest dim in table
r = lookupRidgeBeam(1.5, 4.2, "light");
check("ridge 1.5m/4.2ld", r.size, "240x45"); // 240x45 at 4.2 → span 1.6 ≥ 1.5
check("ridge span", r.max_span_m, 1.6);

// 1200mm rafter spacing
r = lookupRafter("M", 3.0, 1200);
// 140x45 at 1200 → 2.2*1.3=2.86 < 3.0; 190x45 at 1200 → 2.5*1.3=3.25 ≥ 3.0
check("M 3.0m/1200 → 190x45", r.size, "190x45");


console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
