import { Client } from '@hubspot/api-client';
import { config } from '../config.js';

let client = null;

/**
 * Get or create the HubSpot API client singleton.
 */
export function getClient() {
  if (!client) {
    if (!config.hubspot.accessToken) {
      throw new Error('HUBSPOT_ACCESS_TOKEN is not set. Check your .env file.');
    }
    client = new Client({ accessToken: config.hubspot.accessToken });
  }
  return client;
}

/**
 * Override the client (for testing).
 */
export function setClient(mockClient) {
  client = mockClient;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff on 429/500 errors.
 */
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.code || err?.statusCode || err?.response?.status;
      const retryable = status === 429 || status >= 500;

      if (!retryable || attempt === maxRetries) throw err;

      const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      await sleep(delay);
    }
  }
}

/**
 * Upsert a single contact by email (create or update).
 *
 * @param {object} contact — enriched contact object
 * @returns {object} — HubSpot contact response with id
 */
export async function upsertContact(contact) {
  const hubspot = getClient();

  const properties = {
    email: contact.email,
    firstname: contact.firstName,
    lastname: contact.lastName,
    company: contact.company,
    lifecyclestage: contact.enrichment?.lifecycleStage || 'lead',
    hs_lead_status: 'NEW',
  };

  // Add custom properties if they exist in the portal
  if (contact.enrichment?.region) {
    properties.city = contact.enrichment.region;
  }

  return withRetry(async () => {
    try {
      // Try to create first
      const result = await hubspot.crm.contacts.basicApi.create({
        properties,
        associations: [],
      });
      return { id: result.id, created: true };
    } catch (err) {
      // If conflict (contact exists), update instead
      if (err?.code === 409 || err?.statusCode === 409) {
        const searchResult = await hubspot.crm.contacts.searchApi.doSearch({
          filterGroups: [{
            filters: [{ propertyName: 'email', operator: 'EQ', value: contact.email }],
          }],
          properties: ['email'],
          limit: 1,
        });

        if (searchResult.results.length > 0) {
          const existingId = searchResult.results[0].id;
          await hubspot.crm.contacts.basicApi.update(existingId, { properties });
          return { id: existingId, created: false };
        }
      }
      throw err;
    }
  });
}

/**
 * Upsert a company by name (create or update).
 *
 * @param {string} companyName
 * @returns {object} — { id, created }
 */
export async function upsertCompany(companyName) {
  const hubspot = getClient();

  return withRetry(async () => {
    // Search for existing company
    const searchResult = await hubspot.crm.companies.searchApi.doSearch({
      filterGroups: [{
        filters: [{ propertyName: 'name', operator: 'EQ', value: companyName }],
      }],
      properties: ['name'],
      limit: 1,
    });

    if (searchResult.results.length > 0) {
      return { id: searchResult.results[0].id, created: false };
    }

    // Create new company
    const result = await hubspot.crm.companies.basicApi.create({
      properties: { name: companyName },
      associations: [],
    });
    return { id: result.id, created: true };
  });
}

/**
 * Associate a contact with a company.
 *
 * @param {string} contactId
 * @param {string} companyId
 */
export async function associateContactToCompany(contactId, companyId) {
  const hubspot = getClient();

  return withRetry(async () => {
    await hubspot.crm.associations.v4.basicApi.create(
      'contacts',
      contactId,
      'companies',
      companyId,
      [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 1 }],
    );
  });
}

/**
 * Batch upsert contacts. Processes in chunks of 100.
 *
 * @param {Array} contacts — enriched contacts
 * @param {function} [onProgress] — callback(current, total)
 * @returns {{ imported: Array, errors: Array }}
 */
export async function batchUpsertContacts(contacts, onProgress) {
  const imported = [];
  const errors = [];
  const companyCache = new Map(); // name -> companyId

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];

    try {
      // Upsert contact
      const contactResult = await upsertContact(contact);

      // Upsert and associate company if provided
      if (contact.company) {
        let companyId = companyCache.get(contact.company);
        if (!companyId) {
          const companyResult = await upsertCompany(contact.company);
          companyId = companyResult.id;
          companyCache.set(contact.company, companyId);
        }
        await associateContactToCompany(contactResult.id, companyId);
      }

      imported.push({
        ...contact,
        hubspotContactId: contactResult.id,
        wasCreated: contactResult.created,
      });
    } catch (err) {
      errors.push({
        contact,
        error: err.message || String(err),
      });
    }

    if (onProgress) onProgress(i + 1, contacts.length);

    // Rate limiting: ~10 contacts/second to stay well under 100 req/10s
    if ((i + 1) % 10 === 0) await sleep(1000);
  }

  return { imported, errors };
}
