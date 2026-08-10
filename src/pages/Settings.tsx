import { useState } from 'react';
import { Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useWardrobe } from '../context/WardrobeContext';

export default function Settings() {
  const { items, outfits, wearLogs } = useWardrobe();
  const [showReset, setShowReset] = useState(false);

  const handleExport = () => {
    const data = { items, outfits, wearLogs, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wardrobe-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (confirm(`Import ${data.items?.length || 0} items and ${data.outfits?.length || 0} outfits? This will replace current data.`)) {
          localStorage.setItem('wardrobe-tracker', JSON.stringify({
            items: data.items || [],
            outfits: data.outfits || [],
            wearLogs: data.wearLogs || [],
          }));
          window.location.reload();
        }
      } catch {
        alert('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    localStorage.removeItem('wardrobe-tracker');
    window.location.reload();
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-semibold text-text font-[family-name:var(--font-heading)]">Settings</h1>

      {/* Data Management */}
      <div className="bg-cream border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-text">Data Management</h2>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-sm font-medium text-text">Export Data</p>
            <p className="text-xs text-text-muted mt-0.5">Download a backup of your wardrobe</p>
          </div>
          <button
            onClick={handleExport}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-hover flex items-center gap-1.5 transition-all"
          >
            <Download size={14} />
            Export
          </button>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-sm font-medium text-text">Import Data</p>
            <p className="text-xs text-text-muted mt-0.5">Restore from a previous backup</p>
          </div>
          <label className="px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-hover flex items-center gap-1.5 transition-all cursor-pointer">
            <Upload size={14} />
            Import
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>

        <div className="pt-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-error">Reset All Data</p>
              <p className="text-xs text-text-muted mt-0.5">This will permanently delete everything</p>
            </div>
            <button
              onClick={() => setShowReset(true)}
              className="px-3 py-2 bg-error/10 text-error rounded-lg text-sm font-medium hover:bg-error/20 flex items-center gap-1.5 transition-all"
            >
              <Trash2 size={14} />
              Reset
            </button>
          </div>

          {showReset && (
            <div className="mt-3 p-4 bg-error/5 border border-error/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-error flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-error">Are you sure?</p>
                  <p className="text-xs text-text-secondary mt-1">
                    This will delete all {items.length} items, {outfits.length} outfits, and {wearLogs.length} wear logs. This cannot be undone.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleReset}
                      className="px-3 py-1.5 bg-error text-white rounded-lg text-xs font-medium hover:bg-error/90 transition-all"
                    >
                      Yes, Delete Everything
                    </button>
                    <button
                      onClick={() => setShowReset(false)}
                      className="px-3 py-1.5 bg-surface text-text-secondary rounded-lg text-xs font-medium hover:bg-surface-hover transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* About */}
      <div className="bg-cream border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-text mb-3">About</h2>
        <div className="space-y-2 text-sm text-text-secondary">
          <p><strong className="text-text">Wardrobe Tracker</strong></p>
          <p>Version 1.0.0</p>
          <p>A digital closet companion built with care.</p>
          <p className="text-xs text-text-muted mt-3">
            All data is stored locally in your browser. No data is sent to any server.
          </p>
        </div>
      </div>
    </div>
  );
}
