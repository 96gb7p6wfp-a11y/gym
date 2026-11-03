import { useRef, useState } from 'react';
import { Copy, Download, Share2, Upload } from 'lucide-react';
import { exportBackup, exportRecovery, hasPreviousRestoreCopy, importBackup, MAX_BACKUP_BYTES, previewBackup, previousRestoreCopy, resetLocalData, type BackupPreview } from './storage';
import './data-settings.css';

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function DataSettings({ beforeExport, onReplace }: {
  beforeExport?: () => Promise<boolean>;
  onReplace?: (replace: () => void) => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ name: string; text: string; preview: BackupPreview } | null>(null);
  const [hasSafetyCopy] = useState(() => {
    try { return hasPreviousRestoreCopy(); } catch { return false; }
  });
  function reportError(error: unknown) {
    setFailed(true);
    setMessage(error instanceof Error ? error.message : 'Your data could not be updated.');
  }
  async function flush() {
    if (beforeExport && !(await beforeExport())) throw new Error('Some workout changes could not be saved. Retry saving before exporting or restoring, or export a recovery copy.');
  }
  async function action(work: () => Promise<void> | void) {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (error) { reportError(error); }
    finally { setBusy(false); }
  }
  return (
    <section className="data-settings" aria-label="Your local data" aria-busy={busy}>
      <h3>Your data</h3>
      <p className="small-note">Workouts, your plan, and nutrition stay on this device. Export a backup before clearing browser data or moving to another phone.</p>
      <p className="small-note">This copy of Setline runs at <code className="data-settings__origin">{window.location.origin}</code>. Another website address has separate records, even if it looks like the same app.</p>
      <button className="text-button data-settings__copy" type="button" disabled={busy} onClick={() => void action(async () => {
        if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable here. Touch and hold the address above to select it.');
        await navigator.clipboard.writeText(window.location.origin);
        setFailed(false); setMessage('App address copied.');
      })}><Copy size={16} /> Copy app address</button>
      <div className="backup-buttons">
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void action(async () => {
          await flush();
          download(exportBackup(), `setline-backup-${new Date().toISOString().slice(0, 10)}.json`);
          setFailed(false); setMessage('Backup download requested. Check that the JSON file is saved in Files or Downloads.');
        })}><Download size={16} /> Export backup</button>
        {typeof navigator.share === 'function' && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void action(async () => {
          await flush();
          const file = new File([exportBackup()], `setline-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
          if (!navigator.canShare?.({ files: [file] })) throw new Error('File sharing is unavailable here. Use Export backup instead.');
          try {
            await navigator.share({ files: [file], title: 'Setline backup' });
            setFailed(false); setMessage('Sharing finished. Confirm the backup was saved in Files or another safe place.');
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              setFailed(false); setMessage('Backup sharing was cancelled. No records were changed.');
            } else throw error;
          }
        })}><Share2 size={16} /> Save to Files / share</button>}
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={16} /> Import backup</button>
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Restore Setline backup" hidden disabled={busy} onChange={async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        setPending(null);
        if (!file) return;
        await action(async () => {
          if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 10 MB.');
          const text = await file.text();
          const preview = previewBackup(text);
          setFailed(false); setMessage('');
          setPending({ name: file.name, text, preview });
        });
      }} />
      {pending && <section className="data-settings__preview" aria-label="Backup restore preview">
        <h4>Review backup</h4>
        <p className="small-note data-settings__filename">{pending.name}</p>
        <p className="small-note">Exported: {pending.preview.exportedAt ? new Date(pending.preview.exportedAt).toLocaleString() : 'Date unavailable (older backup)'}</p>
        <dl>
          <div><dt>Workouts</dt><dd>{pending.preview.workouts}</dd></div>
          <div><dt>Meal and weight records</dt><dd>{pending.preview.mealsAndWeights}</dd></div>
          <div><dt>Extra activities</dt><dd>{pending.preview.activities}</dd></div>
          <div><dt>Reminders</dt><dd>{pending.preview.reminders}</dd></div>
          <div><dt>Jump measurements</dt><dd>{pending.preview.jumpMeasurements}</dd></div>
          <div><dt>Readiness check-ins</dt><dd>{pending.preview.readinessCheckIns}</dd></div>
        </dl>
        {pending.preview.activeWorkouts > 0 && <p className="small-note">Includes an active workout that you can resume.</p>}
        <p className="small-note">Close other Setline tabs before restoring, especially tabs running an older app version. Restore replaces all current local records and the training plan with this backup, including deleted records. A safety copy of your current saved data is kept on this device before replacement. Export it from Settings after restoring.</p>
        <div className="backup-buttons">
          <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setPending(null)}>Cancel restore</button>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void action(async () => {
            await flush();
            if (!window.confirm('Replace current local records with this reviewed backup? A safety copy will be kept on this device.')) return;
            if (onReplace) await onReplace(() => importBackup(pending.text));
            else { importBackup(pending.text); window.location.reload(); }
          })}>Restore backup</button>
        </div>
      </section>}
      {hasSafetyCopy && <div className="data-settings__safety">
        <p className="small-note">A copy of the saved data from before your last restore is available. Export it before another restore or clearing browser data.</p>
        <button className="text-button" type="button" disabled={busy} onClick={() => void action(() => {
          const copy = previousRestoreCopy();
          if (!copy) throw new Error('No pre-restore safety copy is available.');
          download(copy.text, copy.recovery ? 'setline-before-restore-recovery.json' : 'setline-before-restore.json');
          setFailed(false); setMessage(copy.recovery ? 'Recovery download requested. This copy contains the original unreadable data for recovery.' : 'Safety-copy download requested. Check Files or Downloads; you can import this backup to recover your previous records.');
        })}>Export pre-restore safety copy</button>
      </div>}
      {message && <p className={failed ? 'backup-error' : 'small-note'} role={failed ? 'alert' : 'status'}>{message}</p>}
      {failed && <button className="text-button" type="button" disabled={busy} onClick={() => void action(() => {
        download(exportRecovery(), 'setline-recovery.json');
        setFailed(false); setMessage('Recovery download requested. Check Files or Downloads.');
      })}>Export recovery copy</button>}
      <button className="text-button backup-delete" type="button" disabled={busy} onClick={() => void action(async () => {
        if (!window.confirm('Delete all local workouts, nutrition, custom plans and the pre-restore safety copy? This cannot be undone. Export a backup first.')) return;
        if (onReplace) await onReplace(resetLocalData);
        else { resetLocalData(); window.location.reload(); }
      })}>Delete all local data</button>
    </section>
  );
}
