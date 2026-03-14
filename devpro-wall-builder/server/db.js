import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'devpro-quotes.db');

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Compatibility wrapper ──────────────────────────────────────
// Wraps sql.js to expose the same synchronous API as better-sqlite3:
//   db.prepare(sql).run(...params)  → { changes }
//   db.prepare(sql).get(...params)  → row object | undefined
//   db.prepare(sql).all(...params)  → [row objects]
//   db.exec(sql)
//   db.transaction(fn) → wrapped fn
//   db.pragma(string)  → (no-op for WAL; foreign_keys supported)
//   db.close()

function createWrapper(SQL, dbPath) {
  let rawDb;
  try {
    const fileBuffer = fs.readFileSync(dbPath);
    rawDb = new SQL.Database(fileBuffer);
  } catch {
    rawDb = new SQL.Database();
  }

  let inTransaction = false;

  // Auto-save to disk after writes (skip during transactions — commit will persist)
  function persist() {
    if (inTransaction) return;
    const data = rawDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  function rowsToObjects(stmt) {
    const cols = stmt.getColumnNames();
    const results = [];
    while (stmt.step()) {
      const vals = stmt.get();
      const obj = {};
      for (let i = 0; i < cols.length; i++) {
        obj[cols[i]] = vals[i];
      }
      results.push(obj);
    }
    return results;
  }

  const db = {
    prepare(sql) {
      return {
        run(...params) {
          rawDb.run(sql, params);
          const changes = rawDb.getRowsModified();
          persist();
          return { changes };
        },
        get(...params) {
          const stmt = rawDb.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const obj = {};
            for (let i = 0; i < cols.length; i++) {
              obj[cols[i]] = vals[i];
            }
            stmt.free();
            return obj;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const stmt = rawDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          const results = rowsToObjects(stmt);
          stmt.free();
          return results;
        },
      };
    },

    exec(sql) {
      rawDb.exec(sql);
      persist();
    },

    pragma(str) {
      // sql.js doesn't support WAL (in-memory/file-based), but we can handle foreign_keys
      if (str.includes('foreign_keys')) {
        rawDb.run('PRAGMA foreign_keys = ON');
      }
      // WAL and other pragmas are silently ignored
    },

    transaction(fn) {
      return (...args) => {
        rawDb.run('BEGIN TRANSACTION');
        inTransaction = true;
        try {
          const result = fn(...args);
          rawDb.run('COMMIT');
          inTransaction = false;
          // Persist after successful commit
          const data = rawDb.export();
          fs.writeFileSync(dbPath, Buffer.from(data));
          return result;
        } catch (err) {
          inTransaction = false;
          try { rawDb.run('ROLLBACK'); } catch { /* already rolled back */ }
          throw err;
        }
      };
    },

    close() {
      persist();
      rawDb.close();
    },
  };

  return db;
}

// ── Initialize ──────────────────────────────────────────────────

const SQL = await initSqlJs();
const db = createWrapper(SQL, DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS pricing (
    category TEXT PRIMARY KEY,
    unit TEXT NOT NULL,
    unit_cost REAL NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS margins (
    key TEXT PRIMARY KEY,
    value REAL NOT NULL,
    label TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    hubspot_contact_id TEXT,
    hubspot_company_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    quote_number TEXT UNIQUE NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    parent_quote_id TEXT,
    project_id TEXT NOT NULL,
    project_name TEXT,
    project_address TEXT,
    client_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    validity_days INTEGER NOT NULL DEFAULT 30,
    valid_until TEXT,
    material_quantities TEXT,
    pricing_snapshot TEXT,
    margin_snapshot TEXT,
    subtotals TEXT,
    total_before_overhead REAL,
    overhead_amount REAL,
    total_price REAL,
    notes TEXT,
    hubspot_deal_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (parent_quote_id) REFERENCES quotes(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quote_number_seq (
    year INTEGER PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0
  );
`);

export default db;
