import { describe, it, expect } from 'vitest';
import { calculateWallLayout, computeCourses } from './calculator.js';
import {
  PANEL_WIDTH,
  PANEL_PITCH,
  STOCK_SHEET_HEIGHTS,
  WALL_PROFILES,
  OPENING_TYPES,
} from './constants.js';

// ── Helpers ──

function makeWall(overrides = {}) {
  return {
    length_mm: 9740,
    height_mm: 2440,
    profile: WALL_PROFILES.STANDARD,
    deduction_left_mm: 0,
    deduction_right_mm: 0,
    openings: [],
    ...overrides,
  };
}

// ── computeCourses ──

describe('computeCourses', () => {
  it('returns single course for wall within max sheet height', () => {
    const { courses, isMultiCourse } = computeCourses(2440);
    expect(isMultiCourse).toBe(false);
    expect(courses).toHaveLength(1);
    expect(courses[0].y).toBe(0);
    expect(courses[0].height).toBe(2440);
  });

  it('returns two courses for wall exceeding max sheet height', () => {
    const { courses, isMultiCourse } = computeCourses(4000);
    expect(isMultiCourse).toBe(true);
    expect(courses).toHaveLength(2);
    expect(courses[0].y).toBe(0);
    expect(courses[1].y).toBe(courses[0].height);
    // Total height covered should equal wall height
    const totalH = courses.reduce((sum, c) => sum + c.height, 0);
    expect(totalH).toBe(4000);
  });

  it('returns three courses for very tall wall', () => {
    // 3050 + 3050 = 6100, so a 7000mm wall needs 3 courses
    const { courses, isMultiCourse } = computeCourses(7000);
    expect(isMultiCourse).toBe(true);
    expect(courses.length).toBeGreaterThanOrEqual(3);
    const totalH = courses.reduce((sum, c) => sum + c.height, 0);
    expect(totalH).toBe(7000);
  });
});

// ── Single course (baseline — existing behaviour should not change) ──

describe('calculateWallLayout — single course', () => {
  it('counts panels correctly for a simple wall', () => {
    const wall = makeWall({ length_mm: 9740, height_mm: 2440 });
    const layout = calculateWallLayout(wall);

    expect(layout.isMultiCourse).toBe(false);
    expect(layout.totalPanels).toBe(layout.panels.length);
    expect(layout.totalPanels).toBeGreaterThan(0);
    // All panels should have no course property or course === 0
    layout.panels.forEach(p => {
      expect(p.course ?? 0).toBe(0);
    });
  });

  it('counts L-cut panels around a window', () => {
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 2440,
      openings: [{
        ref: 'W1',
        type: OPENING_TYPES.WINDOW,
        width_mm: 1200,
        height_mm: 1200,
        sill_mm: 900,
        position_from_left_mm: 4000,
      }],
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(false);
    expect(layout.lcutPanels).toBeGreaterThan(0);
    expect(layout.totalPanels).toBe(
      layout.fullPanels + layout.lcutPanels + layout.endPanels
    );
  });
});

// ── Multi-course panel counting (THE FIX) ──

