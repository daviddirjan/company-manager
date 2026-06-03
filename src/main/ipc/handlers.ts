import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import path from 'node:path';
import { IPC } from './channels';
import { listInvoices, getInvoice, upsertInvoice, updateInvoice, deleteInvoice, getDashboardStats } from '../db/queries/invoices';
import { listClients } from '../db/queries/clients';
import { importFromFolder } from '../import/folderImporter';
import { autoLinkPdfs } from '../pdf/linker';
import { syncPaymentStatus } from '../smartbill/sync';
import type Store from 'electron-store';

let storeRef: InstanceType<typeof Store> | null = null;

export function setStore(s: InstanceType<typeof Store>): void {
  storeRef = s;
}

export function registerHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle(IPC.INVOICE_LIST, (_e, filters) => listInvoices(filters));
  ipcMain.handle(IPC.INVOICE_GET, (_e, id: number) => getInvoice(id));

  ipcMain.handle(IPC.INVOICE_CREATE, (_e, data) => upsertInvoice(data));

  ipcMain.handle(IPC.INVOICE_UPDATE, (_e, id: number, data) => {
    updateInvoice(id, data);
    return getInvoice(id);
  });

  ipcMain.handle(IPC.INVOICE_DELETE, (_e, id: number) => {
    deleteInvoice(id);
    return true;
  });

  ipcMain.handle(IPC.INVOICE_LINK_PDF, (_e, id: number, filePath: string) => {
    updateInvoice(id, {
      pdf_path: filePath,
      pdf_filename: path.basename(filePath),
      pdf_linked: 1,
    } as never);
    return true;
  });

  ipcMain.handle(IPC.INVOICE_OPEN_PDF, (_e, filePath: string) => {
    return shell.openPath(filePath);
  });

  ipcMain.handle(IPC.DASHBOARD_STATS, () => ({
    stats: getDashboardStats(),
    clients: listClients().length,
  }));

  ipcMain.handle(IPC.IMPORT_START, async (_e, folderPath: string) => {
    const result = await importFromFolder(folderPath, (progress) => {
      mainWindow.webContents.send(IPC.IMPORT_PROGRESS, progress);
    });
    autoLinkPdfs(folderPath);
    return result;
  });

  ipcMain.handle(IPC.SYNC_START, async () => {
    if (!storeRef) throw new Error('Store not initialized');
    const username = storeRef.get('smartbillUsername') as string;
    const token = storeRef.get('smartbillToken') as string;
    const cif = storeRef.get('companyCif') as string;
    const seriesName = (storeRef.get('seriesName') as string) || 'AX';

    if (!username || !token || !cif) throw new Error('SmartBill credentials not configured');

    return syncPaymentStatus({ username, token, cif, seriesName }, (progress) => {
      mainWindow.webContents.send(IPC.SYNC_PROGRESS, progress);
    });
  });

  ipcMain.handle(IPC.SETTINGS_GET, () => {
    if (!storeRef) return {};
    return {
      smartbillUsername: storeRef.get('smartbillUsername', '') as string,
      smartbillToken: storeRef.get('smartbillToken', '') as string,
      companyCif: storeRef.get('companyCif', '') as string,
      seriesName: storeRef.get('seriesName', 'AX') as string,
      pdfFolderPath: storeRef.get('pdfFolderPath', '') as string,
    };
  });

  ipcMain.handle(IPC.SETTINGS_SAVE, (_e, data: Record<string, string>) => {
    if (!storeRef) return false;
    for (const [key, value] of Object.entries(data)) storeRef.set(key, value);
    const folderPath = storeRef.get('pdfFolderPath') as string;
    if (folderPath) autoLinkPdfs(folderPath);
    return true;
  });

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.DIALOG_OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}
