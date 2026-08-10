import { useState } from 'react';
import { Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';
import { showToast } from '../components/Toast';
import { DecorativeDivider } from '../components/art';

export default function Settings() {
  const { items, outfits, wearLogs } = useWardrobe();
  const [showReset, setShowReset] = useState(false);

  const handleExport = () => {
    const data = { items, outfits, wearLogs, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wardrobe-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        localStorage.setItem('wardrobe-tracker', JSON.stringify(data));
        showToast('Data imported. Refresh to see changes.', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        showToast('Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    localStorage.removeItem('wardrobe-tracker');
    showToast('All data cleared. Refreshing...', 'info');
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-editorial text-2xl sm:text-3xl text-text">Settings</h1>
        <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">Manage your data</p>
      </div>
      <DecorativeDivider />

      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-4">Collection Overview</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-bg-elevated rounded-lg">
            <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">{items.length}</p>
            <p className="text-xs text-text-muted mt-1">Items</p>
          </div>
          <div className="text-center p-4 bg-bg-elevated rounded-lg">
            <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">{outfits.length}</p>
            <p className="text-xs text-text-muted mt-1">Outfits</p>
          </div>
          <div className="text-center p-4 bg-bg-elevated rounded-lg">
            <p className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">{wearLogs.length}</p>
            <p className="text-xs text-text-muted mt-1">Wear Logs</p>
          </div>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Data Management</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <button onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-bg-elevated border border-border rounded-lg text-sm font-medium text-text hover:border-border-light transition-all">
            <Download size={16} /> Export Data
          </button>
          <label className="flex items-center justify-center gap-2 px-4 py-3 bg-bg-elevated border border-border rounded-lg text-sm font-medium text-text hover:border-border-light transition-all cursor-pointer">
            <Upload size={16} /> Import Data
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Danger Zone</h2>
        {!showReset ? (
          <button onClick={() => setShowReset(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-sm font-medium text-error hover:bg-error/20 transition-all w-full sm:w-auto">
            <Trash2 size={16} /> Reset All Data
          </button>
        ) : (
          <div className="bg-error/5 border border-error/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-error">
              <AlertTriangle size={16} />
              <span className="text-sm font-medium">This will permanently delete all your data</span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleReset}
                className="px-4 py-2 bg-error text-white rounded-lg text-sm font-medium hover:bg-error/80 transition-all">
                Confirm Delete
              </button>
              <button onClick={() => setShowReset(false)}
                className="px-4 py-2 bg-bg-elevated border border-border rounded-lg text-sm font-medium text-text hover:border-border-light transition-all">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-2">About</h2>
        <p className="text-sm text-text-secondary">Wardrobe Tracker v1.0</p>
        <p className="text-xs text-text-muted mt-1">Built with care. Your data stays on your device.</p>
      </div>
    </div>
  );
}
