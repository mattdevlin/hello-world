import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM clients ORDER BY name').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Client not found' });
  }
  res.json(row);
});

router.post('/', (req, res, next) => {
  const { name, company, email, phone, address } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const id = uuidv4();
    db.prepare(
      `INSERT INTO clients (id, name, company, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, company || null, email || null, phone || null, address || null);

    const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  const { id } = req.params;
  const { name, company, email, phone, address } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    db.prepare(
      `UPDATE clients SET name = ?, company = ?, email = ?, phone = ?, address = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      name ?? existing.name,
      company ?? existing.company,
      email ?? existing.email,
      phone ?? existing.phone,
      address ?? existing.address,
      id
    );

    const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
