import React from 'react';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useInvoiceStore } from '../../store/invoiceStore';

export function TopBar() {
  const { syncStatus, syncMessage } = useInvoiceStore();

  return (
    <header style={{
      height: 48,
      background: '#fff',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 20,
      paddingLeft: 80, // space for macOS traffic lights
      flexShrink: 0,
      WebkitAppRegion: 'drag' as never,
    }}>
      {syncStatus !== 'idle' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: syncStatus === 'error' ? '#ef4444' : '#3b82f6',
          WebkitAppRegion: 'no-drag' as never,
        }}>
          {syncStatus === 'running' ? (
            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
          ) : syncStatus === 'error' ? (
            <AlertCircle size={14} />
          ) : (
            <CheckCircle size={14} />
          )}
          <span>{syncMessage || (syncStatus === 'running' ? 'Syncing...' : '')}</span>
        </div>
      )}
    </header>
  );
}
