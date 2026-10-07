import { useId, useState, type FormEvent } from 'react';
import { Bike, Footprints, Plus, Waves } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import {
  ACTIVITY_TYPES,
  ExtraActivitySchema,
  estimateActivity,
  type ActivityRecord,
  type ExtraActivity,
} from './activities';
import './activities.css';

export interface ExtraActivitiesProps {
  date: string;
  bodyWeight: number;
  records: ActivityRecord[];
  onSave: (activity: ExtraActivity, expectedVersion: number) => Promise<void>;
  disabled?: boolean;
  readOnly?: boolean;
  contextLabel?: string;
}

type ActivityDraft = {
  id: string;
  createdAt: number;
  type: ExtraActivity['type'];
  name: string;
  date: string;
  duration: string;
  distance: string;
  intensity: ExtraActivity['intensity'];
  bodyWeight: string;
  watchCalories: string;
  notes: string;
};

function activityName(type: ExtraActivity['type']): string {
  return ACTIVITY_TYPES.find((item) => item.value === type)?.label ?? 'Other activity';
}

function newDraft(date: string, bodyWeight: number): ActivityDraft {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: 'run',
    name: 'Running',
    date,
    duration: '',
    distance: '',
    intensity: 'moderate',
    bodyWeight: String(bodyWeight),
    watchCalories: '',
    notes: '',
  };
}

function recordDraft(activity: ExtraActivity): ActivityDraft {
  return {
    id: activity.id,
    createdAt: activity.createdAt,
    type: activity.type,
    name: activity.name,
    date: activity.date,
    duration: String(activity.durationMinutes),
    distance: activity.distanceKm === null ? '' : String(activity.distanceKm),
    intensity: activity.intensity,
    bodyWeight: String(activity.bodyWeightKg),
    watchCalories: activity.watchCalories === null ? '' : String(activity.watchCalories),
    notes: activity.notes,
  };
}

function parseDraft(draft: ActivityDraft) {
  return ExtraActivitySchema.safeParse({
    id: draft.id,
    createdAt: draft.createdAt,
    type: draft.type,
    name: draft.name,
    date: draft.date,
    durationMinutes: draft.duration.trim() === '' ? NaN : Number(draft.duration),
    distanceKm: draft.distance.trim() === '' ? null : Number(draft.distance),
    intensity: draft.intensity,
    bodyWeightKg: draft.bodyWeight.trim() === '' ? NaN : Number(draft.bodyWeight),
    watchCalories: draft.watchCalories.trim() === '' ? null : Number(draft.watchCalories),
    notes: draft.notes,
    deletedAt: null,
  });
}

function displayDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function ActivityIcon({ type }: { type: ExtraActivity['type'] }) {
  if (type === 'cycle') return <Bike size={20} aria-hidden="true" />;
  if (type === 'swim') return <Waves size={20} aria-hidden="true" />;
  return <Footprints size={20} aria-hidden="true" />;
}

