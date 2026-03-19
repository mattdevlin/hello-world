/**
 * Architect Qualification & Tier Scoring
 *
 * Scores architects by likelihood of converting to DevPro SIP panel customers.
 * Tier 1 (Hot):    Passive House, Homestar, Healthy Homes, energy-efficient residential
 * Tier 2 (Warm):   General residential architects
 * Tier 3 (Viable): Commercial, industrial, schools, government
 * Tier 4 (Low):    Unknown / can't determine specialty
 * Excluded:        Pure interior design, landscape, urban planning (no residential at all)
 */

const TIER_1_KEYWORDS = [
  'passive house', 'passivhaus', 'homestar', 'healthy homes',
  'energy efficient', 'energy-efficient', 'high performance',
  'high-performance', 'sustainable home', 'sustainable design',
  'net zero', 'net-zero', 'zero energy', 'zero-energy',
  'green building', 'green home', 'eco home', 'eco-home',
  'thermal performance', 'airtight', 'low energy',
];

const TIER_2_KEYWORDS = [
  'residential', 'home', 'house', 'housing', 'dwelling',
  'renovation', 'new build', 'new-build', 'alterations',
  'addition', 'bespoke home', 'custom home', 'architectural home',
];

const TIER_3_KEYWORDS = [
  'commercial', 'industrial', 'school', 'education',
  'government', 'civic', 'public', 'hospital', 'healthcare',
  'retail', 'office', 'warehouse', 'mixed use', 'mixed-use',
  'community', 'church', 'religious', 'sports', 'recreation',
];

const EXCLUDE_KEYWORDS = [
  'interior design', 'interior designer', 'interiors only',
  'landscape architect', 'landscape design', 'landscaping',
  'urban planning', 'urban planner', 'town planning',
  'graphic design', 'web design', 'product design',
];

/**
 * Qualify a single contact based on available text (company name, any additional info).
 *
 * @param {object} contact — { firstName, lastName, email, company }
 * @param {string} [additionalText] — optional extra text (e.g., scraped website content, notes)
 * @returns {{ tier: number, tierLabel: string, score: number, reason: string, exclude: boolean }}
 */
export function qualifyArchitect(contact, additionalText = '') {
  const searchText = [
    contact.company || '',
    contact.firstName || '',
    contact.lastName || '',
    additionalText,
  ].join(' ').toLowerCase();

  // Check exclusion first
  const excludeMatch = EXCLUDE_KEYWORDS.find(kw => searchText.includes(kw));
  if (excludeMatch) {
    return {
      tier: 0,
      tierLabel: 'Excluded',
      score: 0,
      reason: `Excluded: matched "${excludeMatch}" — not in target market`,
      exclude: true,
    };
  }

  // Check Tier 1 (Hot)
  const tier1Match = TIER_1_KEYWORDS.find(kw => searchText.includes(kw));
  if (tier1Match) {
    return {
      tier: 1,
      tierLabel: 'Hot',
      score: 100,
      reason: `Tier 1: matched "${tier1Match}" — high-performance / sustainable focus`,
      exclude: false,
    };
  }

  // Check Tier 2 (Warm)
  const tier2Match = TIER_2_KEYWORDS.find(kw => searchText.includes(kw));
  if (tier2Match) {
    return {
      tier: 2,
      tierLabel: 'Warm',
      score: 70,
      reason: `Tier 2: matched "${tier2Match}" — residential work`,
      exclude: false,
    };
  }

  // Check Tier 3 (Viable)
  const tier3Match = TIER_3_KEYWORDS.find(kw => searchText.includes(kw));
  if (tier3Match) {
    return {
      tier: 3,
      tierLabel: 'Viable',
      score: 40,
      reason: `Tier 3: matched "${tier3Match}" — commercial/institutional`,
      exclude: false,
    };
  }

  // Default: Tier 4 (Low / unknown)
  return {
    tier: 4,
    tierLabel: 'Low',
    score: 20,
    reason: 'Tier 4: could not determine specialty from available data — flagged for manual review',
    exclude: false,
  };
}

/**
 * Qualify a batch of contacts.
 *
 * @param {Array} contacts
 * @returns {{ qualified: Array, excluded: Array }}
 */
export function qualifyBatch(contacts) {
  const qualified = [];
  const excluded = [];

  for (const contact of contacts) {
    const result = qualifyArchitect(contact);
    const enriched = { ...contact, qualification: result };

    if (result.exclude) {
      excluded.push(enriched);
    } else {
      qualified.push(enriched);
    }
  }

  // Sort by score descending (Hot first)
  qualified.sort((a, b) => b.qualification.score - a.qualification.score);

  return { qualified, excluded };
}
