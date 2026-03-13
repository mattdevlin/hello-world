#!/usr/bin/env node
/**
 * Chunk 3 validation: Tests the core lookup functions, site classification,
 * and bracing demand logic by reimplementing them in JS and checking against
 * the JSON table data.
 *
 * This validates the ENGINE LOGIC matches the TABLE DATA, even though
 * we can't run the Python directly (Python not installed).
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

// -------------------------------------------------------------------
// 1. table_lookup — round UP to next row
// -------------------------------------------------------------------
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

// Test table_lookup with driven pile spacing (floors_only, 1.5kPa)
const pilesFloors = tables.driven_pile_spacing["1.5kPa"].floors_only;
check("table_lookup: exact match 2.0", tableLookup(pilesFloors, 2.0), "2.0");
check("table_lookup: round up 2.1→2.4", tableLookup(pilesFloors, 2.1), "2.4");
check("table_lookup: round up 3.5→3.6", tableLookup(pilesFloors, 3.5), "3.6");
check("table_lookup: exact 5.6", tableLookup(pilesFloors, 5.6), "5.6");
check("table_lookup: exceeds range", tableLookup(pilesFloors, 6.0), null);

// -------------------------------------------------------------------
// 2. determine_wind_zone
// -------------------------------------------------------------------
function determineWindZone(site) {
  const wz = tables.wind_zones;
  const region = site.wind_region || "A";
  const roughness = site.ground_roughness || "open";
  const topo = site.topographic_class || "T1";
  const exposure = site.site_exposure || "sheltered";
  const lee = site.lee_zone || false;

  const key = `${topo}_${exposure}`;
  let zone = wz[region][roughness][key];

  if (lee && wz.lee_zone_upgrade && wz.lee_zone_upgrade[zone]) {
    zone = wz.lee_zone_upgrade[zone];
  }
  return zone;
}

// Region A, urban, T1, sheltered → L
check(
  "wind_zone: A/urban/T1/sheltered",
  determineWindZone({
    wind_region: "A",
    ground_roughness: "urban",
    topographic_class: "T1",
    site_exposure: "sheltered",
  }),
  "L"
);

// Region A, open, T1, sheltered → M
check(
  "wind_zone: A/open/T1/sheltered",
  determineWindZone({
    wind_region: "A",
    ground_roughness: "open",
    topographic_class: "T1",
    site_exposure: "sheltered",
  }),
  "M"
);

// Region A, open, T1, exposed → H
check(
  "wind_zone: A/open/T1/exposed",
  determineWindZone({
    wind_region: "A",
    ground_roughness: "open",
    topographic_class: "T1",
    site_exposure: "exposed",
  }),
  "H"
);

// Region W, open, T4, exposed → SED
check(
  "wind_zone: W/open/T4/exposed",
  determineWindZone({
    wind_region: "W",
    ground_roughness: "open",
    topographic_class: "T4",
    site_exposure: "exposed",
  }),
  "SED"
);

// Lee zone upgrade: L → H
check(
  "wind_zone: lee zone L→H",
  determineWindZone({
    wind_region: "A",
    ground_roughness: "urban",
    topographic_class: "T1",
    site_exposure: "sheltered",
    lee_zone: true,
  }),
  "H"
);

// Lee zone upgrade: M → VH
check(
  "wind_zone: lee zone M→VH",
  determineWindZone({
    wind_region: "A",
    ground_roughness: "open",
    topographic_class: "T1",
    site_exposure: "sheltered",
    lee_zone: true,
  }),
  "VH"
);

// -------------------------------------------------------------------
// 3. determine_eq_zone
// -------------------------------------------------------------------
function determineEqZone(ta) {
  const eq = tables.eq_zones;
  if (eq[ta] !== undefined) return eq[ta];
  // Case-insensitive fallback
  const taLower = ta.toLowerCase();
  for (const [key, zone] of Object.entries(eq)) {
    if (key.startsWith("_")) continue;
    if (key.toLowerCase() === taLower) return zone;
  }
  return null;
}

check("eq_zone: Wellington City", determineEqZone("Wellington City"), 3);
check("eq_zone: Auckland", determineEqZone("Auckland"), 2);
check("eq_zone: Far North District", determineEqZone("Far North District"), 1);
check("eq_zone: Christchurch City", determineEqZone("Christchurch City"), 3);
check("eq_zone: Dunedin City", determineEqZone("Dunedin City"), 2);
check(
  "eq_zone: Whangarei District",
  determineEqZone("Whangarei District"),
  1
);

// -------------------------------------------------------------------
// 4. topographic_class
// -------------------------------------------------------------------
check(
  "topo: crest/gentle",
  tables.topographic_class.crest.gentle,
  "T1"
);
check(
  "topo: crest/steep",
  tables.topographic_class.crest.steep,
  "T4"
);
check(
  "topo: outer/mild",
  tables.topographic_class.outer.mild,
  "T2"
);

// -------------------------------------------------------------------
// 5. wind bracing multipliers
// -------------------------------------------------------------------
check("wind_mult: L", tables.wind_zone_multipliers.L, 0.5);
check("wind_mult: M", tables.wind_zone_multipliers.M, 0.7);
check("wind_mult: H", tables.wind_zone_multipliers.H, 1);
check("wind_mult: VH", tables.wind_zone_multipliers.VH, 1.3);
check("wind_mult: EH", tables.wind_zone_multipliers.EH, 1.6);

// -------------------------------------------------------------------
// 6. EQ multiplication factors
// -------------------------------------------------------------------
check("eq_factor: zone1/C", tables.eq_multiplication_factors["1"].C, 0.4);
check("eq_factor: zone2/DE", tables.eq_multiplication_factors["2"].DE, 0.8);
check("eq_factor: zone3/AB", tables.eq_multiplication_factors["3"].AB, 0.6);

// -------------------------------------------------------------------
// 7. wind bracing demand — spot check Table 5.6
// -------------------------------------------------------------------
// H_apex=5, h_eaves=1 → across=50, along=55
check(
  "wind_bracing 5.6: H=5, eaves=1",
  tables.wind_bracing_demand_single_upper["5"]["1"],
  { across: 50, along: 55 }
);

// H_apex=7, h_eaves=3 → across=85, along=80
check(
  "wind_bracing 5.6: H=7, eaves=3",
  tables.wind_bracing_demand_single_upper["7"]["3"],
  { across: 85, along: 80 }
);

// -------------------------------------------------------------------
// 8. Integration test: bracing demand for typical Northland house
// -------------------------------------------------------------------
// Single storey, M zone, EQ zone 1, soil C
// Plan 12m × 8m, 2.4m stud, 22.5° pitch, light roof
// Wind: Table 5.6 lookup, multiply by 0.7 (M zone)
// EQ: Table 5.8 or 5.10 lookup, multiply by zone1/C factor (0.4)
const windMult = 0.7; // M zone
const eqFactor = 0.4; // zone 1, soil C

// For H_apex ≈ 2.4 + (4.0/2)*tan(22.5°) ≈ 2.4 + 0.83 = 3.23m → round up to "4"
// h_eaves ≈ 0.83 → round to "1"
const windEntry = tables.wind_bracing_demand_single_upper["4"]["1"];
check(
  "integration: wind entry exists",
  windEntry !== undefined,
  true
);
if (windEntry) {
  const windAcrossBuM = windEntry.across * windMult;
  const windAlongBuM = windEntry.along * windMult;
  console.log(
    `\nIntegration test (Northland single storey, M zone, 12x8m):`
  );
  console.log(
    `  Wind: ${windEntry.across} × ${windMult} = ${windAcrossBuM} BU/m (across)`
  );
  console.log(
    `  Wind: ${windEntry.along} × ${windMult} = ${windAlongBuM} BU/m (along)`
  );
  console.log(
    `  Wind total: ${windAcrossBuM * 12} BU across, ${windAlongBuM * 8} BU along`
  );
  console.log(
    `  EQ factor: ${eqFactor} (zone 1, soil C)`
  );
}

// -------------------------------------------------------------------
// Results
// -------------------------------------------------------------------
console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
