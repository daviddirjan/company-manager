import React, { useEffect } from 'react';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { useInvoiceStore } from '../store/invoiceStore';

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + currency;
}

const CURRENCY_COLORS: Record<string, string> = {
  RON: '#3b82f6',
  EUR: '#8b5cf6',
  CHF: '#f59e0b',
  PLN: '#ec4899',
  USD: '#22c55e',
};

export function Dashboard() {
  const { dashboardStats, clientCount, loadDashboardStats } = useInvoiceStore();

  useEffect(() => { loadDashboardStats(); }, []);

  const totalInvoices = dashboardStats.reduce((s, d) => s + d.count, 0);

  return (
    <div style={{ padding: 32, overflowY: 'auto', flex: 1 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Dashboard</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>
        {totalInvoices} invoice{totalInvoices !== 1 ? 's' : ''} across {dashboardStats.length} currencies — {clientCount} clients
      </p>

      {dashboardStats.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <p>No invoices yet. Go to Settings to import your PDF folder.</p>
        </div>
      )}

      {dashboardStats.map(stat => {
        const color = CURRENCY_COLORS[stat.currency] ?? '#64748b';
        return (
          <div key={stat.currency} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color }} />
              {stat.currency}
              <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>({stat.count} invoices)</span>
            </h2>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <SummaryCard
                label="Total Invoiced"
                value={fmt(stat.total_invoiced, stat.currency)}
                color={color}
              />
              <SummaryCard
                label="Collected"
                value={fmt(stat.total_paid, stat.currency)}
                sub={stat.total_invoiced > 0 ? `${Math.round((stat.total_paid / stat.total_invoiced) * 100)}% of total` : undefined}
                color="#22c55e"
              />
              <SummaryCard
                label="Outstanding"
                value={fmt(stat.total_unpaid, stat.currency)}
                color={stat.total_unpaid > 0 ? '#ef4444' : '#22c55e'}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
