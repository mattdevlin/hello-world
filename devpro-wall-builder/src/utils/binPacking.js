/**
 * Shared shelf-based 2D bin packing with rotation.
 *
 * Used by epsOptimizer.js and magboardOptimizer.js to pack rectangular pieces
 * onto fixed-size slabs/sheets.
 */

// ── Sort strategies for multi-strategy packing ──

const SORT_STRATEGIES = [
  // Original: tallest dimension descending
  (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height),
  // By area descending
  (a, b) => (b.width * b.height) - (a.width * a.height),
  // By shorter dimension descending (groups similar shelf heights)
  (a, b) => Math.min(b.width, b.height) - Math.min(a.width, a.height),
  // By shorter dimension ascending (small shelves first, leaves room for tall ones)
  (a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height),
  // By longer dimension descending, then shorter descending
  (a, b) => {
    const d = Math.max(b.width, b.height) - Math.max(a.width, a.height);
    return d !== 0 ? d : Math.min(b.width, b.height) - Math.min(a.width, a.height);
  },
];

/**
 * Best-fit shelf packing for a given sort order.
 * Instead of first-fit, evaluates all placement options and picks the one
 * that wastes the least space (tightest width fit on existing shelves,
 * then tightest height fit for new shelves).
 */
function shelfPackSorted(sorted, slabW, slabH) {
  const slabs = [];

  for (const piece of sorted) {
    const orients = [{ w: piece.width, h: piece.height }];
    if (piece.width !== piece.height) {
      orients.push({ w: piece.height, h: piece.width });
    }

    // Find the best placement across all slabs, shelves, and orientations
    let bestScore = Infinity;
    let bestAction = null;

    for (const o of orients) {
      if (o.w > slabW || o.h > slabH) continue;

      for (let si = 0; si < slabs.length; si++) {
        const slab = slabs[si];

        // Try existing shelves — score by wasted width (lower = tighter fit)
        for (let shi = 0; shi < slab.shelves.length; shi++) {
          const shelf = slab.shelves[shi];
          if (shelf.remainingW >= o.w && shelf.h >= o.h) {
            // Score: remaining width after placing + wasted shelf height
            const score = (shelf.remainingW - o.w) + (shelf.h - o.h) * 0.5;
            if (score < bestScore) {
              bestScore = score;
              bestAction = { type: 'shelf', si, shi, o };
            }
          }
        }

        // Try new shelf on this slab — score by remaining slab height
        const usedH = slab.shelves.reduce((s, sh) => s + sh.h, 0);
        const remainH = slabH - usedH;
        if (remainH >= o.h) {
          // Prefer slabs with least remaining height (fills them up)
          const score = remainH - o.h + 1000; // +1000 to prefer existing shelves
          if (score < bestScore) {
            bestScore = score;
            bestAction = { type: 'newShelf', si, o };
          }
        }
      }
    }

    if (bestAction) {
      const { o } = bestAction;
      if (bestAction.type === 'shelf') {
        const shelf = slabs[bestAction.si].shelves[bestAction.shi];
        shelf.pieces.push({ ...piece, placedW: o.w, placedH: o.h });
        shelf.remainingW -= o.w;
      } else {
        slabs[bestAction.si].shelves.push({
          h: o.h,
          remainingW: slabW - o.w,
          pieces: [{ ...piece, placedW: o.w, placedH: o.h }],
        });
      }
    } else {
      // Open a new slab — pick orientation with smallest shelf height
      const validOrients = orients.filter(o => o.w <= slabW && o.h <= slabH);
      validOrients.sort((a, b) => a.h - b.h);
      const o = validOrients[0] || orients[0];
      slabs.push({
        shelves: [{
          h: o.h,
          remainingW: slabW - o.w,
          pieces: [{ ...piece, placedW: o.w, placedH: o.h }],
        }],
      });
    }
  }

  return slabs;
}

/**
 * Pack rectangular pieces onto slabs using best-fit shelf algorithm with rotation.
 * Tries multiple sort strategies and returns the result with fewest slabs.
 *
 * @param {Array} pieces - {width, height, ...}
 * @param {number} slabW - slab/sheet width
 * @param {number} slabH - slab/sheet height
 * @returns {Array} slabs, each { shelves: [{h, remainingW, pieces}] }
 */
export function shelfPack(pieces, slabW, slabH) {
  if (pieces.length === 0) return [];

  let bestResult = null;
  let bestSlabCount = Infinity;

  for (const sortFn of SORT_STRATEGIES) {
    const sorted = [...pieces].sort(sortFn);
    const result = shelfPackSorted(sorted, slabW, slabH);
    if (result.length < bestSlabCount) {
      bestSlabCount = result.length;
      bestResult = result;
    }
  }

  return bestResult;
}

/**
 * Compute EPS segments within a panel's horizontal span, excluding zones
 * where timber framing, splines, openings, or lintel panels prevent EPS placement.
 *
 * @param {number} panelLeft - left edge of panel
 * @param {number} panelRight - right edge of panel
 * @param {Array<[number, number]>} exclusions - sorted array of [left, right] exclusion zones
 * @param {number} epsGap - gap between EPS and framing (typically 10mm)
 * @returns {Array<[number, number]>} segments as [left, right] pairs
 */
export function getEpsSegments(panelLeft, panelRight, exclusions, epsGap) {
  const clipped = [];
  for (const [eL, eR] of exclusions) {
    const cL = Math.max(eL, panelLeft);
    const cR = Math.min(eR, panelRight);
    if (cL < cR) clipped.push([cL, cR]);
  }
  const merged = [];
  for (const zone of clipped) {
    if (merged.length > 0 && zone[0] <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], zone[1]);
    } else {
      merged.push([...zone]);
    }
  }
  const segs = [];
  let cursor = panelLeft + epsGap;
  for (const [eL, eR] of merged) {
    const segRight = eL - epsGap;
    if (cursor < segRight) segs.push([cursor, segRight]);
    cursor = eR + epsGap;
  }
  const segRight = panelRight - epsGap;
  if (cursor < segRight) segs.push([cursor, segRight]);
  return segs;
}
