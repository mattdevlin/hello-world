import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Map URL type params to DB data_type values
const TYPE_MAP = {
  walls: 'wall',
  floors: 'floor',
  roofs: 'roof',
  connections: 'connections',
  placements: 'placements',
  'wall-positions': 'wall_positions',
  h1: 'h1',
};

// Types that are entity-based (each item has its own UUID)
const ENTITY_TYPES = new Set(['wall', 'floor', 'roof']);

// Which count column to update for entity types
const COUNT_COLS = { wall: 'wall_count', floor: 'floor_count', roof: 'roof_count' };

function syncCount(projectId, dataType) {
  const col = COUNT_COLS[dataType];
  if (!col) return;
  const row = db.prepare(
    'SELECT COUNT(*) as cnt FROM project_data WHERE project_id = ? AND data_type = ?'
  ).get(projectId, dataType);
  db.prepare(`UPDATE projects SET ${col} = ?, updated_at = ? WHERE id = ?`).run(
    row.cnt, Date.now(), projectId
  );
}

// ── List all projects ──
router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  res.json(rows.map(toProjectJson));
});

// ── Create project ──
router.post('/', (req, res) => {
  const { name, address, territorialAuthority } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }
  const id = req.body.id || crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO projects (id, name, address, territorial_authority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, address || '', territorialAuthority || '', now, now);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(toProjectJson(row));
});

