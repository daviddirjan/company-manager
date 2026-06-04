import type { Invoice, InvoiceFilters, DashboardStats, ClientWithStats } from '../types';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        on: (channel: string, listener: (...args: unknown[]) => void) => void;
        off: (channel: string, listener: (...args: unknown[]) => void) => void;
      };
    };
  }
}

const ipc = window.electron.ipcRenderer;

export const api = {
  invoices: {
    list: (filters?: InvoiceFilters) => ipc.invoke('invoice:list', filters) as Promise<Invoice[]>,
    get: (id: number) => ipc.invoke('invoice:get', id) as Promise<Invoice | null>,
    create: (data: Partial<Invoice>) => ipc.invoke('invoice:create', data) as Promise<number>,
    update: (id: number, data: Partial<Invoice>) => ipc.invoke('invoice:update', id, data) as Promise<Invoice>,
    delete: (id: number) => ipc.invoke('invoice:delete', id) as Promise<boolean>,
    linkPdf: (id: number, filePath: string) => ipc.invoke('invoice:linkPdf', id, filePath) as Promise<boolean>,
    openPdf: (filePath: string) => ipc.invoke('invoice:openPdf', filePath) as Promise<string>,
  },
  dashboard: {
    stats: () => ipc.invoke('dashboard:stats') as Promise<{ stats: DashboardStats[]; clients: number }>,
  },
  import: {
    start: (folderPath: string) => ipc.invoke('import:start', folderPath) as Promise<{ imported: number; skipped: number; errors: number }>,
    sync: (folderPath: string) => ipc.invoke('import:sync', folderPath) as Promise<{ imported: number; skipped: number; errors: number }>,
    onProgress: (cb: (p: { current: number; total: number; filename: string; status: string; error?: string }) => void) => {
      ipc.on('import:progress', cb as never);
    },
  },
  sync: {
    start: () => ipc.invoke('sync:start') as Promise<{ synced: number; notFound: number; errors: number }>,
    onProgress: (cb: (p: { current: number; total: number; invoiceNumber: string; status: string }) => void) => {
      ipc.on('sync:progress', cb as never);
    },
  },
  settings: {
    get: () => ipc.invoke('settings:get') as Promise<Record<string, string>>,
    save: (data: Record<string, string>) => ipc.invoke('settings:save', data) as Promise<boolean>,
  },
  clients: {
    list: () => ipc.invoke('clients:list') as Promise<ClientWithStats[]>,
    update: (id: number, data: { phone?: string | null; email?: string | null }) =>
      ipc.invoke('clients:update', id, data) as Promise<boolean>,
  },
  dialog: {
    openFile: () => ipc.invoke('dialog:openFile') as Promise<string | null>,
    openFolder: () => ipc.invoke('dialog:openFolder') as Promise<string | null>,
  },
  chat: {
    send: (sessionId: number | null, messages: { role: string; content: string }[]) =>
      ipc.invoke('chat:send', sessionId, messages) as Promise<number>,
    check: () => ipc.invoke('chat:check') as Promise<{ ok: boolean; error?: string }>,
    models: () => ipc.invoke('chat:models') as Promise<string[]>,
    sessions: {
      list: () => ipc.invoke('chat:sessions:list') as Promise<{ id: number; title: string; updated_at: string }[]>,
      delete: (id: number) => ipc.invoke('chat:sessions:delete', id) as Promise<boolean>,
      rename: (id: number, title: string) => ipc.invoke('chat:sessions:rename', id, title) as Promise<boolean>,
    },
    messages: {
      get: (sessionId: number) => ipc.invoke('chat:messages:get', sessionId) as Promise<{ id: number; role: string; content: string }[]>,
    },
    onStream: (cb: (p: { chunk: string; done: boolean }) => void) => {
      ipc.on('chat:stream', cb as never);
    },
    offStream: (cb: (p: { chunk: string; done: boolean }) => void) => {
      ipc.off('chat:stream', cb as never);
    },
    onStatus: (cb: (p: { ok: boolean; error?: string }) => void) => {
      ipc.on('chat:status', cb as never);
    },
    offStatus: (cb: (p: { ok: boolean; error?: string }) => void) => {
      ipc.off('chat:status', cb as never);
    },
  },
};
