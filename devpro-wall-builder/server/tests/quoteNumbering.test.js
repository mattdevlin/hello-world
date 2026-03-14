import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { nextQuoteNumber, revisionQuoteNumber } from '../services/quoteNumbering.js';

describe('quoteNumbering', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE quote_number_seq (
        year INTEGER PRIMARY KEY,
        last_seq INTEGER NOT NULL DEFAULT 0
      );
    `);
  });

  it('generates first quote number for the year', () => {
    const num = nextQuoteNumber(db);
    const year = new Date().getFullYear();
    expect(num).toBe(`Q-${year}-001`);
  });

  it('increments sequentially', () => {
    const year = new Date().getFullYear();
    const num1 = nextQuoteNumber(db);
    const num2 = nextQuoteNumber(db);
    const num3 = nextQuoteNumber(db);

    expect(num1).toBe(`Q-${year}-001`);
    expect(num2).toBe(`Q-${year}-002`);
    expect(num3).toBe(`Q-${year}-003`);
  });

  it('zero-pads to 3 digits', () => {
    // Pre-seed to 99
    db.prepare('INSERT INTO quote_number_seq (year, last_seq) VALUES (?, ?)').run(
      new Date().getFullYear(),
      99
    );
    const num = nextQuoteNumber(db);
    const year = new Date().getFullYear();
    expect(num).toBe(`Q-${year}-100`);
  });

  it('handles numbers beyond 999', () => {
    db.prepare('INSERT INTO quote_number_seq (year, last_seq) VALUES (?, ?)').run(
      new Date().getFullYear(),
      999
    );
    const num = nextQuoteNumber(db);
    const year = new Date().getFullYear();
    expect(num).toBe(`Q-${year}-1000`);
  });
});

describe('revisionQuoteNumber', () => {
  it('appends version suffix', () => {
    expect(revisionQuoteNumber('Q-2026-001', 2)).toBe('Q-2026-001-v2');
    expect(revisionQuoteNumber('Q-2026-001', 3)).toBe('Q-2026-001-v3');
  });
});
