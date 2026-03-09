# Plan: Fix RAKED wall multi-course red join lines

## Problem
RAKED walls with left ≤ 3000 and right > 3000 don't show red dashed course join lines, even though `test-maxheight-raked.mjs` proves the calculator returns correct data.

## What We Know
- **Calculator is correct** — `maxHeight`, `isMultiCourse`, `courses`, `heightAt` all verified by tests (19/19 pass)
- **React setState-during-render bug** — `WallForm.updateWall` calls `onChange()` inside `setWall` updater. Fix committed but not yet verified in browser.
- **Debug logs not appearing** — User's machine was on wrong branch. Now switched to `claude/review-code-6FROK`. Needs dev server restart.

## Steps

### Step 1: Restart dev server and verify debug logs work
User restarts via desktop icon (`.bat` now auto-detects branch). Confirm:
- React setState warning is gone (fix is in WallForm.jsx)
- `[DEBUG]` logs appear in console on Generate or wall load

### Step 2: Reproduce and capture console output
Test with Raked left=2400, right=3639. Check:
- `[DEBUG handleCalculate] wall:` — Is `height_right_mm` correct?
- `[DEBUG handleCalculate] layout:` — Is `isMultiCourse: true`?
- `[DEBUG WallDrawing]` — Does component receive correct data?

### Step 3: Fix based on findings

**Most likely cause A: `height_right_mm` not in wall state when profile changes**
- `WallForm.jsx:151` shows `wall.height_right_mm || wall.height_mm` as display value
- But when switching to RAKED, `height_right_mm` may still be undefined in state
- Fix: In profile change handler, explicitly set `height_right_mm` to `wall.height_mm` when switching to RAKED

**Most likely cause B: `heightAt` function lost during React state update**
- `calculateWallLayout` returns `heightAt` as a function in the layout object
- If React serializes/loses the function reference, WallDrawing falls back to `height` (left height only)
- Fix: Reconstruct `heightAt` in WallDrawing from `layout.heightLeft`/`heightRight`/`grossLength`

### Step 4: Remove debug console.logs
Clean up `[DEBUG]` lines from `WallBuilderPage.jsx` and `WallDrawing.jsx`.

### Step 5: Test and verify
- `node test-maxheight-raked.mjs` — no regressions
- Visual verification in browser with left=2400/right=3639 and left=3000/right=3100
