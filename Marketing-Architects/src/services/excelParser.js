import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const NAME_COLUMNS = ['name', 'full name', 'contact name', 'contact', 'architect'];
const EMAIL_COLUMNS = ['email', 'e-mail', 'email address', 'mail'];
const COMPANY_COLUMNS = ['company', 'company name', 'firm', 'firm name', 'organisation', 'organization', 'practice'];

/**
 * Find a column header by checking against a list of known aliases (case-insensitive).
 */
function findColumn(headers, aliases) {
  const normalized = headers.map(h => String(h).trim().toLowerCase());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

/**
 * Split a full name into firstName and lastName.
 * Handles: "John Smith", "Smith, John", "Dr John Smith", single names.
 */
export function splitName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', lastName: '' };
  }

  let name = fullName.trim();

  // Remove common prefixes
  name = name.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?)\s+/i, '');

  // Handle "Last, First" format
  if (name.includes(',')) {
    const [last, first] = name.split(',').map(s => s.trim());
    return { firstName: first || '', lastName: last || '' };
  }

  const parts = name.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Parse an Excel or CSV file and return structured contact records.
 *
 * @param {string} filePath — path to .xlsx or .csv file
 * @returns {{ contacts: Array<{firstName, lastName, email, company, row}>, errors: Array<{row, reason}> }}
 */
export function parseExcelFile(filePath) {
  const buf = readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) {
    return { contacts: [], errors: [{ row: 0, reason: 'Empty spreadsheet' }] };
  }

  const headers = Object.keys(rows[0]);
  const nameCol = findColumn(headers, NAME_COLUMNS);
  const emailCol = findColumn(headers, EMAIL_COLUMNS);
  const companyCol = findColumn(headers, COMPANY_COLUMNS);

  if (!emailCol) {
    return {
      contacts: [],
      errors: [{ row: 0, reason: `No email column found. Headers: ${headers.join(', ')}` }],
    };
  }

  const contacts = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for 1-indexed + header row

    const email = String(row[emailCol] || '').trim();
    if (!email) {
      errors.push({ row: rowNum, reason: 'Missing email' });
      continue;
    }

    const rawName = nameCol ? String(row[nameCol] || '').trim() : '';
    const { firstName, lastName } = splitName(rawName);
    const company = companyCol ? String(row[companyCol] || '').trim() : '';

    contacts.push({ firstName, lastName, email, company, row: rowNum });
  }

  return { contacts, errors };
}
