/**
 * Generates sequential quote numbers in Q-YYYY-NNN format.
 * Sequence resets each year.
 */
export function nextQuoteNumber(db) {
  const year = new Date().getFullYear();

  const getNextSeq = db.transaction(() => {
    db.prepare(`
      INSERT INTO quote_number_seq (year, last_seq) VALUES (?, 1)
      ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1
    `).run(year);

    return db.prepare('SELECT last_seq FROM quote_number_seq WHERE year = ?').get(year).last_seq;
  });

  const seq = String(getNextSeq()).padStart(3, '0');
  return `Q-${year}-${seq}`;
}

/**
 * Generates a revision quote number: Q-YYYY-NNN-vN
 */
export function revisionQuoteNumber(baseQuoteNumber, version) {
  return `${baseQuoteNumber}-v${version}`;
}
