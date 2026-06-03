import { dbRun, dbGet, dbAll, dbExec, lastInsertRowId } from '../database';

export interface Invoice {
  id: number;
  series_name: string;
  number: string;
  issue_date: string;
  due_date: string | null;
  client_id: number | null;
  client_name: string;
  client_vat_code: string | null;
  total_amount: number;
  currency: string;
  payment_status: 'unpaid' | 'partial' | 'paid';
  paid_amount: number;
  language: string;
  sb_total_amount: number | null;
  sb_paid_amount: number | null;
  sb_unpaid_amount: number | null;
  sb_paid: number | null;
  sb_synced: number;
  sb_sync_at: string | null;
  sb_error: string | null;
  pdf_filename: string | null;
  pdf_path: string | null;
  pdf_linked: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFilters {
  search?: string;
  currency?: string;
  payment_status?: string;
  date_from?: string;
  date_to?: string;
}

export interface DashboardStats {
  currency: string;
  total_invoiced: number;
  total_paid: number;
  total_unpaid: number;
  count: number;
}

export function listInvoices(filters: InvoiceFilters = {}): Invoice[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    conditions.push('(client_name LIKE ? OR (series_name || number) LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.currency) {
    conditions.push('currency = ?');
    params.push(filters.currency);
  }
  if (filters.payment_status) {
    conditions.push('payment_status = ?');
    params.push(filters.payment_status);
  }
  if (filters.date_from) {
    conditions.push('issue_date >= ?');
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push('issue_date <= ?');
    params.push(filters.date_to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM invoices ${where} ORDER BY issue_date DESC, CAST(number AS INTEGER) DESC`;
  return dbAll<Invoice>(sql, params);
}

export function getInvoice(id: number): Invoice | null {
  return dbGet<Invoice>('SELECT * FROM invoices WHERE id = ?', [id]);
}

export function upsertInvoice(data: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): number {
  const existing = dbGet<{ id: number }>('SELECT id FROM invoices WHERE series_name = ? AND number = ?', [data.series_name, data.number]);

  if (existing) {
    const fields = Object.keys(data).filter(k => k !== 'series_name' && k !== 'number');
    const sets = [...fields.map(f => `${f} = ?`), "updated_at = datetime('now')"].join(', ');
    const vals = [...fields.map(f => (data as Record<string, unknown>)[f]), existing.id];
    dbRun(`UPDATE invoices SET ${sets} WHERE id = ?`, vals);
    return existing.id;
  } else {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const vals = keys.map(k => (data as Record<string, unknown>)[k]);
    dbRun(`INSERT INTO invoices (${keys.join(', ')}) VALUES (${placeholders})`, vals);
    return lastInsertRowId();
  }
}

export function updateInvoice(id: number, data: Partial<Invoice>): void {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const sets = [...keys.map(k => `${k} = ?`), "updated_at = datetime('now')"].join(', ');
  const vals = [...keys.map(k => (data as Record<string, unknown>)[k]), id];
  dbRun(`UPDATE invoices SET ${sets} WHERE id = ?`, vals);
}

export function deleteInvoice(id: number): void {
  dbRun('DELETE FROM invoices WHERE id = ?', [id]);
}

export function getDashboardStats(): DashboardStats[] {
  return dbAll<DashboardStats>(`
    SELECT
      currency,
      COUNT(*) as count,
      SUM(total_amount) as total_invoiced,
      SUM(paid_amount) as total_paid,
      SUM(total_amount - paid_amount) as total_unpaid
    FROM invoices
    GROUP BY currency
    ORDER BY currency
  `);
}

export { dbExec };
