import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { InvoiceFilters } from '../components/invoice/InvoiceFilters';
import { InvoiceTable } from '../components/invoice/InvoiceTable';
import { InvoiceFormModal } from '../components/invoice/InvoiceFormModal';
import { useInvoiceStore } from '../store/invoiceStore';
import type { Invoice } from '../types';

export function Invoices() {
  const { loadInvoices, invoices } = useInvoiceStore();
  const [editInvoice, setEditInvoice] = useState<Invoice | null | undefined>(undefined);

  useEffect(() => { loadInvoices(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Invoices</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 12 }}>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setEditInvoice(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 12 }}
        >
          <Plus size={15} /> Add Invoice
        </button>
      </div>

      <InvoiceFilters />

      <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
        <InvoiceTable onEdit={inv => setEditInvoice(inv)} />
      </div>

      {editInvoice !== undefined && (
        <InvoiceFormModal
          invoice={editInvoice}
          onClose={() => setEditInvoice(undefined)}
        />
      )}
    </div>
  );
}
