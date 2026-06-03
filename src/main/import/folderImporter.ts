import fs from 'node:fs';
import path from 'node:path';
import { extractFromPdf } from './pdfExtractor';
import { upsertInvoice } from '../db/queries/invoices';
import { upsertClient } from '../db/queries/clients';

export interface ImportProgress {
  current: number;
  total: number;
  filename: string;
  status: 'ok' | 'skip' | 'error';
  error?: string;
}

export async function importFromFolder(
  folderPath: string,
  onProgress: (p: ImportProgress) => void
): Promise<{ imported: number; skipped: number; errors: number }> {
  const files = fs.readdirSync(folderPath)
    .filter(f => /^AX\d+\.pdf$/i.test(f) || /^CHITANTA_AX\d+\.pdf$/i.test(f))
    .sort();

  const total = files.length;
  let imported = 0, skipped = 0, errors = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(folderPath, filename);

    try {
      const extracted = await extractFromPdf(filePath);
      if (!extracted) {
        onProgress({ current: i + 1, total, filename, status: 'skip' });
        skipped++;
        continue;
      }

      const clientId = upsertClient(
        extracted.client_name,
        extracted.client_vat_code ?? undefined,
        extracted.client_country ?? undefined
      );

      upsertInvoice({
        series_name: extracted.series_name,
        number: extracted.number,
        issue_date: extracted.issue_date,
        due_date: extracted.due_date,
        client_id: clientId,
        client_name: extracted.client_name,
        client_vat_code: extracted.client_vat_code,
        total_amount: extracted.total_amount,
        currency: extracted.currency,
        payment_status: 'unpaid',
        paid_amount: 0,
        language: extracted.language,
        sb_total_amount: null,
        sb_paid_amount: null,
        sb_unpaid_amount: null,
        sb_paid: null,
        sb_synced: 0,
        sb_sync_at: null,
        sb_error: null,
        pdf_filename: extracted.pdf_filename,
        pdf_path: extracted.pdf_path,
        pdf_linked: 1,
        source: 'pdf_import',
      });

      onProgress({ current: i + 1, total, filename, status: 'ok' });
      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onProgress({ current: i + 1, total, filename, status: 'error', error: msg });
      errors++;
    }
  }

  return { imported, skipped, errors };
}
