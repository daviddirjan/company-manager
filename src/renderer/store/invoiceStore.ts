import { create } from 'zustand';
import type { Invoice, InvoiceFilters, DashboardStats, ChartData, ChartPeriod, Page } from '../types';
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
  chartData: ChartData | null;
  chartPeriod: ChartPeriod;
  exchangeRates: Record<string, number>;

  setPage: (p: Page) => void;
  setFilters: (f: InvoiceFilters) => void;
  setSelectedInvoice: (inv: Invoice | null) => void;
  loadInvoices: () => Promise<void>;
  loadDashboardStats: () => Promise<void>;
  loadChartData: (period: ChartPeriod) => Promise<void>;
  loadExchangeRates: () => Promise<void>;
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
  chartData: null,
  chartPeriod: 'year',
  exchangeRates: { RON: 1 },

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

  loadChartData: async (period) => {
    set({ chartPeriod: period });
    const data = await api.dashboard.chart(period);
    set({ chartData: data });
  },

  loadExchangeRates: async () => {
    const rates = await api.dashboard.rates();
    set({ exchangeRates: rates });
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
