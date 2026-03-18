import { describe, it, expect } from 'vitest';
import {
  determineWindZone,
  determineEqZone,
  getSiteClassification,
} from './site.js';

// ─────────────────────────────────────────────────────────────
// Wind Zone (Table 5.4)
// ─────────────────────────────────────────────────────────────

describe('determineWindZone', () => {
  it('A, urban, T1, sheltered → L', () => {
    expect(determineWindZone('A', 'urban', 'T1', 'sheltered', false)).toBe('L');
  });

  it('A, urban, T1, exposed → M', () => {
    expect(determineWindZone('A', 'urban', 'T1', 'exposed', false)).toBe('M');
  });

  it('A, open, T1, sheltered → M', () => {
    expect(determineWindZone('A', 'open', 'T1', 'sheltered', false)).toBe('M');
  });

  it('A, open, T1, exposed → H', () => {
    expect(determineWindZone('A', 'open', 'T1', 'exposed', false)).toBe('H');
  });

  it('W, open, T3, exposed → EH', () => {
    expect(determineWindZone('W', 'open', 'T3', 'exposed', false)).toBe('EH');
  });

  it('W, open, T4, sheltered → SED', () => {
    expect(determineWindZone('W', 'open', 'T4', 'sheltered', false)).toBe('SED');
  });

  it('lee zone upgrades L → H', () => {
    expect(determineWindZone('A', 'urban', 'T1', 'sheltered', true)).toBe('H');
  });

  it('lee zone upgrades M → VH', () => {
    expect(determineWindZone('A', 'urban', 'T1', 'exposed', true)).toBe('VH');
  });

  it('invalid region → SED', () => {
    expect(determineWindZone('X', 'urban', 'T1', 'sheltered', false)).toBe('SED');
  });
});

// ─────────────────────────────────────────────────────────────
// Earthquake Zone (Figure 5.4)
// ─────────────────────────────────────────────────────────────

describe('determineEqZone', () => {
  it('Whangarei District → 1', () => {
    expect(determineEqZone('Whangarei District')).toBe(1);
  });

  it('Auckland → 2', () => {
    expect(determineEqZone('Auckland')).toBe(2);
  });

  it('Wellington City → 3', () => {
    expect(determineEqZone('Wellington City')).toBe(3);
  });

  it('Far North District → 1', () => {
    expect(determineEqZone('Far North District')).toBe(1);
  });

  it('Christchurch City → 3', () => {
    expect(determineEqZone('Christchurch City')).toBe(3);
  });

  it('unknown TA → null', () => {
    expect(determineEqZone('Nonexistent City')).toBeNull();
  });

  it('null → null', () => {
    expect(determineEqZone(null)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Site Classification (Orchestrator)
// ─────────────────────────────────────────────────────────────

describe('getSiteClassification', () => {
  it('Whangarei defaults → M wind, EQ zone 1', () => {
    const result = getSiteClassification({
      windRegion: 'A',
      groundRoughness: 'open',
      topoClass: 'T1',
      exposure: 'sheltered',
      leeZone: false,
      territorialAuthority: 'Whangarei District',
    });
    expect(result.windZone).toBe('M');
    expect(result.eqZone).toBe(1);
  });

  it('uses defaults when params missing', () => {
    const result = getSiteClassification({
      territorialAuthority: 'Auckland',
    });
    // Default: A, open, T1, sheltered, no lee → M
    expect(result.windZone).toBe('M');
    expect(result.eqZone).toBe(2);
  });

  it('Wellington exposed hilltop → EH wind', () => {
    const result = getSiteClassification({
      windRegion: 'W',
      groundRoughness: 'open',
      topoClass: 'T3',
      exposure: 'exposed',
      leeZone: false,
      territorialAuthority: 'Wellington City',
    });
    expect(result.windZone).toBe('EH');
    expect(result.eqZone).toBe(3);
  });
});