// ── Update project metadata ──
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const { name, address, territorialAuthority } = req.body;
  db.prepare(
    `UPDATE projects SET name = ?, address = ?, territorial_authority = ?, updated_at = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    address ?? existing.address,
    territorialAuthority ?? existing.territorial_authority,
    Date.now(),
    req.params.id
  );
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(toProjectJson(row));
});

// ── Delete project (cascade via FK) ──
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });
  db.prepare('DELETE FROM project_data WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// ── Get entities by type ──
router.get('/:id/:type', (req, res) => {
  const dataType = TYPE_MAP[req.params.type];
  if (!dataType) return res.status(400).json({ error: 'Invalid type' });

  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  if (ENTITY_TYPES.has(dataType)) {
    // Return array of parsed entities, sorted by name
    const rows = db.prepare(
      'SELECT data FROM project_data WHERE project_id = ? AND data_type = ? ORDER BY entity_id'
    ).all(req.params.id, dataType);
    const items = rows.map(r => JSON.parse(r.data));
    items.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));
    res.json(items);
  } else {
    // Singleton — return the JSON data or default
    const row = db.prepare(
      'SELECT data FROM project_data WHERE project_id = ? AND data_type = ? AND entity_id = ?'
    ).get(req.params.id, dataType, '_');
    if (!row) {
      // Return appropriate default
      if (dataType === 'wall_positions') return res.json({});
      return res.json(dataType === 'h1' ? null : []);
    }
    res.json(JSON.parse(row.data));
  }
});

// ── Upsert entity ──
router.put('/:id/:type/:entityId', (req, res) => {
  const dataType = TYPE_MAP[req.params.type];
  if (!dataType) return res.status(400).json({ error: 'Invalid type' });

  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const entityId = req.params.entityId;
  const now = Date.now();
  const data = req.body;

  // For entity types, ensure id and timestamps
  if (ENTITY_TYPES.has(dataType)) {
    if (!data.id) data.id = entityId !== '_' ? entityId : crypto.randomUUID();
    if (!data.createdAt) data.createdAt = now;
    data.updatedAt = now;
  }

  const jsonStr = JSON.stringify(data);

  // Check if row exists
  const existingRow = db.prepare(
    'SELECT 1 FROM project_data WHERE project_id = ? AND data_type = ? AND entity_id = ?'
  ).get(req.params.id, dataType, entityId);

  if (existingRow) {
    db.prepare(
      'UPDATE project_data SET data = ?, updated_at = ? WHERE project_id = ? AND data_type = ? AND entity_id = ?'
    ).run(jsonStr, now, req.params.id, dataType, entityId);
  } else {
    db.prepare(
      'INSERT INTO project_data (project_id, data_type, entity_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.params.id, dataType, entityId, jsonStr, now, now);
  }

  // Update project timestamp and counts
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, req.params.id);
  syncCount(req.params.id, dataType);

  res.json(ENTITY_TYPES.has(dataType) ? data : JSON.parse(jsonStr));
});

// ── Delete entity ──
router.delete('/:id/:type/:entityId', (req, res) => {
  const dataType = TYPE_MAP[req.params.type];
  if (!dataType) return res.status(400).json({ error: 'Invalid type' });

  db.prepare(
    'DELETE FROM project_data WHERE project_id = ? AND data_type = ? AND entity_id = ?'
  ).run(req.params.id, dataType, req.params.entityId);

  // For walls, also clean up connections, placements, wall_positions
  if (dataType === 'wall') {
    const wallId = req.params.entityId;

    // Clean connections referencing the deleted wall
    const connRow = db.prepare(
      "SELECT data FROM project_data WHERE project_id = ? AND data_type = 'connections' AND entity_id = '_'"
    ).get(req.params.id);
    if (connRow) {
      const conns = JSON.parse(connRow.data).filter(
        c => c.wallId !== wallId && c.attachedWallId !== wallId
      );
      db.prepare(
        "UPDATE project_data SET data = ?, updated_at = ? WHERE project_id = ? AND data_type = 'connections' AND entity_id = '_'"
      ).run(JSON.stringify(conns), Date.now(), req.params.id);
    }

    // Clean placements
    const placRow = db.prepare(
      "SELECT data FROM project_data WHERE project_id = ? AND data_type = 'placements' AND entity_id = '_'"
    ).get(req.params.id);
    if (placRow) {
      const placements = JSON.parse(placRow.data).filter(id => id !== wallId);
      db.prepare(
        "UPDATE project_data SET data = ?, updated_at = ? WHERE project_id = ? AND data_type = 'placements' AND entity_id = '_'"
      ).run(JSON.stringify(placements), Date.now(), req.params.id);
    }

    // Clean wall_positions
    const posRow = db.prepare(
      "SELECT data FROM project_data WHERE project_id = ? AND data_type = 'wall_positions' AND entity_id = '_'"
    ).get(req.params.id);
    if (posRow) {
      const positions = JSON.parse(posRow.data);
      delete positions[wallId];
      db.prepare(
        "UPDATE project_data SET data = ?, updated_at = ? WHERE project_id = ? AND data_type = 'wall_positions' AND entity_id = '_'"
      ).run(JSON.stringify(positions), Date.now(), req.params.id);
    }
  }

  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(Date.now(), req.params.id);
  syncCount(req.params.id, dataType);

  res.json({ deleted: true });
});

// ── Copy wall to another project ──
router.post('/:id/walls/copy', (req, res) => {
  const { wall, targetProjectId } = req.body;
  if (!wall || !targetProjectId) {
    return res.status(400).json({ error: 'wall and targetProjectId required' });
  }
  const target = db.prepare('SELECT * FROM projects WHERE id = ?').get(targetProjectId);
  if (!target) return res.status(404).json({ error: 'Target project not found' });

  const now = Date.now();
  const copy = { ...wall, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  db.prepare(
    'INSERT INTO project_data (project_id, data_type, entity_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(targetProjectId, 'wall', copy.id, JSON.stringify(copy), now, now);
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, targetProjectId);
  syncCount(targetProjectId, 'wall');

  res.status(201).json(copy);
});

// ── One-shot migration from localStorage ──
router.post('/migrate', (req, res, next) => {
  const { projects, data } = req.body;
  // projects: array of project objects
  // data: { [localStorageKey]: parsedValue }
  if (!Array.isArray(projects)) {
    return res.status(400).json({ error: 'projects must be an array' });
  }

  try {
    const doMigrate = db.transaction(() => {
      for (const p of projects) {
        // Skip if project already exists
        const exists = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(p.id);
        if (exists) continue;

        db.prepare(
          `INSERT INTO projects (id, name, address, territorial_authority, wall_count, floor_count, roof_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          p.id, p.name, p.address || '', p.territorialAuthority || '',
          p.wallCount || 0, p.floorCount || 0, p.roofCount || 0,
          p.createdAt || Date.now(), p.updatedAt || Date.now()
        );

        // Import walls
        const wallsKey = `devpro-project-${p.id}`;
        const walls = data[wallsKey];
        if (Array.isArray(walls)) {
          for (const wall of walls) {
            db.prepare(
              'INSERT OR IGNORE INTO project_data (project_id, data_type, entity_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(p.id, 'wall', wall.id, JSON.stringify(wall), wall.createdAt || Date.now(), wall.updatedAt || Date.now());
          }
        }

        // Import floors
        const floorsKey = `devpro-project-${p.id}-floors`;
        const floors = data[floorsKey];
        if (Array.isArray(floors)) {
          for (const floor of floors) {
            db.prepare(
              'INSERT OR IGNORE INTO project_data (project_id, data_type, entity_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(p.id, 'floor', floor.id, JSON.stringify(floor), floor.createdAt || Date.now(), floor.updatedAt || Date.now());
          }
        }

        // Import roofs
        const roofsKey = `devpro-project-${p.id}-roofs`;
        const roofs = data[roofsKey];
        if (Array.isArray(roofs)) {
          for (const roof of roofs) {
            db.prepare(
              'INSERT OR IGNORE INTO project_data (project_id, data_type, entity_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(p.id, 'roof', roof.id, JSON.stringify(roof), roof.createdAt || Date.now(), roof.updatedAt || Date.now());
          }
        }

        // Import singletons
        const singletons = {
          connections: `devpro-project-${p.id}-connections`,
          placements: `devpro-project-${p.id}-placements`,
          wall_positions: `devpro-project-${p.id}-wallpositions`,
          h1: `devpro-project-${p.id}-h1`,
        };
        for (const [dataType, key] of Object.entries(singletons)) {
          const val = data[key];
          if (val != null) {
            db.prepare(
              'INSERT OR IGNORE INTO project_data (project_id, data_type, entity_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(p.id, dataType, '_', JSON.stringify(val), Date.now(), Date.now());
          }
        }

        // Re-sync counts from actual data
        syncCount(p.id, 'wall');
        syncCount(p.id, 'floor');
        syncCount(p.id, 'roof');
      }
    });

    doMigrate();
    res.json({ migrated: projects.length });
  } catch (err) {
    next(err);
  }
});

function toProjectJson(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    territorialAuthority: row.territorial_authority,
    wallCount: row.wall_count,
    floorCount: row.floor_count,
    roofCount: row.roof_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;
