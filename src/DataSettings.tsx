import { useEffect, useRef, useState } from 'react';
import { Copy, Download, Share2, Upload } from 'lucide-react';
import { exportBackup, exportRecovery, hasPreviousRestoreCopy, importBackup, MAX_BACKUP_BYTES, previewBackup, previousRestoreCopy, resetLocalData, type BackupPreview } from './storage';
import { backupReminderDue, clearBackupStatus, confirmExternalBackup, dismissBackupReminder, invalidateBackupConfirmation, readBackupStatus, recordBackupAction, writeBackupStatus, type BackupStatus } from './backup-status';
import './data-settings.css';

const BACKUP_STATUS_CHANGED = 'setline:backup-status-changed';
function browserBackupStatus() {
  try { return { value: readBackupStatus(window.localStorage), available: true }; }
  catch { return { value: { version: 1, firstSeenAt: Date.now() } as BackupStatus, available: false }; }
}

function useBackupStatus() {
  const [state, setState] = useState(browserBackupStatus);
  useEffect(() => {
    const sync = () => setState(browserBackupStatus());
    try { writeBackupStatus(window.localStorage, readBackupStatus(window.localStorage)); }
    catch { setState(current => ({ ...current, available: false })); }
    window.addEventListener(BACKUP_STATUS_CHANGED, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(BACKUP_STATUS_CHANGED, sync); window.removeEventListener('storage', sync); };
  }, []);
  function update(change: (current: BackupStatus) => BackupStatus) {
    // Always read the latest metadata so two open settings views do not regress it.
    let value: BackupStatus;
    try { value = change(readBackupStatus(window.localStorage)); }
    catch { value = change(state.value); }
    try {
      writeBackupStatus(window.localStorage, value);
      setState({ value, available: true });
      window.dispatchEvent(new Event(BACKUP_STATUS_CHANGED));
      return true;
    } catch { setState({ value, available: false }); return false; }
  }
  return { ...state, update };
}

/** A low-priority reminder; opening settings or switching modes never changes logs. */
export function BackupReminder({ onOpen }: { onOpen: () => void }) {
  const status = useBackupStatus();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !backupReminderDue(status.value)) return null;
  return <aside className="backup-reminder" aria-label="Backup reminder">
    <p>Keep a copy of your progress</p>
    <p className="small-note">No external backup file has been confirmed here in the last 30 days. Check a saved file before relying on it.</p>
    <div className="backup-buttons">
      <button className="text-button" type="button" onClick={onOpen}>Backup & data</button>
      <button className="text-button" type="button" onClick={() => { status.update(current => dismissBackupReminder(current)); setDismissed(true); }}>Remind me in 7 days</button>
    </div>
  </aside>;
}

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
  const actionInFlight = useRef(false);
  const backupStatus = useBackupStatus();
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
    if (actionInFlight.current) return;
    actionInFlight.current = true; setBusy(true);
    try { await work(); } catch (error) { reportError(error); }
    finally { actionInFlight.current = false; setBusy(false); }
  }
  function rememberAction(method: 'download-requested' | 'share-completed', successMessage: string) {
    const remembered = backupStatus.update(current => recordBackupAction(current, method));
    setFailed(false); setMessage(successMessage + (remembered ? '' : ' The export action could not be remembered on this browser.'));
  }
  function replaceBackup(text: string) {
    importBackup(text);
    // Backup status is advisory: failing to remember it must not undo a valid restore.
    try { invalidateBackupConfirmation(window.localStorage); } catch { /* Main records were safely restored. */ }
  }
  function deleteLocalData() {
    resetLocalData();
    try { clearBackupStatus(window.localStorage); } catch { /* This key contains no training records. */ }
  }
  return (
    <section className="data-settings" aria-label="Your local data" aria-busy={busy}>
      <h3>Your data</h3>
      <p className="small-note">Workouts, your plan, and nutrition stay on this device. Export a backup before clearing browser data or moving to another phone.</p>
      <dl className="data-settings__status" aria-label="Backup status">
        <div><dt>Storage location</dt><dd>This browser on this device · local storage</dd></div>
        <div><dt>Last known export action</dt><dd>{backupStatus.value.lastExportAction ? `${backupStatus.value.lastExportAction.method === 'download-requested' ? 'Download requested' : 'Sharing completed'} · ${new Date(backupStatus.value.lastExportAction.at).toLocaleString()}` : 'No export action recorded in this browser'}</dd></div>
        <div><dt>External file check</dt><dd>{backupStatus.value.externalCopyConfirmedAt ? `You confirmed a saved file · ${new Date(backupStatus.value.externalCopyConfirmedAt).toLocaleString()}` : 'No saved file confirmed by you'}</dd></div>
      </dl>
      <p className="small-note">A download or completed share does not prove a file is safely stored. Open the file in Files, Downloads, or your chosen storage before confirming. Setline cannot independently verify it and has no automatic cloud backup.</p>
      <button className="text-button data-settings__copy" type="button" disabled={busy} onClick={() => {
        const remembered = backupStatus.update(current => confirmExternalBackup(current));
        setFailed(false); setMessage(remembered ? 'Your file check was recorded. This is your confirmation; Setline cannot verify external storage.' : 'Your file check could not be remembered on this browser. Keep the backup file in a safe place.');
      }}>I checked my saved backup file</button>
      {!backupStatus.available && <p className="small-note">Backup-status storage is unavailable. Export and check your file; these status dates may not persist.</p>}
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
          rememberAction('download-requested', 'Backup download requested. Check that the JSON file is saved in Files or Downloads.');
        })}><Download size={16} /> Export backup</button>
        {typeof navigator.share === 'function' && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void action(async () => {
          await flush();
          const file = new File([exportBackup()], `setline-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
          if (!navigator.canShare?.({ files: [file] })) throw new Error('File sharing is unavailable here. Use Export backup instead.');
          try {
            await navigator.share({ files: [file], title: 'Setline backup' });
            rememberAction('share-completed', 'Sharing finished. Confirm the backup was saved in Files or another safe place.');
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              setFailed(false); setMessage('Backup sharing was cancelled. No records were changed.');
            } else throw error;
          }
        })}><Share2 size={16} /> Save to Files / share</button>}
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={16} /> Import backup</button>
      </div>
      <details className="data-settings__transfer">
        <summary>Move to another device or website</summary>
        <ol>
          <li>Export a backup from this device and this exact app address.</li>
          <li>Confirm the JSON file is visible in Files or Downloads. Keep a second copy somewhere safe.</li>
          <li>Open Setline at the intended address on the destination device. Different website addresses, browsers, and devices have separate storage.</li>
          <li>Choose Import backup, review its date and record counts, then confirm Restore backup. Restore replaces the destination records; export them first if needed.</li>
          <li>Check your plan and history on the destination before relying on it. Keep the original device and its data until you are satisfied.</li>
        </ol>
        <p className="small-note">Setline does not copy data between website addresses automatically or clear the original copy. Backup-status dates stay with this browser and are not proof of a file on another device.</p>
      </details>
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
            if (onReplace) await onReplace(() => replaceBackup(pending.text));
            else { replaceBackup(pending.text); window.location.reload(); }
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
        if (onReplace) await onReplace(deleteLocalData);
        else { deleteLocalData(); window.location.reload(); }
      })}>Delete all local data</button>
    </section>
  );
}
