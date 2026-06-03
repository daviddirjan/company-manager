import React, { useEffect, useState } from 'react';
import { FolderOpen, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api/ipc';
import { useInvoiceStore } from '../store/invoiceStore';

interface SettingsData {
  pdfFolderPath: string;
  smartbillUsername: string;
  smartbillToken: string;
  companyCif: string;
  seriesName: string;
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsData>({
    pdfFolderPath: '',
    smartbillUsername: '',
    smartbillToken: '',
    companyCif: '',
    seriesName: 'AX',
  });
  const [importStatus, setImportStatus] = useState<string>('');
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [saved, setSaved] = useState(false);
  const { loadInvoices, loadDashboardStats } = useInvoiceStore();

  useEffect(() => {
    api.settings.get().then(s => setSettings(s as SettingsData));

    api.import.onProgress(p => {
      setImportProgress({ current: p.current, total: p.total });
    });

    api.sync.onProgress(p => {
      setSyncStatus(`Syncing ${p.invoiceNumber} (${p.current}/${p.total})`);
    });
  }, []);

  async function save() {
    await api.settings.save(settings as unknown as Record<string, string>);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function pickFolder() {
    const folder = await api.dialog.openFolder();
    if (folder) setSettings(s => ({ ...s, pdfFolderPath: folder }));
  }

  async function runImport() {
    if (!settings.pdfFolderPath) return;
    setImportStatus('Importing...');
    setImportProgress(null);
    // Save folder path first
    await api.settings.save({ pdfFolderPath: settings.pdfFolderPath });
    try {
      const result = await api.import.start(settings.pdfFolderPath);
      setImportStatus(`Done: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`);
      await loadInvoices();
      await loadDashboardStats();
    } catch (err) {
      setImportStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImportProgress(null);
    }
  }

  async function runSync() {
    setSyncStatus('Starting sync...');
    try {
      const result = await api.sync.start();
      setSyncStatus(`Done: ${result.synced} synced, ${result.notFound} not found, ${result.errors} errors`);
      await loadInvoices();
    } catch (err) {
      setSyncStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const hasSmartBillCreds = !!(settings.smartbillUsername && settings.smartbillToken && settings.companyCif);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 24 }}>Settings</h1>

      {/* PDF Folder */}
      <Section title="PDF Folder">
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          Folder containing your renamed PDF invoices (AX001.pdf, AX002.pdf, ...).
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={settings.pdfFolderPath}
            onChange={e => setSettings(s => ({ ...s, pdfFolderPath: e.target.value }))}
            placeholder="/Users/you/invoices"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={pickFolder} style={secondaryBtn}>
            <FolderOpen size={14} /> Browse
          </button>
        </div>
        <button onClick={runImport} disabled={!settings.pdfFolderPath} style={primaryBtn}>
          <RefreshCw size={14} /> Import from PDF Folder
        </button>
        {importProgress && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#3b82f6', width: `${(importProgress.current / importProgress.total) * 100}%`, transition: 'width 0.2s' }} />
            </div>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{importProgress.current} / {importProgress.total}</p>
          </div>
        )}
        {importStatus && (
          <p style={{ fontSize: 13, marginTop: 8, color: importStatus.startsWith('Error') ? '#ef4444' : '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
            {importStatus.startsWith('Error') ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            {importStatus}
          </p>
        )}
      </Section>

      {/* SmartBill */}
      <Section title="SmartBill API">
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          Connect to SmartBill to sync payment status. Requires a{' '}
          <strong>Platinum subscription</strong>.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <LabeledInput label="Username / Email" value={settings.smartbillUsername} onChange={v => setSettings(s => ({ ...s, smartbillUsername: v }))} placeholder="your@email.com" />
          <LabeledInput label="API Token" value={settings.smartbillToken} onChange={v => setSettings(s => ({ ...s, smartbillToken: v }))} placeholder="API token from SmartBill" type="password" />
          <LabeledInput label="Company CIF" value={settings.companyCif} onChange={v => setSettings(s => ({ ...s, companyCif: v }))} placeholder="44913578" />
          <LabeledInput label="Invoice Series" value={settings.seriesName} onChange={v => setSettings(s => ({ ...s, seriesName: v }))} placeholder="AX" />
        </div>
        <button onClick={runSync} disabled={!hasSmartBillCreds} style={{ ...primaryBtn, background: hasSmartBillCreds ? '#8b5cf6' : '#e2e8f0', color: hasSmartBillCreds ? '#fff' : '#94a3b8' }}>
          <RefreshCw size={14} /> Sync Payment Status
        </button>
        {!hasSmartBillCreds && (
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Enter credentials above to enable sync.</p>
        )}
        {syncStatus && (
          <p style={{ fontSize: 13, marginTop: 8, color: syncStatus.startsWith('Error') ? '#ef4444' : '#8b5cf6', display: 'flex', alignItems: 'center', gap: 6 }}>
            {syncStatus}
          </p>
        )}
      </Section>

      {/* Save */}
      <div style={{ marginTop: 8 }}>
        <button onClick={save} style={primaryBtn}>
          {saved ? <><CheckCircle2 size={14} /> Saved!</> : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>{title}</h2>
      {children}
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0',
  borderRadius: 8, fontSize: 14, outline: 'none', color: '#1e293b',
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 18px', background: '#3b82f6', color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
};

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', background: '#fff', color: '#475569',
  border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13,
};