export function ExtraActivities({
  date,
  bodyWeight,
  records,
  onSave,
  disabled = false,
  readOnly = false,
  contextLabel,
}: ExtraActivitiesProps) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ActivityDraft>(() => newDraft(date, bodyWeight));
  const [expectedVersion, setExpectedVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const daily = records.filter((record) => record.activity.date === date);
  const active = daily.filter((record) => record.activity.deletedAt === null);
  const deleted = daily.filter((record) => record.activity.deletedAt !== null);
  const parsed = parseDraft(draft);
  const estimate = parsed.success ? estimateActivity(parsed.data) : null;
  const totalCalories = active.reduce((total, record) => total + estimateActivity(record.activity).calories, 0);
  const busy = disabled || saving || pendingId !== null;

  function updateDraft(field: keyof ActivityDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFormError('');
  }

  function startAdd() {
    setDraft(newDraft(date, bodyWeight));
    setExpectedVersion(0);
    setFormError('');
    setOpen(true);
  }

  function startEdit(record: ActivityRecord) {
    setDraft(recordDraft(record.activity));
    setExpectedVersion(record.version);
    setFormError('');
    setOpen(true);
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const result = parseDraft(draft);
    if (!result.success) {
      setFormError('Check the activity name, date and numbers. Duration must be 1–600 minutes and body weight 20–400 kg.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await onSave(result.data, expectedVersion);
      setOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this activity. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function changeDeleted(record: ActivityRecord, remove: boolean) {
    if (busy) return;
    if (remove && !window.confirm(`Delete ${record.activity.name} from ${displayDate(record.activity.date)}?`)) return;
    setPendingId(record.activity.id);
    setActionError('');
    try {
      await onSave({ ...record.activity, deletedAt: remove ? Date.now() : null }, record.version);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update this activity. Please try again.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="extra-activities" aria-label="Extra activities">
      <div className="extra-activities-heading">
        <div>
          <h2>Extra activities</h2>
          <p className="extra-activities-date">{displayDate(date)}</p>
        </div>
        {!readOnly && (
          <button type="button" className="btn lime extra-add" disabled={busy} onClick={startAdd}>
            <Plus size={18} aria-hidden="true" /> Add activity
          </button>
        )}
      </div>
      <p className="extra-activities-note">Logged only for this date; your weekly plan stays the same. Record time outside your workout so the same activity is not counted twice.</p>
      {contextLabel && <p className="extra-activities-note">{contextLabel}</p>}
      {active.length === 0 ? (
        <p className="extra-activities-empty">No extra activities logged for this date.</p>
      ) : (
        <div className="extra-activity-list">
          {active.map((record) => {
            const activity = record.activity;
            const result = estimateActivity(activity);
            return (
              <article className="extra-activity-card" key={activity.id} aria-label={`${activity.name} activity`}>
                <div className="extra-activity-title">
                  <ActivityIcon type={activity.type} />
                  <h3>{activity.name}</h3>
                </div>
                <p className="extra-activity-metrics">
                  <span>{activity.durationMinutes} min</span>
                  {activity.distanceKm !== null && <span>{activity.distanceKm} km</span>}
                  <span>{activity.intensity} effort</span>
                </p>
                <p className="extra-activity-energy">
                  <strong>{Math.round(result.calories)} active kcal</strong>
                  <span>{activity.watchCalories !== null ? 'Watch reading' : 'Rough estimate'}</span>
                </p>
                <details className="extra-estimate-details">
                  <summary>How this is calculated</summary>
                  <p>{result.method}</p>
                  <p>Body weight at logging: {activity.bodyWeightKg} kg.</p>
                  <p>{result.source}</p>
                </details>
                {activity.notes && <p className="extra-activity-notes">{activity.notes}</p>}
                {!readOnly && (
                  <div className="extra-activity-actions">
                    <button type="button" className="btn secondary" disabled={busy} aria-label={`Edit ${activity.name}`} onClick={() => startEdit(record)}>Edit</button>
                    <button type="button" className="extra-delete" disabled={busy} aria-label={`Delete ${activity.name}`} onClick={() => void changeDeleted(record, true)}>{pendingId === activity.id ? 'Saving…' : 'Delete'}</button>
                  </div>
                )}
              </article>
            );
          })}
          <p className="extra-activities-total">Extra activity total: <strong>{Math.round(totalCalories)} active kcal</strong>. Estimates are approximate.</p>
        </div>
      )}
      {!readOnly && deleted.length > 0 && (
        <details className="extra-recently-deleted">
          <summary>Recently deleted activities ({deleted.length})</summary>
          {deleted.map((record) => (
            <div className="extra-restore-row" key={record.activity.id}>
              <span>{record.activity.name}</span>
              <button type="button" className="btn secondary" disabled={busy} aria-label={`Restore ${record.activity.name}`} onClick={() => void changeDeleted(record, false)}>Restore</button>
            </div>
          ))}
        </details>
      )}
      {actionError && <p className="extra-activity-error" role="alert">{actionError}</p>}
      <Dialog open={open} onOpenChange={(next: boolean) => { if (!saving) setOpen(next); }}>
        <DialogContent className="app-dialog extra-activity-dialog">
          <DialogHeader className="">
            <DialogTitle className="">{expectedVersion === 0 ? 'Add activity' : 'Edit activity'}</DialogTitle>
            <DialogDescription className="">Log an additional activity for one day. This does not change your training plan.</DialogDescription>
          </DialogHeader>
          <form className="extra-activity-form" onSubmit={(event) => void saveActivity(event)}>
            <fieldset disabled={saving}>
              <label className="field-label" htmlFor={`${fieldId}-type`}>Activity</label>
              <select id={`${fieldId}-type`} value={draft.type} onChange={(event) => {
                const type = event.target.value as ExtraActivity['type'];
                setDraft((current) => ({ ...current, type, name: current.name === activityName(current.type) ? activityName(type) : current.name }));
                setFormError('');
              }}>
                {ACTIVITY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <label className="field-label" htmlFor={`${fieldId}-name`}>Activity name</label>
              <input id={`${fieldId}-name`} type="text" maxLength={100} required value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} />
              <label className="field-label" htmlFor={`${fieldId}-date`}>Activity date</label>
              <input id={`${fieldId}-date`} type="date" required value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} />
              <div className="extra-field-grid">
                <div>
                  <label className="field-label" htmlFor={`${fieldId}-duration`}>Duration · minutes</label>
                  <input id={`${fieldId}-duration`} type="number" inputMode="decimal" min={1} max={600} step="any" required value={draft.duration} onChange={(event) => updateDraft('duration', event.target.value)} />
                </div>
                <div>
                  <label className="field-label" htmlFor={`${fieldId}-distance`}>Distance · km · optional</label>
                  <input id={`${fieldId}-distance`} type="number" inputMode="decimal" min={0.01} max={300} step="any" value={draft.distance} onChange={(event) => updateDraft('distance', event.target.value)} />
                </div>
              </div>
              <label className="field-label" htmlFor={`${fieldId}-intensity`}>Intensity</label>
              <select id={`${fieldId}-intensity`} value={draft.intensity} onChange={(event) => updateDraft('intensity', event.target.value)}>
                <option value="easy">Easy · comfortable conversation</option>
                <option value="moderate">Moderate · conversation takes effort</option>
                <option value="hard">Hard · only a few words at a time</option>
              </select>
              <label className="field-label" htmlFor={`${fieldId}-weight`}>Body weight · kg</label>
              <input id={`${fieldId}-weight`} type="number" inputMode="decimal" min={20} max={400} step="any" required value={draft.bodyWeight} onChange={(event) => updateDraft('bodyWeight', event.target.value)} />
              <p className="extra-field-help">Saved with this activity so future weight changes do not alter its estimate.</p>
              <label className="field-label" htmlFor={`${fieldId}-watch`}>Watch active calories · optional</label>
              <input id={`${fieldId}-watch`} type="number" inputMode="decimal" min={0} max={20000} step="any" placeholder="Leave blank to estimate" value={draft.watchCalories} onChange={(event) => updateDraft('watchCalories', event.target.value)} />
              <p className="extra-field-help">Use active calories, not total calories. A watch reading replaces the estimate.</p>
              <label className="field-label" htmlFor={`${fieldId}-notes`}>Activity notes · optional</label>
              <textarea id={`${fieldId}-notes`} rows={3} maxLength={1000} value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} />
            </fieldset>
            <div className="extra-live-estimate" aria-live="polite">
              {estimate ? (
                <>
                  <strong>{Math.round(estimate.calories)} active kcal {draft.watchCalories.trim() === '' ? '· rough estimate' : '· watch reading'}</strong>
                  <p>{estimate.method}</p>
                </>
              ) : <p>Enter a duration and valid body weight to see an approximate calorie estimate.</p>}
            </div>
            {formError && <p className="extra-activity-error" role="alert">{formError}</p>}
            <button type="submit" className="btn full" disabled={saving || disabled}>{saving ? 'Saving activity…' : 'Save activity'}</button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default ExtraActivities;
