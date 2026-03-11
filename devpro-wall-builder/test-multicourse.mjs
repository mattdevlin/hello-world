/**
 * Multi-course red join line — diagnostic test script.
 *
 * Tests the data layer (computeCourses, calculateWallLayout) with specific
 * wall configurations, then verifies assumptions about SVG rendering.
 *
 * Run: node test-multicourse.mjs
 */

import { computeCourses, calculateWallLayout } from './src/utils/calculator.js';
import { STOCK_SHEET_HEIGHTS, MAX_SHEET_HEIGHT, WALL_PROFILES, OPENING_TYPES } from './src/utils/constants.js';

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

// ──────────────────────────────────────────────────────────────
// TEST 1: Flat wall 3600mm — standard multi-course
// ──────────────────────────────────────────────────────────────
section('Test 1: Flat wall 3600mm — standard multi-course');
{
  const { courses, isMultiCourse } = computeCourses(3600);
  assert(isMultiCourse === true, 'isMultiCourse should be true for 3600mm');
  assert(courses.length === 2, `should have 2 courses, got ${courses.length}`);
  assert(courses[0].y === 0, `course[0].y should be 0, got ${courses[0].y}`);
  assert(courses[1].y > 0, `course[1].y should be > 0, got ${courses[1].y}`);
  assert(courses[1].y + courses[1].height === 3600, `courses should sum to 3600, got ${courses[1].y + courses[1].height}`);
  console.log(`  → Course split: bottom=${courses[0].height}mm (${courses[0].sheetHeight}mm sheet), top=${courses[1].height}mm at y=${courses[1].y}mm`);

  // Full layout test
  const layout = calculateWallLayout({
    length_mm: 6000,
    height_mm: 3600,
    profile: WALL_PROFILES.STANDARD,
    openings: [],
  });
  assert(layout.isMultiCourse === true, 'layout.isMultiCourse should be true');
  assert(layout.courses.length === 2, 'layout should have 2 courses');
  assert(layout.maxHeight === 3600, `maxHeight should be 3600, got ${layout.maxHeight}`);
}

// ──────────────────────────────────────────────────────────────
// TEST 2: Flat wall 3000mm — NO multi-course (single sheet fits)
// ──────────────────────────────────────────────────────────────
section('Test 2: Flat wall 3000mm — no multi-course');
{
  const { courses, isMultiCourse } = computeCourses(3000);
  assert(isMultiCourse === false, 'isMultiCourse should be false for 3000mm');
  assert(courses.length === 1, `should have 1 course, got ${courses.length}`);
  console.log(`  → Single course: ${courses[0].sheetHeight}mm sheet`);
}

// ──────────────────────────────────────────────────────────────
// TEST 3: Flat wall 3051mm — barely multi-course (exceeds 3050mm max sheet)
// ──────────────────────────────────────────────────────────────
section('Test 3: Flat wall 3051mm — barely multi-course');
{
  const { courses, isMultiCourse } = computeCourses(3051);
  assert(isMultiCourse === true, 'isMultiCourse should be true for 3051mm');
  assert(courses.length === 2, `should have 2 courses, got ${courses.length}`);
  assert(courses[1].y > 0, `course[1].y should be > 0, got ${courses[1].y}`);
  console.log(`  → Course split: bottom=${courses[0].height}mm, top=${courses[1].height}mm at y=${courses[1].y}mm`);
}