describe('calculateWallLayout — multi-course panel counts', () => {
  it('doubles panel count for a 2-course standard wall with no openings', () => {
    // 4000mm wall → 2 courses (e.g., 2745 + 1255)
    const wall = makeWall({ length_mm: 9740, height_mm: 4000 });
    const layout = calculateWallLayout(wall);

    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses).toHaveLength(2);

    // Single-course version of same wall width for comparison
    const singleCourse = calculateWallLayout(
      makeWall({ length_mm: 9740, height_mm: 2440 })
    );

    // Multi-course should have 2× the panels
    expect(layout.totalPanels).toBe(singleCourse.totalPanels * 2);
  });

  it('triples panel count for a 3-course wall with no openings', () => {
    // 7000mm → 3 courses
    const wall = makeWall({ length_mm: 9740, height_mm: 7000 });
    const layout = calculateWallLayout(wall);

    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses.length).toBeGreaterThanOrEqual(3);

    const singleCourse = calculateWallLayout(
      makeWall({ length_mm: 9740, height_mm: 2440 })
    );

    expect(layout.totalPanels).toBe(
      singleCourse.totalPanels * layout.courses.length
    );
  });

  it('each panel has a course index', () => {
    const wall = makeWall({ length_mm: 9740, height_mm: 4000 });
    const layout = calculateWallLayout(wall);

    // Every panel should have a course property
    layout.panels.forEach(p => {
      expect(p.course).toBeDefined();
      expect(p.course).toBeGreaterThanOrEqual(0);
      expect(p.course).toBeLessThan(layout.courses.length);
    });

    // Should have panels in both course 0 and course 1
    const course0 = layout.panels.filter(p => p.course === 0);
    const course1 = layout.panels.filter(p => p.course === 1);
    expect(course0.length).toBeGreaterThan(0);
    expect(course1.length).toBeGreaterThan(0);
  });

  it('panel y offsets match course positions', () => {
    const wall = makeWall({ length_mm: 9740, height_mm: 4000 });
    const layout = calculateWallLayout(wall);

    for (const panel of layout.panels) {
      const course = layout.courses[panel.course];
      expect(panel.courseY).toBe(course.y);
    }
  });

  it('panel heights match their course heights', () => {
    const wall = makeWall({ length_mm: 4815, height_mm: 4000 });
    const layout = calculateWallLayout(wall);

    const course0Panels = layout.panels.filter(p => p.course === 0);
    const course1Panels = layout.panels.filter(p => p.course === 1);
    const bottomCourse = layout.courses[0];
    const topCourse = layout.courses[1];

    // Bottom course panels should use the bottom course height
    for (const p of course0Panels) {
      expect(p.heightLeft).toBe(bottomCourse.height);
      expect(p.heightRight).toBe(bottomCourse.height);
    }

    // Top course panels should use the top course height
    for (const p of course1Panels) {
      expect(p.heightLeft).toBe(topCourse.height);
      expect(p.heightRight).toBe(topCourse.height);
    }
  });

  it('x positions are the same across courses (no openings)', () => {
    const wall = makeWall({ length_mm: 9740, height_mm: 4000 });
    const layout = calculateWallLayout(wall);

    const course0Xs = layout.panels
      .filter(p => p.course === 0)
      .map(p => p.x)
      .sort((a, b) => a - b);
    const course1Xs = layout.panels
      .filter(p => p.course === 1)
      .map(p => p.x)
      .sort((a, b) => a - b);

    expect(course0Xs).toEqual(course1Xs);
  });

  it('sheetHeight per panel matches its course sheetHeight', () => {
    const wall = makeWall({ length_mm: 4815, height_mm: 4000 });
    const layout = calculateWallLayout(wall);

    for (const panel of layout.panels) {
      const course = layout.courses[panel.course];
      expect(panel.sheetHeight).toBe(course.sheetHeight);
    }
  });

  it('summary counts reflect all courses', () => {
    const wall = makeWall({ length_mm: 9740, height_mm: 4000 });
    const layout = calculateWallLayout(wall);

    expect(layout.totalPanels).toBe(layout.panels.length);
    expect(layout.totalPanels).toBe(
      layout.fullPanels + layout.lcutPanels + layout.endPanels
    );
  });
});

// ── Multi-course with openings ──

