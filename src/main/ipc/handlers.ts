import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import path from 'node:path';
import { IPC } from './channels';
import { listInvoices, getInvoice, upsertInvoice, updateInvoice, deleteInvoice, getDashboardStats, getChartData } from '../db/queries/invoices';
import { listClients, listClientsWithStats, updateClient } from '../db/queries/clients';
import { dbAll } from '../db/database';
import { importFromFolder } from '../import/folderImporter';
import { autoLinkPdfs } from '../pdf/linker';
import { syncPaymentStatus } from '../smartbill/sync';
import { chatStream, checkConnection } from '../llm/ollama';
import { createChatSession, listChatSessions, deleteChatSession, getChatMessages, saveChatMessage, renameChatSession } from '../db/queries/chat';
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

  ipcMain.handle(IPC.DASHBOARD_CHART, (_e, period: 'month' | 'year' | 'all') => getChartData(period));

  ipcMain.handle(IPC.IMPORT_START, async (_e, folderPath: string) => {
    const result = await importFromFolder(folderPath, (progress) => {
      mainWindow.webContents.send(IPC.IMPORT_PROGRESS, progress);
    });
    autoLinkPdfs(folderPath);
    return result;
  });

  ipcMain.handle(IPC.IMPORT_SYNC, async (_e, folderPath: string) => {
    const result = await importFromFolder(folderPath, (progress) => {
      mainWindow.webContents.send(IPC.IMPORT_PROGRESS, progress);
    }, { onlyNew: true });
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
      ollamaUrl: storeRef.get('ollamaUrl', 'http://localhost:11434') as string,
      ollamaModel: storeRef.get('ollamaModel', 'qwen3.5:0.8b') as string,
    };
  });

  ipcMain.handle(IPC.SETTINGS_SAVE, (_e, data: Record<string, string>) => {
    if (!storeRef) return false;
    for (const [key, value] of Object.entries(data)) storeRef.set(key, value);
    const folderPath = storeRef.get('pdfFolderPath') as string;
    if (folderPath) autoLinkPdfs(folderPath);
    return true;
  });

  ipcMain.handle(IPC.CLIENTS_LIST, () => listClientsWithStats());
  ipcMain.handle(IPC.CLIENTS_UPDATE, (_e, id: number, data) => {
    updateClient(id, data);
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

  ipcMain.handle(IPC.CHAT_SESSIONS_LIST, () => listChatSessions());

  ipcMain.handle(IPC.CHAT_SESSIONS_DELETE, (_e, id: number) => {
    deleteChatSession(id);
    return true;
  });

  ipcMain.handle(IPC.CHAT_SESSIONS_RENAME, (_e, id: number, title: string) => {
    renameChatSession(id, title);
    return true;
  });

  ipcMain.handle(IPC.CHAT_MESSAGES_GET, (_e, sessionId: number) => getChatMessages(sessionId));

  ipcMain.handle(IPC.CHAT_MODELS, async () => {
    if (!storeRef) return [];
    const baseUrl = (storeRef.get('ollamaUrl') as string) || 'http://localhost:11434';
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];
      const data = await res.json() as { models?: { name: string }[] };
      return (data.models ?? []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC.CHAT_CHECK, async () => {
    if (!storeRef) return { ok: false, error: 'Store not initialized' };
    const baseUrl = (storeRef.get('ollamaUrl') as string) || 'http://localhost:11434';
    const ok = await checkConnection(baseUrl);
    return ok ? { ok: true } : { ok: false, error: `Cannot reach Ollama at ${baseUrl}. Run: ollama serve` };
  });

  ipcMain.handle(IPC.CHAT_SEND, async (_e, sessionId: number | null, messages: { role: string; content: string }[]) => {
    if (!storeRef) throw new Error('Store not initialized');

    const baseUrl = (storeRef.get('ollamaUrl') as string) || 'http://localhost:11434';
    const model = (storeRef.get('ollamaModel') as string) || 'qwen3:0.6b';

    // Build business context from DB
    const stats = getDashboardStats();
    const recentInvoices = dbAll<{
      number: string; client_name: string; total_amount: number;
      currency: string; payment_status: string; issue_date: string;
    }>(
      `SELECT number, client_name, total_amount, currency, payment_status, issue_date
       FROM invoices ORDER BY issue_date DESC, CAST(number AS INTEGER) DESC LIMIT 30`
    );
    const clients = listClientsWithStats().slice(0, 20);

    const today = new Date().toISOString().split('T')[0];

    let contextBlock = `You are a helpful business assistant built into Axiontic Manager.\n`;
    contextBlock += `Today is ${today}. Answer concisely. Use numbers from the data below — do not make them up.\n\n`;
    contextBlock += `=== BUSINESS DATA ===\n`;

    for (const s of stats) {
      contextBlock += `${s.currency}: ${s.count} invoice${s.count !== 1 ? 's' : ''} | invoiced ${s.total_invoiced.toFixed(2)} | collected ${s.total_paid.toFixed(2)} | outstanding ${s.total_unpaid.toFixed(2)}\n`;
    }

    if (recentInvoices.length > 0) {
      contextBlock += `\nRecent invoices (last ${recentInvoices.length}):\n`;
      for (const inv of recentInvoices) {
        contextBlock += `${inv.number} | ${inv.client_name} | ${inv.total_amount.toFixed(2)} ${inv.currency} | ${inv.payment_status} | ${inv.issue_date}\n`;
      }
    }

    if (clients.length > 0) {
      contextBlock += `\nClients (${clients.length} shown):\n`;
      for (const c of clients) {
        const totals = [
          c.total_eur > 0 ? `EUR ${c.total_eur.toFixed(2)}` : '',
          c.total_ron > 0 ? `RON ${c.total_ron.toFixed(2)}` : '',
          c.total_chf > 0 ? `CHF ${c.total_chf.toFixed(2)}` : '',
          c.total_pln > 0 ? `PLN ${c.total_pln.toFixed(2)}` : '',
          c.total_usd > 0 ? `USD ${c.total_usd.toFixed(2)}` : '',
        ].filter(Boolean).join(', ');
        contextBlock += `${c.name} | ${c.invoice_count} invoice${c.invoice_count !== 1 ? 's' : ''} | ${totals || 'no amounts'}\n`;
      }
    }

    contextBlock += `=== END DATA ===`;

    const fullMessages = [
      { role: 'system' as const, content: contextBlock },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // Persist user message and create session if needed
    const userMessage = messages[messages.length - 1];
    if (!sessionId) {
      const title = (userMessage?.content ?? 'New chat').slice(0, 60);
      sessionId = createChatSession(title);
    }
    if (userMessage?.role === 'user') {
      saveChatMessage(sessionId, 'user', userMessage.content);
    }

    const send = (channel: string, data: unknown) => {
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
    };

    let fullResponse = '';
    try {
      for await (const chunk of chatStream(baseUrl, model, fullMessages)) {
        fullResponse += chunk;
        send(IPC.CHAT_STREAM, { chunk, done: false });
      }
      saveChatMessage(sessionId, 'assistant', fullResponse);
      send(IPC.CHAT_STREAM, { chunk: '', done: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      send(IPC.CHAT_STATUS, { ok: false, error });
    }

    return sessionId;
  });
}
