import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Invoice } from '../../types';
import { api } from '../../api/ipc';
import { useInvoiceStore } from '../../store/invoiceStore';

interface Props {
  invoice?: Invoice | null;
  onClose: () => void;
}

const CURRENCIES = ['RON', 'EUR', 'CHF', 'PLN', 'USD'];
const LANGUAGES = [{ v: 'ro', l: 'Romanian' }, { v: 'es', l: 'Spanish' }, { v: 'en', l: 'English' }, { v: 'fr', l: 'French' }];
const STATUSES = ['unpaid', 'partial', 'paid'];

const DEFAULT: Partial<Invoice> = {
  series_name: 'AX',
  number: '',
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: null,
  client_name: '',
  client_vat_code: null,
  total_amount: 0,
  currency: 'RON',
  payment_status: 'unpaid',
  paid_amount: 0,
  language: 'ro',
  source: 'manual',
};

export function InvoiceFormModal({ invoice, onClose }: Props) {
  const [form, setForm] = useState<Partial<Invoice>>(invoice ? { ...invoice } : { ...DEFAULT });
  const [saving, setSaving] = useState(false);
  const { loadInvoices, loadDashboardStats } = useInvoiceStore();

  useEffect(() => {
    setForm(invoice ? { ...invoice } : { ...DEFAULT });
  }, [invoice]);

  function patch(key: keyof Invoice, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!form.client_name || !form.number || !form.issue_date) return;
    setSaving(true);
    try {
      if (invoice) {
        await api.invoices.update(invoice.id, form);
      } else {
        await api.invoices.create(form);
      }
      await loadInvoices();
      await loadDashboardStats();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 520, maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>{invoice ? 'Edit Invoice' : 'New Invoice'}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Row label="Series & Number">
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={form.series_name ?? 'AX'} onChange={e => patch('series_name', e.target.value)} style={{ ...inputStyle, width: 70 }} placeholder="AX" />
              <input value={form.number ?? ''} onChange={e => patch('number', e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="001" />
            </div>
          </Row>

          <Row label="Issue Date">
            <input type="date" value={form.issue_date ?? ''} onChange={e => patch('issue_date', e.target.value)} style={inputStyle} />
          </Row>

          <Row label="Due Date (optional)">
            <input type="date" value={form.due_date ?? ''} onChange={e => patch('due_date', e.target.value || null)} style={inputStyle} />
          </Row>

          <Row label="Client Name *">
            <input value={form.client_name ?? ''} onChange={e => patch('client_name', e.target.value)} style={inputStyle} placeholder="Company name" />
          </Row>

          <Row label="Client VAT Code">
            <input value={form.client_vat_code ?? ''} onChange={e => patch('client_vat_code', e.target.value || null)} style={inputStyle} placeholder="CIF / VAT" />
          </Row>

          <Row label="Amount & Currency">
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" step="0.01" value={form.total_amount ?? 0} onChange={e => patch('total_amount', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, flex: 1 }} />
              <select value={form.currency ?? 'RON'} onChange={e => patch('currency', e.target.value)} style={{ ...inputStyle, width: 90 }}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </Row>

          <Row label="Payment Status">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={form.payment_status ?? 'unpaid'} onChange={e => patch('payment_status', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              {form.payment_status === 'partial' && (
                <input type="number" step="0.01" value={form.paid_amount ?? 0} onChange={e => patch('paid_amount', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 120 }} placeholder="Paid amount" />
              )}
            </div>
          </Row>

          <Row label="Language">
            <select value={form.language ?? 'ro'} onChange={e => patch('language', e.target.value)} style={inputStyle}>
              {LANGUAGES.map(l => <option key={l.v} value={l.v}>{l.l}</option>)}
            </select>
          </Row>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button
            onClick={save}
            disabled={saving || !form.client_name || !form.number || !form.issue_date}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  color: '#1e293b',
};
