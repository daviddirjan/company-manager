import { create } from 'zustand';
import type { Invoice, InvoiceFilters, DashboardStats, Page } from '../types';
import { api } from '../api/ipc';

interface InvoiceStore {
  invoices: Invoice[];
  filters: InvoiceFilters;
  loading: boolean;
  page: Page;
  syncStatus: 'idle' | 'running' | 'error';
  syncMessage: string;
  dashboardStats: DashboardStats[];
  clientCount: number;
  selectedInvoice: Invoice | null;

  setPage: (p: Page) => void;
  setFilters: (f: InvoiceFilters) => void;
  setSelectedInvoice: (inv: Invoice | null) => void;
  loadInvoices: () => Promise<void>;
  loadDashboardStats: () => Promise<void>;
  setSyncStatus: (s: 'idle' | 'running' | 'error', msg?: string) => void;
  refreshInvoice: (id: number) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  invoices: [],
  filters: {},
  loading: false,
  page: 'dashboard',
  syncStatus: 'idle',
  syncMessage: '',
  dashboardStats: [],
  clientCount: 0,
  selectedInvoice: null,

  setPage: (page) => set({ page }),
  setFilters: (filters) => {
    set({ filters });
    get().loadInvoices();
  },
  setSelectedInvoice: (inv) => set({ selectedInvoice: inv }),
  setSyncStatus: (syncStatus, syncMessage = '') => set({ syncStatus, syncMessage }),

  loadInvoices: async () => {
    set({ loading: true });
    try {
      const invoices = await api.invoices.list(get().filters);
      set({ invoices });
    } finally {
      set({ loading: false });
    }
  },

  loadDashboardStats: async () => {
    const data = await api.dashboard.stats();
    set({ dashboardStats: data.stats, clientCount: data.clients });
  },

  refreshInvoice: async (id) => {
    const updated = await api.invoices.get(id);
    if (updated) {
      set(state => ({
        invoices: state.invoices.map(inv => inv.id === id ? updated : inv),
        selectedInvoice: state.selectedInvoice?.id === id ? updated : state.selectedInvoice,
      }));
    }
  },
}));
