import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM margins ORDER BY key').all();
  res.json(rows);
});

router.put('/:key', (req, res, next) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value == null || typeof value !== 'number') {
    return res.status(400).json({ error: 'value must be a number' });
  }

  try {
    const stmt = db.prepare(
      `UPDATE margins SET value = ?, updated_at = datetime('now') WHERE key = ?`
    );
    const result = stmt.run(value, key);

    if (result.changes === 0) {
      return res.status(404).json({ error: `Margin key "${key}" not found` });
    }

    const row = db.prepare('SELECT * FROM margins WHERE key = ?').get(key);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

export default router;
