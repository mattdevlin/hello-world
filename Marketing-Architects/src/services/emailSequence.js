import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getClient } from './hubspotClient.js';
import * as log from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load a sequence template from the templates directory.
 *
 * @param {string} templateName — filename without extension (e.g. "architect-sequence")
 * @returns {object} — parsed template
 */
export function loadTemplate(templateName) {
  const templatePath = resolve(__dirname, '../../templates', `${templateName}.json`);
  const raw = readFileSync(templatePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Get or create a HubSpot sequence from a template.
 * Searches for an existing sequence by name first, then creates if needed.
 *
 * @param {object} template — loaded sequence template
 * @returns {string} — HubSpot sequence ID
 */
export async function getOrCreateSequence(template) {
  const hubspot = getClient();

  // Search for existing sequence by name
  const existing = await hubspot.automation.sequencesApi.search({
    filterGroups: [{
      filters: [{ propertyName: 'name', operator: 'EQ', value: template.name }],
    }],
    limit: 1,
  }).catch(() => ({ results: [] }));

  if (existing.results?.length > 0) {
    log.info(`Found existing sequence: ${template.name} (${existing.results[0].id})`);
    return existing.results[0].id;
  }

  // Create new sequence
  const sequence = await hubspot.automation.sequencesApi.create({
    name: template.name,
    steps: template.emails.map(email => ({
      type: 'EMAIL',
      delayMillis: email.delayDays * 24 * 60 * 60 * 1000,
      templateId: null, // Will be set when email templates are created
      subject: email.subject,
      body: email.body,
    })),
  });

  log.success(`Created sequence: ${template.name} (${sequence.id})`);
  return sequence.id;
}

/**
 * Enroll a single contact in a HubSpot sequence.
 *
 * @param {object} options
 * @param {string} options.sequenceId — HubSpot sequence ID
 * @param {string} options.contactId — HubSpot contact ID
 * @param {string} options.senderEmail — email address of the sender (HubSpot user)
 * @returns {object} — enrollment result
 */
export async function enrollContact({ sequenceId, contactId, senderEmail }) {
  const hubspot = getClient();

  return hubspot.automation.sequencesApi.enroll(sequenceId, {
    contactId,
    senderEmail,
    startingStepOrder: 0,
  });
}

/**
 * Enroll a batch of contacts in a sequence. Processes one at a time
 * with rate limiting to respect HubSpot's API limits.
 *
 * @param {object} options
 * @param {string} options.sequenceId — HubSpot sequence ID
 * @param {Array} options.contacts — array of { hubspotContactId, email, firstName, lastName }
 * @param {string} options.senderEmail — sender's HubSpot email
 * @param {function} [options.onProgress] — callback(current, total, contact)
 * @returns {{ enrolled: Array, errors: Array }}
 */
export async function batchEnroll({ sequenceId, contacts, senderEmail, onProgress }) {
  const enrolled = [];
  const errors = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    try {
      const result = await enrollContact({
        sequenceId,
        contactId: contact.hubspotContactId,
        senderEmail,
      });

      enrolled.push({
        ...contact,
        enrollmentId: result.id,
      });
    } catch (err) {
      errors.push({
        contact,
        error: err.message || String(err),
      });
    }

    if (onProgress) onProgress(i + 1, contacts.length, contact);

    // Rate limit: ~5 enrollments/second
    if ((i + 1) % 5 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { enrolled, errors };
}

/**
 * Build a preview of what the sequence will look like for a given contact.
 * Useful for dry-run mode.
 *
 * @param {object} template — loaded sequence template
 * @param {object} contact — contact object with firstName, lastName, company
 * @returns {Array} — array of { step, subject, delayDays, previewBody }
 */
export function previewSequence(template, contact) {
  return template.emails.map(email => ({
    step: email.step,
    label: email.label,
    subject: email.subject,
    delayDays: email.delayDays,
    to: contact.email,
    previewBody: email.body.slice(0, 120) + (email.body.length > 120 ? '...' : ''),
  }));
}

/**
 * Filter contacts eligible for sequence enrollment based on qualification tier.
 * Only Tier 1 (Hot) and Tier 2 (Warm) contacts are enrolled by default.
 *
 * @param {Array} contacts — enriched contacts with qualification data
 * @param {number} [maxTier=2] — maximum tier to include (1=Hot only, 2=Hot+Warm, etc.)
 * @returns {Array} — filtered contacts
 */
export function filterEligible(contacts, maxTier = 2) {
  return contacts.filter(c => {
    const tier = c.enrichment?.qualificationTier ?? c.qualification?.tier ?? 4;
    return tier <= maxTier;
  });
}
