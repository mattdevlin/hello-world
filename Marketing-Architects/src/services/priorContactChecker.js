import { google } from 'googleapis';
import { readFileSync, existsSync } from 'fs';
import { getClient } from './hubspotClient.js';
import { config } from '../config.js';

/**
 * Check HubSpot for prior engagement with a contact.
 *
 * @param {string} email
 * @returns {{ hasPriorContact: boolean, summary: string|null, details: object|null }}
 */
export async function checkHubSpotHistory(email) {
  const hubspot = getClient();

  try {
    const searchResult = await hubspot.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: email }],
      }],
      properties: ['email', 'hs_email_last_send_date', 'notes_last_contacted', 'num_contacted_notes'],
      limit: 1,
    });

    if (searchResult.results.length === 0) {
      return { hasPriorContact: false, summary: null, details: null };
    }

    const contact = searchResult.results[0];
    const props = contact.properties;
    const lastSend = props.hs_email_last_send_date;
    const lastContacted = props.notes_last_contacted;
    const numNotes = parseInt(props.num_contacted_notes || '0', 10);

    if (!lastSend && !lastContacted && numNotes === 0) {
      return { hasPriorContact: false, summary: null, details: null };
    }

    const parts = [];
    if (numNotes > 0) parts.push(`${numNotes} contact notes`);
    if (lastContacted) parts.push(`last contacted ${lastContacted}`);
    if (lastSend) parts.push(`last email sent ${lastSend}`);

    return {
      hasPriorContact: true,
      summary: parts.join(', '),
      details: { contactId: contact.id, lastSend, lastContacted, numNotes },
    };
  } catch {
    return { hasPriorContact: false, summary: null, details: null };
  }
}

/**
 * Get an authenticated Gmail API client.
 */
async function getGmailClient() {
  const { credentialsPath, tokenPath } = config.gmail;

  if (!existsSync(credentialsPath)) {
    throw new Error(`Gmail credentials file not found: ${credentialsPath}`);
  }
  if (!existsSync(tokenPath)) {
    throw new Error(`Gmail token file not found: ${tokenPath}. Run OAuth flow first.`);
  }

  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
  const token = JSON.parse(readFileSync(tokenPath, 'utf8'));

  const { client_id, client_secret } = credentials.installed || credentials.web || {};
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret);
  oauth2Client.setCredentials(token);

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Check Gmail for prior email threads with a contact.
 *
 * @param {string} email
 * @returns {{ hasPriorContact: boolean, summary: string|null, details: object|null }}
 */
export async function checkGmailHistory(email) {
  try {
    const gmail = await getGmailClient();

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: email,
      maxResults: 10,
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) {
      return { hasPriorContact: false, summary: null, details: null };
    }

    // Get the date of the most recent message
    const latest = await gmail.users.messages.get({
      userId: 'me',
      id: messages[0].id,
      format: 'metadata',
      metadataHeaders: ['Date', 'Subject'],
    });

    const headers = latest.data.payload?.headers || [];
    const dateHeader = headers.find(h => h.name === 'Date');
    const subjectHeader = headers.find(h => h.name === 'Subject');

    const lastDate = dateHeader ? new Date(dateHeader.value).toISOString().split('T')[0] : 'unknown date';
    const lastSubject = subjectHeader?.value || 'no subject';

    return {
      hasPriorContact: true,
      summary: `${messages.length} emails found, last on ${lastDate} ("${lastSubject}")`,
      details: { messageCount: messages.length, lastDate, lastSubject },
    };
  } catch (err) {
    // Gmail not configured — return gracefully
    return { hasPriorContact: false, summary: `Gmail check skipped: ${err.message}`, details: null };
  }
}

/**
 * Check both HubSpot and Gmail for prior contact with a given email.
 *
 * @param {string} email
 * @returns {{ hasPriorContact: boolean, summary: string, hubspot: object, gmail: object }}
 */
export async function checkPriorContact(email) {
  const [hubspot, gmail] = await Promise.all([
    checkHubSpotHistory(email),
    checkGmailHistory(email),
  ]);

  const hasPriorContact = hubspot.hasPriorContact || gmail.hasPriorContact;

  const summaryParts = [];
  if (hubspot.hasPriorContact) summaryParts.push(`HubSpot: ${hubspot.summary}`);
  if (gmail.hasPriorContact) summaryParts.push(`Gmail: ${gmail.summary}`);

  return {
    hasPriorContact,
    summary: summaryParts.join(' | ') || 'No prior contact found',
    hubspot,
    gmail,
  };
}

/**
 * Check prior contact for a batch of contacts.
 *
 * @param {Array} contacts — contacts with email field
 * @param {function} [onProgress] — callback(current, total)
 * @returns {Array} — contacts with priorContact field added
 */
export async function checkPriorContactBatch(contacts, onProgress) {
  const results = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const priorContact = await checkPriorContact(contact.email);

    results.push({
      ...contact,
      priorContact,
    });

    if (onProgress) onProgress(i + 1, contacts.length);
  }

  return results;
}
