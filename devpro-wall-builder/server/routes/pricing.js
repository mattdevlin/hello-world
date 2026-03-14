import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM pricing ORDER BY category').all();
  res.json(rows);
});

router.put('/:category', (req, res) => {
  const { category } = req.params;
  const { unit_cost, description } = req.body;

  if (unit_cost == null || typeof unit_cost !== 'number') {
    return res.status(400).json({ error: 'unit_cost must be a number' });
  }

  const stmt = db.prepare(
    `UPDATE pricing SET unit_cost = ?, description = COALESCE(?, description), updated_at = datetime('now') WHERE category = ?`
  );
  const result = stmt.run(unit_cost, description ?? null, category);

  if (result.changes === 0) {
    return res.status(404).json({ error: `Category "${category}" not found` });
  }

  const row = db.prepare('SELECT * FROM pricing WHERE category = ?').get(category);
  res.json(row);
});

export default router;
