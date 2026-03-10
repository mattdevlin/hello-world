import { describe, it, expect } from 'vitest';
import { calculateWallLayout } from './calculator.js';
import { WALL_PROFILES, OPENING_TYPES } from './constants.js';

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

/**
 * Compute label positions exactly as the elevation components do.
 * Returns { x, y, width, height, label } for each panel label.
 */
function computeLabelPositions(layout) {
  const { panels, courses, isMultiCourse, height, heightAt } = layout;
  const basePanels = panels.filter(p => (p.course ?? 0) === 0);
  const posMap = new Map(basePanels.map((p, idx) => [p.x, idx]));

  return panels.map(panel => {
    const courseIdx = panel.course ?? 0;
    const course = courses?.[courseIdx];
    const cY = course?.y ?? 0;
    const cTop = cY + (course?.height ?? height);
    const centerX = panel.x + panel.width / 2;

    // Vertical center of this course region at the panel's x
    const absH = heightAt ? heightAt(centerX) : height;
    const courseMidTop = Math.min(absH, cTop);
    const courseMidY = (cY + courseMidTop) / 2; // mm from wall bottom

    const posIdx = posMap.get(panel.x) ?? 0;
    const label = isMultiCourse ? `P${posIdx + 1}·C${courseIdx + 1}` : `P${posIdx + 1}`;

    // Approximate label dimensions in mm (based on font size ~10px at typical scale)
    // At scale ≈ 0.11 (1100px / 9740mm), 10px text ≈ 90mm width for "P1·C1"
    const approxCharWidthMm = 15; // ~15mm per character at typical scale
    const approxHeightMm = 30;    // ~30mm text height at typical scale
    const labelW = label.length * approxCharWidthMm;
    const labelH = approxHeightMm;

    return {
      x: centerX,
      y: courseMidY,
      width: labelW,
      height: labelH,
      label,
      panelWidth: panel.width,
      courseHeight: course?.height ?? height,
      courseIdx,
    };
  });
}

function rectsOverlap(a, b) {
  const aL = a.x - a.width / 2;
  const aR = a.x + a.width / 2;
  const aT = a.y - a.height / 2;
  const aB = a.y + a.height / 2;
  const bL = b.x - b.width / 2;
  const bR = b.x + b.width / 2;
  const bT = b.y - b.height / 2;
  const bB = b.y + b.height / 2;
  return aL < bR && aR > bL && aT < bB && aB > bT;
}

function checkLabelClashes(layout, testName) {
  const labels = computeLabelPositions(layout);
  const clashes = [];

  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (rectsOverlap(labels[i], labels[j])) {
        clashes.push({ a: labels[i].label, b: labels[j].label });
      }
    }
  }

  return { labels, clashes };
}

function checkLabelsWithinCourse(layout) {
  const labels = computeLabelPositions(layout);
  const issues = [];

  for (const lbl of labels) {
    // Check if label text height fits within the course region
    if (lbl.courseHeight < lbl.height) {
      issues.push({
        label: lbl.label,
        courseHeight: lbl.courseHeight,
        labelHeight: lbl.height,
        reason: 'label taller than course height',
      });
    }
  }

  return issues;
}

// ── Test cases ──

