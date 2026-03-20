#!/usr/bin/env node

/**
 * Sequence Enrollment CLI
 *
 * Enrolls imported contacts into the architect email sequence via HubSpot.
 *
 * Usage:
 *   node scripts/enroll-sequence.js ./path/to/architects-results.json --sender matt@devlinproperty.co.nz
 *   node scripts/enroll-sequence.js ./path/to/architects-results.json --sender matt@devlinproperty.co.nz --dry-run
 *   node scripts/enroll-sequence.js ./path/to/architects-results.json --sender matt@devlinproperty.co.nz --max-tier 1
 *   node scripts/enroll-sequence.js ./path/to/architects-results.json --sender matt@devlinproperty.co.nz --verbose
 */

import { readFileSync } from 'fs';
import {
  loadTemplate,
  getOrCreateSequence,
  batchEnroll,
  previewSequence,
  filterEligible,
} from '../src/services/emailSequence.js';
import * as log from '../src/utils/logger.js';

const args = process.argv.slice(2);
const resultsPath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

const senderIdx = args.indexOf('--sender');
const senderEmail = senderIdx !== -1 ? args[senderIdx + 1] : null;

const maxTierIdx = args.indexOf('--max-tier');
const maxTier = maxTierIdx !== -1 ? parseInt(args[maxTierIdx + 1], 10) : 2;

if (verbose) log.setVerbose(true);

if (!resultsPath || !senderEmail) {
  log.error('Usage: node scripts/enroll-sequence.js <results.json> --sender <email> [--dry-run] [--max-tier N] [--verbose]');
  process.exit(1);
}

async function main() {
  log.info(`Loading import results from: ${resultsPath}`);

  // Load the import results (which contain hubspotContactId for each contact)
  const raw = readFileSync(resultsPath, 'utf-8');
  const results = JSON.parse(raw);

  // Results file from import-architects.js contains top-level 'imported' array
  // or we may need to load contacts differently depending on format
  const contacts = results.imported || results.contacts || [];

  if (contacts.length === 0) {
    log.error('No contacts found in results file. Run import-architects.js first.');
    process.exit(1);
  }

  log.success(`  Loaded ${contacts.length} contacts`);

  // Filter eligible contacts by tier
  log.info(`Filtering contacts (max tier: ${maxTier})...`);
  const eligible = filterEligible(contacts, maxTier);
  log.success(`  ${eligible.length} of ${contacts.length} contacts eligible for sequence enrollment`);

  if (eligible.length === 0) {
    log.warn('No contacts eligible for enrollment at the specified tier. Try --max-tier 3 or --max-tier 4.');
    process.exit(0);
  }

  // Load template
  log.info('Loading email sequence template...');
  const template = loadTemplate('architect-sequence');
  log.success(`  Loaded "${template.name}" — ${template.emails.length} emails over ${template.emails[template.emails.length - 1].delayDays} days`);

  // Preview
  if (dryRun || verbose) {
    log.info('Sequence preview for first eligible contact:');
    const preview = previewSequence(template, eligible[0]);
    for (const step of preview) {
      log.verbose(`  Day ${step.delayDays} — [${step.label}] "${step.subject}"`);
      log.verbose(`    To: ${step.to}`);
      log.verbose(`    ${step.previewBody}`);
    }
  }

  if (dryRun) {
    log.warn('DRY RUN — no enrollments will be made');
    log.summary('Enrollment Preview', {
      'Template': template.name,
      'Total contacts': contacts.length,
      'Eligible (tier ≤ ' + maxTier + ')': eligible.length,
      'Emails per contact': template.emails.length,
      'Sequence duration': `${template.emails[template.emails.length - 1].delayDays} days`,
      'Sender': senderEmail,
    });
    return;
  }

  // Get or create sequence in HubSpot
  log.info('Syncing sequence to HubSpot...');
  const sequenceId = await getOrCreateSequence(template);

  // Enroll contacts
  log.info(`Enrolling ${eligible.length} contacts...`);
  const { enrolled, errors } = await batchEnroll({
    sequenceId,
    contacts: eligible,
    senderEmail,
    onProgress: (current, total, contact) => {
      log.verbose(`  Enrolled ${current}/${total}: ${contact.email}`);
    },
  });

  // Summary
  log.summary('Enrollment Complete', {
    'Sequence': template.name,
    'Sequence ID': sequenceId,
    'Total contacts': contacts.length,
    'Eligible': eligible.length,
    'Enrolled': enrolled.length,
    'Errors': errors.length,
    'Sender': senderEmail,
  });

  if (errors.length > 0) {
    log.warn('Enrollment errors:');
    for (const e of errors) {
      log.error(`  ${e.contact.email}: ${e.error}`);
    }
  }
}

main().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  if (verbose) console.error(err);
  process.exit(1);
});
