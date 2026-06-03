import fs from 'node:fs';
import path from 'node:path';
import { dbAll, dbRun } from '../db/database';

export function autoLinkPdfs(folderPath: string): number {
  if (!folderPath || !fs.existsSync(folderPath)) return 0;

  const unlinked = dbAll<{ id: number; series_name: string; number: string }>(
    'SELECT id, series_name, number FROM invoices WHERE pdf_linked = 0'
  );

  let linked = 0;

  for (const inv of unlinked) {
    const paddedNum = inv.number.padStart(3, '0');
    const filename = `${inv.series_name}${paddedNum}.pdf`;
    const fullPath = path.join(folderPath, filename);

    if (fs.existsSync(fullPath)) {
      dbRun(
        "UPDATE invoices SET pdf_path = ?, pdf_filename = ?, pdf_linked = 1, updated_at = datetime('now') WHERE id = ?",
        [fullPath, filename, inv.id]
      );
      linked++;
    }
  }

  return linked;
}
