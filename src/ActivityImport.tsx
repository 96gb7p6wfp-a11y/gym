import { useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Download, FileUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import {
  ACTIVITY_TYPES,
  ExtraActivitySchema,
  estimateActivity,
  type ActivityRecord,
  type ExtraActivity,
} from './activities';
import {
  findDuplicateActivity,
  findPossibleDuplicateActivity,
  parseActivityFile,
  type ImportCandidate,
} from './activity-import';
import './import.css';

export interface ActivityImportProps {
  bodyWeight: number;
  records: ActivityRecord[];
  onImport: (activities: ExtraActivity[]) => Promise<void>;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideLauncher?: boolean;
}

type ImportRow = {
  key: string;
  fileName: string;
  candidate: ImportCandidate;
  selected: boolean;
  name: string;
  date: string;
  type: ExtraActivity['type'];
  duration: string;
  distance: string;
  intensity: ExtraActivity['intensity'];
  bodyWeight: string;
};

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PREVIEW_ROWS = 500;

function providerName(provider: ImportCandidate['source']['provider']): string {
  if (provider === 'strava') return 'Strava';
  if (provider === 'adidas') return 'Adidas Running';
  return 'Activity file';
}

function parseRow(row: ImportRow) {
  return ExtraActivitySchema.safeParse({
    ...row.candidate.activity,
    name: row.name,
    date: row.date,
    type: row.type,
    durationMinutes: row.duration.trim() === '' ? NaN : Number(row.duration),
    distanceKm: row.distance.trim() === '' ? null : Number(row.distance),
    intensity: row.intensity,
    bodyWeightKg: row.bodyWeight.trim() === '' ? NaN : Number(row.bodyWeight),
    // Use exported energy only when the parser identifies it explicitly as active energy.
    watchCalories: row.candidate.activity.watchCalories,
    importSource: row.candidate.source,
  });
}

function previewRow(candidate: ImportCandidate, fileName: string, records: ActivityRecord[]): ImportRow {
  const activity = candidate.activity;
  return {
    key: crypto.randomUUID(),
    fileName,
    candidate,
    selected: !findDuplicateActivity(candidate, records) && !findPossibleDuplicateActivity(candidate, records),
    name: activity.name,
    date: activity.date,
    type: activity.type,
    duration: String(activity.durationMinutes),
    distance: activity.distanceKm === null ? '' : String(activity.distanceKm),
    intensity: activity.intensity,
    bodyWeight: String(activity.bodyWeightKg),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not read this activity file.';
}

export function ActivityImport({ bodyWeight, records, onImport, disabled = false, open: controlledOpen, onOpenChange, hideLauncher = false }: ActivityImportProps) {
  const id = useId();
  const parsingId = useRef(0);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  function setOpen(next: boolean) {
    setInternalOpen(next);
    onOpenChange?.(next);
  }
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState('');
  const busy = disabled || reading || saving;

  const previews = useMemo(() => {
    const previous: ActivityRecord[] = [];
    return rows.map((row) => {
      const parsed = parseRow(row);
      const candidate: ImportCandidate = {
        ...row.candidate,
        activity: parsed.success ? parsed.data : row.candidate.activity,
      };
      const savedDuplicate = findDuplicateActivity(candidate, records);
      const fileDuplicate = findDuplicateActivity(candidate, previous);
      const possibleDuplicate = savedDuplicate || fileDuplicate ? undefined : findPossibleDuplicateActivity(candidate, records);
      previous.push({
        activity: { ...candidate.activity, importSource: candidate.source },
        version: 1,
      });
      return { row, parsed, savedDuplicate, fileDuplicate, possibleDuplicate };
    });
  }, [rows, records]);
  const selected = previews.filter(({ row, savedDuplicate, fileDuplicate }) => row.selected && !savedDuplicate && !fileDuplicate);
  const invalidSelected = selected.some(({ parsed }) => !parsed.success);
  const duplicateCount = previews.filter(({ savedDuplicate, fileDuplicate }) => savedDuplicate || fileDuplicate).length;

  function changeOpen(next: boolean) {
    if (saving) return;
    if (!next) {
      parsingId.current += 1;
      setReading(false);
    }
    setOpen(next);
  }

  function updateRow(key: string, patch: Partial<ImportRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
    setSaveError('');
  }

  async function readFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0 || saving) return;
    const operation = ++parsingId.current;
    setSaveError('');
    setSuccess('');
    setFileErrors([]);
    setRows([]);
    if (files.length > MAX_FILES) {
      setFileErrors([`Choose up to ${MAX_FILES} files at a time.`]);
      return;
    }
    setReading(true);
    const nextRows: ImportRow[] = [];
    const errors: string[] = [];
    try {
      for (const file of files) {
        if (operation !== parsingId.current) return;
        try {
          if (file.size > MAX_FILE_BYTES) throw new Error('This file exceeds the 10 MB limit. Choose a smaller activity export.');
          if (file.size === 0) throw new Error('This file is empty.');
          const candidates = await parseActivityFile({ name: file.name, bytes: await file.arrayBuffer() }, bodyWeight);
          if (candidates.length === 0) throw new Error('No supported activities were found in this file.');
          if (nextRows.length + candidates.length > MAX_PREVIEW_ROWS) {
            throw new Error(`A preview supports up to ${MAX_PREVIEW_ROWS} activities. Split this export into smaller files.`);
          }
          nextRows.push(...candidates.map((candidate) => previewRow(candidate, file.name, records)));
        } catch (error) {
          errors.push(`${file.name}: ${errorMessage(error)}`);
        }
      }
      if (operation !== parsingId.current) return;
      setRows(nextRows);
      setFileErrors(errors);
    } finally {
      if (operation === parsingId.current) setReading(false);
    }
  }

  async function saveImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || selected.length === 0) return;
    if (invalidSelected) {
      setSaveError('Check the selected activities. Choose a valid date, 1–600 minutes, a positive distance or leave it blank, and a body weight of 20–400 kg.');
      return;
    }
    const activities = selected.flatMap(({ row, parsed }) => parsed.success ? [{ ...parsed.data, importSource: row.candidate.source }] : []);
    setSaving(true);
    setSaveError('');
    try {
      await onImport(activities);
      setSuccess(`Imported ${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}. Find them on their dates in Workout and History.`);
      setRows([]);
      setFileErrors([]);
      setOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save the import. Your preview is still here; please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="activity-import" aria-label="Activity imports">
      {!hideLauncher && <div className="activity-import-heading">
        <div>
          <h2>Import activities</h2>
          <p>Add exported Strava or Adidas Running activities to their recorded dates.</p>
        </div>
        <button type="button" className="btn secondary" disabled={disabled || saving} onClick={() => { setSaveError(''); setOpen(true); }}>
          <Download size={18} aria-hidden="true" /> Import activities
        </button>
      </div>}
      {success && <p className="activity-import-success" role="status">{success}</p>}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="app-dialog activity-import-dialog">
          <DialogHeader className="">
            <DialogTitle className="">Import activities</DialogTitle>
            <DialogDescription className="">Choose activity exports, review the details, then save. Everything is processed on your device.</DialogDescription>
          </DialogHeader>
          <details className="activity-import-help">
            <summary>How to export from Strava or Adidas Running</summary>
            <p><strong>Strava:</strong> Open an activity on the website → menu → Export GPX or Export Original. For several activities, use the account data export and choose its activities CSV.</p>
            <p><strong>Adidas Running:</strong> Request your account data export, then choose any included GPX, TCX, FIT or activity CSV files. Export formats vary; JSON and ZIP archives cannot be read here.</p>
            <p>Unzip archives first. No account connection or password is needed.</p>
          </details>
          <div className="activity-import-picker">
            <label className="activity-import-file-label" htmlFor={`${id}-files`}><FileUp size={20} aria-hidden="true" /> Choose activity files</label>
            <input id={`${id}-files`} aria-label="Activity files" type="file" multiple accept=".gpx,.tcx,.fit,.csv" disabled={busy} onChange={(event) => void readFiles(event)} />
            <p>GPX, TCX, FIT or CSV · up to 10 files, 10 MB each. GPS routes are not saved.</p>
          </div>
          {reading && <p className="activity-import-status" role="status">Reading activities…</p>}
          {fileErrors.length > 0 && <div className="activity-import-error" role="alert">{fileErrors.map((error, index) => <p key={index}>{error}</p>)}</div>}
          {rows.length > 0 && (
            <form className="activity-import-form" noValidate onSubmit={(event) => void saveImport(event)}>
              <div className="activity-import-preview-heading">
                <h3>Review activities ({rows.length})</h3>
                <p>{selected.length} selected{duplicateCount > 0 ? ` · ${duplicateCount} already present or repeated` : ''}.</p>
                <p>Check the date and duration. GPX can include pauses; change the minutes to your actual moving time.</p>
              </div>
              <fieldset className="activity-import-previews" disabled={busy}>
                {previews.map(({ row, parsed, savedDuplicate, fileDuplicate, possibleDuplicate }, index) => {
                  const rowId = `${id}-row-${index}`;
                  const duplicate = Boolean(savedDuplicate || fileDuplicate);
                  const estimate = parsed.success ? estimateActivity(parsed.data) : null;
                  const sourceCalories = row.candidate.source.originalCalories;
                  return (
                    <article key={row.key} className={`activity-import-row${duplicate ? ' is-duplicate' : ''}`} aria-label={`Import preview ${index + 1}`}>
                      <label className="activity-import-check" htmlFor={`${rowId}-selected`}>
                        <input id={`${rowId}-selected`} type="checkbox" checked={row.selected && !duplicate} disabled={duplicate} onChange={(event) => updateRow(row.key, { selected: event.target.checked })} />
                        <span>{row.name || 'Unnamed activity'}</span>
                      </label>
                      <p className="activity-import-source">{providerName(row.candidate.source.provider)} · {row.candidate.source.format.toUpperCase()} · {row.fileName}</p>
                      {savedDuplicate && <p className="activity-import-warning">{savedDuplicate.activity.deletedAt !== null ? 'Previously deleted. Restore the existing activity from History if you want it back.' : 'Already imported. This activity will be skipped.'}</p>}
                      {!savedDuplicate && fileDuplicate && <p className="activity-import-warning">Repeated in these files. Review the first copy above.</p>}
                      {possibleDuplicate && <p className="activity-import-warning">{possibleDuplicate.activity.deletedAt !== null ? 'A similar deleted activity exists for this date. Check History before selecting this copy.' : 'A similar activity is already logged for this date. Select only if this is a separate activity.'}</p>}
                      {!duplicate && (
                        <div className="activity-import-fields">
                          <label htmlFor={`${rowId}-name`}>Name<input id={`${rowId}-name`} type="text" maxLength={100} value={row.name} onChange={(event) => updateRow(row.key, { name: event.target.value })} /></label>
                          <div className="activity-import-grid">
                            <label htmlFor={`${rowId}-date`}>Date<input id={`${rowId}-date`} type="date" value={row.date} onChange={(event) => updateRow(row.key, { date: event.target.value })} /></label>
                            <label htmlFor={`${rowId}-type`}>Activity<select id={`${rowId}-type`} value={row.type} onChange={(event) => updateRow(row.key, { type: event.target.value as ExtraActivity['type'] })}>{ACTIVITY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                            <label htmlFor={`${rowId}-duration`}>Duration · minutes<input id={`${rowId}-duration`} type="number" inputMode="decimal" min={1} max={600} step="any" value={row.duration} onChange={(event) => updateRow(row.key, { duration: event.target.value })} /></label>
                            <label htmlFor={`${rowId}-distance`}>Distance · km · optional<input id={`${rowId}-distance`} type="number" inputMode="decimal" min={0.01} max={300} step="any" value={row.distance} onChange={(event) => updateRow(row.key, { distance: event.target.value })} /></label>
                            <label htmlFor={`${rowId}-effort`}>Effort<select id={`${rowId}-effort`} value={row.intensity} onChange={(event) => updateRow(row.key, { intensity: event.target.value as ExtraActivity['intensity'] })}><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option></select></label>
                            <label htmlFor={`${rowId}-weight`}>Body weight · kg<input id={`${rowId}-weight`} type="number" inputMode="decimal" min={20} max={400} step="any" value={row.bodyWeight} onChange={(event) => updateRow(row.key, { bodyWeight: event.target.value })} /></label>
                          </div>
                        </div>
                      )}
                      {!duplicate && estimate && <p className="activity-import-energy"><strong>{Math.round(estimate.calories)} active kcal</strong> · {parsed.success && parsed.data.watchCalories !== null ? 'imported active energy' : 'rough estimate'}</p>}
                      {!duplicate && !parsed.success && <p className="activity-import-warning">Check the date and numbers before importing this activity.</p>}
                      {typeof sourceCalories === 'number' && <p className="activity-import-source">Source calories: {Math.round(sourceCalories)} kcal. These may include resting energy and are not used as active calories.</p>}
                      {row.candidate.warnings.length > 0 && <ul className="activity-import-warnings">{row.candidate.warnings.map((warning, warningIndex) => <li key={warningIndex}>{warning}</li>)}</ul>}
                    </article>
                  );
                })}
              </fieldset>
              <p className="activity-import-footnote">Active calories use an explicitly labelled active-energy reading when available; otherwise they are estimated from your activity and body weight. Import time outside existing workouts to avoid counting the same exercise twice. You can export a local backup in Settings.</p>
              {saveError && <p className="activity-import-error" role="alert">{saveError}</p>}
              <button type="submit" className="btn full activity-import-save" disabled={busy || selected.length === 0 || invalidSelected}>{saving ? 'Importing activities…' : `Import ${selected.length} selected ${selected.length === 1 ? 'activity' : 'activities'}`}</button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default ActivityImport;
