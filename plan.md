# Multi-Course Red Line Debug Plan

## The Bug Pattern

**Works (red line shows):**
| Left | Right | maxHeight | > 3000? |
|------|-------|-----------|---------|
| 3001 | 4000  | 4000      | YES     |
| 4000 | 4000  | 4000      | YES     |
| 4000 | 3000  | 4000      | YES     |
| 6050 | 2000  | 6050      | YES     |

**Broken (no red line):**
| Left | Right | maxHeight | > 3000? |
|------|-------|-----------|---------|
| 3000 | 3100  | 3100*     | YES*    |
| 2400 | 6100  | 6100*     | YES*    |

*Only if the wall profile is set to RAKED. If profile is STANDARD, `height_right_mm` is completely ignored.

---

## Root Cause Candidates (in order of likelihood)

### 1. Profile is STANDARD — `height_right_mm` is silently ignored
**File:** `src/utils/calculator.js:22-46`

`buildHeightFn()` only uses `height_right_mm` when `profile === WALL_PROFILES.RAKED`. For STANDARD walls, `heightAt()` always returns `wall.height_mm` regardless of any right-side value. So:

- STANDARD wall, height_mm=3000 → `maxHeight = 3000` → `computeCourses(3000)` → **`3000 <= 3000` → single course, NO red line**
- STANDARD wall, height_mm=2400 → `maxHeight = 2400` → single course, NO red line

The form only shows the "Height Right" input when profile is RAKED (line 140), so if the user sees two height fields, they must be on RAKED. **But if they're describing desired heights without actually switching to RAKED profile, that's the issue.**

### 2. Boundary condition: `<=` vs `<` in computeCourses
**File:** `src/utils/calculator.js:56`

```js
if (wallHeight <= MAX_SHEET_HEIGHT)  // MAX_SHEET_HEIGHT = 3000
```

A wall at exactly 3000mm is treated as single course. This means:
- 3000mm → NO multi-course (single 3000mm sheet covers it)
- 3001mm → YES multi-course

This is actually **correct behavior** — a 3000mm sheet can cover a 3000mm wall. But it explains why 3001 works and 3000 doesn't.

### 3. The `heightAt` x-extent math could clip the line to zero width
**File:** `src/components/WallDrawing.jsx:210-220`

The interpolation formula:
```js
x0 = (course.y - hL) / (hR - hL) * grossLength
```

If `hR === hL` (division by zero), this would produce NaN. For a "flat" raked wall (3000/3000), this path isn't hit because both sides pass the `>=` check. But edge cases near the boundary could produce a line that's essentially zero-width.

---

## Debug Steps

### Step 1: Add console logging to `computeCourses`
Add temporary logs at the entry of `computeCourses()` and at the return points to see:
- What `wallHeight` value is actually passed in
- Whether `isMultiCourse` comes back true/false
- What `courses` array looks like

### Step 2: Add console logging to `calculateWallLayout`
Log `maxHeight`, `height`, `heightRight`, `profile`, and `wall.height_right_mm` to confirm:
- Is the profile actually RAKED?
- Is `height_right_mm` populated?
- Does `maxHeight` exceed 3000?

### Step 3: Add console logging to WallDrawing course-join rendering
At line 204 in WallDrawing.jsx, log:
- `isMultiCourse` value
- `courses` array
- `hL`, `hR`, `course.y` for each course
- Computed `x0`, `x1` values

### Step 4: Test the exact failing inputs
With logging in place, enter:
- left: 3000, right: 3100 (RAKED profile)
- left: 2400, right: 6100 (RAKED profile)
Check console output to see where the chain breaks.

### Step 5: Fix based on findings
Most likely fix: ensure the profile is RAKED when two heights differ, OR add a UI hint that tells the user to switch to RAKED profile when they want different left/right heights.
