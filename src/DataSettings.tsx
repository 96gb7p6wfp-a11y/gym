import { useRef, useState } from 'react';
import { Copy, Download, Share2, Upload } from 'lucide-react';
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
  const [appAddress] = useState(() => window.location.origin);
  function reportError(error: unknown) {
    setFailed(true);
    setMessage(error instanceof Error ? error.message : 'Your data could not be updated.');
  }
  return (
    <section className="data-settings" aria-label="Your local data">
      <h3>Your data</h3>
      <p className="small-note">Workouts, your plan, and nutrition stay on this device. Export a backup before clearing browser data or moving to another phone.</p>
      <p className="small-note">This copy of Setline runs at <code style={{ overflowWrap: 'anywhere' }}>{appAddress}</code>. Another website address has separate records, even if it looks like the same app.</p>
      <button className="text-button" style={{ minHeight: 44 }} type="button" onClick={async () => {
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable here. Touch and hold the address above to select it.');
          await navigator.clipboard.writeText(appAddress);
          setFailed(false); setMessage('App address copied. Share it to identify which Setline installation you use.');
        } catch (error) { reportError(error); }
      }}><Copy size={16} /> Copy app address</button>
      <div className="backup-buttons">
        <button className="btn btn-secondary" type="button" onClick={async () => {
          try {
            if (beforeExport && !(await beforeExport())) throw new Error('Some workout changes could not be saved. Retry saving before exporting, or export a recovery copy.');
            download(exportBackup(), `setline-backup-${new Date().toISOString().slice(0, 10)}.json`);
            setFailed(false); setMessage('Backup downloaded. Keep it somewhere safe.');
          } catch (error) { reportError(error); }
        }}><Download size={16} /> Export backup</button>
        {typeof navigator.share === 'function' && <button className="btn btn-secondary" type="button" onClick={async () => {
          try {
            if (beforeExport && !(await beforeExport())) throw new Error('Some workout changes could not be saved. Retry saving before sharing a backup.');
            const filename = `setline-backup-${new Date().toISOString().slice(0, 10)}.json`;
            const file = new File([exportBackup()], filename, { type: 'application/json' });
            if (navigator.canShare && !navigator.canShare({ files: [file] })) throw new Error('File sharing is not available here. Use Export backup instead.');
            await navigator.share({ files: [file], title: 'Setline backup' });
            setFailed(false); setMessage('Sharing finished. Confirm the backup was saved in Files or another safe place.');
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              setFailed(false); setMessage('Backup sharing was cancelled. No records were changed.');
            } else reportError(error);
          }
        }}><Share2 size={16} /> Save to Files / share</button>}
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
