import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings ORDER BY key').all();
  res.json(rows);
});

router.put('/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value == null) {
    return res.status(400).json({ error: 'value is required' });
  }

  const stmt = db.prepare(
    `UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?`
  );
  const result = stmt.run(String(value), key);

  if (result.changes === 0) {
    // Key doesn't exist yet — insert it
    db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run(key, String(value));
  }

  const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
  res.json(row);
});

export default router;
