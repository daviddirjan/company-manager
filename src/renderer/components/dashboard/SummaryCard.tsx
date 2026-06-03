import React from 'react';

interface Props {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

export function SummaryCard({ label, value, sub, color = '#3b82f6' }: Props) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '20px 24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      borderLeft: `4px solid ${color}`,
      minWidth: 180,
      flex: '1 1 180px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
