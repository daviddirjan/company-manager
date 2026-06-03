import type { Database as SqlDatabase } from 'sql.js';

export function runMigrations(db: SqlDatabase): void {
  db.run(`CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const stmt = db.prepare('SELECT MAX(version) as v FROM schema_version');
  stmt.step();
  const row = stmt.getAsObject() as { v: number | null };
  stmt.free();
  const current = row.v ?? 0;

  if (current < 1) {
    db.run(`
      CREATE TABLE IF NOT EXISTS clients (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE,
        vat_code    TEXT,
        country     TEXT,
        address     TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        series_name       TEXT NOT NULL DEFAULT 'AX',
        number            TEXT NOT NULL,
        issue_date        TEXT NOT NULL,
        due_date          TEXT,
        client_id         INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        client_name       TEXT NOT NULL,
        client_vat_code   TEXT,
        total_amount      REAL NOT NULL,
        currency          TEXT NOT NULL CHECK(currency IN ('RON','EUR','CHF','PLN','USD')),
        payment_status    TEXT NOT NULL DEFAULT 'unpaid'
                          CHECK(payment_status IN ('unpaid','partial','paid')),
        paid_amount       REAL NOT NULL DEFAULT 0,
        language          TEXT DEFAULT 'ro' CHECK(language IN ('ro','es','en','fr')),
        sb_total_amount   REAL,
        sb_paid_amount    REAL,
        sb_unpaid_amount  REAL,
        sb_paid           INTEGER,
        sb_synced         INTEGER NOT NULL DEFAULT 0,
        sb_sync_at        TEXT,
        sb_error          TEXT,
        pdf_filename      TEXT,
        pdf_path          TEXT,
        pdf_linked        INTEGER NOT NULL DEFAULT 0,
        source            TEXT NOT NULL DEFAULT 'pdf_import'
                          CHECK(source IN ('pdf_import','manual','smartbill')),
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(series_name, number)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_issue_date     ON invoices(issue_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_client_name    ON invoices(client_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_currency       ON invoices(currency)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status)`);

    db.run(`
      CREATE TABLE IF NOT EXISTS sync_state (
        id               INTEGER PRIMARY KEY CHECK(id=1),
        last_synced_num  INTEGER NOT NULL DEFAULT 0,
        last_sync_at     TEXT,
        sync_in_progress INTEGER NOT NULL DEFAULT 0
      )
    `);
    db.run(`INSERT OR IGNORE INTO sync_state(id) VALUES(1)`);

    db.run(`INSERT OR IGNORE INTO schema_version(version) VALUES(1)`);
  }
}
