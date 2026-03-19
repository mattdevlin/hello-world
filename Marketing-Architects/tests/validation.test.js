import { describe, it, expect } from 'vitest';
import { isValidEmail, normalizeEmail, normalizeCompany, validateAndDedup } from '../src/utils/validation.js';

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('john@example.com')).toBe(true);
    expect(isValidEmail('jane.doe@company.co.nz')).toBe(true);
    expect(isValidEmail('a+tag@domain.org')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail('noemail')).toBe(false);
    expect(isValidEmail('noemail@')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
    expect(isValidEmail('user@domain.c')).toBe(false); // TLD too short
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  John@Example.COM  ')).toBe('john@example.com');
  });
});

describe('normalizeCompany', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeCompany('  Smith   Architects  ')).toBe('Smith Architects');
  });
});

describe('validateAndDedup', () => {
  const contacts = [
    { firstName: 'John', lastName: 'Smith', email: 'john@test.com', company: 'A', row: 2 },
    { firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com', company: 'B', row: 3 },
    { firstName: 'Bad', lastName: 'Email', email: 'not-an-email', company: 'C', row: 4 },
    { firstName: 'Dupe', lastName: 'John', email: 'JOHN@test.com', company: 'D', row: 5 },
    { firstName: 'No', lastName: 'Email', email: '', company: 'E', row: 6 },
  ];

  it('separates valid, invalid, and duplicates', () => {
    const result = validateAndDedup(contacts);

    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].email).toBe('john@test.com');
    expect(result.valid[1].email).toBe('jane@test.com');

    expect(result.invalid).toHaveLength(2);
    expect(result.invalid[0].reason).toContain('Invalid email');
    expect(result.invalid[1].reason).toContain('Missing email');

    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].contact.row).toBe(5);
    expect(result.duplicates[0].duplicateOf).toBe(2);
  });

  it('normalizes emails in valid contacts', () => {
    const result = validateAndDedup([
      { firstName: 'A', lastName: 'B', email: '  TEST@Example.COM  ', company: 'X', row: 2 },
    ]);
    expect(result.valid[0].email).toBe('test@example.com');
  });
});
