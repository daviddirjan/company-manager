import React, { useEffect, useState } from 'react';
import { Pencil, X, Check } from 'lucide-react';
import { api } from '../api/ipc';
import type { ClientWithStats } from '../types';

const CURRENCIES = ['eur', 'ron', 'chf', 'pln', 'usd'] as const;

function formatTotals(client: ClientWithStats): string {
  const parts: string[] = [];
  for (const cur of CURRENCIES) {
    const val = client[`total_${cur}` as keyof ClientWithStats] as number;
    if (val > 0) parts.push(`${val.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur.toUpperCase()}`);
  }
  return parts.join(' · ') || '—';
}

interface EditState {
  phone: string;
  email: string;
}

export function Clients() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ phone: '', email: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.clients.list();
      setClients(data);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(client: ClientWithStats) {
    setEditingId(client.id);
    setEditState({ phone: client.phone ?? '', email: client.email ?? '' });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    await api.clients.update(id, {
      phone: editState.phone.trim() || null,
      email: editState.email.trim() || null,
    });
    setEditingId(null);
    await load();
  }

  const filtered = clients.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.vat_code ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Clients</h1>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or VAT…"
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: 240, outline: 'none' }}
        />
      </div>

      {loading ? (
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading…</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Th>Name</Th>
                <Th>VAT Code</Th>
                <Th>Total Spent</Th>
                <Th>Phone</Th>
                <Th>Email</Th>
                <Th style={{ width: 48 }}></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                    No clients found.
                  </td>
                </tr>
              )}
              {filtered.map((client, idx) => {
                const isEditing = editingId === client.id;
                const rowBg = idx % 2 === 0 ? '#fff' : '#f8fafc';
                return (
                  <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9', background: isEditing ? '#eff6ff' : rowBg }}>
                    <Td style={{ fontWeight: 500, color: '#1e293b' }}>{client.name}</Td>
                    <Td style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 13 }}>{client.vat_code ?? '—'}</Td>
                    <Td style={{ color: '#0f172a', fontWeight: 500 }}>{formatTotals(client)}</Td>
                    <Td>
                      {isEditing ? (
                        <input
                          value={editState.phone}
                          onChange={e => setEditState(s => ({ ...s, phone: e.target.value }))}
                          placeholder="+40 700 000 000"
                          style={inlineInput}
                          autoFocus
                        />
                      ) : (
                        <span style={{ color: client.phone ? '#1e293b' : '#cbd5e1' }}>{client.phone || '—'}</span>
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <input
                          value={editState.email}
                          onChange={e => setEditState(s => ({ ...s, email: e.target.value }))}
                          placeholder="contact@company.com"
                          style={inlineInput}
                        />
                      ) : (
                        <span style={{ color: client.email ? '#1e293b' : '#cbd5e1' }}>{client.email || '—'}</span>
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <IconBtn onClick={() => saveEdit(client.id)} color="#22c55e" title="Save">
                            <Check size={14} />
                          </IconBtn>
                          <IconBtn onClick={cancelEdit} color="#94a3b8" title="Cancel">
                            <X size={14} />
                          </IconBtn>
                        </div>
                      ) : (
                        <IconBtn onClick={() => startEdit(client)} color="#94a3b8" title="Edit">
                          <Pencil size={14} />
                        </IconBtn>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
        {filtered.length} client{filtered.length !== 1 ? 's' : ''}
        {search ? ` matching "${search}"` : ''}
      </p>
    </div>
  );
}

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, ...style }}>
      {children}
    </th>
  );
}

function Td({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: '12px 16px', color: '#475569', ...style }}>
      {children}
    </td>
  );
}

function IconBtn({ children, onClick, color, title }: { children: React.ReactNode; onClick: () => void; color: string; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}
    >
      {children}
    </button>
  );
}

const inlineInput: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #93c5fd',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  width: '100%',
  minWidth: 140,
};
