import { describe, it, expect } from 'vitest';
import { extractRegion, inferFirmType, enrichContact } from '../src/services/contactEnricher.js';

describe('extractRegion', () => {
  it('detects Auckland', () => {
    expect(extractRegion('Passive House Architects Auckland')).toBe('Auckland');
  });

  it('detects Wellington', () => {
    expect(extractRegion('Green Design Studio Wellington')).toBe('Wellington');
  });

  it('detects Christchurch', () => {
    expect(extractRegion('Brown & Associates Architects Christchurch')).toBe('Christchurch');
  });

  it('detects Tauranga', () => {
    expect(extractRegion('Homestar Design Practice Tauranga')).toBe('Tauranga');
  });

  it('returns null for no region match', () => {
    expect(extractRegion('Smith Architects')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractRegion('')).toBeNull();
    expect(extractRegion(null)).toBeNull();
  });
});

describe('inferFirmType', () => {
  it('detects Associates Practice', () => {
    expect(inferFirmType('Brown & Associates')).toBe('Associates Practice');
  });

  it('detects Architecture Group', () => {
    expect(inferFirmType('Commercial Architecture Group')).toBe('Architecture Group');
  });

  it('detects Design Studio', () => {
    expect(inferFirmType('Green Design Studio')).toBe('Design Studio');
  });

  it('detects Limited Company', () => {
    expect(inferFirmType('Home Architects Ltd')).toBe('Limited Company');
  });

  it('returns Unknown for no match', () => {
    expect(inferFirmType('ABC Corp')).toBe('Unknown');
  });
});

describe('enrichContact', () => {
  it('adds enrichment fields', () => {
    const contact = {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@test.com',
      company: 'Passive House Architects Auckland',
      qualification: { tier: 1, tierLabel: 'Hot' },
    };

    const result = enrichContact(contact);
    expect(result.enrichment.region).toBe('Auckland');
    expect(result.enrichment.firmType).toBe('Architecture Practice');
    expect(result.enrichment.lifecycleStage).toBe('lead');
    expect(result.enrichment.leadSource).toBe('excel_import');
    expect(result.enrichment.architectPipeline).toBe(true);
    expect(result.enrichment.qualificationTier).toBe(1);
    expect(result.enrichment.qualificationTierLabel).toBe('Hot');
  });

  it('defaults tier to 4 when qualification missing', () => {
    const contact = { firstName: 'A', lastName: 'B', email: 'a@b.com', company: 'X' };
    const result = enrichContact(contact);
    expect(result.enrichment.qualificationTier).toBe(4);
  });
});
