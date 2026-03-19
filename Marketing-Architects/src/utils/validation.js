/**
 * Validate an email address.
 * Checks structure, not deliverability. Covers common edge cases.
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;

  const trimmed = email.trim();
  if (trimmed.length > 254) return false;

  // RFC 5322 simplified: local@domain, domain has at least one dot
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(trimmed);
}

/**
 * Normalize an email address: trim + lowercase.
 */
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/**
 * Normalize a company name: trim, collapse whitespace, title case common suffixes.
 */
export function normalizeCompany(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+(ltd|limited|inc|llc|pty|nz)\s*\.?$/i, (match) => match.toUpperCase());
}

/**
 * Validate and deduplicate a list of contacts.
 *
 * @param {Array<{firstName, lastName, email, company, row}>} contacts
 * @returns {{ valid: Array, invalid: Array<{contact, reason}>, duplicates: Array<{contact, duplicateOf}> }}
 */
export function validateAndDedup(contacts) {
  const valid = [];
  const invalid = [];
  const duplicates = [];
  const seen = new Map(); // email -> row number

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email);

    if (!isValidEmail(email)) {
      invalid.push({
        contact,
        reason: contact.email ? `Invalid email format: "${contact.email}"` : 'Missing email',
      });
      continue;
    }

    if (seen.has(email)) {
      duplicates.push({
        contact,
        duplicateOf: seen.get(email),
      });
      continue;
    }

    seen.set(email, contact.row);
    valid.push({
      ...contact,
      email,
      company: normalizeCompany(contact.company),
    });
  }

  return { valid, invalid, duplicates };
}
