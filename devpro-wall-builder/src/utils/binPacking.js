/**
 * Shared shelf-based 2D bin packing with rotation.
 *
 * Used by epsOptimizer.js and magboardOptimizer.js to pack rectangular pieces
 * onto fixed-size slabs/sheets.
 */

/**
 * Pack rectangular pieces onto slabs using shelf algorithm.
 * Pieces may be rotated 90° if it helps.
 *
 * @param {Array} pieces - {width, height, ...}
 * @param {number} slabW - slab/sheet width
 * @param {number} slabH - slab/sheet height
 * @returns {Array} slabs, each { shelves: [{h, remainingW, pieces}] }
 */
export function shelfPack(pieces, slabW, slabH) {
  // Sort by tallest dimension descending — packs shelves more tightly
  const sorted = [...pieces].sort((a, b) => {
    const aMax = Math.max(a.width, a.height);
    const bMax = Math.max(b.width, b.height);
    return bMax - aMax;
  });

  const slabs = [];

  for (const piece of sorted) {
    // Build candidate orientations
    const orients = [{ w: piece.width, h: piece.height }];
    if (piece.width !== piece.height) {
      orients.push({ w: piece.height, h: piece.width });
    }
    // Prefer the orientation where height is smaller,
    // so shelves stay short and more fit vertically
    orients.sort((a, b) => a.h - b.h);

    let placed = false;

    for (const o of orients) {
      if (o.w > slabW || o.h > slabH) continue;

      // Try to fit on an existing slab's existing shelf
      for (const slab of slabs) {
        for (const shelf of slab.shelves) {
          if (shelf.remainingW >= o.w && shelf.h >= o.h) {
            shelf.pieces.push({ ...piece, placedW: o.w, placedH: o.h });
            shelf.remainingW -= o.w;
            placed = true;
            break;
          }
        }
        if (placed) break;

        // Try a new shelf on this slab
        const usedH = slab.shelves.reduce((s, sh) => s + sh.h, 0);
        if (usedH + o.h <= slabH) {
          slab.shelves.push({
            h: o.h,
            remainingW: slabW - o.w,
            pieces: [{ ...piece, placedW: o.w, placedH: o.h }],
          });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      // Open a new slab
      const o = orients.find(o => o.w <= slabW && o.h <= slabH) || orients[0];
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
