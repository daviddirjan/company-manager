import { dbRun, dbGet, dbAll, lastInsertRowId } from '../database';

export interface Client {
  id: number;
  name: string;
  vat_code: string | null;
  country: string | null;
  address: string | null;
  created_at: string;
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
