#!/usr/bin/env node
/**
 * Chunk 4 validation: Tests wall sizing functions by reimplementing
 * the lookup logic in JS and checking against the JSON table data.
 *
 * Validates: stud lookup, lintel sizing, trimming studs, sill/head
 * trimmers, top/bottom plates, dwangs, wall position, and integration
 * tests with realistic wall configurations.
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

// Reuse table_lookup from chunk3 validation
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

// size_lookup — find smallest member where max_span >= required
function sizeLookup(entries, requiredSpan) {
  const candidates = [];
  for (const [size, data] of Object.entries(entries)) {
    if (size.startsWith("_")) continue;
    let maxSpan;
    if (typeof data === "number") maxSpan = data;
    else if (data && typeof data === "object" && "max_span" in data) maxSpan = data.max_span;
    else continue;
    if (maxSpan >= requiredSpan - 1e-9) {
      const parts = size.split("x");
      const area = parseInt(parts[0]) * parseInt(parts[1]);
      candidates.push({ area, size });
    }
  }
  candidates.sort((a, b) => a.area - b.area);
  return candidates.length > 0 ? candidates[0].size : null;
}

// -------------------------------------------------------------------
// 1. Stud lookup — Table 8.2 (loadbearing)
// -------------------------------------------------------------------
console.log("--- Stud Lookups (Table 8.2) ---");

// sot, H zone, 2.0m loaded dim, 2.4m height, 600mm spacing → 90x70
const slb = tables.studs_loadbearing;
check(
  "stud: sot/H/2.0/2.4/600",
  slb.sot.H["2.0"]["2.4"]["600"],
  "90x70"
);

// sot, H zone, 2.0m loaded dim, 2.4m height, 300mm spacing → 90x35
check(
  "stud: sot/H/2.0/2.4/300",
  slb.sot.H["2.0"]["2.4"]["300"],
  "90x35"
);

// sot, M zone, 4.0m loaded dim, 2.4m height, 600mm spacing
check(
  "stud: sot/M/4.0/2.4/600 exists",
  slb.sot.M["4.0"]["2.4"]["600"] !== undefined,
  true
);

// lot (lower of two), H zone
check(
  "stud: lot position exists",
  "lot" in slb,
  true
);

// sub position exists
check(
  "stud: sub position exists",
  "sub" in slb,
  true
);

// -------------------------------------------------------------------
// 2. Non-loadbearing studs — Table 8.4
// -------------------------------------------------------------------
console.log("\n--- Non-loadbearing Studs (Table 8.4) ---");
const snlb = tables.studs_nonloadbearing;

// EH zone, 2.4m, 600mm → 90x70
check("nlb stud: EH/2.4/600", snlb.EH["2.4"]["600"], "90x70");

// ML zone, 2.4m, 600mm (M and L map to ML)
check(
  "nlb stud: ML zone exists",
  "ML" in snlb,
  true
);

// -------------------------------------------------------------------
// 3. Trimming studs — Table 8.5
// -------------------------------------------------------------------
console.log("\n--- Trimming Studs (Table 8.5) ---");
const ts = tables.trimming_studs;

// sot_and_nlb, 1.8m opening, 45mm stud → 45mm trimmer
check("trimmer: sot/1.8/45", ts.sot_and_nlb["1.8"]["45"], 45);

// sot_and_nlb, 3.0m opening, 70mm stud → 90mm trimmer
check("trimmer: sot/3.0/70", ts.sot_and_nlb["3.0"]["70"], 90);

// sot_and_nlb, 3.6m opening, 45mm stud → 90mm trimmer
check("trimmer: sot/3.6/45", ts.sot_and_nlb["3.6"]["45"], 90);

// sot_and_nlb, 4.2m opening, 90mm stud → 270mm trimmer
check("trimmer: sot/4.2/90", ts.sot_and_nlb["4.2"]["90"], 270);

// other position, 1.8m opening, 45mm stud → 70mm
check("trimmer: other/1.8/45", ts.other["1.8"]["45"], 70);

// -------------------------------------------------------------------
// 4. Lintel load cases — Table 8.8
// -------------------------------------------------------------------
console.log("\n--- Lintel Load Cases (Table 8.8) ---");
const llc = tables.lintel_load_cases;

check("load_case: roof_only supports_roof", llc.roof_only.supports_roof, true);
check("load_case: roof_only supports_wall", llc.roof_only.supports_wall, false);
check("load_case: roof_wall_floor table", llc.roof_wall_floor.table, "8.11");
check("load_case: floor_only supports_floor", llc.floor_only.supports_floor, true);

// -------------------------------------------------------------------
// 5. Lintel sizing — Tables 8.9-8.13
// -------------------------------------------------------------------
console.log("\n--- Lintel Sizing (Tables 8.9-8.13) ---");

// Table 8.9 (roof_only): light, 2m loaded dim, find size for 1.5m span
const lr = tables.lintel_roof_only.light["2"];
check(
  "lintel 8.9: light/2m/1.5m span → 140x70",
  sizeLookup(lr, 1.5),
  "140x70"
);

// Table 8.9: light, 2m loaded dim, 2.5m span → 190x70
check(
  "lintel 8.9: light/2m/2.5m span → 190x70",
  sizeLookup(lr, 2.5),
  "190x70"
);

// Table 8.9: light, 4m loaded dim, 2.0m span
const lr4 = tables.lintel_roof_only.light["4"];
check(
  "lintel 8.9: light/4m/2.0m span → 190x70",
  sizeLookup(lr4, 2.0),
  "190x70"
);

// Table 8.10 (roof_wall): light_light, 2m loaded dim
const lrw = tables.lintel_roof_wall.light_light["2"];
check(
  "lintel 8.10: light_light/2m/1.5m → 140x70",
  sizeLookup(lrw, 1.5),
  "140x70"
);

// Table 8.13 (floor_only): 2.0m loaded dim
const lfo = tables.lintel_floor_only["2.0"];
check(
  "lintel 8.13: 2.0m/1.5m span → 140x70",
  sizeLookup(lfo, 1.5),
  "140x70"
);

// Table 8.13: 4.0m loaded dim, 2.0m span
const lfo4 = tables.lintel_floor_only["4.0"];
// 240x70 max span is 1.8m (< 2.0), so 290x70 (max 2.2m) is smallest adequate
check(
  "lintel 8.13: 4.0m/2.0m span → 290x70",
  sizeLookup(lfo4, 2.0),
  "290x70"
);

// -------------------------------------------------------------------
// 6. Sill/head trimmers — Table 8.15
// -------------------------------------------------------------------
console.log("\n--- Sill/Head Trimmers (Table 8.15) ---");
const sht = tables.sill_head_trimmers;

check("sill_trimmer: 2.0m → 35mm", sht["2.0"], 35);
check("sill_trimmer: 2.4m → 45mm", sht["2.4"], 45);
check("sill_trimmer: 3.0m → 90mm", sht["3.0"], 90);
check("sill_trimmer: 3.6m → 135mm", sht["3.6"], 135);
check("sill_trimmer: 4.2m → SED", sht["4.2"], "SED");

// Round-up test: 2.1m → use 2.4m row → 45mm
check(
  "sill_trimmer: 2.1m rounds up to 2.4m",
  sht[tableLookup(sht, 2.1)],
  45
);

// -------------------------------------------------------------------
// 7. Lintel fixing — Table 8.14
// -------------------------------------------------------------------
console.log("\n--- Lintel Fixing (Table 8.14) ---");
const lf = tables.lintel_fixing;

// light, H zone, 2m loaded dim
check(
  "lintel_fixing: light/H/2 no_uplift",
  lf.light.H["2"].no_uplift,
  1.5
);
check(
  "lintel_fixing: light/H/2 uplift",
  lf.light.H["2"].uplift,
  5
);

// light, M zone, 2m loaded dim — no_uplift exists
check(
  "lintel_fixing: light/M/2 no_uplift",
  lf.light.M["2"].no_uplift,
  2.4
);

// light, EH zone, 2m — no_uplift is null (always use uplift fixing)
check(
  "lintel_fixing: light/EH/2 no_uplift null",
  lf.light.EH["2"].no_uplift,
  null
);

// -------------------------------------------------------------------
// 8. Top plates — Table 8.16
// -------------------------------------------------------------------
console.log("\n--- Top Plates (Table 8.16) ---");
const tp = tables.top_plates;

// sot, 70x45, anywhere joint, 600mm stud spacing, light roof, 300mm loaded dim → 6.0m
check(
  "top_plate: sot/70x45/anywhere/600/light/300",
  tp.sot["70x45"].anywhere["600"].light["300"],
  6
);

// Verify plate sizes exist
const sotPlates = Object.keys(tp.sot).filter(function(k) { return k.indexOf("_") !== 0; });
check(
  "top_plate: sot has 70x45",
  sotPlates.indexOf("70x45") >= 0,
  true
);
check(
  "top_plate: sot has 90x45",
  sotPlates.indexOf("90x45") >= 0,
  true
);

// -------------------------------------------------------------------
// 9. Bottom plates — Table 8.17
// -------------------------------------------------------------------
console.log("\n--- Bottom Plates (Table 8.17) ---");
const bp = tables.bottom_plates;

// sot, 70x45, 400mm joist spacing, light roof, 300mm loaded dim → 6.0m
check(
  "bottom_plate: sot/70x45/400/light/300",
  bp.sot["70x45"]["400"].light["300"],
  6
);

// 90x45 exists
const sotBPlates = Object.keys(bp.sot).filter(function(k) { return k.indexOf("_") !== 0; });
check(
  "bottom_plate: sot has 90x45",
  sotBPlates.indexOf("90x45") >= 0,
  true
);

// -------------------------------------------------------------------
// 10. Dwang positions
// -------------------------------------------------------------------
console.log("\n--- Dwang Positions ---");

function getDwangPositions(heightMm) {
  const positions = [];
  if (heightMm <= 2700) {
    positions.push(Math.floor(heightMm / 2));
  } else {
    positions.push(Math.floor(heightMm / 3));
    positions.push(Math.floor(2 * heightMm / 3));
  }
  for (let h = 1200; h < heightMm; h += 1200) {
    if (positions.indexOf(h) < 0 && Math.abs(h - heightMm) > 100) {
      positions.push(h);
    }
  }
  positions.sort(function(a, b) { return a - b; });
  return positions;
}

check("dwang: 2400mm → [1200]", getDwangPositions(2400), [1200]);
// 2700mm: mid-height=1350, plus sheet joints at 1200 and 2400
check("dwang: 2700mm → [1200, 1350, 2400]", getDwangPositions(2700), [1200, 1350, 2400]);
check("dwang: 3600mm → [1200, 2400]", getDwangPositions(3600), [1200, 2400]);

// -------------------------------------------------------------------
// 11. Integration test: typical Northland single-storey wall
// -------------------------------------------------------------------
console.log("\n--- Integration: Typical Northland Wall ---");

// M zone, sot position, 4.0m loaded dim, 2.4m height, 600mm spacing
const windZone = "M";
const position = "sot";
const loadedDim = 4.0;
const heightM = 2.4;

// Stud lookup
const studSize = slb[position][windZone][tableLookup(slb[position][windZone], loadedDim)][tableLookup(slb[position][windZone][tableLookup(slb[position][windZone], loadedDim)], heightM)]["600"];
check(
  "integration: M/sot/4.0/2.4/600 stud exists",
  studSize !== undefined && studSize !== null,
  true
);
console.log(`  Stud: ${studSize}`);

// Lintel for 1.8m window — roof_only, light, find loaded dim
const lintDimKey = tableLookup(tables.lintel_roof_only.light, loadedDim);
if (lintDimKey) {
  const lintEntries = tables.lintel_roof_only.light[lintDimKey];
  const lintSize = sizeLookup(lintEntries, 1.8);
  check(
    "integration: lintel for 1.8m window exists",
    lintSize !== null,
    true
  );
  console.log(`  Lintel (1.8m window, roof_only, light, ${lintDimKey}m): ${lintSize}`);
}

// Trimmer for 1.8m opening
const studThick600 = parseInt(studSize.split("x")[1]);
const trimThickKey = tableLookup(tables.trimming_studs.sot_and_nlb, 1.8);
if (trimThickKey) {
  const trimThickEntry = tables.trimming_studs.sot_and_nlb[trimThickKey];
  const thickKey = tableLookup(trimThickEntry, studThick600);
  if (thickKey) {
    const trimThick = trimThickEntry[thickKey];
    console.log(`  Trimmer (1.8m, ${studThick600}mm stud): ${trimThick}mm`);
  }
}

// Sill trimmer for 1.8m window
const sillKey = tableLookup(sht, 1.8);
console.log(`  Sill trimmer (1.8m): ${sht[sillKey]}mm`);

// Top plate — find smallest adequate plate WITH stud width constraint
// Stud is 90x45, so plate width must be >= 90mm (S8.7.1)
const studWidth = parseInt(studSize.split("x")[0]);
let foundTopPlate = null;
for (const plateSize of sotPlates) {
  // Skip plates narrower than stud
  const plateWidth = parseInt(plateSize.split("+")[0].split("x")[0]);
  if (plateWidth < studWidth) continue;

  const pd = tp.sot[plateSize];
  if (pd.anywhere && pd.anywhere["600"] && pd.anywhere["600"].light) {
    const dimKey = tableLookup(pd.anywhere["600"].light, loadedDim);
    if (dimKey) {
      const maxSpan = pd.anywhere["600"].light[dimKey];
      if (maxSpan !== null && maxSpan >= loadedDim - 0.01) {
        foundTopPlate = plateSize;
        break;
      }
    }
  }
}
check(
  "integration: top plate found and >= stud width",
  foundTopPlate !== null,
  true
);
// Verify the found plate is NOT 70x45 when stud is 90x45
check(
  "integration: top plate is not 70x45 for 90mm stud",
  foundTopPlate !== "70x45",
  true
);
console.log(`  Top plate: ${foundTopPlate} (>= ${studWidth}mm stud width)`);

// Bottom plate — find smallest adequate plate WITH stud width constraint
let foundBottomPlate = null;
for (const plateSize of sotBPlates) {
  const plateWidth = parseInt(plateSize.replace("2/","").split("x")[0]);
  if (plateWidth < studWidth) continue;

  const pd = bp.sot[plateSize];
  if (pd["450"] && pd["450"].light) {
    const dimKey = tableLookup(pd["450"].light, loadedDim);
    if (dimKey) {
      const maxSpan = pd["450"].light[dimKey];
      if (maxSpan !== null && maxSpan >= loadedDim - 0.01) {
        foundBottomPlate = plateSize;
        break;
      }
    }
  }
}
check(
  "integration: bottom plate found and >= stud width",
  foundBottomPlate !== null,
  true
);
check(
  "integration: bottom plate is not 70x45 for 90mm stud",
  foundBottomPlate !== "70x45" && foundBottomPlate !== "70x70",
  true
);
console.log(`  Bottom plate: ${foundBottomPlate} (>= ${studWidth}mm stud width)`);

// -------------------------------------------------------------------
// 12. Edge cases
// -------------------------------------------------------------------
console.log("\n--- Edge Cases ---");

// Very large opening (4.5m) — should exceed sill_head_trimmers range
check(
  "edge: sill trimmer 4.5m exceeds range",
  tableLookup(sht, 4.5),
  null
);

// Large loaded dim on lintel (7.0m) — should exceed table
check(
  "edge: lintel loaded dim 7.0m exceeds range",
  tableLookup(tables.lintel_roof_only.light, 7.0),
  null
);

// Minimum case: 90x70 lintel, roof_only, light, 2m dim, 1.0m span
check(
  "edge: smallest lintel 8.9 light/2m/1.0m → 90x70",
  sizeLookup(tables.lintel_roof_only.light["2"], 1.0),
  "90x70"
);

// NLB stud with null value (EH, 4.8, 600)
check(
  "edge: nlb stud EH/4.8/600 is null",
  snlb.EH["4.8"]["600"],
  null
);

// -------------------------------------------------------------------
// 13. Plate width must be >= stud width (S8.7.1/S8.7.2)
// -------------------------------------------------------------------
console.log("\n--- Plate Width >= Stud Width ---");

// Helper: find smallest adequate plate WITH min_width constraint
function findTopPlateWithMinWidth(position, loadedDim, roofWeight, studSpacing, minWidth) {
  const posData = tp[position] || tp.sot;
  const sizes = Object.keys(posData).filter(function(k) { return k.indexOf("_") !== 0; });
  // Sort by area
  sizes.sort(function(a, b) {
    function area(s) {
      var base = s.split("+")[0]; var p = base.split("x");
      return parseInt(p[0]) * parseInt(p[1]);
    }
    return area(a) - area(b);
  });

  for (var i = 0; i < sizes.length; i++) {
    var plateSize = sizes[i];
    // Check plate width >= minWidth
    var pw = parseInt(plateSize.split("+")[0].split("x")[0]);
    if (pw < minWidth) continue;

    var pd = posData[plateSize];
    if (!pd.anywhere) continue;
    var spKey = tableLookup(pd.anywhere, studSpacing);
    if (!spKey || !pd.anywhere[spKey][roofWeight]) continue;
    var dimData = pd.anywhere[spKey][roofWeight];
    var ldKey = tableLookup(dimData, loadedDim);
    if (!ldKey) continue;
    var maxSpan = dimData[ldKey];
    if (maxSpan !== null && maxSpan >= loadedDim - 0.01) {
      return plateSize;
    }
  }
  return minWidth + "x45"; // fallback per S8.7.1.2
}

// 90x45 stud → 70x45 plate must be skipped, 90x45 plate must be used
const topPlate90 = findTopPlateWithMinWidth("sot", 4.0, "light", 600, 90);
const topPlateWidth90 = parseInt(topPlate90.split("+")[0].split("x")[0]);
check(
  "plate_width: 90mm stud → top plate width >= 90mm",
  topPlateWidth90 >= 90,
  true
);
console.log(`  90x45 stud → top plate: ${topPlate90} (width ${topPlateWidth90}mm)`);

// Without constraint, 70x45 would be returned (verify the bug existed)
const topPlateNoConstraint = findTopPlateWithMinWidth("sot", 4.0, "light", 600, 0);
check(
  "plate_width: without constraint, 70x45 would be chosen",
  topPlateNoConstraint,
  "70x45"
);

// Bottom plate with 90mm stud
function findBottomPlateWithMinWidth(position, loadedDim, roofWeight, joistSpacing, minWidth) {
  const posData = bp[position] || bp.sot;
  const sizes = Object.keys(posData).filter(function(k) { return k.indexOf("_") !== 0; });
  sizes.sort(function(a, b) {
    function area(s) { var p = s.replace("2/","").split("x"); return parseInt(p[0]) * parseInt(p[1]); }
    return area(a) - area(b);
  });

  for (var i = 0; i < sizes.length; i++) {
    var plateSize = sizes[i];
    var pw = parseInt(plateSize.split("+")[0].replace("2/","").split("x")[0]);
    if (pw < minWidth) continue;

    var pd = posData[plateSize];
    var jsKey = tableLookup(pd, joistSpacing);
    if (!jsKey || !pd[jsKey][roofWeight]) continue;
    var dimData = pd[jsKey][roofWeight];
    var ldKey = tableLookup(dimData, loadedDim);
    if (!ldKey) continue;
    var maxSpan = dimData[ldKey];
    if (maxSpan !== null && maxSpan >= loadedDim - 0.01) {
      return plateSize;
    }
  }
  return minWidth + "x45";
}

const bottomPlate90 = findBottomPlateWithMinWidth("sot", 4.0, "light", 450, 90);
const bottomPlateWidth90 = parseInt(bottomPlate90.replace("2/","").split("x")[0]);
check(
  "plate_width: 90mm stud → bottom plate width >= 90mm",
  bottomPlateWidth90 >= 90,
  true
);
console.log(`  90x45 stud → bottom plate: ${bottomPlate90} (width ${bottomPlateWidth90}mm)`);

// -------------------------------------------------------------------
// Results
// -------------------------------------------------------------------
console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