describe('calculateWallLayout — multi-course with openings', () => {
  it('opening only in bottom course: top course gets full panels', () => {
    // Window: sill 500, height 1200 → top at 1700mm
    // Course split at ~2745mm → opening is entirely in bottom course
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 4000,
      openings: [{
        ref: 'W1',
        type: OPENING_TYPES.WINDOW,
        width_mm: 1200,
        height_mm: 1200,
        sill_mm: 500,
        position_from_left_mm: 4000,
      }],
    });
    const layout = calculateWallLayout(wall);

    expect(layout.isMultiCourse).toBe(true);

    // Bottom course should have L-cut panels
    const course0Lcuts = layout.panels.filter(
      p => p.course === 0 && p.type === 'lcut'
    );
    expect(course0Lcuts.length).toBeGreaterThan(0);

    // Top course should have NO L-cut panels at the opening position
    // (opening doesn't reach the top course)
    const course1Lcuts = layout.panels.filter(
      p => p.course === 1 && p.type === 'lcut'
    );
    expect(course1Lcuts.length).toBe(0);
  });

  it('door spanning both courses: both courses get L-cuts', () => {
    // Door: sill 0, height 3200mm → spans both courses (split at ~2745)
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 4000,
      openings: [{
        ref: 'D1',
        type: OPENING_TYPES.DOOR,
        width_mm: 900,
        height_mm: 3200,
        sill_mm: 0,
        position_from_left_mm: 4000,
      }],
    });
    const layout = calculateWallLayout(wall);

    expect(layout.isMultiCourse).toBe(true);

    // Both courses should have L-cut panels around the door
    const course0Lcuts = layout.panels.filter(
      p => p.course === 0 && p.type === 'lcut'
    );
    const course1Lcuts = layout.panels.filter(
      p => p.course === 1 && p.type === 'lcut'
    );
    expect(course0Lcuts.length).toBeGreaterThan(0);
    expect(course1Lcuts.length).toBeGreaterThan(0);
  });

  it('total panel count with opening-in-bottom-only exceeds single-course count', () => {
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 4000,
      openings: [{
        ref: 'W1',
        type: OPENING_TYPES.WINDOW,
        width_mm: 1200,
        height_mm: 1200,
        sill_mm: 500,
        position_from_left_mm: 4000,
      }],
    });
    const layout = calculateWallLayout(wall);

    // Should be more panels than the single-course bottom row alone
    const course0Count = layout.panels.filter(p => p.course === 0).length;
    expect(layout.totalPanels).toBeGreaterThan(course0Count);
  });
});

// ── Multi-course raked wall ──

describe('calculateWallLayout — multi-course raked', () => {
  it('counts panels per course for a raked multi-course wall', () => {
    // Left height 4000, right height 3200 — both exceed max sheet
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 4000,
      height_right_mm: 3200,
      profile: WALL_PROFILES.RAKED,
    });
    const layout = calculateWallLayout(wall);

    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses.length).toBeGreaterThanOrEqual(2);

    // Should have panels in multiple courses
    const courseIndices = [...new Set(layout.panels.map(p => p.course))];
    expect(courseIndices.length).toBe(layout.courses.length);
  });
});

// ── Course split height logic ──

describe('computeCourses — preferredBottom parameter', () => {
  it('uses preferredBottom as bottom course height when provided', () => {
    const { courses } = computeCourses(4000, STOCK_SHEET_HEIGHTS, 2745);
    expect(courses[0].height).toBe(2745);
    expect(courses[0].sheetHeight).toBe(2745);
    expect(courses[1].height).toBe(4000 - 2745);
  });

  it('uses 3050 as bottom course when preferred', () => {
    const { courses } = computeCourses(4000, STOCK_SHEET_HEIGHTS, 3050);
    expect(courses[0].height).toBe(3050);
    expect(courses[0].sheetHeight).toBe(3050);
    expect(courses[1].height).toBe(4000 - 3050);
  });

  it('sets sheetHeight to covering stock sheet when preferredBottom is not a stock size', () => {
    // preferredBottom=2700 → sheetHeight should be 2745 (smallest stock sheet ≥ 2700)
    const { courses } = computeCourses(4800, STOCK_SHEET_HEIGHTS, 2700);
    expect(courses[0].height).toBe(2700);
    expect(courses[0].sheetHeight).toBe(2745);
    expect(courses[1].height).toBe(4800 - 2700);
  });

  it('ignores preferredBottom for single-course walls', () => {
    const { courses, isMultiCourse } = computeCourses(2440, STOCK_SHEET_HEIGHTS, 2745);
    expect(isMultiCourse).toBe(false);
    expect(courses).toHaveLength(1);
  });

  it('falls back to waste-minimization when preferredBottom is not provided', () => {
    const { courses } = computeCourses(4000);
    expect(courses).toHaveLength(2);
    // Should still produce a valid split
    expect(courses[0].height + courses[1].height).toBe(4000);
  });
});

