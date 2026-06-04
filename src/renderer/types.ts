export interface Invoice {
  id: number;
  series_name: string;
  number: string;
  issue_date: string;
  due_date: string | null;
  client_id: number | null;
  client_name: string;
  client_vat_code: string | null;
  total_amount: number;
  currency: string;
  payment_status: 'unpaid' | 'partial' | 'paid';
  paid_amount: number;
  language: string;
  sb_total_amount: number | null;
  sb_paid_amount: number | null;
  sb_unpaid_amount: number | null;
  sb_paid: number | null;
  sb_synced: number;
  sb_sync_at: string | null;
  sb_error: string | null;
  pdf_filename: string | null;
  pdf_path: string | null;
  pdf_linked: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFilters {
  search?: string;
  currency?: string;
  payment_status?: string;
  date_from?: string;
  date_to?: string;
}

export interface DashboardStats {
  currency: string;
  total_invoiced: number;
  total_paid: number;
  total_unpaid: number;
  count: number;
}

export interface ClientWithStats {
  id: number;
  name: string;
  vat_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  invoice_count: number;
  total_eur: number;
  total_ron: number;
  total_chf: number;
  total_pln: number;
  total_usd: number;
}

export type Page = 'dashboard' | 'invoices' | 'clients' | 'chat' | 'settings';
