import { describe, it, expect } from 'vitest';
import { shelfPack } from './binPacking.js';

describe('shelfPack placement coordinates', () => {
  it('adds placedX and placedY to all pieces', () => {
    const pieces = [
      { width: 300, height: 200, id: 'a' },
      { width: 400, height: 150, id: 'b' },
      { width: 200, height: 100, id: 'c' },
    ];
    const slabs = shelfPack(pieces, 1200, 2745);
    const allPieces = slabs.flatMap(s => s.shelves.flatMap(sh => sh.pieces));

    for (const p of allPieces) {
      expect(p).toHaveProperty('placedX');
      expect(p).toHaveProperty('placedY');
      expect(typeof p.placedX).toBe('number');
      expect(typeof p.placedY).toBe('number');
    }
  });

  it('no pieces overlap within a slab', () => {
    const pieces = [];
    for (let i = 0; i < 20; i++) {
      pieces.push({
        width: 100 + Math.floor(Math.random() * 400),
        height: 100 + Math.floor(Math.random() * 500),
        id: `p${i}`,
      });
    }
    const slabs = shelfPack(pieces, 1200, 2745);

    for (const slab of slabs) {
      const placed = slab.shelves.flatMap(sh => sh.pieces);
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i];
          const b = placed[j];
          // Two rects don't overlap if one is fully left, right, above, or below the other
          const noOverlap =
            a.placedX + a.placedW <= b.placedX ||
            b.placedX + b.placedW <= a.placedX ||
            a.placedY + a.placedH <= b.placedY ||
            b.placedY + b.placedH <= a.placedY;
          expect(noOverlap).toBe(true);
        }
      }
    }
  });

  it('all pieces fit within slab bounds', () => {
    const pieces = [
      { width: 600, height: 1000 },
      { width: 500, height: 800 },
      { width: 400, height: 700 },
      { width: 300, height: 500 },
      { width: 200, height: 300 },
    ];
    const slabW = 1200;
    const slabH = 2745;
    const slabs = shelfPack(pieces, slabW, slabH);

    for (const slab of slabs) {
      const placed = slab.shelves.flatMap(sh => sh.pieces);
      for (const p of placed) {
        expect(p.placedX).toBeGreaterThanOrEqual(0);
        expect(p.placedY).toBeGreaterThanOrEqual(0);
        expect(p.placedX + p.placedW).toBeLessThanOrEqual(slabW);
        expect(p.placedY + p.placedH).toBeLessThanOrEqual(slabH);
      }
    }
  });

  it('first piece on a new slab is at (0, 0)', () => {
    const pieces = [{ width: 500, height: 400 }];
    const slabs = shelfPack(pieces, 1200, 2745);

    expect(slabs.length).toBe(1);
    const p = slabs[0].shelves[0].pieces[0];
    expect(p.placedX).toBe(0);
    expect(p.placedY).toBe(0);
  });

  it('second piece on same shelf has correct placedX', () => {
    // Two pieces that should fit on one shelf
    const pieces = [
      { width: 500, height: 400 },
      { width: 300, height: 400 },
    ];
    const slabs = shelfPack(pieces, 1200, 2745);

    expect(slabs.length).toBe(1);
    const allPieces = slabs[0].shelves.flatMap(sh => sh.pieces);
    expect(allPieces.length).toBe(2);
    // First piece at x=0, second at x=500 (or rotated equivalent)
    const firstPiece = allPieces[0];
    const secondPiece = allPieces[1];
    expect(firstPiece.placedX).toBe(0);
    expect(secondPiece.placedX).toBe(firstPiece.placedW);
  });

  it('piece on new shelf has placedY = sum of preceding shelf heights', () => {
    // First piece tall enough to fill shelf, second must go on next shelf
    const pieces = [
      { width: 1100, height: 500 },
      { width: 1100, height: 400 },
    ];
    const slabs = shelfPack(pieces, 1200, 2745);

    expect(slabs.length).toBe(1);
    expect(slabs[0].shelves.length).toBe(2);

    const shelf1Piece = slabs[0].shelves[0].pieces[0];
    const shelf2Piece = slabs[0].shelves[1].pieces[0];
    expect(shelf1Piece.placedY).toBe(0);
    expect(shelf2Piece.placedY).toBe(slabs[0].shelves[0].h);
  });
});