describe('calculateWallLayout — course split matches wall geometry', () => {
  it('flat wall: defaults to smaller stock sheet (2745) for bottom course', () => {
    const wall = makeWall({ length_mm: 9740, height_mm: 4000 });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses[0].height).toBe(2745);
    expect(layout.courses[0].sheetHeight).toBe(2745);
  });

  it('flat wall: preferred_sheet_height=3050 uses 3050 for bottom course', () => {
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 4000,
      preferred_sheet_height: 3050,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses[0].height).toBe(3050);
  });

  it('flat wall: preferred_sheet_height=2745 uses 2745 for bottom course', () => {
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 4000,
      preferred_sheet_height: 2745,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses[0].height).toBe(2745);
  });

  it('raked wall: bottom course height = actual lower wall height', () => {
    // Left 4000mm, right 2600mm → lower = 2600 → course height = 2600, sheet = 2745
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 4000,
      height_right_mm: 2600,
      profile: WALL_PROFILES.RAKED,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses[0].height).toBe(2600);
    expect(layout.courses[0].sheetHeight).toBe(2745);
  });

  it('raked wall: lower height 2800 → bottom course height = 2800, sheet = 3050', () => {
    // Left 4000mm, right 2800mm → lower = 2800 → course height = 2800, sheet = 3050
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 4000,
      height_right_mm: 2800,
      profile: WALL_PROFILES.RAKED,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses[0].height).toBe(2800);
    expect(layout.courses[0].sheetHeight).toBe(3050);
  });

  it('raked wall: lower height exceeds all sheets → uses max sheet', () => {
    // Left 7000mm, right 3200mm → lower = 3200 > 3050 → course height = 3200, sheet = 3050 (max)
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 7000,
      height_right_mm: 3200,
      profile: WALL_PROFILES.RAKED,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses[0].height).toBe(3200);
    expect(layout.courses[0].sheetHeight).toBe(3050);
  });

  it('raked wall: preferred_sheet_height overrides auto-detection', () => {
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 4000,
      height_right_mm: 2600,
      profile: WALL_PROFILES.RAKED,
      preferred_sheet_height: 3050,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses[0].height).toBe(3050);
  });

  it('gable wall: bottom course height = actual base wall height', () => {
    // Base 2600mm, peak 4500mm → course height = 2600, sheet = 2745
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 2600,
      peak_height_mm: 4500,
      profile: WALL_PROFILES.GABLE,
    });
    const layout = calculateWallLayout(wall);
    // Only multi-course if maxHeight > 3050
    if (layout.isMultiCourse) {
      expect(layout.courses[0].height).toBe(2600);
      expect(layout.courses[0].sheetHeight).toBe(2745);
    }
  });

  it('gable wall: base 2800, peak 4000 → bottom course = 2800, sheet = 3050', () => {
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 2800,
      peak_height_mm: 4000,
      profile: WALL_PROFILES.GABLE,
    });
    const layout = calculateWallLayout(wall);
    if (layout.isMultiCourse) {
      expect(layout.courses[0].height).toBe(2800);
      expect(layout.courses[0].sheetHeight).toBe(3050);
    }
  });

  it('single-course wall is unaffected by preferred_sheet_height', () => {
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 2440,
      preferred_sheet_height: 3050,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(false);
  });
});

// ── Raked wall panel shapes — lower height below course split ──

