import * as React from 'react';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { requestLocal } from './storage.ts';
import { isTrackable, mealReminders, reminderEntryId, ReminderSchema, reminderStatus, timeReminders, timingLabel, type Reminder, type ReminderEntry, type ReminderRecord, type ReminderState } from './reminders.ts';
import './reminders.css';

export interface RemindersPanelProps {
  date: string;
  onDateChange?: (date: string) => void;
  showHeading?: boolean;
  mealSavedToken?: { date: string; sequence: number } | null;
}
interface MealRoutineCueProps {
  date: string;
  mealSavedToken?: { date: string; sequence: number } | null;
  onOpenRoutine?: () => void;
}
const ROUTINE_CHANGED = 'setline:routine-change';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Your routine could not be saved.';
const newId = () => crypto.randomUUID();

/** Default display names are shorter; saved names and all instructions stay intact. */
function displayName(reminder: Reminder) {
  const names: Record<string, [string, string]> = {
    zinc: ['Mivolis zinc', 'Zinc'],
    'vitamin-d-k2': ['Doppelherz D3 + K2', 'Vitamin D3 + K2'],
    'omega-3': ['Doppelherz omega-3', 'Omega-3'],
    magnesium: ['Mivolis Magnesium 500', 'Magnesium'],
  };
  const pair = names[reminder.id];
  return pair?.[0] === reminder.name ? pair[1] : reminder.name;
}

function useRoutine() {
  const [state, setState] = React.useState<ReminderState | null>(null);
  const [error, setError] = React.useState('');
  const load = React.useCallback(async () => {
    try {
      const saved = await requestLocal('/api/reminders');
      setState(saved as unknown as ReminderState);
      setError('');
    } catch (error) { setError(errorText(error)); }
  }, []);
  React.useEffect(() => {
    void load();
    const reload = (event: StorageEvent) => { if (event.key === 'setline.gym.v1' || event.key === null) void load(); };
    const refresh = () => void load();
    window.addEventListener('storage', reload);
    window.addEventListener(ROUTINE_CHANGED, refresh);
    return () => { window.removeEventListener('storage', reload); window.removeEventListener(ROUTINE_CHANGED, refresh); };
  }, [load]);
  return { state, setState, error, setError, load };
}

/** A meal offers a cue, never a dose record or an automatic completion. */
export function MealRoutineCue({ date, mealSavedToken, onOpenRoutine }: MealRoutineCueProps) {
  const { state } = useRoutine();
  const due = state && mealSavedToken?.date === date && mealSavedToken.sequence > 0 ? mealReminders(state, date) : [];
  if (!due.length) return null;
  return <div className="meal-routine-cue" role="status">
    <span><strong>Meal saved</strong><span>Check {due.map(displayName).join(', ')} against your instructions.</span></span>
    {onOpenRoutine && <button type="button" onClick={onOpenRoutine}>Routine <ChevronRight size={16} aria-hidden="true" /></button>}
  </div>;
}
export const MealReminderCue = MealRoutineCue;

