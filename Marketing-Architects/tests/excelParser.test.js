import { describe, it, expect } from 'vitest';
import { splitName, parseExcelFile } from '../src/services/excelParser.js';
import * as XLSX from 'xlsx';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('splitName', () => {
  it('splits "First Last"', () => {
    expect(splitName('John Smith')).toEqual({ firstName: 'John', lastName: 'Smith' });
  });

  it('splits "Last, First"', () => {
    expect(splitName('Smith, John')).toEqual({ firstName: 'John', lastName: 'Smith' });
  });

  it('handles single name', () => {
    expect(splitName('Madonna')).toEqual({ firstName: 'Madonna', lastName: '' });
  });

  it('handles three-part names', () => {
    expect(splitName('John van der Berg')).toEqual({ firstName: 'John', lastName: 'van der Berg' });
  });

  it('strips common prefixes', () => {
    expect(splitName('Dr John Smith')).toEqual({ firstName: 'John', lastName: 'Smith' });
    expect(splitName('Mr. John Smith')).toEqual({ firstName: 'John', lastName: 'Smith' });
  });

  it('handles empty/null input', () => {
    expect(splitName('')).toEqual({ firstName: '', lastName: '' });
    expect(splitName(null)).toEqual({ firstName: '', lastName: '' });
    expect(splitName(undefined)).toEqual({ firstName: '', lastName: '' });
  });

  it('trims whitespace', () => {
    expect(splitName('  John  Smith  ')).toEqual({ firstName: 'John', lastName: 'Smith' });
  });
});

describe('parseExcelFile', () => {
  let tmpDir;

  function createTestExcel(data, filename = 'test.xlsx') {
    tmpDir = mkdtempSync(join(tmpdir(), 'excel-test-'));
    const filePath = join(tmpDir, filename);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    writeFileSync(filePath, buf);
    return filePath;
  }

  it('parses standard columns', () => {
    const filePath = createTestExcel([
      { Name: 'John Smith', Email: 'john@test.com', Company: 'Test Ltd' },
    ]);
    const { contacts, errors } = parseExcelFile(filePath);
    expect(errors).toHaveLength(0);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@test.com',
      company: 'Test Ltd',
    });
    rmSync(tmpDir, { recursive: true });
  });

  it('handles alternative column names', () => {
    const filePath = createTestExcel([
      { 'Full Name': 'Jane Doe', 'E-mail': 'jane@test.com', Firm: 'Doe Architects' },
    ]);
    const { contacts } = parseExcelFile(filePath);
    expect(contacts[0].firstName).toBe('Jane');
    expect(contacts[0].email).toBe('jane@test.com');
    expect(contacts[0].company).toBe('Doe Architects');
    rmSync(tmpDir, { recursive: true });
  });

  it('skips rows with missing email', () => {
    const filePath = createTestExcel([
      { Name: 'John', Email: 'john@test.com', Company: 'A' },
      { Name: 'No Email', Email: '', Company: 'B' },
    ]);
    const { contacts, errors } = parseExcelFile(filePath);
    expect(contacts).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toBe('Missing email');
    rmSync(tmpDir, { recursive: true });
  });

  it('returns error for empty spreadsheet', () => {
    const filePath = createTestExcel([]);
    const { contacts, errors } = parseExcelFile(filePath);
    expect(contacts).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toContain('Empty');
    rmSync(tmpDir, { recursive: true });
  });

  it('returns error when no email column found', () => {
    const filePath = createTestExcel([
      { Name: 'John', Phone: '0211234567' },
    ]);
    const { contacts, errors } = parseExcelFile(filePath);
    expect(contacts).toHaveLength(0);
    expect(errors[0].reason).toContain('No email column');
    rmSync(tmpDir, { recursive: true });
  });
});
