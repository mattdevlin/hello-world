/**
 * Test: maxHeight calculation for RAKED walls where left <= 3000 and right > 3000.
 *
 * Verifies that computeCourses receives the correct maxHeight and triggers
 * multi-course when the RIGHT side exceeds MAX_SHEET_HEIGHT (3000mm),
 * even if the LEFT side does not.
 *
 * Run: node test-maxheight-raked.mjs
 */

import { computeCourses, calculateWallLayout } from './src/utils/calculator.js';
import { WALL_PROFILES } from './src/utils/constants.js';

let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function section(title) {
  console.log(`\n═══ ${title} ═══`);
}

// ── Test cases: RAKED walls where left <= 3000, right > 3000 ──

section('RAKED left=3000, right=3100');
{
  const wall = {
    length_mm: 4000,
    height_mm: 3000,
    height_right_mm: 3100,
    profile: WALL_PROFILES.RAKED,
    openings: [],
    deduction_left_mm: 0,
    deduction_right_mm: 0,
  };
  const layout = calculateWallLayout(wall);

  console.log('  height:', layout.height);
  console.log('  maxHeight:', layout.maxHeight);
  console.log('  heightLeft:', layout.heightLeft);
  console.log('  heightRight:', layout.heightRight);
  console.log('  isMultiCourse:', layout.isMultiCourse);
  console.log('  courses:', JSON.stringify(layout.courses));

  assert(layout.maxHeight === 3100, `maxHeight should be 3100, got ${layout.maxHeight}`);
  assert(layout.isMultiCourse === true, `isMultiCourse should be true, got ${layout.isMultiCourse}`);
  assert(layout.courses.length >= 2, `should have >= 2 courses, got ${layout.courses.length}`);

  // Verify heightAt function returns correct values
  if (layout.heightAt) {
    const hL = layout.heightAt(0);
    const hR = layout.heightAt(wall.length_mm);
    console.log('  heightAt(0):', hL);
    console.log('  heightAt(grossLength):', hR);
    assert(hL === 3000, `heightAt(0) should be 3000, got ${hL}`);
    assert(hR === 3100, `heightAt(grossLength) should be 3100, got ${hR}`);

    // Verify red line x-extent calculation for course[1]
    const course = layout.courses[1];
    if (course) {
      const bothReach = hL >= course.y && hR >= course.y;
      console.log('  course[1].y:', course.y);
      console.log('  hL >= course.y:', hL >= course.y);
      console.log('  hR >= course.y:', hR >= course.y);
      assert(bothReach, `both sides should reach course.y=${course.y} (hL=${hL}, hR=${hR})`);
    }
  }
}

section('RAKED left=2400, right=6100');
{
  const wall = {
    length_mm: 4000,
    height_mm: 2400,
    height_right_mm: 6100,
    profile: WALL_PROFILES.RAKED,
    openings: [],
    deduction_left_mm: 0,
    deduction_right_mm: 0,
  };
  const layout = calculateWallLayout(wall);

  console.log('  height:', layout.height);
  console.log('  maxHeight:', layout.maxHeight);
  console.log('  heightLeft:', layout.heightLeft);
  console.log('  heightRight:', layout.heightRight);
  console.log('  isMultiCourse:', layout.isMultiCourse);
  console.log('  courses:', JSON.stringify(layout.courses));

  assert(layout.maxHeight === 6100, `maxHeight should be 6100, got ${layout.maxHeight}`);
  assert(layout.isMultiCourse === true, `isMultiCourse should be true, got ${layout.isMultiCourse}`);
  assert(layout.courses.length >= 2, `should have >= 2 courses, got ${layout.courses.length}`);

  // Verify heightAt
  if (layout.heightAt) {
    const hL = layout.heightAt(0);
    const hR = layout.heightAt(wall.length_mm);
    console.log('  heightAt(0):', hL);
    console.log('  heightAt(grossLength):', hR);
    assert(hL === 2400, `heightAt(0) should be 2400, got ${hL}`);
    assert(hR === 6100, `heightAt(grossLength) should be 6100, got ${hR}`);

    // Check each course join line x-extent
    layout.courses.slice(1).forEach((course, i) => {
      const reachL = hL >= course.y;
      const reachR = hR >= course.y;
      let x0, x1;
      if (reachL && reachR) {
        x0 = 0; x1 = wall.length_mm;
      } else if (reachL) {
        x0 = 0; x1 = (course.y - hL) / (hR - hL) * wall.length_mm;
      } else if (reachR) {
        x0 = (course.y - hL) / (hR - hL) * wall.length_mm;
        x1 = wall.length_mm;
      } else {
        x0 = null; x1 = null;
      }
      console.log(`  course[${i+1}] y=${course.y}: x0=${x0?.toFixed(0)}, x1=${x1?.toFixed(0)}, reachL=${reachL}, reachR=${reachR}`);
      assert(x0 !== null && x1 !== null, `course[${i+1}] at y=${course.y} should have a visible red line`);
      assert(x1 > x0, `course[${i+1}] line width should be > 0 (x0=${x0}, x1=${x1})`);
    });
  }
}

// ── Control cases that DO work (sanity check) ──

section('RAKED left=3001, right=4000 (known working)');
{
  const wall = {
    length_mm: 4000,
    height_mm: 3001,
    height_right_mm: 4000,
    profile: WALL_PROFILES.RAKED,
    openings: [],
    deduction_left_mm: 0,
    deduction_right_mm: 0,
  };
  const layout = calculateWallLayout(wall);

  console.log('  maxHeight:', layout.maxHeight);
  console.log('  isMultiCourse:', layout.isMultiCourse);
  console.log('  courses:', JSON.stringify(layout.courses));

  assert(layout.maxHeight === 4000, `maxHeight should be 4000, got ${layout.maxHeight}`);
  assert(layout.isMultiCourse === true, `isMultiCourse should be true`);
}

section('RAKED left=4000, right=3000 (known working)');
{
  const wall = {
    length_mm: 4000,
    height_mm: 4000,
    height_right_mm: 3000,
    profile: WALL_PROFILES.RAKED,
    openings: [],
    deduction_left_mm: 0,
    deduction_right_mm: 0,
  };
  const layout = calculateWallLayout(wall);

  console.log('  maxHeight:', layout.maxHeight);
  console.log('  isMultiCourse:', layout.isMultiCourse);
  console.log('  courses:', JSON.stringify(layout.courses));

  assert(layout.maxHeight === 4000, `maxHeight should be 4000, got ${layout.maxHeight}`);
  assert(layout.isMultiCourse === true, `isMultiCourse should be true`);
}

// ── Summary ──
console.log(`\n${'═'.repeat(40)}`);
console.log(`Results: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('❌ SOME TESTS FAILED — see above');
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED');
}
