import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { exportBackup, exportRecovery, importBackup, resetLocalData } from './storage';

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataSettings({ beforeExport, onReplace }: {
  beforeExport?: () => Promise<boolean>;
  onReplace?: (replace: () => void) => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  function reportError(error: unknown) {
    setFailed(true);
    setMessage(error instanceof Error ? error.message : 'Your data could not be updated.');
  }
  return (
    <section className="data-settings" aria-label="Your local data">
      <h3>Your data</h3>
      <p className="small-note">Workouts, your plan, and nutrition stay on this device. Export a backup before clearing browser data or moving to another phone.</p>
      <div className="backup-buttons">
        <button className="btn btn-secondary" type="button" onClick={async () => {
          try {
            if (beforeExport && !(await beforeExport())) throw new Error('Some workout changes could not be saved. Retry saving before exporting, or export a recovery copy.');
            download(exportBackup(), `setline-backup-${new Date().toISOString().slice(0, 10)}.json`);
            setFailed(false); setMessage('Backup downloaded. Keep it somewhere safe.');
          } catch (error) { reportError(error); }
        }}><Download size={16} /> Export backup</button>
        <button className="btn btn-secondary" type="button" onClick={() => fileInput.current?.click()}><Upload size={16} /> Import backup</button>
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Restore Setline backup" hidden onChange={async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !window.confirm('Restore this backup? It will replace your current local workouts, plan, and nutrition.')) return;
        try {
          const text = await file.text();
          if (onReplace) await onReplace(() => importBackup(text));
          else { importBackup(text); window.location.reload(); }
        } catch (error) { reportError(error); }
      }} />
      {message && <p className={failed ? 'backup-error' : 'small-note'} role={failed ? 'alert' : 'status'}>{message}</p>}
      {failed && <button className="text-button" type="button" onClick={() => {
        try { download(exportRecovery(), 'setline-recovery.json'); }
        catch (error) { reportError(error); }
      }}>Export recovery copy</button>}
      <button className="text-button backup-delete" type="button" onClick={async () => {
        if (!window.confirm('Delete all local workouts, nutrition and custom plans? This cannot be undone. Export a backup first.')) return;
        try {
          if (onReplace) await onReplace(resetLocalData);
          else { resetLocalData(); window.location.reload(); }
        }
        catch (error) { reportError(error); }
      }}>Delete all local data</button>
    </section>
  );
}