export default function RemindersPanel({ date, onDateChange, mealSavedToken, showHeading = true }: RemindersPanelProps) {
  const { state, setState, error, setError, load } = useRoutine();
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState<Reminder | null>(null);
  const [draftVersion, setDraftVersion] = React.useState(0);
  const [draftError, setDraftError] = React.useState('');
  const [now, setNow] = React.useState(() => new Date());
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
    const timestamp = Date.now();
    const entry: ReminderEntry = { id: reminderEntryId(reminder.id, date), reminderId: reminder.id, date, status, takenAt: status === 'taken' ? timestamp : null, updatedAt: timestamp };
    try {
      const result = await requestLocal('/api/reminders', { action: 'entry', entry, expectedVersion: existing?.version ?? 0 });
      setState((current) => current && ({ ...current, entries: [{ entry, version: result.version as number }, ...current.entries.filter((item) => item.entry.id !== entry.id)] }));
      window.dispatchEvent(new Event(ROUTINE_CHANGED));
    } catch (error) { setError(errorText(error)); }
    finally { setSaving(false); }
  }
  function edit(record?: ReminderRecord) {
    setDraft(record ? { ...record.reminder } : { id: newId(), name: '', kind: 'medicine', instructions: '', timing: 'instructions', time: null, schedule: 'instructions-only', confirmed: false, enabled: true });
    setDraftVersion(record?.version ?? 0);
    setDraftError('');
  }
  function changeDraft(update: Partial<Reminder>) {
    setDraft((current) => current && ({ ...current, ...update, confirmed: false }));
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !state || saving) return;
    const parsed = ReminderSchema.safeParse(draft);
    if (!parsed.success) { setDraftError('Add a name and label instructions. Check the time and confirm only a once-daily schedule.'); return; }
    setSaving(true);
    setDraftError('');
    try {
      const result = await requestLocal('/api/reminders', { action: 'reminder', reminder: parsed.data, expectedVersion: draftVersion });
      setState((current) => current && ({ ...current, items: [{ reminder: parsed.data, version: result.version as number }, ...current.items.filter((item) => item.reminder.id !== parsed.data.id)] }));
      setDraft(null);
      window.dispatchEvent(new Event(ROUTINE_CHANGED));
    } catch (error) { setDraftError(errorText(error)); }
    finally { setSaving(false); }
  }
  const mealDue = state && mealSavedToken?.date === date && mealSavedToken.sequence > 0 ? mealReminders(state, date) : [];
  const timeDue = state ? timeReminders(state, date, now) : [];
  const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const ready = state?.items.filter(({ reminder }) => isTrackable(reminder)) ?? [];
  const needsReview = state?.items.filter(({ reminder }) => !isTrackable(reminder)) ?? [];

  function reminderRow(record: ReminderRecord) {
    if (!state) return null;
    const { reminder } = record;
    const status = reminderStatus(state, reminder.id, date);
    const trackable = isTrackable(reminder);
    return <li key={reminder.id} className={`reminder-panel__item${status === 'taken' ? ' reminder-panel__item--taken' : ''}`}>
      <div className="reminder-panel__row">
        <button type="button" className="reminder-panel__name" aria-label={`Edit ${reminder.name} reminder`} disabled={saving} onClick={() => edit(record)}>
          <strong>{displayName(reminder)}</strong>
          <span>{!reminder.enabled ? 'Paused' : !trackable ? 'Confirm label instructions' : timingLabel(reminder)}</span>
          {reminder.dosageText && <span className="reminder-panel__dose">{reminder.dosageText}</span>}
        </button>
        {(trackable || status === 'taken') ? <button type="button" className="reminder-panel__check-button" disabled={saving} aria-pressed={status === 'taken'} aria-label={`${status === 'taken' ? 'Undo' : 'Mark'} ${reminder.name} taken`} onClick={() => void recordStatus(reminder, status === 'taken' ? 'pending' : 'taken')}>
          <span className="reminder-panel__check-circle">{status === 'taken' && <Check size={18} strokeWidth={2.5} aria-hidden="true" />}</span>
        </button> : <button type="button" className="reminder-panel__edit-button" aria-label={`Review ${reminder.name} instructions`} disabled={saving} onClick={() => edit(record)}><ChevronRight size={19} aria-hidden="true" /></button>}
      </div>
      {status !== 'pending' && <p className="reminder-panel__status" role="status">{status === 'taken' ? 'Taken' : 'Later'}</p>}
      <details className="reminder-panel__instructions">
        <summary>Instructions</summary>
        <p>{reminder.instructions}</p>{trackable && <p>Once daily · confirmed instructions</p>}
        {(trackable || status === 'later') && status !== 'taken' && <button type="button" className="reminder-panel__later" disabled={saving} aria-label={`${status === 'later' ? 'Undo later for' : 'Remind later for'} ${reminder.name}`} onClick={() => void recordStatus(reminder, status === 'later' ? 'pending' : 'later')}>{status === 'later' ? 'Undo later' : 'Later'}</button>}
      </details>
    </li>;
  }

  return <section className="reminder-panel" aria-label="Supplement and medication reminders">
    <div className="reminder-panel__heading">
      <div>{showHeading && <h2>Routine</h2>}<p>{dayLabel}</p></div>
      <button type="button" className="reminder-panel__add" aria-label="Add reminder" onClick={() => edit()} disabled={!state || saving || !!draft}><Plus size={18} aria-hidden="true" /><span>Add</span></button>
    </div>
    {onDateChange && <label className="reminder-panel__date">Routine date<input type="date" value={date} onChange={(event) => event.target.value && onDateChange(event.target.value)} /></label>}
    {error && <div role="alert" className="reminder-panel__error">{error} <button type="button" onClick={() => void load()}>Reload reminders</button></div>}
    {!state && !error && <p role="status">Loading routine…</p>}
    {mealDue.length > 0 && <p className="reminder-panel__meal" role="status">Meal saved · Check {mealDue.map(displayName).join(', ')}.</p>}
    {timeDue.length > 0 && <p className="reminder-panel__meal" role="status">Due now · {timeDue.map(displayName).join(', ')}.</p>}
    {state && <>
      {ready.length > 0 ? <ul className="reminder-panel__list">{ready.map(reminderRow)}</ul> : <p className="reminder-panel__empty">Your confirmed routine will appear here.</p>}
      {needsReview.length > 0 && <details className="reminder-panel__manage"><summary>Manage routine <span>{needsReview.length}</span></summary><ul className="reminder-panel__list">{needsReview.map(reminderRow)}</ul></details>}
    </>}
    <details className="reminder-panel__alerts"><summary>About reminders</summary><p>Your schedule is available in the app. Alerts while Setline is closed need a notification service.</p><p>Logging food never marks a supplement taken. Follow your label or prescription.</p></details>
    <Dialog open={!!draft} onOpenChange={(open: boolean) => { if (!open && !saving) setDraft(null); }}>
      <DialogContent className="app-dialog reminder-sheet">
        <DialogHeader className="">
          <DialogTitle className="">{draftVersion > 0 || state?.items.some((item) => item.reminder.id === draft?.id) ? 'Edit reminder' : 'New reminder'}</DialogTitle>
          <DialogDescription className="">Use your label or prescription instructions.</DialogDescription>
        </DialogHeader>
        {draft && <form className="reminder-panel__form" aria-label="Reminder form" onSubmit={(event) => void save(event)}>
          <label>Name<input value={draft.name} maxLength={120} required onChange={(event) => changeDraft({ name: event.target.value })} /></label>
          <label>Dosage text<input value={draft.dosageText ?? ''} maxLength={160} placeholder="As written on your label" onChange={(event) => changeDraft({ dosageText: event.target.value })} /></label>
          <div className="reminder-panel__form-pair">
            <label>Type<select aria-label="Type" value={draft.kind} onChange={(event) => changeDraft({ kind: event.target.value as Reminder['kind'] })}><option value="medicine">Medicine</option><option value="supplement">Supplement</option></select></label>
            <label>Frequency<select aria-label="Frequency" value={draft.schedule} onChange={(event) => changeDraft({ schedule: event.target.value as Reminder['schedule'] })}><option value="instructions-only">Instructions only</option><option value="once-daily">Once daily</option></select></label>
          </div>
          <label>Label or prescribed instructions<textarea aria-label="Label or prescribed instructions" value={draft.instructions} maxLength={1000} rows={3} required onChange={(event) => changeDraft({ instructions: event.target.value })} /></label>
          <label>Reminder timing<select aria-label="Reminder timing" value={draft.timing} onChange={(event) => changeDraft({ timing: event.target.value as Reminder['timing'], time: null })}><option value="instructions">Follow instructions</option><option value="meal">At a meal</option><option value="evening">Evening meal</option><option value="time">Choose a time</option></select></label>
          {draft.timing === 'time' && <label>Reminder time · Berlin<input type="time" value={draft.time ?? ''} required onChange={(event) => changeDraft({ time: event.target.value || null })} /></label>}
          <label>Food timing<select aria-label="Food timing" value={draft.foodRelation ?? ''} onChange={(event) => changeDraft({ foodRelation: (event.target.value || undefined) as Reminder['foodRelation'] })}><option value="">Follow recorded instructions</option><option value="before">Before food</option><option value="with">With food</option><option value="after">After food</option></select></label>
          <label className="reminder-panel__check"><input type="checkbox" checked={draft.confirmed} disabled={draft.schedule !== 'once-daily'} onChange={(event) => setDraft({ ...draft, confirmed: event.target.checked })} />I verified these instructions and once-daily frequency from my label or prescription.</label>
          <label className="reminder-panel__check"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Active reminder</label>
          <details className="reminder-panel__form-note"><summary>About doses and medicines</summary><p>Other frequencies stay as instructions only. Check doses and medicine interactions with your pharmacist. Pausing keeps your history.</p></details>
          {draftError && <p role="alert" className="reminder-panel__error">{draftError}</p>}
          <div className="reminder-panel__form-actions"><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save reminder'}</button><button type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</button></div>
        </form>}
      </DialogContent>
    </Dialog>
  </section>;
}

export { RemindersPanel };
