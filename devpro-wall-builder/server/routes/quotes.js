import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { calculateQuotePrice } from '../services/quoteCalculator.js';
import { nextQuoteNumber, revisionQuoteNumber } from '../services/quoteNumbering.js';

const router = Router();

const VALID_STATUSES = ['draft', 'sent', 'accepted', 'rejected'];

// List quotes (filterable by project_id and status)
router.get('/', (req, res) => {
  const { project_id, status } = req.query;
  let sql = 'SELECT * FROM quotes';
  const conditions = [];
  const params = [];

  if (project_id) {
    conditions.push('project_id = ?');
    params.push(project_id);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Get single quote
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Quote not found' });
  }

  // Parse JSON fields for the response
  row.material_quantities = JSON.parse(row.material_quantities || '{}');
  row.pricing_snapshot = JSON.parse(row.pricing_snapshot || '{}');
  row.margin_snapshot = JSON.parse(row.margin_snapshot || '{}');
  row.subtotals = JSON.parse(row.subtotals || '{}');

  res.json(row);
});

// Create a new quote
router.post('/', (req, res, next) => {
  const { projectId, projectName, projectAddress, clientId, validityDays, notes, materials } =
    req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }
  if (!materials || typeof materials !== 'object' || Array.isArray(materials)) {
    return res.status(400).json({ error: 'materials must be an object' });
  }

  // Validate material categories have numeric quantity fields
  const MATERIAL_FIELDS = {
    magboard: 'totalSheets',
    eps: 'totalBlocks',
    glue: 'totalLitres',
    timber: 'totalLinealMetres',
  };
  for (const [category, field] of Object.entries(MATERIAL_FIELDS)) {
    if (materials[category] != null) {
      if (typeof materials[category] !== 'object') {
        return res.status(400).json({ error: `materials.${category} must be an object` });
      }
      if (materials[category][field] != null && typeof materials[category][field] !== 'number') {
        return res.status(400).json({ error: `materials.${category}.${field} must be a number` });
      }
    }
  }

  try {
    // Load current pricing and margins
    const pricingRows = db.prepare('SELECT * FROM pricing').all();
    const pricing = {};
    for (const row of pricingRows) {
      pricing[row.category] = row;
    }

    const marginRows = db.prepare('SELECT * FROM margins').all();
    const margins = {};
    for (const row of marginRows) {
      margins[row.key] = row.value;
    }

    // Calculate price
    const priceResult = calculateQuotePrice(materials, pricing, margins);

    // Generate quote number
    const quoteNumber = nextQuoteNumber(db);

    // Determine validity
    const days = validityDays || parseInt(
      db.prepare("SELECT value FROM settings WHERE key = 'default_validity_days'").get()?.value || '30'
    );
    const now = new Date();
    const validUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const id = uuidv4();
    db.prepare(`
      INSERT INTO quotes (
        id, quote_number, version, project_id, project_name, project_address,
        client_id, status, validity_days, valid_until,
        material_quantities, pricing_snapshot, margin_snapshot, subtotals,
        total_before_overhead, overhead_amount, total_price, notes
      ) VALUES (?, ?, 1, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      quoteNumber,
      projectId,
      projectName || null,
      projectAddress || null,
      clientId || null,
      days,
      validUntil,
      JSON.stringify(materials),
      JSON.stringify(pricing),
      JSON.stringify(margins),
      JSON.stringify(priceResult.subtotals),
      priceResult.totalBeforeOverhead,
      priceResult.overheadAmount,
      priceResult.totalPrice,
      notes || null
    );

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
    quote.material_quantities = JSON.parse(quote.material_quantities);
    quote.pricing_snapshot = JSON.parse(quote.pricing_snapshot);
    quote.margin_snapshot = JSON.parse(quote.margin_snapshot);
    quote.subtotals = JSON.parse(quote.subtotals);

    res.status(201).json(quote);
  } catch (err) {
    next(err);
  }
});

// Update quote status
router.put('/:id/status', (req, res, next) => {
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  try {
    const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    db.prepare(
      `UPDATE quotes SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(status, req.params.id);

    const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Create a revision of an existing quote
router.post('/:id/revise', (req, res, next) => {
  try {
    const original = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!original) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Find the root quote (follow parent chain)
    const rootQuoteId = original.parent_quote_id || original.id;
    const baseQuoteNumber = original.parent_quote_id
      ? db.prepare('SELECT quote_number FROM quotes WHERE id = ?').get(rootQuoteId)?.quote_number
      : original.quote_number;

    // Count existing versions
    const versionCount = db.prepare(
      'SELECT COUNT(*) as count FROM quotes WHERE parent_quote_id = ? OR id = ?'
    ).get(rootQuoteId, rootQuoteId).count;
    const newVersion = versionCount + 1;

    // Re-price with current pricing and margins
    const materials = JSON.parse(original.material_quantities || '{}');

    const pricingRows = db.prepare('SELECT * FROM pricing').all();
    const pricing = {};
    for (const row of pricingRows) {
      pricing[row.category] = row;
    }

    const marginRows = db.prepare('SELECT * FROM margins').all();
    const margins = {};
    for (const row of marginRows) {
      margins[row.key] = row.value;
    }

    const priceResult = calculateQuotePrice(materials, pricing, margins);
    const newQuoteNumber = revisionQuoteNumber(baseQuoteNumber, newVersion);

    const days = original.validity_days;
    const now = new Date();
    const validUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const id = uuidv4();
    db.prepare(`
      INSERT INTO quotes (
        id, quote_number, version, parent_quote_id, project_id, project_name, project_address,
        client_id, status, validity_days, valid_until,
        material_quantities, pricing_snapshot, margin_snapshot, subtotals,
        total_before_overhead, overhead_amount, total_price, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      newQuoteNumber,
      newVersion,
      rootQuoteId,
      original.project_id,
      original.project_name,
      original.project_address,
      original.client_id,
      days,
      validUntil,
      original.material_quantities,
      JSON.stringify(pricing),
      JSON.stringify(margins),
      JSON.stringify(priceResult.subtotals),
      priceResult.totalBeforeOverhead,
      priceResult.overheadAmount,
      priceResult.totalPrice,
      original.notes
    );

    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id);
    quote.material_quantities = JSON.parse(quote.material_quantities);
    quote.pricing_snapshot = JSON.parse(quote.pricing_snapshot);
    quote.margin_snapshot = JSON.parse(quote.margin_snapshot);
    quote.subtotals = JSON.parse(quote.subtotals);

    res.status(201).json(quote);
  } catch (err) {
    next(err);
  }
});

// Delete a draft quote
router.delete('/:id', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    if (existing.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft quotes can be deleted' });
    }

    db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
