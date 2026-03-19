#!/usr/bin/env node

/**
 * Architect Import CLI
 *
 * Usage:
 *   node scripts/import-architects.js ./path/to/architects.xlsx
 *   node scripts/import-architects.js ./path/to/architects.xlsx --dry-run
 *   node scripts/import-architects.js ./path/to/architects.xlsx --verbose
 *   node scripts/import-architects.js ./path/to/architects.xlsx --dry-run --verbose
 */

import { parseExcelFile } from '../src/services/excelParser.js';
import { validateAndDedup } from '../src/utils/validation.js';
import { qualifyBatch } from '../src/services/architectQualifier.js';
import { enrichBatch } from '../src/services/contactEnricher.js';
import { batchUpsertContacts } from '../src/services/hubspotClient.js';
import { checkPriorContactBatch } from '../src/services/priorContactChecker.js';
import * as log from '../src/utils/logger.js';
import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

if (verbose) log.setVerbose(true);

if (!filePath) {
  log.error('Usage: node scripts/import-architects.js <file.xlsx> [--dry-run] [--verbose]');
  process.exit(1);
}

async function main() {
  log.info(`Importing architects from: ${filePath}`);
  if (dryRun) log.warn('DRY RUN — no data will be pushed to HubSpot or Gmail');

  // Step 1: Parse Excel
  log.info('Step 1/6: Parsing Excel file...');
  const { contacts: rawContacts, errors: parseErrors } = parseExcelFile(filePath);

  if (parseErrors.length > 0) {
    for (const err of parseErrors) {
      log.warn(`  Row ${err.row}: ${err.reason}`);
    }
  }

  log.success(`  Parsed ${rawContacts.length} rows (${parseErrors.length} parse errors)`);
  log.verbose(`  First contact: ${JSON.stringify(rawContacts[0])}`);

  if (rawContacts.length === 0) {
    log.error('No contacts to import. Check your file format.');
    process.exit(1);
  }

  // Step 2: Validate & Dedup
  log.info('Step 2/6: Validating & deduplicating...');
  const { valid, invalid, duplicates } = validateAndDedup(rawContacts);

  if (invalid.length > 0) {
    for (const inv of invalid) {
      log.verbose(`  Invalid: row ${inv.contact.row} — ${inv.reason}`);
    }
  }
  if (duplicates.length > 0) {
    for (const dup of duplicates) {
      log.verbose(`  Duplicate: row ${dup.contact.row} — duplicate of row ${dup.duplicateOf}`);
    }
  }

  log.success(`  ${valid.length} valid, ${invalid.length} invalid, ${duplicates.length} duplicates`);

  // Step 3: Qualify & Score
  log.info('Step 3/6: Qualifying architects by tier...');
  const { qualified, excluded } = qualifyBatch(valid);

  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const c of qualified) {
    tierCounts[c.qualification.tier]++;
  }

  if (excluded.length > 0) {
    for (const ex of excluded) {
      log.verbose(`  Excluded: ${ex.email} — ${ex.qualification.reason}`);
    }
  }

  log.success(`  ${qualified.length} qualified (T1:${tierCounts[1]} T2:${tierCounts[2]} T3:${tierCounts[3]} T4:${tierCounts[4]}), ${excluded.length} excluded`);

  // Step 4: Enrich
  log.info('Step 4/6: Enriching contacts...');
  const enriched = enrichBatch(qualified);

  const withRegion = enriched.filter(c => c.enrichment.region).length;
  log.success(`  Enriched ${enriched.length} contacts (${withRegion} with region detected)`);

  // Step 5: Check prior contact
  log.info('Step 5/6: Checking prior contact history...');
  let finalContacts;
  if (dryRun) {
    log.warn('  Skipping prior contact check (dry run)');
    finalContacts = enriched.map(c => ({ ...c, priorContact: { hasPriorContact: false, summary: 'Skipped (dry run)' } }));
  } else {
    finalContacts = await checkPriorContactBatch(enriched, (current, total) => {
      log.verbose(`  Checked ${current}/${total}`);
    });
  }

  const withPrior = finalContacts.filter(c => c.priorContact?.hasPriorContact).length;
  log.success(`  ${withPrior} contacts with prior communication found`);

  // Step 6: Push to HubSpot
  log.info('Step 6/6: Pushing to HubSpot...');
  let importResult = { imported: [], errors: [] };

  if (dryRun) {
    log.warn('  Skipping HubSpot push (dry run)');
  } else {
    importResult = await batchUpsertContacts(finalContacts, (current, total) => {
      log.verbose(`  Synced ${current}/${total}`);
    });
  }

  // Summary
  const results = {
    file: filePath,
    dryRun,
    timestamp: new Date().toISOString(),
    totals: {
      parsed: rawContacts.length,
      parseErrors: parseErrors.length,
      valid: valid.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
      qualified: qualified.length,
      excluded: excluded.length,
      withPriorContact: withPrior,
      imported: importResult.imported.length,
      importErrors: importResult.errors.length,
    },
    tierBreakdown: {
      'Tier 1 (Hot)': tierCounts[1],
      'Tier 2 (Warm)': tierCounts[2],
      'Tier 3 (Viable)': tierCounts[3],
      'Tier 4 (Low)': tierCounts[4],
      'Excluded': excluded.length,
    },
    excluded: excluded.map(c => ({ email: c.email, company: c.company, reason: c.qualification.reason })),
    invalid: invalid.map(i => ({ row: i.contact.row, reason: i.reason })),
    importErrors: importResult.errors.map(e => ({ email: e.contact.email, error: e.error })),
  };

  // Write results file
  const resultsPath = filePath.replace(/\.\w+$/, '-results.json');
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));

  log.summary('Import Complete', {
    'Total parsed': results.totals.parsed,
    'Valid contacts': results.totals.valid,
    'Qualified': `${results.totals.qualified} (T1:${tierCounts[1]} T2:${tierCounts[2]} T3:${tierCounts[3]} T4:${tierCounts[4]})`,
    'Excluded': results.totals.excluded,
    'Prior contact': results.totals.withPriorContact,
    'Imported to HubSpot': dryRun ? 'SKIPPED (dry run)' : results.totals.imported,
    'Import errors': dryRun ? 'N/A' : results.totals.importErrors,
    'Results saved to': resultsPath,
  });
}

main().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  if (verbose) console.error(err);
  process.exit(1);
});
