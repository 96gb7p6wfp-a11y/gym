import * as React from 'react';
import { requestLocal } from './storage.ts';
import { isTrackable, mealReminders, reminderEntryId, ReminderSchema, reminderStatus, timeReminders, timingLabel, type Reminder, type ReminderEntry, type ReminderRecord, type ReminderState } from './reminders.ts';
import './reminders.css';

export interface RemindersPanelProps {
  date: string;
  mealSavedToken?: { date: string; sequence: number } | null;
}
const errorText = (error: unknown) => error instanceof Error ? error.message : 'The reminder could not be saved.';
const newId = () => crypto.randomUUID();

export default function RemindersPanel({ date, mealSavedToken }: RemindersPanelProps) {
  const [state, setState] = React.useState<ReminderState | null>(null);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<Reminder | null>(null);
  const [draftVersion, setDraftVersion] = React.useState(0);
  const [draftError, setDraftError] = React.useState('');
  const [now, setNow] = React.useState(() => new Date());
  async function load() {
    try {
      const saved = await requestLocal('/api/reminders');
      setState(saved as unknown as ReminderState);
      setError('');
    } catch (error) { setError(errorText(error)); }
  }
  React.useEffect(() => {
    void load();
    const reload = (event: StorageEvent) => { if (event.key === 'setline.gym.v1' || event.key === null) void load(); };
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, []);
  React.useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  async function recordStatus(reminder: Reminder, status: ReminderEntry['status']) {
    if (!state || saving) return;
    const existing = state.entries.find(({ entry }) => entry.reminderId === reminder.id && entry.date === date);
    if (status === 'taken' && existing?.entry.status === 'taken') return;
    setSaving(true);
    setError('');
    const now = Date.now();
    const entry: ReminderEntry = { id: reminderEntryId(reminder.id, date), reminderId: reminder.id, date, status, takenAt: status === 'taken' ? now : null, updatedAt: now };
    try {
      const result = await requestLocal('/api/reminders', { action: 'entry', entry, expectedVersion: existing?.version ?? 0 });
      setState((current) => current && ({ ...current, entries: [{ entry, version: result.version as number }, ...current.entries.filter((item) => item.entry.id !== entry.id)] }));
    } catch (error) { setError(errorText(error)); }
    finally { setSaving(false); }
  }
  function edit(record?: ReminderRecord) {
    setDraft(record ? { ...record.reminder } : { id: newId(), name: '', kind: 'medicine', instructions: '', timing: 'instructions', time: null, schedule: 'instructions-only', confirmed: false, enabled: true });
    setDraftVersion(record?.version ?? 0);
    setDraftError('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !state || saving) return;
    const parsed = ReminderSchema.safeParse(draft);
    if (!parsed.success) { setDraftError('Enter a name, label or prescription instructions, and a valid time if selected. Confirm only a once-daily schedule.'); return; }
    setSaving(true);
    setDraftError('');
    try {
      const result = await requestLocal('/api/reminders', { action: 'reminder', reminder: parsed.data, expectedVersion: draftVersion });
      setState((current) => current && ({ ...current, items: [{ reminder: parsed.data, version: result.version as number }, ...current.items.filter((item) => item.reminder.id !== parsed.data.id)] }));
      setDraft(null);
    } catch (error) { setDraftError(errorText(error)); }
    finally { setSaving(false); }
  }
  const mealDue = state && mealSavedToken?.date === date && mealSavedToken.sequence > 0 ? mealReminders(state, date) : [];
  const timeDue = state ? timeReminders(state, date, now) : [];
  const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return <section className="reminder-panel" aria-label="Supplement and medication reminders">
    <div className="reminder-panel__heading"><div><h2>Daily reminders</h2><p>{dayLabel} · In-app only; no alerts when the app is closed.</p></div><button type="button" onClick={() => edit()} disabled={!state || saving || !!draft}>Add reminder</button></div>
    <p className="reminder-panel__note">Logging a meal does not mark anything taken. Follow your label or prescription; reminders do not recommend a dose.</p>
    {error && <div role="alert" className="reminder-panel__error">{error} <button type="button" onClick={() => void load()}>Reload reminders</button></div>}
    {!state && !error && <p role="status">Loading reminders…</p>}
    {mealDue.length > 0 && <div className="reminder-panel__meal" role="status">Meal saved. If this matches your instructions, check your meal reminders: {mealDue.map((item) => item.name).join(', ')}.</div>}
    {timeDue.length > 0 && <div className="reminder-panel__meal" role="status">Scheduled time reached (Berlin): {timeDue.map((item) => item.name).join(', ')}. Follow your recorded instructions.</div>}
    {state && <ul className="reminder-panel__list">{state.items.map((record) => {
      const reminder = record.reminder;
      const status = reminderStatus(state, reminder.id, date);
      const trackable = isTrackable(reminder);
      return <li key={reminder.id} className="reminder-panel__item">
        <div className="reminder-panel__row"><div><strong>{reminder.name}</strong><p>{!reminder.enabled ? 'Paused' : !trackable ? 'Check label or prescription before tracking' : `${timingLabel(reminder)} · Once daily`}</p></div><button type="button" aria-label={`Edit ${reminder.name} reminder`} disabled={saving} onClick={() => edit(record)}>Edit</button></div>
        <details className="reminder-panel__instructions"><summary>Recorded instructions</summary><p>{reminder.instructions}</p></details>
        {(trackable || status !== 'pending') && <div className="reminder-panel__actions">
          <span role="status">{status === 'taken' ? 'Taken for this date' : status === 'later' ? 'Later for this date' : 'Not marked taken'}</span>
          {status === 'taken' ? <button type="button" disabled={saving} aria-label={`Undo ${reminder.name} taken`} onClick={() => void recordStatus(reminder, 'pending')}>Undo</button> : <>
            {trackable && <button type="button" className="reminder-panel__take" disabled={saving} aria-label={`Mark ${reminder.name} taken`} onClick={() => void recordStatus(reminder, 'taken')}>Taken</button>}
            <button type="button" disabled={saving} aria-label={`${status === 'later' ? 'Undo later for' : 'Remind later for'} ${reminder.name}`} onClick={() => void recordStatus(reminder, status === 'later' ? 'pending' : 'later')}>{status === 'later' ? 'Undo later' : 'Later'}</button>
          </>}
        </div>}
      </li>;
    })}</ul>}
    {draft && <form className="reminder-panel__form" onSubmit={(event) => void save(event)}>
      <h3>{draftVersion > 0 || state?.items.some((item) => item.reminder.id === draft.id) ? 'Edit reminder' : 'New reminder'}</h3>
      <label>Name<input value={draft.name} maxLength={120} required onChange={(event) => setDraft({ ...draft, name: event.target.value, confirmed: false })} /></label>
      <label>Type<select aria-label="Type" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as Reminder['kind'], confirmed: false })}><option value="medicine">Medicine</option><option value="supplement">Supplement</option></select></label>
      <label>Label or prescribed instructions<textarea aria-label="Label or prescribed instructions" value={draft.instructions} maxLength={1000} rows={4} required onChange={(event) => setDraft({ ...draft, instructions: event.target.value, confirmed: false })} /></label>
      <label>Frequency<select aria-label="Frequency" value={draft.schedule} onChange={(event) => setDraft({ ...draft, schedule: event.target.value as Reminder['schedule'], confirmed: false })}><option value="instructions-only">Keep instructions; frequency needs confirmation</option><option value="once-daily">Once daily, according to my label or prescription</option></select></label>
      <label>Reminder timing<select aria-label="Reminder timing" value={draft.timing} onChange={(event) => setDraft({ ...draft, timing: event.target.value as Reminder['timing'], time: null, confirmed: false })}><option value="instructions">Follow recorded instructions</option><option value="meal">With a meal</option><option value="evening">With my evening meal</option><option value="time">A time I choose</option></select></label>
      {draft.timing === 'time' && <label>Reminder time · Berlin<input type="time" value={draft.time ?? ''} required onChange={(event) => setDraft({ ...draft, time: event.target.value || null, confirmed: false })} /></label>}
      <label className="reminder-panel__check"><input type="checkbox" checked={draft.confirmed} disabled={draft.schedule !== 'once-daily'} onChange={(event) => setDraft({ ...draft, confirmed: event.target.checked })} />I verified these instructions and once-daily frequency from my label or prescription.</label>
      <label className="reminder-panel__check"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Active reminder</label>
      <p className="reminder-panel__note">Other frequencies stay as instructions only. Ask your pharmacist about supplement doses and medicine interactions. You can pause reminders without deleting history.</p>
      {draftError && <p role="alert" className="reminder-panel__error">{draftError}</p>}
      <div className="reminder-panel__form-actions"><button type="submit" disabled={saving}>Save reminder</button><button type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</button></div>
    </form>}
  </section>;
}

export { RemindersPanel };
