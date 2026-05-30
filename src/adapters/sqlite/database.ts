import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SqliteDatabase = Database.Database;

export function openInventoryDatabase(path: string): SqliteDatabase {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  ensureInventorySchema(sqlite);
  return sqlite;
}

export function ensureInventorySchema(sqlite: SqliteDatabase): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      serial_number TEXT,
      location TEXT,
      owner TEXT,
      purchase_date TEXT,
      purchase_price_minor INTEGER,
      currency TEXT,
      merchant TEXT,
      warranty_start TEXT,
      warranty_end TEXT,
      warranty_months INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
    CREATE INDEX IF NOT EXISTS idx_items_serial_number ON items(serial_number);
  `);
}

