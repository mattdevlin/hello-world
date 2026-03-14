import { Router } from 'express';
import db from '../db.js';

const router = Router();

const VALID_KEYS = new Set([
  'default_validity_days',
  'gst_rate',
  'company_name',
  'company_phone',
  'company_email',
  'terms_and_conditions',
]);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings ORDER BY key').all();
  res.json(rows);
});

router.put('/:key', (req, res, next) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!VALID_KEYS.has(key)) {
    return res.status(404).json({ error: `Unknown setting key "${key}"` });
  }

  if (value == null) {
    return res.status(400).json({ error: 'value is required' });
  }

  try {
    const stmt = db.prepare(
      `UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?`
    );
    stmt.run(String(value), key);

    const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

export default router;
