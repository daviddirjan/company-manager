import React from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Dashboard } from './pages/Dashboard';
import { Invoices } from './pages/Invoices';
import { Clients } from './pages/Clients';
import { Chat } from './pages/Chat';
import { Settings } from './pages/Settings';
import { useInvoiceStore } from './store/invoiceStore';

export default function App() {
  const { page } = useInvoiceStore();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {page === 'dashboard' && <Dashboard />}
          {page === 'invoices' && <Invoices />}
          {page === 'clients' && <Clients />}
          {page === 'chat' && <Chat />}
          {page === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
