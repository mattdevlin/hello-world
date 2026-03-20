import { describe, it, expect } from 'vitest';
import { loadTemplate, previewSequence, filterEligible } from '../src/services/emailSequence.js';

describe('loadTemplate', () => {
  it('loads the architect sequence template', () => {
    const template = loadTemplate('architect-sequence');

    expect(template.name).toBe('Architect — DevPro SIP Evidence Sequence');
    expect(template.emails).toHaveLength(4);
    expect(template.sender.name).toBe('Matt Devlin');
  });

  it('has correct email structure', () => {
    const template = loadTemplate('architect-sequence');

    for (const email of template.emails) {
      expect(email).toHaveProperty('id');
      expect(email).toHaveProperty('step');
      expect(email).toHaveProperty('label');
      expect(email).toHaveProperty('subject');
      expect(email).toHaveProperty('delayDays');
      expect(email).toHaveProperty('body');
      expect(email.body.length).toBeGreaterThan(0);
    }
  });

  it('has correct delay schedule: 0, 3, 7, 14 days', () => {
    const template = loadTemplate('architect-sequence');
    const delays = template.emails.map(e => e.delayDays);
    expect(delays).toEqual([0, 3, 7, 14]);
  });

  it('uses same-thread subject format (Re:) for follow-ups', () => {
    const template = loadTemplate('architect-sequence');

    expect(template.emails[0].subject).toBe('Clients sitting on the fence?');
    expect(template.emails[1].subject).toBe('Re: Clients sitting on the fence?');
    expect(template.emails[2].subject).toBe('Re: Clients sitting on the fence?');
    expect(template.emails[3].subject).toBe('Re: Clients sitting on the fence?');
  });

  it('throws on missing template', () => {
    expect(() => loadTemplate('nonexistent')).toThrow();
  });
});

describe('previewSequence', () => {
  it('generates preview for a contact', () => {
    const template = loadTemplate('architect-sequence');
    const contact = {
      email: 'architect@test.com',
      firstName: 'Jane',
      lastName: 'Doe',
      company: 'Test Architects',
    };

    const preview = previewSequence(template, contact);

    expect(preview).toHaveLength(4);
    expect(preview[0].to).toBe('architect@test.com');
    expect(preview[0].step).toBe(1);
    expect(preview[0].label).toBe('The Hook');
    expect(preview[0].delayDays).toBe(0);
    expect(preview[0].previewBody.length).toBeLessThanOrEqual(123); // 120 + "..."
  });
});

describe('filterEligible', () => {
  const contacts = [
    { email: 'hot@test.com', enrichment: { qualificationTier: 1 } },
    { email: 'warm@test.com', enrichment: { qualificationTier: 2 } },
    { email: 'viable@test.com', enrichment: { qualificationTier: 3 } },
    { email: 'low@test.com', enrichment: { qualificationTier: 4 } },
  ];

  it('defaults to tier 1 and 2', () => {
    const result = filterEligible(contacts);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.email)).toEqual(['hot@test.com', 'warm@test.com']);
  });

  it('respects custom maxTier', () => {
    expect(filterEligible(contacts, 1)).toHaveLength(1);
    expect(filterEligible(contacts, 3)).toHaveLength(3);
    expect(filterEligible(contacts, 4)).toHaveLength(4);
  });

  it('handles contacts with qualification.tier fallback', () => {
    const fallbackContacts = [
      { email: 'a@test.com', qualification: { tier: 1 } },
      { email: 'b@test.com', qualification: { tier: 3 } },
    ];
    const result = filterEligible(fallbackContacts, 2);
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('a@test.com');
  });

  it('treats contacts without tier data as tier 4', () => {
    const noTier = [{ email: 'unknown@test.com' }];
    expect(filterEligible(noTier, 2)).toHaveLength(0);
    expect(filterEligible(noTier, 4)).toHaveLength(1);
  });
});
