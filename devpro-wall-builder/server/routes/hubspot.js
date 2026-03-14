import { Router } from 'express';
import db from '../db.js';
import { getContacts, getCompanies, syncQuoteToDeal } from '../services/hubspotService.js';

const router = Router();

router.get('/contacts', async (req, res, next) => {
  try {
    const contacts = await getContacts();
    res.json(contacts);
  } catch (err) {
    next(err);
  }
});

router.get('/companies', async (req, res, next) => {
  try {
    const companies = await getCompanies();
    res.json(companies);
  } catch (err) {
    next(err);
  }
});

router.post('/sync-quote/:quoteId', async (req, res, next) => {
  try {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.quoteId);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // If quote has a client, look up their HubSpot contact ID
    let hubspotContactId = null;
    if (quote.client_id) {
      const client = db.prepare('SELECT hubspot_contact_id FROM clients WHERE id = ?').get(quote.client_id);
      hubspotContactId = client?.hubspot_contact_id || null;
    }

    const dealId = await syncQuoteToDeal({
      ...quote,
      hubspot_contact_id: hubspotContactId,
    });

    // Store the deal ID on the quote
    db.prepare(
      `UPDATE quotes SET hubspot_deal_id = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(dealId, req.params.quoteId);

    res.json({ dealId, synced: true });
  } catch (err) {
    next(err);
  }
});

export default router;
