import { useEffect, useRef, useState } from 'react';
import { rebaseObjectChanges } from './profile-updates';
import type { TrainingGuidance } from './training-guidance';

const unknownGuidance: TrainingGuidance = { impact: 'unknown', heavyLifting: 'unknown' };

export function TrainingGuidanceForm({ guidance, onSave, disabled = false, open = false, onOpenChange, onDirtyChange }: {
  guidance?: TrainingGuidance;
  onSave: (guidance: TrainingGuidance) => Promise<boolean>;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const saved = guidance ?? unknownGuidance;
  const key = JSON.stringify(saved);
  const baseline = useRef(saved);
  const [draft, setDraft] = useState<TrainingGuidance>(saved);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const dirty = JSON.stringify(draft) !== key;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    setDraft(current => rebaseObjectChanges(baseline.current, saved, current));
    baseline.current = saved;
    // Semantically equal profile hydration must not discard an unfinished edit.
  }, [key]);
  useEffect(() => { if (open) heading.current?.focus({ preventScroll: true }); }, [open]);

  return <details className="training-terms" open={open} onToggle={event => onOpenChange?.(event.currentTarget.open)}>
    <summary>Impact &amp; lifting guidance</summary>
    <section aria-label="Training guidance" style={{ display: 'grid', gap: 16, paddingBlock: 16 }}>
      <h3 ref={heading} tabIndex={-1}>Your recorded guidance</h3>
      <p>These are your reported settings, not medical approval from Setline. Choose cleared only when it matches your own clinician’s guidance.</p>
      {([['impact', 'Impact clearance'], ['heavyLifting', 'Heavy lifting clearance']] as const).map(([field, label]) => <label className="field-label" key={field}>
        {label}<select aria-label={label} disabled={disabled || saving} value={draft[field]}
          onChange={event => { setDraft({ ...draft, [field]: event.target.value as TrainingGuidance[typeof field] }); setMessage(''); }}>
          <option value="unknown">Unknown / awaiting guidance</option>
          <option value="cleared">Cleared within my guidance</option>
          <option value="restricted">Restricted</option>
        </select>
      </label>)}
      <label className="field-label">Personal guidance note<textarea aria-label="Personal guidance note" maxLength={500} rows={3} value={draft.note ?? ''} disabled={disabled || saving}
        onChange={event => { setDraft({ ...draft, note: event.target.value }); setMessage(''); }} /></label>
      <p className="small-note">Unconfirmed lifting guidance keeps future strength work at easy preparation. Unconfirmed impact guidance excludes maximal jumps and ballistic work. Program changes keep these settings; active and completed workouts keep their saved prescriptions.</p>
      <button type="button" className="btn full" disabled={disabled || saving} onClick={async () => {
        if (saving) return;
        setSaving(true); setMessage('');
        try { setMessage(await onSave(draft) ? 'Training guidance saved for future workouts.' : 'Guidance could not save. Your previous settings stay.'); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Guidance could not save.'); }
        finally { setSaving(false); }
      }}>{saving ? 'Saving…' : 'Save training guidance'}</button>
      {dirty && <button type="button" className="text-button" disabled={disabled || saving} onClick={() => { setDraft(saved); setMessage(''); }}>Discard guidance edits</button>}
      {message && <p role="status">{message}</p>}
    </section>
  </details>;
}
