/**
 * Contact Enrichment
 *
 * Adds region, firm type, and HubSpot properties to qualified contacts.
 */

const NZ_REGIONS = [
  'Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga',
  'Dunedin', 'Palmerston North', 'Napier', 'Hastings', 'Nelson',
  'New Plymouth', 'Rotorua', 'Whangarei', 'Invercargill', 'Whanganui',
  'Gisborne', 'Blenheim', 'Timaru', 'Queenstown', 'Kapiti',
  'Northland', 'Waikato', 'Bay of Plenty', 'Hawkes Bay', "Hawke's Bay",
  'Taranaki', 'Manawatu', 'Wairarapa', 'Canterbury', 'Otago',
  'Southland', 'West Coast', 'Marlborough', 'Coromandel',
];

const FIRM_PATTERNS = [
  { pattern: /&\s*associates/i, type: 'Associates Practice' },
  { pattern: /group\b/i, type: 'Architecture Group' },
  { pattern: /studio\b/i, type: 'Design Studio' },
  { pattern: /partnership/i, type: 'Partnership' },
  { pattern: /collective/i, type: 'Collective' },
  { pattern: /\bltd\b|\blimited\b/i, type: 'Limited Company' },
  { pattern: /architects?\b/i, type: 'Architecture Practice' },
  { pattern: /design\b/i, type: 'Design Practice' },
];

/**
 * Extract region from company name.
 */
export function extractRegion(companyName) {
  if (!companyName) return null;
  const lower = companyName.toLowerCase();
  for (const region of NZ_REGIONS) {
    if (lower.includes(region.toLowerCase())) return region;
  }
  return null;
}

/**
 * Infer firm type from company name patterns.
 */
export function inferFirmType(companyName) {
  if (!companyName) return 'Unknown';
  for (const { pattern, type } of FIRM_PATTERNS) {
    if (pattern.test(companyName)) return type;
  }
  return 'Unknown';
}

/**
 * Enrich a single contact with region, firm type, and HubSpot properties.
 *
 * @param {object} contact — a qualified contact with qualification data
 * @returns {object} — contact with added enrichment fields
 */
export function enrichContact(contact) {
  const region = extractRegion(contact.company);
  const firmType = inferFirmType(contact.company);

  return {
    ...contact,
    enrichment: {
      region,
      firmType,
      lifecycleStage: 'lead',
      leadSource: 'excel_import',
      architectPipeline: true,
      qualificationTier: contact.qualification?.tier ?? 4,
      qualificationTierLabel: contact.qualification?.tierLabel ?? 'Low',
    },
  };
}

/**
 * Enrich a batch of contacts.
 */
export function enrichBatch(contacts) {
  return contacts.map(enrichContact);
}
