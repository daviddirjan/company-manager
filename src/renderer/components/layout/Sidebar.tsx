import React from 'react';
import { LayoutDashboard, FileText, Users, MessageSquare, Settings } from 'lucide-react';
import { useInvoiceStore } from '../../store/invoiceStore';
import type { Page } from '../../types';

const NAV: Array<{ id: Page; label: string; Icon: React.FC<{ size?: number; className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', Icon: FileText },
  { id: 'clients', label: 'Clients', Icon: Users },
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function Sidebar() {
  const { page, setPage } = useInvoiceStore();

  return (
    <aside style={{
      width: 200,
      background: '#1e293b',
      color: '#cbd5e1',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 48,
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 16px 24px', borderBottom: '1px solid #334155' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9', letterSpacing: 0.5 }}>
          AXIONTIC
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Manager</div>
      </div>

      <nav style={{ padding: '12px 8px', flex: 1 }}>
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: page === id ? '#3b82f6' : 'transparent',
              color: page === id ? '#fff' : '#94a3b8',
              fontSize: 14,
              fontWeight: page === id ? 600 : 400,
              marginBottom: 2,
              textAlign: 'left',
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