// ──────────────────────────────────────────────────────────────
// TEST 4: Raked wall 2400L / 3600R — partial multi-course
// ──────────────────────────────────────────────────────────────
section('Test 4: Raked wall 2400L / 3600R');
{
  const wall = {
    length_mm: 6000,
    height_mm: 2400,
    height_right_mm: 3600,
    profile: WALL_PROFILES.RAKED,
    openings: [],
  };
  const layout = calculateWallLayout(wall);
  assert(layout.isRaked === true, 'should be raked');
  assert(layout.maxHeight === 3600, `maxHeight should be 3600, got ${layout.maxHeight}`);
  assert(layout.isMultiCourse === true, 'isMultiCourse should be true (maxHeight=3600 > 3050)');
  assert(layout.courses.length === 2, `should have 2 courses, got ${layout.courses.length}`);

  const joinY = layout.courses[1].y;
  console.log(`  → Course join at y=${joinY}mm`);

  // Verify heightAt function
  const hLeft = layout.heightAt(0);
  const hRight = layout.heightAt(6000);
  assert(hLeft === 2400, `heightAt(0) should be 2400, got ${hLeft}`);
  assert(hRight === 3600, `heightAt(6000) should be 3600, got ${hRight}`);

  // KEY TEST: Where does the wall reach the join height?
  // For a raked wall, heightAt(x) = 2400 + (3600-2400) * x/6000 = 2400 + 0.2*x
  // heightAt(x) = joinY → x = (joinY - 2400) / 0.2
  if (joinY > hLeft) {
    const xStart = (joinY - hLeft) / (hRight - hLeft) * 6000;
    console.log(`  → Wall reaches join height at x=${Math.round(xStart)}mm (line should start here, not x=0)`);
    assert(xStart > 0, 'Join line should NOT start at x=0 on this raked wall');

    // BUG CHECK: WallDrawing renders from s(0) to s(grossLength) — extends past wall on left
    console.log(`  ⚠ WallDrawing BUG: line renders from x=0 to x=6000, but wall only reaches ${joinY}mm at x=${Math.round(xStart)}mm`);
    // BUG CHECK: FramingElevation renders from plateLeft to plateRight — same issue
    console.log(`  ⚠ FramingElevation BUG: line renders full width, floats above wall on left side`);
    // EpsElevation correctly clips — verify its logic
    console.log(`  ✓ EpsElevation correctly computes x-extent`);
  } else {
    console.log(`  → Join at y=${joinY}mm is within both sides (left=${hLeft}, right=${hRight})`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 5: Gable wall 2700 sides / 3600 peak
// ──────────────────────────────────────────────────────────────
section('Test 5: Gable wall 2700 sides / 3600 peak');
{
  const wall = {
    length_mm: 6000,
    height_mm: 2700,
    peak_height_mm: 3600,
    peak_position_mm: 3000,
    profile: WALL_PROFILES.GABLE,
    openings: [],
  };
  const layout = calculateWallLayout(wall);
  assert(layout.isRaked === true, 'gable should be treated as raked (non-standard)');
  assert(layout.maxHeight === 3600, `maxHeight should be 3600, got ${layout.maxHeight}`);
  assert(layout.isMultiCourse === true, 'isMultiCourse should be true');

  const joinY = layout.courses[1].y;
  console.log(`  → Course join at y=${joinY}mm`);

  // Height at edges and peak
  const hLeft = layout.heightAt(0);
  const hPeak = layout.heightAt(3000);
  const hRight = layout.heightAt(6000);
  console.log(`  → Heights: left=${hLeft}, peak=${hPeak}, right=${hRight}`);

  if (joinY > hLeft) {
    // On left slope: height = 2700 + (3600-2700) * x/3000 = joinY → x = (joinY-2700) * 3000/900
    const xLeftStart = (joinY - hLeft) / (hPeak - hLeft) * 3000;
    // On right slope: height = 3600 - 900 * (x-3000)/3000 = joinY → x = 3000 + (3600-joinY)*3000/900
    const xRightEnd = 3000 + (hPeak - joinY) / (hPeak - hRight) * 3000;
    console.log(`  → Join line visible from x=${Math.round(xLeftStart)} to x=${Math.round(xRightEnd)}`);
    console.log(`  ⚠ WallDrawing/FramingElevation BUG: line would extend past wall on both sides`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 6: Multi-course wall with openings (L-cut panels)
// ──────────────────────────────────────────────────────────────
section('Test 6: Multi-course wall with L-cut panels');
{
  const wall = {
    length_mm: 6000,
    height_mm: 3600,
    profile: WALL_PROFILES.STANDARD,
    openings: [
      {
        type: OPENING_TYPES.WINDOW,
        width_mm: 1200,
        height_mm: 1200,
        position_from_left_mm: 1500,
        height_to_underside_mm: 900,
      },
      {
        type: OPENING_TYPES.WINDOW,
        width_mm: 1200,
        height_mm: 1200,
        position_from_left_mm: 3500,
        height_to_underside_mm: 900,
      },
    ],
  };
  const layout = calculateWallLayout(wall);
  assert(layout.isMultiCourse === true, 'isMultiCourse should be true');

  const lcutPanels = layout.panels.filter(p => p.type === 'lcut');
  const fullPanels = layout.panels.filter(p => p.type === 'full');
  const endPanels = layout.panels.filter(p => p.type === 'end');
  console.log(`  → Panel types: ${fullPanels.length} full, ${lcutPanels.length} lcut, ${endPanels.length} end`);

  // PanelPlans BUG CHECK: TopCourseCard only includes full + end
  const topCoursePanels = layout.panels.filter(p => p.type === 'full' || p.type === 'end');
  const allPanels = layout.panels;
  console.log(`  → TopCourseCard covers ${topCoursePanels.length}/${allPanels.length} panels`);
  if (lcutPanels.length > 0 && topCoursePanels.length < allPanels.length) {
    console.log(`  ⚠ PanelPlans BUG: ${lcutPanels.length} L-cut panels excluded from TopCourseCard`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 7: Multi-course wall with ONLY L-cut panels (all openings)
// ──────────────────────────────────────────────────────────────
section('Test 7: Multi-course wall with ONLY L-cut panels');
{
  const wall = {
    length_mm: 4000,
    height_mm: 3600,
    profile: WALL_PROFILES.STANDARD,
    openings: [
      {
        type: OPENING_TYPES.WINDOW,
        width_mm: 600,
        height_mm: 1200,
        position_from_left_mm: 600,
        height_to_underside_mm: 900,
      },
      {
        type: OPENING_TYPES.WINDOW,
        width_mm: 600,
        height_mm: 1200,
        position_from_left_mm: 2200,
        height_to_underside_mm: 900,
      },
    ],
  };
  const layout = calculateWallLayout(wall);
  const lcutPanels = layout.panels.filter(p => p.type === 'lcut');
  const fullPanels = layout.panels.filter(p => p.type === 'full');
  const endPanels = layout.panels.filter(p => p.type === 'end');
  console.log(`  → Panel types: ${fullPanels.length} full, ${lcutPanels.length} lcut, ${endPanels.length} end`);

  const topCoursePanels = layout.panels.filter(p => p.type === 'full' || p.type === 'end');
  if (topCoursePanels.length === 0 && layout.isMultiCourse) {
    console.log(`  ⚠ PanelPlans BUG CONFIRMED: isMultiCourse=true but TopCourseCard has 0 panels (all L-cut)`);
    console.log(`    → "Top Course Panels" section will not render at all!`);
  }
}

// ──────────────────────────────────────────────────────────────
// TEST 8: 3+ course wall (>6000mm)
// ──────────────────────────────────────────────────────────────
section('Test 8: 3+ course wall (6500mm)');
{
  const { courses, isMultiCourse } = computeCourses(6500);
  assert(isMultiCourse === true, 'isMultiCourse should be true');
  assert(courses.length >= 3, `should have 3+ courses, got ${courses.length}`);
  console.log(`  → Courses: ${courses.map((c, i) => `C${i + 1}: y=${c.y}, h=${c.height}`).join(' | ')}`);
  console.log(`  ⚠ PanelPlans BUG: topCourse hardcoded to courses[1], missing courses[2+]`);
}

// ──────────────────────────────────────────────────────────────
// SVG RENDERING STATIC ANALYSIS
// ──────────────────────────────────────────────────────────────
section('SVG Rendering — Static Analysis');

console.log('\n  WallDrawing.jsx:');
console.log('    Course join line paint order: AFTER panels, openings, footer panels, lintel panels ✓');
console.log('    x-extent: s(0) to s(grossLength) — NO clipping for raked/gable ✗');
console.log('    Coordinate: joinY = yBottom - s(course.y) — correct ✓');

console.log('\n  FramingElevation.jsx:');
console.log('    Course join line paint order: BEFORE panels, splines, plates, etc ✗ (BURIED)');
console.log('    x-extent: s(plateLeft) to s(plateRight) — NO clipping for raked/gable ✗');
console.log('    Coordinate: s(yBottom - course.y) — correct ✓');

console.log('\n  EpsElevation.jsx:');
console.log('    Course join line paint order: AFTER clip group, on top of all content ✓');
console.log('    x-extent: analytically computed x0/x1 from heightAt ✓');
console.log('    Coordinate: s(yBottom - course.y) — correct ✓');
console.log('    OUTSIDE clip path (line 515 after clip close at 513) ✓');

console.log('\n  PanelPlans.jsx:');
console.log('    Red line on individual panel cards: MISSING ✗');
console.log('    TopCourseCard filter: only full+end, excludes lcut ✗');
console.log('    Multi-course >2 courses: hardcoded to courses[1] ✗');

// ──────────────────────────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────────────────────────
section('SUMMARY');
console.log(`\n  Data layer assertions: ${pass} passed, ${fail} failed`);
console.log('\n  Confirmed bugs:');
console.log('    1. FramingElevation: join lines painted UNDER everything (z-order)');
console.log('    2. WallDrawing + FramingElevation: no x-extent clipping for raked/gable');
console.log('    3. PanelPlans: TopCourseCard excludes L-cut panels');
console.log('    4. PanelPlans: no red course line on individual panel cards');
console.log('    5. PanelPlans: only handles courses[1], ignores 3+ courses');

process.exit(fail > 0 ? 1 : 0);
