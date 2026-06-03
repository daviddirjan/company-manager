import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useInvoiceStore } from '../../store/invoiceStore';

const CURRENCIES = ['', 'RON', 'EUR', 'CHF', 'PLN', 'USD'];
const STATUSES = ['', 'unpaid', 'partial', 'paid'];

export function InvoiceFilters() {
  const { filters, setFilters } = useInvoiceStore();
  const [search, setSearch] = useState(filters.search ?? '');

  function apply(patch: Partial<typeof filters>) {
    setFilters({ ...filters, ...patch });
  }

  function reset() {
    setSearch('');
    setFilters({});
  }

  const hasFilters = !!(filters.search || filters.currency || filters.payment_status || filters.date_from || filters.date_to);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && apply({ search: search || undefined })}
          onBlur={() => apply({ search: search || undefined })}
          placeholder="Search client or number..."
          style={inputStyle}
        />
      </div>

      {/* Currency */}
      <select
        value={filters.currency ?? ''}
        onChange={e => apply({ currency: e.target.value || undefined })}
        style={selectStyle}
      >
        <option value="">All currencies</option>
        {CURRENCIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Status */}
      <select
        value={filters.payment_status ?? ''}
        onChange={e => apply({ payment_status: e.target.value || undefined })}
        style={selectStyle}
      >
        <option value="">All statuses</option>
        {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
      </select>

      {/* Date from */}
      <input
        type="date"
        value={filters.date_from ?? ''}
        onChange={e => apply({ date_from: e.target.value || undefined })}
        style={{ ...selectStyle, width: 140 }}
        title="From date"
      />

      {/* Date to */}
      <input
        type="date"
        value={filters.date_to ?? ''}
        onChange={e => apply({ date_to: e.target.value || undefined })}
        style={{ ...selectStyle, width: 140 }}
        title="To date"
      />

      {hasFilters && (
        <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#64748b', fontSize: 13 }}>
          <X size={13} /> Reset
        </button>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px 6px 30px',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  color: '#1e293b',
  background: '#f8fafc',
};

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  color: '#1e293b',
  background: '#f8fafc',
  cursor: 'pointer',
};
