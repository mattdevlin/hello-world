import { Client } from '@hubspot/api-client';

let hubspotClient = null;
let contactsCache = { data: null, expires: 0 };
let companiesCache = { data: null, expires: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getClient() {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    throw Object.assign(new Error('HUBSPOT_ACCESS_TOKEN not configured'), { status: 400 });
  }
  if (!hubspotClient) {
    hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });
  }
  return hubspotClient;
}

const STATUS_TO_STAGE = {
  draft: 'qualifiedtobuy',
  sent: 'presentationscheduled',
  accepted: 'closedwon',
  rejected: 'closedlost',
};

export async function getContacts() {
  if (contactsCache.data && Date.now() < contactsCache.expires) {
    return contactsCache.data;
  }

  const client = getClient();
  const response = await client.crm.contacts.basicApi.getPage(100, undefined, [
    'firstname', 'lastname', 'email', 'phone', 'company',
  ]);

  const contacts = response.results.map(c => ({
    id: c.id,
    firstName: c.properties.firstname || '',
    lastName: c.properties.lastname || '',
    email: c.properties.email || '',
    phone: c.properties.phone || '',
    company: c.properties.company || '',
  }));

  contactsCache = { data: contacts, expires: Date.now() + CACHE_TTL };
  return contacts;
}

export async function getCompanies() {
  if (companiesCache.data && Date.now() < companiesCache.expires) {
    return companiesCache.data;
  }

  const client = getClient();
  const response = await client.crm.companies.basicApi.getPage(100, undefined, [
    'name', 'phone', 'domain',
  ]);

  const companies = response.results.map(c => ({
    id: c.id,
    name: c.properties.name || '',
    phone: c.properties.phone || '',
    domain: c.properties.domain || '',
  }));

  companiesCache = { data: companies, expires: Date.now() + CACHE_TTL };
  return companies;
}

export async function syncQuoteToDeal(quote) {
  const client = getClient();
  const dealStage = STATUS_TO_STAGE[quote.status] || 'qualifiedtobuy';

  const properties = {
    dealname: `${quote.project_name || 'Quote'} — ${quote.quote_number}`,
    amount: String(quote.total_price || 0),
    dealstage: dealStage,
    pipeline: 'default',
    description: `Quote ${quote.quote_number} (v${quote.version})`,
  };

  if (quote.valid_until) {
    properties.closedate = new Date(quote.valid_until + 'T00:00:00').toISOString();
  }

  let dealId = quote.hubspot_deal_id;

  if (dealId) {
    // Update existing deal
    await client.crm.deals.basicApi.update(dealId, { properties });
  } else {
    // Create new deal
    const response = await client.crm.deals.basicApi.create({ properties });
    dealId = response.id;
  }

  // Associate with contact if we have a HubSpot contact ID
  if (quote.hubspot_contact_id && !quote.hubspot_deal_id) {
    try {
      await client.crm.associations.v4.basicApi.create(
        'deals', dealId,
        'contacts', quote.hubspot_contact_id,
        [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }],
      );
    } catch (_err) {
      // Association may already exist — ignore
    }
  }

  return dealId;
}
