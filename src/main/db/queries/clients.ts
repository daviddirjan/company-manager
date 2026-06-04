import { dbRun, dbGet, dbAll, lastInsertRowId } from '../database';

export interface Client {
  id: number;
  name: string;
  vat_code: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface ClientWithStats extends Client {
  invoice_count: number;
  total_eur: number;
  total_ron: number;
  total_chf: number;
  total_pln: number;
  total_usd: number;
}

export function upsertClient(name: string, vat_code?: string, country?: string, address?: string): number {
  const existing = dbGet<{ id: number }>('SELECT id FROM clients WHERE name = ?', [name]);
  if (existing) return existing.id;
  dbRun('INSERT INTO clients (name, vat_code, country, address) VALUES (?,?,?,?)', [name, vat_code ?? null, country ?? null, address ?? null]);
  return lastInsertRowId();
}

export function listClients(): Client[] {
  return dbAll<Client>('SELECT * FROM clients ORDER BY name');
}

export function listClientsWithStats(): ClientWithStats[] {
  return dbAll<ClientWithStats>(`
    SELECT
      c.id, c.name, c.vat_code, c.country, c.phone, c.email, c.created_at,
      COUNT(i.id) as invoice_count,
      SUM(CASE WHEN i.currency = 'EUR' THEN i.total_amount ELSE 0 END) as total_eur,
      SUM(CASE WHEN i.currency = 'RON' THEN i.total_amount ELSE 0 END) as total_ron,
      SUM(CASE WHEN i.currency = 'CHF' THEN i.total_amount ELSE 0 END) as total_chf,
      SUM(CASE WHEN i.currency = 'PLN' THEN i.total_amount ELSE 0 END) as total_pln,
      SUM(CASE WHEN i.currency = 'USD' THEN i.total_amount ELSE 0 END) as total_usd
    FROM clients c
    LEFT JOIN invoices i ON i.client_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `);
}

export function updateClient(id: number, data: { phone?: string | null; email?: string | null }): void {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const vals = [...keys.map(k => (data as Record<string, unknown>)[k]), id];
  dbRun(`UPDATE clients SET ${sets} WHERE id = ?`, vals);
}
