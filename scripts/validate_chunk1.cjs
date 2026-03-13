/**
 * Validation script for Chunk 1 tables: 8.1, 8.16, 8.17, 8.18, 8.19
 * Spot-checks known values from NZS 3604:2011 PDF
 */

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('nzs3604_tables.json', 'utf8'));

let passed = 0;
let failed = 0;

function check(desc, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.log(`FAIL: ${desc}`);
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
  }
}

// ---- Table 8.1: Masonry bracing ----
console.log('\n=== Table 8.1: Masonry bracing ===');
check('8.1 exists', !!data.masonry_bracing, true);
check('8.1 ratio < 0.625 = 0 BU/m', data.masonry_bracing.ranges[0].bu_per_m, 0);
check('8.1 ratio 0.625-1.5 = 42 BU/m', data.masonry_bracing.ranges[1].bu_per_m, 42);
check('8.1 ratio 1.5-3.0 = 100 BU/m', data.masonry_bracing.ranges[2].bu_per_m, 100);
check('8.1 ratio 3.0-4.5 = 200 BU/m', data.masonry_bracing.ranges[3].bu_per_m, 200);
check('8.1 ratio > 4.5 = 300 BU/m', data.masonry_bracing.ranges[4].bu_per_m, 300);
check('8.1 min wall length', data.masonry_bracing.min_wall_length_m, 1.5);

// ---- Table 8.16: Top plates ----
console.log('\n=== Table 8.16: Top plates ===');
const tp = data.top_plates;
check('8.16 exists', !!tp, true);
check('8.16 has sot', !!tp.sot, true);
check('8.16 has lot', !!tp.lot, true);
check('8.16 has sub2', !!tp.sub2, true);

// SOT 70x45, anywhere, truss 600, light, stud 600 = 5.8
check('8.16(a) 70x45/anywhere/600/light/600 = 5.8',
  tp.sot['70x45'].anywhere['600'].light['600'], 5.8);

// SOT 70x45, anywhere, truss 900, heavy, stud 300 = 5.0
check('8.16(a) 70x45/anywhere/900/heavy/300 = 5.0',
  tp.sot['70x45'].anywhere['900'].heavy['300'], 5.0);

// SOT 90x45, anywhere, truss 600, light, stud 600 = 6.0
check('8.16(a) 90x45/anywhere/600/light/600 = 6.0',
  tp.sot['90x45'].anywhere['600'].light['600'], 6.0);

// SOT 90x45, anywhere, truss 1200, heavy = null (not permitted)
check('8.16(a) 90x45/anywhere/1200/heavy/300 = null',
  tp.sot['90x45'].anywhere['1200'].heavy['300'], null);

// SOT 90x45, within_150, truss 900, heavy, stud 600 = 4.1
check('8.16(a) 90x45/within150/900/heavy/600 = 4.1',
  tp.sot['90x45'].within_150['900'].heavy['600'], 4.1);

// LOT 90x45, floor 1.5, truss 600, light, stud 600 = 2.0
check('8.16(b) 90x45/1.5/600/light/600 = 2.0',
  tp.lot['90x45']['1.5']['600'].light['600'], 2.0);

// LOT 90x70, floor 3.0, truss 600, heavy, stud 600 = 5.4
check('8.16(b) 90x70/3.0/600/heavy/600 = 5.4',
  tp.lot['90x70']['3.0']['600'].heavy['600'], 5.4);

// SUB2 90x70, floor 1.5, all 6.0
check('8.16(c) 90x70/1.5/400/light/300 = 6.0',
  tp.sub2['90x70']['1.5']['400'].light['300'], 6.0);

// ---- Table 8.17: Bottom plates ----
console.log('\n=== Table 8.17: Bottom plates ===');
const bp = data.bottom_plates;
check('8.17 exists', !!bp, true);

// SOT 90x45 = all 6.0 (any joist/stud/roof combo)
check('8.17(a) 90x45/400/light/300 = 6.0',
  bp.sot['90x45']['400'].light['300'], 6.0);
check('8.17(a) 90x45/600/heavy/600 = 6.0',
  bp.sot['90x45']['600'].heavy['600'], 6.0);

// SOT 70x45 at joist 450, heavy, stud 600 = 1.6
check('8.17(a) 70x45/450/heavy/600 = 1.6',
  bp.sot['70x45']['450'].heavy['600'], 1.6);

