import React from 'react';

const CONFIG = {
  unpaid:  { label: 'Unpaid',  bg: '#fef2f2', color: '#ef4444', border: '#fecaca' },
  partial: { label: 'Partial', bg: '#fffbeb', color: '#f59e0b', border: '#fde68a' },
  paid:    { label: 'Paid',    bg: '#f0fdf4', color: '#22c55e', border: '#bbf7d0' },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status as keyof typeof CONFIG] ?? CONFIG.unpaid;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    }}>
      {cfg.label}
    </span>
  );
}