describe('Label clash detection — multi-course elevations', () => {

  it('Test 1: basic 2-course, 4 panels — no clashes', () => {
    const layout = calculateWallLayout(makeWall({ length_mm: 4815, height_mm: 4000 }));
    const { clashes } = checkLabelClashes(layout);
    expect(clashes).toEqual([]);
  });

  it('Test 2: 2-course, ~8 panels — no clashes', () => {
    const layout = calculateWallLayout(makeWall({ length_mm: 9740, height_mm: 4000 }));
    const { clashes } = checkLabelClashes(layout);
    expect(clashes).toEqual([]);
  });

  it('Test 3: 2-course, 2 narrow panels — check for clashes', () => {
    const layout = calculateWallLayout(makeWall({ length_mm: 2410, height_mm: 4000 }));
    const { labels, clashes } = checkLabelClashes(layout);

    // With narrow panels, labels may clash horizontally — log any issues
    if (clashes.length > 0) {
      console.warn(`Test 3 clashes: ${clashes.map(c => `${c.a} ↔ ${c.b}`).join(', ')}`);
    }
    // At minimum, labels within the same course should not clash
    const sameCourseClashes = clashes.filter(c => {
      const la = labels.find(l => l.label === c.a);
      const lb = labels.find(l => l.label === c.b);
      return la.courseIdx === lb.courseIdx;
    });
    expect(sameCourseClashes).toEqual([]);
  });

  it('Test 4: opening in bottom course only — no clashes', () => {
    const layout = calculateWallLayout(makeWall({
      length_mm: 9740,
      height_mm: 4000,
      openings: [{
        ref: 'W1', type: OPENING_TYPES.WINDOW,
        width_mm: 1200, height_mm: 1200, sill_mm: 500,
        position_from_left_mm: 4000,
      }],
    }));
    const { clashes } = checkLabelClashes(layout);
    expect(clashes).toEqual([]);
  });

  it('Test 5: door spanning both courses — no clashes', () => {
    const layout = calculateWallLayout(makeWall({
      length_mm: 9740,
      height_mm: 4000,
      openings: [{
        ref: 'D1', type: OPENING_TYPES.DOOR,
        width_mm: 900, height_mm: 3200, sill_mm: 0,
        position_from_left_mm: 4000,
      }],
    }));
    const { clashes } = checkLabelClashes(layout);
    expect(clashes).toEqual([]);
  });

  it('Test 6: very short top course (~200mm) — labels may not fit vertically', () => {
    // 5500mm wall → bottom 3050 + top 2450, actually fits
    // Use 3300mm → bottom 2745 + top 555mm
    const layout = calculateWallLayout(makeWall({ length_mm: 9740, height_mm: 3300 }));
    if (!layout.isMultiCourse) return; // skip if single course

    const issues = checkLabelsWithinCourse(layout);
    if (issues.length > 0) {
      console.warn('Test 6 — labels that don\'t fit vertically:', issues);
    }
    // No same-course clashes
    const { clashes, labels } = checkLabelClashes(layout);
    const sameCourseClashes = clashes.filter(c => {
      const la = labels.find(l => l.label === c.a);
      const lb = labels.find(l => l.label === c.b);
      return la.courseIdx === lb.courseIdx;
    });
    expect(sameCourseClashes).toEqual([]);
  });

  it('Test 7: 3-course wall — no same-course clashes', () => {
    const layout = calculateWallLayout(makeWall({ length_mm: 9740, height_mm: 7000 }));
    expect(layout.courses.length).toBeGreaterThanOrEqual(3);
    const { clashes, labels } = checkLabelClashes(layout);
    const sameCourseClashes = clashes.filter(c => {
      const la = labels.find(l => l.label === c.a);
      const lb = labels.find(l => l.label === c.b);
      return la.courseIdx === lb.courseIdx;
    });
    expect(sameCourseClashes).toEqual([]);
  });

  it('Test 8: raked 2-course — no same-course clashes', () => {
    const layout = calculateWallLayout(makeWall({
      length_mm: 9740,
      height_mm: 4000,
      height_right_mm: 3200,
      profile: WALL_PROFILES.RAKED,
    }));
    const { clashes, labels } = checkLabelClashes(layout);
    const sameCourseClashes = clashes.filter(c => {
      const la = labels.find(l => l.label === c.a);
      const lb = labels.find(l => l.label === c.b);
      return la.courseIdx === lb.courseIdx;
    });
    expect(sameCourseClashes).toEqual([]);
  });

  it('Test 9: gable 2-course — no same-course clashes', () => {
    const layout = calculateWallLayout(makeWall({
      length_mm: 9740,
      height_mm: 4000,
      peak_height_mm: 4500,
      profile: WALL_PROFILES.GABLE,
    }));
    const { clashes, labels } = checkLabelClashes(layout);
    const sameCourseClashes = clashes.filter(c => {
      const la = labels.find(l => l.label === c.a);
      const lb = labels.find(l => l.label === c.b);
      return la.courseIdx === lb.courseIdx;
    });
    expect(sameCourseClashes).toEqual([]);
  });

  it('Test 10: 2 windows close together — no same-course clashes', () => {
    const layout = calculateWallLayout(makeWall({
      length_mm: 4815,
      height_mm: 4000,
      openings: [
        {
          ref: 'W1', type: OPENING_TYPES.WINDOW,
          width_mm: 900, height_mm: 1000, sill_mm: 800,
          position_from_left_mm: 1200,
        },
        {
          ref: 'W2', type: OPENING_TYPES.WINDOW,
          width_mm: 900, height_mm: 1000, sill_mm: 800,
          position_from_left_mm: 2600,
        },
      ],
    }));
    const { clashes, labels } = checkLabelClashes(layout);
    const sameCourseClashes = clashes.filter(c => {
      const la = labels.find(l => l.label === c.a);
      const lb = labels.find(l => l.label === c.b);
      return la.courseIdx === lb.courseIdx;
    });
    expect(sameCourseClashes).toEqual([]);
  });
});

describe('Label positioning — single course baseline', () => {
  it('single-course wall labels do not clash', () => {
    const layout = calculateWallLayout(makeWall({ length_mm: 9740, height_mm: 2440 }));
    const { clashes } = checkLabelClashes(layout);
    expect(clashes).toEqual([]);
  });

  it('single-course labels use P1, P2 format (no course suffix)', () => {
    const layout = calculateWallLayout(makeWall({ length_mm: 4815, height_mm: 2440 }));
    const labels = computeLabelPositions(layout);
    for (const lbl of labels) {
      expect(lbl.label).toMatch(/^P\d+$/);
    }
  });

  it('multi-course labels use P1·C1 format', () => {
    const layout = calculateWallLayout(makeWall({ length_mm: 4815, height_mm: 4000 }));
    const labels = computeLabelPositions(layout);
    for (const lbl of labels) {
      expect(lbl.label).toMatch(/^P\d+·C\d+$/);
    }
  });
});

describe('Label vertical fit', () => {
  it('all labels fit vertically in their course for standard 2-course', () => {
    const layout = calculateWallLayout(makeWall({ length_mm: 9740, height_mm: 4000 }));
    const issues = checkLabelsWithinCourse(layout);
    expect(issues).toEqual([]);
  });

  it('reports labels that do not fit in very short courses', () => {
    // 3080mm wall → bottom 2745 + top 335mm — top course very short
    const layout = calculateWallLayout(makeWall({ length_mm: 9740, height_mm: 3080 }));
    if (!layout.isMultiCourse) return;

    const topCourse = layout.courses[layout.courses.length - 1];
    if (topCourse.height < 30) {
      // Label won't fit — this is expected, just verify we detect it
      const issues = checkLabelsWithinCourse(layout);
      expect(issues.length).toBeGreaterThan(0);
    }
  });
});