// SOT 70x45 at joist 400, heavy, stud 600 = 5.9
check('8.17(a) 70x45/400/heavy/600 = 5.9',
  bp.sot['70x45']['400'].heavy['600'], 5.9);

// LOT 2/90x45, floor 1.5, joist 400, all should be 6.0
check('8.17(b) 2/90x45/1.5/400/light/300 = 6.0',
  bp.lot['2/90x45']['1.5']['400'].light['300'], 6.0);

// LOT 90x70, floor 1.5, all 6.0
check('8.17(b) 90x70/1.5/400/heavy/600 = 6.0',
  bp.lot['90x70']['1.5']['400'].heavy['600'], 6.0);

// ---- Table 8.18: Top plate fixing ----
console.log('\n=== Table 8.18: Top plate fixing ===');
const tpf = data.top_plate_fixing;
check('8.18 exists', !!tpf, true);

// Light, 900mm, zone L, 2.0m = A
check('8.18 light/900/L/2.0 = A', tpf.light['900'].L['2.0'], 'A');

// Light, 900mm, zone M, 3.0m = B
check('8.18 light/900/M/3.0 = B', tpf.light['900'].M['3.0'], 'B');

// Light, 900mm, zone H, 2.0m = B
check('8.18 light/900/H/2.0 = B', tpf.light['900'].H['2.0'], 'B');

// Heavy, 900mm, zone L, 6.0m = A
check('8.18 heavy/900/L/6.0 = A', tpf.heavy['900'].L['6.0'], 'A');

// Heavy, 900mm, zone H, 3.0m = B
check('8.18 heavy/900/H/3.0 = B', tpf.heavy['900'].H['3.0'], 'B');

// Fixing types
check('8.18 type A capacity = 0.7kN', tpf.fixing_types.A.capacity_kN, 0.7);
check('8.18 type B capacity = 4.7kN', tpf.fixing_types.B.capacity_kN, 4.7);

// ---- Table 8.19: Nailing schedule ----
console.log('\n=== Table 8.19: Nailing schedule S8 ===');
const ns = data.nailing_schedule_s8;
check('8.19 exists', !!ns, true);

// Stud to plate: hand 75x3.15 x4 skewed
check('8.19 stud_to_plate hand[0] nail', ns.joints.stud_to_plate.hand[0].nail, '75x3.15');
check('8.19 stud_to_plate hand[0] qty', ns.joints.stud_to_plate.hand[0].qty, 4);

// Bottom plate external: power 90x3.15 x3 at 600mm
check('8.19 bottom_plate_external power nail', ns.joints.bottom_plate_external.power.nail, '90x3.15');
check('8.19 bottom_plate_external power qty', ns.joints.bottom_plate_external.power.qty, 3);

// Half joint: hand 75x3.15 x3
check('8.19 half_joint hand nail', ns.joints.half_joint_top_plate.hand.nail, '75x3.15');
check('8.19 half_joint hand qty', ns.joints.half_joint_top_plate.hand.qty, 3);

// ---- Consistency checks ----
console.log('\n=== Consistency checks ===');

// Top plates SOT: larger plate should always >= smaller plate for same config
function checkMonotonic(desc, values) {
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== null && values[i-1] !== null && values[i] < values[i-1]) {
      failed++;
      console.log(`FAIL: ${desc} - value[${i}]=${values[i]} < value[${i-1}]=${values[i-1]}`);
      return;
    }
  }
  passed++;
}

// For SOT, plates in order: 70x45 <= 90x45 <= 90x45+90x35
const sot_plates = ['70x45', '90x45', '90x45+90x35'];
checkMonotonic('8.16 SOT plate ordering at anywhere/600/light/600',
  sot_plates.map(p => tp.sot[p].anywhere['600'].light['600']));

// Stud spacing: 300 >= 400 >= 600 for same config
check('8.16 stud ordering: 300 >= 400',
  tp.sot['70x45'].anywhere['900'].light['300'] >= tp.sot['70x45'].anywhere['900'].light['400'], true);
check('8.16 stud ordering: 400 >= 600',
  tp.sot['70x45'].anywhere['900'].light['400'] >= tp.sot['70x45'].anywhere['900'].light['600'], true);

// Light >= Heavy for same config
check('8.16 light >= heavy (70x45/anywhere/600/300)',
  tp.sot['70x45'].anywhere['600'].light['300'] >= tp.sot['70x45'].anywhere['600'].heavy['300'], true);

// ---- Summary ----
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('All spot-checks passed!');
} else {
  process.exit(1);
}
