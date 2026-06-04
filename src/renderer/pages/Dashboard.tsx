import React, { useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useInvoiceStore } from '../store/invoiceStore';
import type { ChartPeriod } from '../types';

const CURRENCY_ORDER = ['RON', 'EUR', 'PLN', 'CHF'];

const CURRENCY_COLORS: Record<string, string> = {
  RON: '#3b82f6',
  EUR: '#8b5cf6',
  CHF: '#f59e0b',
  PLN: '#ec4899',
  USD: '#22c55e',
};

function fmtCompact(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toFixed(0);
}

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + currency;
}

const PERIOD_LABELS: Record<ChartPeriod, string> = {
  month: 'This Month',
  year: 'This Year',
  all: 'Since Sep 2021',
};

export function Dashboard() {
  const {
    dashboardStats, clientCount, loadDashboardStats,
    chartData, chartPeriod, loadChartData,
    exchangeRates, loadExchangeRates,
  } = useInvoiceStore();

  useEffect(() => {
    loadDashboardStats();
    loadExchangeRates();
    loadChartData('year');
  }, []);

  const totalInvoices = dashboardStats.reduce((s, d) => s + d.count, 0);

  const sortedStats = useMemo(() => {
    return [...dashboardStats].sort((a, b) => {
      const ia = CURRENCY_ORDER.indexOf(a.currency);
      const ib = CURRENCY_ORDER.indexOf(b.currency);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [dashboardStats]);

  const chartPoints = useMemo(() => {
    if (!chartData) return [];
    const map = new Map<string, number>();
    for (const row of chartData.rows) {
      const rate = exchangeRates[row.currency] ?? 1;
      map.set(row.period, (map.get(row.period) ?? 0) + row.amount * rate);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, total]) => ({ period, total: Math.round(total) }));
  }, [chartData, exchangeRates]);

  const rateInfo = useMemo(() => {
    return ['EUR', 'PLN', 'CHF', 'USD']
      .filter(c => exchangeRates[c])
      .map(c => `1 ${c} = ${exchangeRates[c].toFixed(4)} RON`)
      .join(' · ');
  }, [exchangeRates]);

  const handlePeriod = (p: ChartPeriod) => loadChartData(p);

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Dashboard</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
        {totalInvoices} invoice{totalInvoices !== 1 ? 's' : ''} across {dashboardStats.length} currencies — {clientCount} clients
      </p>

      {/* Compact summary grid */}
      {sortedStats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10, marginBottom: 28 }}>
          {sortedStats.map(stat => {
            const color = CURRENCY_COLORS[stat.currency] ?? '#64748b';
            const pct = stat.total_invoiced > 0 ? Math.round((stat.total_paid / stat.total_invoiced) * 100) : 0;
            return (
              <div key={stat.currency} style={{
                background: '#fff',
                borderRadius: 10,
                padding: '12px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                borderLeft: `3px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}>
                <div style={{ minWidth: 42 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color }}>
                    {stat.currency}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{stat.count} inv.</div>
                </div>
                <div style={{ flex: 1, display: 'flex', gap: 16 }}>
                  <StatCell label="Invoiced" value={fmtCompact(stat.total_invoiced)} color="#1e293b" />
                  <StatCell label={`Paid ${pct}%`} value={fmtCompact(stat.total_paid)} color="#22c55e" />
                  <StatCell
                    label="Outstanding"
                    value={fmtCompact(stat.total_unpaid)}
                    color={stat.total_unpaid > 0 ? '#ef4444' : '#22c55e'}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sortedStats.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <p>No invoices yet. Go to Settings to import your PDF folder.</p>
        </div>
      )}

      {/* Revenue chart */}
      {sortedStats.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Revenue (RON)</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['month', 'year', 'all'] as ChartPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => handlePeriod(p)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    background: chartPeriod === p ? '#3b82f6' : '#f1f5f9',
                    color: chartPeriod === p ? '#fff' : '#64748b',
                    transition: 'background 0.15s',
                  }}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {rateInfo && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
              BNR · {rateInfo}
            </div>
          )}

          {chartPoints.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartPoints} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtCompact}
                  width={48}
                />
                <Tooltip
                  formatter={(value: number) => [fmt(value, 'RON'), 'Total']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
