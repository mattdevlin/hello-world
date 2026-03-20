# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Marketing-Architects — a Node.js CLI tool for importing, qualifying, and syncing architect contacts into HubSpot CRM. Part of the DevPro SIP (Structural Insulated Panel) marketing pipeline for reaching architects who may specify SIP panels in their projects.

## Commands

- `npm run import -- ./path/to/file.xlsx` — import architects from Excel into HubSpot
- `npm run import -- ./path/to/file.xlsx --dry-run` — preview import without pushing to HubSpot
- `npm run import -- ./path/to/file.xlsx --verbose` — detailed logging during import
- `npm run enroll -- ./path/to/results.json --sender matt@devlinproperty.co.nz` — enroll imported contacts into email sequence
- `npm run enroll -- ./path/to/results.json --sender matt@devlinproperty.co.nz --dry-run` — preview enrollment
- `npm run enroll -- ./path/to/results.json --sender matt@devlinproperty.co.nz --max-tier 1` — enroll only Tier 1 (Hot) contacts
- `npm test` — run all Vitest tests
- `npm run test:watch` — run Vitest in watch mode

## Architecture

### Pipeline Flow
1. **Excel Parser** (`src/services/excelParser.js`) — reads `.xlsx`/`.csv`, maps columns flexibly, splits names
2. **Validation** (`src/utils/validation.js`) — email validation, normalization, deduplication
3. **Architect Qualifier** (`src/services/architectQualifier.js`) — scores contacts by conversion likelihood (Tier 1-4), excludes non-targets
4. **Contact Enricher** (`src/services/contactEnricher.js`) — adds region, firm type, HubSpot properties
5. **Prior Contact Checker** (`src/services/priorContactChecker.js`) — checks Gmail + HubSpot for prior communication
6. **HubSpot Client** (`src/services/hubspotClient.js`) — upserts contacts/companies, manages associations
7. **Email Sequence** (`src/services/emailSequence.js`) — loads templates, enrolls contacts in HubSpot sequences
8. **Import CLI** (`scripts/import-architects.js`) — orchestrates the full import pipeline
9. **Enrollment CLI** (`scripts/enroll-sequence.js`) — enrolls imported contacts into email sequences

### Qualification Tiers
| Tier | Label | Score | Description |
|------|-------|-------|-------------|
| 1 | Hot | 100 | Passive House, Homestar, Healthy Homes, energy-efficient residential |
| 2 | Warm | 70 | General residential architects (new builds, renovations) |
| 3 | Viable | 40 | Commercial, industrial, schools, government buildings |
| 4 | Low | 20 | Mixed/unknown specialty |
| — | Excluded | 0 | Pure interior design, landscape, urban planning (no residential) |

### Key Files
- `src/config.js` — loads environment variables from `.env`
- `src/utils/logger.js` — structured CLI logging with chalk
- `data/sample-architects.xlsx` — sample data for testing
- `templates/architect-sequence.json` — 4-email sequence template for architect outreach

## Key Conventions

- ES modules throughout (`"type": "module"` in package.json)
- All HubSpot operations use upsert (create-or-update) to ensure idempotency
- Email addresses are always lowercased and trimmed before any operation
- The `--dry-run` flag must prevent ALL external API calls (HubSpot, Gmail)

## Reference Documents

- `sources.md` — evidence-backed research on email sequence design, conversion statistics, and B2B outreach best practices. Read this when working on email templates, sequence timing, or CTA design.

## Environment Variables

See `.env.example` for required configuration:
- `HUBSPOT_ACCESS_TOKEN` — HubSpot private app access token
- `HUBSPOT_PORTAL_ID` — HubSpot account/portal ID
- `GMAIL_CREDENTIALS_PATH` — path to Google OAuth credentials JSON
- `GMAIL_TOKEN_PATH` — path to stored Gmail API token
