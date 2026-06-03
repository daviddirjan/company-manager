import { dbAll, dbRun, dbGet } from '../db/database';
import { SmartBillClient } from './client';
import type { SmartBillConfig } from './types';

export interface SyncProgress {
  current: number;
  total: number;
  invoiceNumber: string;
  status: 'ok' | 'not_found' | 'error';
  error?: string;
}

export async function syncPaymentStatus(
  config: SmartBillConfig,
  onProgress: (p: SyncProgress) => void
): Promise<{ synced: number; notFound: number; errors: number }> {
  const state = dbGet<{ sync_in_progress: number }>('SELECT sync_in_progress FROM sync_state WHERE id = 1');
  if (state?.sync_in_progress) throw new Error('Sync already in progress');

  dbRun('UPDATE sync_state SET sync_in_progress = 1 WHERE id = 1');

  const client = new SmartBillClient(config);
  let synced = 0, notFound = 0, errors = 0;

  try {
    const invoices = dbAll<{ id: number; number: string }>(
      `SELECT id, number FROM invoices WHERE series_name = ? ORDER BY CAST(number AS INTEGER)`,
      [config.seriesName]
    );

    const total = invoices.length;

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];

      try {
        const status = await client.getPaymentStatus(inv.number);

        if (!status) {
          onProgress({ current: i + 1, total, invoiceNumber: inv.number, status: 'not_found' });
          notFound++;
          continue;
        }

        const paymentStatus = status.paid ? 'paid' : (status.paidAmount > 0 ? 'partial' : 'unpaid');

        dbRun(`
          UPDATE invoices SET
            sb_total_amount = ?, sb_paid_amount = ?, sb_unpaid_amount = ?, sb_paid = ?,
            payment_status = ?, paid_amount = ?,
            sb_synced = 1, sb_sync_at = datetime('now'), sb_error = null,
            updated_at = datetime('now')
          WHERE id = ?
        `, [status.invoiceTotalAmount, status.paidAmount, status.unpaidAmount, status.paid ? 1 : 0, paymentStatus, status.paidAmount, inv.id]);

        onProgress({ current: i + 1, total, invoiceNumber: inv.number, status: 'ok' });
        synced++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        dbRun(`UPDATE invoices SET sb_error = ?, updated_at = datetime('now') WHERE id = ?`, [msg, inv.id]);
        onProgress({ current: i + 1, total, invoiceNumber: inv.number, status: 'error', error: msg });
        errors++;
      }
    }

    const maxNum = invoices.length > 0 ? Math.max(...invoices.map(i => parseInt(i.number))) : 0;
    dbRun(`UPDATE sync_state SET last_synced_num = ?, last_sync_at = datetime('now'), sync_in_progress = 0 WHERE id = 1`, [maxNum]);
  } catch (err) {
    dbRun(`UPDATE sync_state SET sync_in_progress = 0 WHERE id = 1`);
    throw err;
  }

  return { synced, notFound, errors };
}
