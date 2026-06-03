import React, { useState } from 'react';
import { FileText, Link, Pencil, Trash2, ExternalLink } from 'lucide-react';
import type { Invoice } from '../../types';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { api } from '../../api/ipc';
import { useInvoiceStore } from '../../store/invoiceStore';

interface Props {
  onEdit: (inv: Invoice) => void;
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ' + currency;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function InvoiceTable({ onEdit }: Props) {
  const { invoices, loading, loadInvoices, loadDashboardStats } = useInvoiceStore();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleOpenPdf(inv: Invoice) {
    if (inv.pdf_path) {
      await api.invoices.openPdf(inv.pdf_path);
    }
  }

  async function handleLinkPdf(inv: Invoice) {
    const file = await api.dialog.openFile();
    if (file) {
      await api.invoices.linkPdf(inv.id, file);
      await loadInvoices();
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this invoice?')) return;
    setDeletingId(id);
    await api.invoices.delete(id);
    await loadInvoices();
    await loadDashboardStats();
    setDeletingId(null);
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading invoices...</div>;
  }

  if (invoices.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
        <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
        <p>No invoices found.</p>
        <p style={{ fontSize: 13, marginTop: 4 }}>Import from a PDF folder or add manually.</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            {['Invoice', 'Date', 'Client', 'Amount', 'Currency', 'Status', 'PDF', 'Actions'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv, i) => (
            <tr
              key={inv.id}
              style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}
            >
              <td style={tdStyle}>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>
                  {inv.series_name}{inv.number.padStart(3, '0')}
                </span>
              </td>
              <td style={tdStyle}>{formatDate(inv.issue_date)}</td>
              <td style={{ ...tdStyle, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.client_name}</td>
              <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{formatAmount(inv.total_amount, '')}</td>
              <td style={tdStyle}>
                <span style={{ fontWeight: 600, fontSize: 11, color: '#3b82f6' }}>{inv.currency}</span>
              </td>
              <td style={tdStyle}><PaymentStatusBadge status={inv.payment_status} /></td>
              <td style={tdStyle}>
                {inv.pdf_linked ? (
                  <button onClick={() => handleOpenPdf(inv)} title="Open PDF" style={iconBtn('#22c55e')}>
                    <ExternalLink size={14} />
                  </button>
                ) : (
                  <button onClick={() => handleLinkPdf(inv)} title="Link PDF" style={iconBtn('#94a3b8')}>
                    <Link size={14} />
                  </button>
                )}
              </td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => onEdit(inv)} style={iconBtn('#3b82f6')} title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(inv.id)}
                    disabled={deletingId === inv.id}
                    style={iconBtn('#ef4444')}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tdStyle: React.CSSProperties = { padding: '9px 16px', verticalAlign: 'middle' };

function iconBtn(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 6,
    border: `1px solid ${color}22`, background: `${color}11`,
    color, cursor: 'pointer',
  };
}
