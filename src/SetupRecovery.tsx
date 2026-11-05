import { useEffect, useRef, useState } from 'react';
import { applySetupRecovery, cancelSetupRecovery, MAX_BACKUP_BYTES, previewSetupRecovery, type SetupRecoveryPreview } from './storage';
import type { SetupRecoveryScope } from './setup-recovery';
import './setup-recovery.css';

interface SetupRecoveryProps {
  beforeExport?: () => Promise<boolean>;
  onReplace?: (replace: () => void) => Promise<void>;
  activeWorkout?: boolean;
  disabled?: boolean;
  initiallyOpen?: boolean;
}

/** Explicit, reviewed setup recovery; historical records never come from the chosen file. */
export function SetupRecovery({ beforeExport, onReplace, activeWorkout = false, disabled = false, initiallyOpen = false }: SetupRecoveryProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [scope, setScope] = useState<SetupRecoveryScope>('settings');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<SetupRecoveryPreview | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (initiallyOpen) setOpen(true); }, [initiallyOpen]);
  // A cancelled, replaced or unmounted review cannot remain actionable through
  // an old callback. Its potentially large backup text is released too.
  useEffect(() => () => { if (preview) cancelSetupRecovery(preview.token); }, [preview]);

  async function action(work: () => Promise<void> | void) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try { await work(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Recovery could not be completed. Your records were not replaced.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  function selectScope(next: SetupRecoveryScope) {
    if (inFlight.current) return;
    setScope(next); setPreview(null); setError(''); setMessage('');
  }

  return <details className="setup-recovery" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Recover settings or training plan</summary>
    <section aria-label="Setup recovery" aria-busy={busy}>
      <p>Your current app address is <code>{window.location.origin}</code>. Preview and production addresses have separate browser data. This app cannot read or automatically restore settings on your other address or iPhone installation.</p>
      <p>Choose a backup from your original installation, then review which part to recover. Your current workouts, nutrition, jump records, routines and custom workout templates stay here.</p>
      <div className="setup-recovery__scope" role="group" aria-label="Recovery scope">
        <button type="button" aria-pressed={scope === 'settings'} disabled={disabled || busy} onClick={() => selectScope('settings')}>Settings only</button>
        <button type="button" aria-pressed={scope === 'training'} disabled={disabled || busy || activeWorkout} onClick={() => selectScope('training')}>Training plan only</button>
      </div>
      <p className="small-note">{scope === 'settings'
        ? 'Recover personal inputs, goals, equipment preferences, schedule, rest, theme and sound. The weekly plan and program version stay unchanged. Missing settings in an older backup keep their current values.'
        : 'Recover the saved weekly plan, program cycle and match weeks. Current date-specific edits, custom templates and saved program archive remain in place. Date edits may still override the recovered week.'}</p>
      <p className="small-note">Your current impact and lifting guidance is kept. Medical-clearance flags from this backup are not applied. Review your own guidance separately in Training.</p>
      {activeWorkout && <p className="small-note">Finish your active workout before recovering a training plan. Settings recovery does not change that workout’s saved prescription.</p>}
      <input ref={input} className="sr-only" type="file" accept="application/json,.json" aria-label="Choose setup recovery backup"
        aria-hidden="true" tabIndex={-1} disabled={disabled || busy || (scope === 'training' && activeWorkout)}
        onChange={event => {
          if (inFlight.current) return;
          const chosen = event.currentTarget.files?.[0]; event.currentTarget.value = '';
          if (!chosen) return;
          setPreview(null); setFile(null);
          void action(async () => {
            if (chosen.size > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 10 MB.');
            const text = await chosen.text();
            const reviewed = previewSetupRecovery(text, scope);
            setFile({ name: chosen.name, text }); setPreview(reviewed);
          });
        }} />
      <button type="button" className="btn secondary" disabled={disabled || busy || (scope === 'training' && activeWorkout)} onClick={() => input.current?.click()}>Choose recovery backup</button>
      {file && <p className="setup-recovery__filename">{file.name}</p>}
      {file && !preview && <button type="button" className="text-button" disabled={disabled || busy || (scope === 'training' && activeWorkout)} onClick={() => void action(() => setPreview(previewSetupRecovery(file.text, scope)))}>Review recovery changes</button>}
      {preview && <section className="setup-recovery__preview" aria-label="Setup recovery preview">
        <h4>Review {preview.scope === 'settings' ? 'settings' : 'training plan'} recovery</h4>
        {preview.exportedAt && <p className="small-note">Backup exported {new Date(preview.exportedAt).toLocaleString()}</p>}
        {preview.changes.length ? <dl>{preview.changes.map(change => <div key={change.field}>
          <dt>{change.label}</dt><dd><span>Current</span>{change.before}</dd><dd><span>Recover</span>{change.after}</dd>
        </div>)}</dl> : <p>This backup already matches the selected part of your setup. There is nothing to recover.</p>}
        {preview.scope === 'training' && <details className="setup-recovery__plan"><summary>Recovered week · exercises & dosage</summary>
          {preview.plan.map(day => <section key={day.day}><h5>{day.day} · {day.name}</h5>
            {day.exercises.length ? <ul>{day.exercises.map((exercise, index) => <li key={index}><strong>{exercise.name}</strong><span>{exercise.dose}</span></li>)}</ul> : <p>No working exercises in this saved day.</p>}
          </section>)}
        </details>}
        <p className="small-note">Current records kept: {preview.preserved.workouts} workouts ({preview.preserved.activeWorkouts} active), {preview.preserved.nutrition} meal/weight entries, {preview.preserved.activities} activities, {preview.preserved.jumpMeasurements} jump measurements and {preview.preserved.reminders} routine items. New records saved after this preview are kept too.</p>
        <p className="small-note">A recoverable copy of the complete current data is saved first. Recovery stops if that safety copy cannot be saved. Full backup restore remains a separate action below.</p>
        <div className="backup-buttons">
          <button type="button" className="btn" disabled={disabled || busy || !preview.changes.length || (preview.scope === 'training' && activeWorkout)} onClick={() => void action(async () => {
            if (beforeExport && !(await beforeExport())) throw new Error('Save pending workout changes before recovering your setup. No records were replaced.');
            const replace = () => applySetupRecovery(preview.token);
            if (onReplace) await onReplace(replace);
            else { replace(); window.location.reload(); }
            setPreview(null); setFile(null); setMessage('Setup recovery saved. Your current training records were kept.');
          })}>{busy ? 'Recovering…' : 'Confirm setup recovery'}</button>
          <button type="button" className="text-button" disabled={busy} onClick={() => { if (inFlight.current) return; setPreview(null); setFile(null); setError(''); setMessage(''); }}>Cancel recovery</button>
        </div>
      </section>}
      {error && <p className="setup-recovery__error" role="alert">{error}</p>}
      {error && file && <button type="button" className="text-button" disabled={disabled || busy} onClick={() => void action(() => setPreview(previewSetupRecovery(file.text, scope)))}>Review current setup again</button>}
      {message && <p role="status">{message}</p>}
    </section>
  </details>;
}
