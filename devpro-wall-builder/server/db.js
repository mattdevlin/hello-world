import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'devpro-quotes.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
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
