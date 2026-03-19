import { describe, it, expect } from 'vitest';
import { qualifyArchitect, qualifyBatch } from '../src/services/architectQualifier.js';

describe('qualifyArchitect', () => {
  it('scores Tier 1 for passive house keywords', () => {
    const result = qualifyArchitect({ company: 'Passive House Architects Auckland' });
    expect(result.tier).toBe(1);
    expect(result.tierLabel).toBe('Hot');
    expect(result.score).toBe(100);
    expect(result.exclude).toBe(false);
  });

  it('scores Tier 1 for homestar keywords', () => {
    const result = qualifyArchitect({ company: 'Homestar Design Practice' });
    expect(result.tier).toBe(1);
    expect(result.tierLabel).toBe('Hot');
  });

  it('scores Tier 1 for healthy homes keywords', () => {
    const result = qualifyArchitect({ company: 'Healthy Homes Design Ltd' });
    expect(result.tier).toBe(1);
  });

  it('scores Tier 1 for energy efficient keywords', () => {
    const result = qualifyArchitect({ company: 'Energy Efficient Homes Studio' });
    expect(result.tier).toBe(1);
  });

  it('scores Tier 2 for residential keywords', () => {
    const result = qualifyArchitect({ company: 'Home Architects Ltd' });
    expect(result.tier).toBe(2);
    expect(result.tierLabel).toBe('Warm');
    expect(result.score).toBe(70);
  });

  it('scores Tier 3 for commercial keywords', () => {
    const result = qualifyArchitect({ company: 'Commercial Architecture Group' });
    expect(result.tier).toBe(3);
    expect(result.tierLabel).toBe('Viable');
    expect(result.score).toBe(40);
  });

  it('scores Tier 3 for education keywords', () => {
    const result = qualifyArchitect({ company: 'Harris Education Architecture' });
    expect(result.tier).toBe(3);
  });

  it('scores Tier 4 for unknown specialty', () => {
    const result = qualifyArchitect({ company: 'Smith & Partners' });
    expect(result.tier).toBe(4);
    expect(result.tierLabel).toBe('Low');
    expect(result.score).toBe(20);
  });

  it('excludes interior design firms', () => {
    const result = qualifyArchitect({ company: 'Taylor Interior Design Studio' });
    expect(result.exclude).toBe(true);
    expect(result.tier).toBe(0);
    expect(result.tierLabel).toBe('Excluded');
  });

  it('excludes landscape architects', () => {
    const result = qualifyArchitect({ company: 'White Landscape Architects' });
    expect(result.exclude).toBe(true);
  });

  it('excludes urban planning firms', () => {
    const result = qualifyArchitect({ company: 'City Urban Planning Associates' });
    expect(result.exclude).toBe(true);
  });

  it('uses additional text for qualification', () => {
    const result = qualifyArchitect(
      { company: 'Smith Architects' },
      'We specialize in passive house design and sustainable building',
    );
    expect(result.tier).toBe(1);
  });
});

describe('qualifyBatch', () => {
  it('separates qualified from excluded and sorts by score', () => {
    const contacts = [
      { email: 'a@test.com', company: 'Commercial Architecture Group' }, // T3
      { email: 'b@test.com', company: 'Passive House Architects' },       // T1
      { email: 'c@test.com', company: 'Taylor Interior Design Studio' },  // Excluded
      { email: 'd@test.com', company: 'Home Architects Ltd' },            // T2
    ];

    const { qualified, excluded } = qualifyBatch(contacts);

    expect(qualified).toHaveLength(3);
    expect(excluded).toHaveLength(1);

    // Should be sorted by score descending
    expect(qualified[0].qualification.tier).toBe(1); // Hot first
    expect(qualified[1].qualification.tier).toBe(2); // Warm second
    expect(qualified[2].qualification.tier).toBe(3); // Viable third

    expect(excluded[0].email).toBe('c@test.com');
  });
});