describe('calculateWallLayout — raked/gable wall panel clipping', () => {
  it('raked: no C2 panels where wall height is below the course split', () => {
    // 5100mm × 3229–2400mm raked → course split at 2400 (lower wall height)
    const wall = makeWall({
      length_mm: 5100,
      height_mm: 3229,
      height_right_mm: 2400,
      profile: WALL_PROFILES.RAKED,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses[0].height).toBe(2400);

    const courseSplit = layout.courses[0].height;

    // Every C2 panel must have at least one edge with positive height
    const c2Panels = layout.panels.filter(p => p.course === 1);
    for (const panel of c2Panels) {
      const wallHL = layout.heightAt(panel.x);
      const wallHR = layout.heightAt(panel.x + panel.width);
      // At least one edge must be above the course split
      expect(Math.max(wallHL, wallHR)).toBeGreaterThan(courseSplit);
    }
  });

  it('raked: C1 panel heights are clipped to actual wall height', () => {
    // 5100mm × 3229–2400mm raked → course split at 2400
    const wall = makeWall({
      length_mm: 5100,
      height_mm: 3229,
      height_right_mm: 2400,
      profile: WALL_PROFILES.RAKED,
    });
    const layout = calculateWallLayout(wall);
    const courseSplit = layout.courses[0].height;

    const c1Panels = layout.panels.filter(p => p.course === 0);
    for (const panel of c1Panels) {
      const wallHL = Math.round(layout.heightAt(panel.x));
      const wallHR = Math.round(layout.heightAt(panel.x + panel.width));
      // Panel heightLeft should not exceed the actual wall height at that edge
      expect(panel.heightLeft).toBeLessThanOrEqual(wallHL);
      expect(panel.heightRight).toBeLessThanOrEqual(wallHR);
      // Panel heights should also not exceed course height
      expect(panel.heightLeft).toBeLessThanOrEqual(courseSplit);
      expect(panel.heightRight).toBeLessThanOrEqual(courseSplit);
    }
  });

  it('raked: C2 panels have non-negative heights at both edges', () => {
    const wall = makeWall({
      length_mm: 9740,
      height_mm: 4000,
      height_right_mm: 2600,
      profile: WALL_PROFILES.RAKED,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);

    for (const panel of layout.panels) {
      expect(panel.heightLeft).toBeGreaterThanOrEqual(0);
      expect(panel.heightRight).toBeGreaterThanOrEqual(0);
      // At least one edge must be positive (zero-height panels are filtered)
      expect(Math.max(panel.heightLeft, panel.heightRight)).toBeGreaterThan(0);
    }
  });

  it('raked: no panels have heightLeft > course height or heightRight > course height', () => {
    const wall = makeWall({
      length_mm: 5100,
      height_mm: 3229,
      height_right_mm: 2400,
      profile: WALL_PROFILES.RAKED,
    });
    const layout = calculateWallLayout(wall);

    for (const panel of layout.panels) {
      const course = layout.courses[panel.course];
      expect(panel.heightLeft).toBeLessThanOrEqual(course.height);
      expect(panel.heightRight).toBeLessThanOrEqual(course.height);
    }
  });

  it('gable: course split at base height, no C2 slivers at edges', () => {
    // Base 2700mm, peak 4800mm → course split at 2700 (base height)
    const wall = makeWall({
      length_mm: 7200,
      height_mm: 2700,
      peak_height_mm: 4800,
      profile: WALL_PROFILES.GABLE,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);
    expect(layout.courses[0].height).toBe(2700);
    expect(layout.courses[0].sheetHeight).toBe(2745);

    const courseSplit = layout.courses[0].height;

    // C2 panels should only exist where wall is above the base height
    const c2Panels = layout.panels.filter(p => p.course === 1);
    for (const panel of c2Panels) {
      const wallHL = layout.heightAt(panel.x);
      const wallHR = layout.heightAt(panel.x + panel.width);
      expect(Math.max(wallHL, wallHR)).toBeGreaterThan(courseSplit);
    }

    // C1 panels should not exceed base height
    const c1Panels = layout.panels.filter(p => p.course === 0);
    for (const panel of c1Panels) {
      expect(panel.heightLeft).toBeLessThanOrEqual(courseSplit);
      expect(panel.heightRight).toBeLessThanOrEqual(courseSplit);
    }
  });

  it('gable: hspline position matches base height, not stock sheet height', () => {
    const wall = makeWall({
      length_mm: 7200,
      height_mm: 2700,
      peak_height_mm: 4800,
      profile: WALL_PROFILES.GABLE,
    });
    const layout = calculateWallLayout(wall);
    expect(layout.isMultiCourse).toBe(true);

    // Course join (C2 start) should be at base height
    expect(layout.courses[1].y).toBe(2700);
    // Sheet height should be the covering stock sheet
    expect(layout.courses[0].sheetHeight).toBe(2745);
  });
});
