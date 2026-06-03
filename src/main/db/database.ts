import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import type { Database as SqlDatabase } from 'sql.js';
import { runMigrations } from './migrations';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require('sql.js');

let _db: SqlDatabase | null = null;
let _dbPath = '';

export async function initDb(): Promise<SqlDatabase> {
  _dbPath = path.join(app.getPath('userData'), 'database.db');

  const SQL = await initSqlJs({
    locateFile: (filename: string) =>
      path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', filename),
  });

  if (fs.existsSync(_dbPath)) {
    const fileBuffer = fs.readFileSync(_dbPath);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  _db!.run('PRAGMA foreign_keys = ON');
  runMigrations(_db!);
  saveDb();

  return _db!;
}

export function getDb(): SqlDatabase {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

export function saveDb(): void {
  if (!_db || !_dbPath) return;
  const data = _db.export();
  fs.writeFileSync(_dbPath, Buffer.from(data));
}

export function closeDb(): void {
  if (_db) {
    saveDb();
    _db.close();
    _db = null;
  }
}

// Helpers that mirror better-sqlite3's synchronous API
export function dbRun(sql: string, params: unknown[] = []): void {
  getDb().run(sql, params as never);
  saveDb();
}

export function dbGet<T>(sql: string, params: unknown[] = []): T | null {
  const stmt = getDb().prepare(sql);
  stmt.bind(params as never);
  const row = stmt.step() ? (stmt.getAsObject() as T) : null;
  stmt.free();
  return row;
}

export function dbAll<T>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql);
  const rows: T[] = [];
  stmt.bind(params as never);
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

export function dbExec(sql: string): void {
  getDb().exec(sql);
  saveDb();
}

export function lastInsertRowId(): number {
  const row = dbGet<{ id: number }>('SELECT last_insert_rowid() as id');
  return row?.id ?? 0;
}
