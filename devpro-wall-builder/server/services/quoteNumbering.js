/**
 * Generates sequential quote numbers in Q-YYYY-NNN format.
 * Sequence resets each year.
 */
export function nextQuoteNumber(db) {
  const year = new Date().getFullYear();

  const upsert = db.prepare(`
    INSERT INTO quote_number_seq (year, last_seq) VALUES (?, 1)
    ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1
  `);
  upsert.run(year);

  const row = db.prepare('SELECT last_seq FROM quote_number_seq WHERE year = ?').get(year);
  const seq = String(row.last_seq).padStart(3, '0');

  return `Q-${year}-${seq}`;
}

/**
 * Generates a revision quote number: Q-YYYY-NNN-vN
 */
export function revisionQuoteNumber(baseQuoteNumber, version) {
  return `${baseQuoteNumber}-v${version}`;
}
