import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { ReadinessEntrySchema, SprintEntrySchema, type PerformanceData, type ReadinessEntry, type SprintEntry } from './performance-data';
import { sprintProgress, sprintProtocolKey } from './sprint-performance';
import { currentReportDate } from './weekly-report';
import { rebaseObjectChanges } from './profile-updates';
import './sprint-performance.css';

const time = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 3 });
const methodLabel = (method: SprintEntry['timingMethod']) => ({ manual: 'Manual stopwatch', video: 'Video timing', electronic: 'Electronic timing' }[method]);
const jointLabels = { knee: 'Knee', achilles: 'Achilles', shoulder: 'Shoulder' } as const;
type Joint = keyof typeof jointLabels;
type JointValue = NonNullable<ReadinessEntry['joints']>[Joint];

export interface SprintPerformanceProps {
  performance?: PerformanceData;
  today?: string;
  saving?: boolean;
  error?: string;
  onSaveSprint?: (entry: SprintEntry) => void | Promise<void>;
  onDeleteSprint?: (id: string) => void | Promise<void>;
  onSaveReadiness?: (entry: ReadinessEntry) => void | Promise<void>;
}

function SprintTrend({ points, distance }: { points: SprintEntry[]; distance: number }) {
  if (points.length < 2) return null;
  const recent = points.slice(-12);
  const low = Math.min(...recent.map(point => point.seconds));
  const high = Math.max(...recent.map(point => point.seconds));
  const range = Math.max(.01, high - low);
  const positions = recent.map((point, index) => ({
    x: 12 + index * 276 / Math.max(1, recent.length - 1), y: 12 + (point.seconds - low) / range * 64,
  }));
  return <svg className="sprint-performance__chart" viewBox="0 0 300 88" role="img"
    aria-label={`${distance} metre measured sprint trend across ${recent.length} dates, same timing method, start protocol and recorded conditions. Lower times are faster.`}>
    <polyline points={positions.map(point => `${point.x},${point.y}`).join(' ')} />
    {positions.map((point, index) => <circle key={recent[index].id} cx={point.x} cy={point.y} r="3"><title>{recent[index].date}: {time(recent[index].seconds)} seconds</title></circle>)}
  </svg>;
}

type JointDraft = { energy: ReadinessEntry['energy'] | ''; soreness: ReadinessEntry['soreness'] | '' } & Record<Joint, JointValue | ''>;
const readinessDraft = (entry?: ReadinessEntry): JointDraft => ({ energy: entry?.energy ?? '', soreness: entry?.soreness ?? '',
  knee: entry?.joints?.knee ?? '', achilles: entry?.joints?.achilles ?? '', shoulder: entry?.joints?.shoulder ?? '' });

function JointReadiness({ performance, today, saving, onSave }: Pick<SprintPerformanceProps, 'performance' | 'saving'> & {
  today: string; onSave?: SprintPerformanceProps['onSaveReadiness'];
}) {
  const [date, setDate] = useState(today);
  const existing = performance?.readiness.find(entry => entry.date === date);
  const saved = readinessDraft(existing);
  const savedKey = JSON.stringify(saved);
  const baseline = useRef(saved);
  const [draft, setDraft] = useState<JointDraft>(saved);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const inFlight = useRef(false);
  useEffect(() => {
    setDraft(current => rebaseObjectChanges(baseline.current, saved, current)); baseline.current = saved;
  }, [savedKey]);
  const locked = saving || busy || !performance || !onSave;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (inFlight.current || locked) return;
    setError(''); setMessage('');
    if (date > today) { setError('Record a check-in for today or an earlier date.'); return; }
    const joints = Object.fromEntries((Object.keys(jointLabels) as Joint[]).flatMap(key => draft[key] ? [[key, draft[key]]] : []));
    const parsed = ReadinessEntrySchema.safeParse({ id: existing?.id ?? crypto.randomUUID(), date,
      energy: draft.energy, soreness: draft.soreness, joints });
    if (!parsed.success) { setError('Choose your actual energy and soreness. Joint observations are optional.'); return; }
    inFlight.current = true; setBusy(true);
    try { await onSave?.(parsed.data); setMessage('Your reported check-in is saved. No workout or medical guidance was changed.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Your check-in could not save.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <details className="sprint-readiness" aria-label="Joint readiness">
    <summary>Knee, Achilles &amp; shoulder</summary>
    <p>Report how movement feels. Missing observations stay unknown; Setline does not measure recovery automatically.</p>
    <form className="sprint-performance__form" onSubmit={event => void submit(event)}>
      <label>Check-in date<input type="date" value={date} max={today} disabled={locked} onChange={event => {
        const next = event.target.value; setDate(next); const values = readinessDraft(performance?.readiness.find(entry => entry.date === next));
        baseline.current = values; setDraft(values); setError(''); setMessage('');
      }} /></label>
      <div className="sprint-performance__fields">
        <label>Energy<select value={draft.energy} disabled={locked} onChange={event => setDraft({ ...draft, energy: event.target.value as JointDraft['energy'] })}>
          <option value="">Choose</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
        </select></label>
        <label>General soreness<select value={draft.soreness} disabled={locked} onChange={event => setDraft({ ...draft, soreness: event.target.value as JointDraft['soreness'] })}>
          <option value="">Choose</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option>
        </select></label>
      </div>
      {(Object.keys(jointLabels) as Joint[]).map(key => <label key={key}>{jointLabels[key]}<select value={draft[key]} disabled={locked}
        onChange={event => setDraft({ ...draft, [key]: event.target.value as JointDraft[Joint] })}>
        <option value="">Not recorded</option><option value="comfortable">Comfortable</option><option value="sore">Sore / tired</option><option value="pain">Pain / instability</option>
      </select></label>)}
      <p className="sprint-performance__hint">Sharp pain, worsening tendon symptoms or unstable landings: stop the relevant work. This check-in does not change your recorded impact/lifting clearance or automatically prescribe a Green session.</p>
      <button type="submit" className="btn secondary full" disabled={locked}>{busy ? 'Saving…' : 'Save joint check-in'}</button>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </form>
  </details>;
}

/** Actual measured sprint results, distinct from planned distance and contacts. */
export function SprintPerformance({ performance, today = currentReportDate(), saving = false, error: loadError,
  onSaveSprint, onDeleteSprint, onSaveReadiness }: SprintPerformanceProps) {
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState(today), [distance, setDistance] = useState('5'), [seconds, setSeconds] = useState('');
  const [method, setMethod] = useState<SprintEntry['timingMethod'] | ''>('');
  const [protocol, setProtocol] = useState(''), [conditions, setConditions] = useState(''), [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [selection, setSelection] = useState(''), [deleteId, setDeleteId] = useState<string | null>(null), [limit, setLimit] = useState(8);
  const inFlight = useRef(false);
  const entries = useMemo(() => [...(performance?.sprints ?? [])].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)), [performance?.sprints]);
  const groups = useMemo(() => [...new Map(entries.filter(entry => entry.date <= today).map(entry => [sprintProtocolKey(entry), entry])).values()], [entries, today]);
  const selected = groups.find(entry => sprintProtocolKey(entry) === selection) ?? groups[0];
  const progress = useMemo(() => selected ? sprintProgress(entries, selected, today) : null, [entries, selected, today]);
  const locked = saving || busy || !performance;
  function edit(entry?: SprintEntry) {
    setEditing(entry?.id ?? null); setDate(entry?.date ?? today); setDistance(String(entry?.distanceM ?? 5)); setSeconds(entry ? String(entry.seconds) : '');
    setMethod(entry?.timingMethod ?? ''); setProtocol(entry?.protocol ?? ''); setConditions(entry?.conditions ?? ''); setNotes(entry?.notes ?? '');
    setOpen(true); setError(''); setMessage('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (locked || inFlight.current || !onSaveSprint) return;
    setError(''); setMessage('');
    if (date > today) { setError('Log an actual effort from today or an earlier date.'); return; }
    const value = seconds.trim().replace(',', '.');
    if (!/^\d+(?:\.\d+)?$/.test(value)) { setError('Enter the measured elapsed time in seconds, such as 1.85.'); return; }
    const parsed = SprintEntrySchema.safeParse({ id: editing ?? crypto.randomUUID(), date, distanceM: Number(distance), seconds: Number(value),
      timingMethod: method, protocol, ...(conditions.trim() ? { conditions } : {}), ...(notes.trim() ? { notes } : {}) });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check the measured time, method and start protocol.'); return; }
    inFlight.current = true; setBusy(true);
    try { await onSaveSprint(parsed.data); setSelection(sprintProtocolKey(parsed.data)); setOpen(false); setEditing(null); setMessage('Measured sprint saved. No workout set was created or completed.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Your measured sprint could not save.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function remove(id: string) {
    if (locked || inFlight.current || !onDeleteSprint) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await onDeleteSprint(id); setDeleteId(null); setMessage('Sprint result removed. Workout history is unchanged.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The sprint result could not be removed.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="sprint-performance" aria-label="Speed and joint readiness">
    <div className="sprint-performance__heading"><div><p className="eyebrow">Athlete testing</p><h2>Speed &amp; movement</h2></div>
      {onSaveSprint && <button type="button" className="text-button" disabled={locked} onClick={() => edit()}><Plus size={17} aria-hidden="true" />Log sprint</button>}
    </div>
    <p className="sprint-performance__hint">Only timed 5 m and 10 m efforts appear here. Planned sprints and completed acceleration sets do not invent a time.</p>
    {open && <form className="sprint-performance__form" aria-label={editing ? 'Edit measured sprint' : 'Log measured sprint'} onSubmit={event => void submit(event)}>
      <div className="sprint-performance__fields"><label>Test date<input type="date" max={today} value={date} disabled={locked} onChange={event => setDate(event.target.value)} /></label>
        <label>Sprint distance<select value={distance} disabled={locked} onChange={event => setDistance(event.target.value)}><option value="5">5 metres</option><option value="10">10 metres</option></select></label></div>
      <label>Measured time · seconds<input type="text" inputMode="decimal" autoComplete="off" value={seconds} disabled={locked} placeholder="Actual measured time" onChange={event => setSeconds(event.target.value)} /></label>
      <label>Timing method<select value={method} disabled={locked} onChange={event => setMethod(event.target.value as typeof method)}>
        <option value="">Choose how this effort was timed</option><option value="manual">Manual stopwatch</option><option value="video">Video timing</option><option value="electronic">Electronic timing gates</option>
      </select></label>
      <label>Start &amp; timing protocol<input type="text" maxLength={300} value={protocol} disabled={locked} placeholder="e.g. standing start; first movement to torso crossing line" onChange={event => setProtocol(event.target.value)} /></label>
      <p className="sprint-performance__hint">Keep start cues, start/finish detection and video frame rate or gate placement consistent when relevant.</p>
      <label>Surface, shoes &amp; conditions · optional<input type="text" maxLength={300} value={conditions} disabled={locked} onChange={event => setConditions(event.target.value)} /></label>
      <label>Notes · optional<textarea rows={2} maxLength={500} value={notes} disabled={locked} onChange={event => setNotes(event.target.value)} /></label>
      <p className="sprint-performance__hint">Use a clear, non-slip lane with enough room to slow down. Manual stopwatch results are sensitive to reaction time; do not compare them with electronic or video times.</p>
      <button className="btn full" type="submit" disabled={locked}>{busy ? 'Saving…' : editing ? 'Save sprint correction' : 'Save measured sprint'}</button>
      <button className="text-button" type="button" disabled={busy} onClick={() => { setOpen(false); setEditing(null); setError(''); }}>Cancel sprint entry</button>
    </form>}
    {progress?.latest && selected ? <div className="sprint-performance__result">
      <label>Comparable sprint series<select aria-label="Comparable sprint series" value={sprintProtocolKey(selected)} onChange={event => setSelection(event.target.value)}>
        {groups.map(entry => <option key={sprintProtocolKey(entry)} value={sprintProtocolKey(entry)}>{entry.distanceM} m · {methodLabel(entry.timingMethod)} · {entry.protocol}{entry.conditions ? ` · ${entry.conditions}` : ''}</option>)}
      </select></label>
      <p>{selected.distanceM} m · {methodLabel(selected.timingMethod)}<br />{selected.protocol}{selected.conditions ? ` · ${selected.conditions}` : ''}</p>
      <dl><div><dt>Latest day’s best</dt><dd>{time(progress.latest.seconds)}<small>s</small></dd></div><div><dt>Same-protocol best</dt><dd>{time(progress.best!.seconds)}<small>s</small></dd></div></dl>
      <p>{progress.latest.date} · {progress.points.length} recorded test {progress.points.length === 1 ? 'day' : 'days'} · {progress.attempts} timed {progress.attempts === 1 ? 'attempt' : 'attempts'}.</p>
      <SprintTrend points={progress.points} distance={selected.distanceM} />
      <p className="sprint-performance__hint">{progress.changeSeconds === null
        ? 'A second test date with the same distance, timing method, start protocol and recorded conditions is needed for a change comparison.'
        : progress.changeSeconds > 0 ? `Latest daily best is ${time(progress.changeSeconds)} seconds faster than the first comparable test day.`
          : progress.changeSeconds < 0 ? `Latest daily best is ${time(-progress.changeSeconds)} seconds slower than the first comparable test day.` : 'Latest daily best matches the first comparable test day.'} This describes recorded times, not proof of a volleyball performance effect.</p>
      {selected.timingMethod === 'manual' && <p className="sprint-performance__hint">Manual timings include human reaction error. Small recorded differences may be timing noise.</p>}
      {!selected.conditions && <p className="sprint-performance__hint">Surface, shoes and conditions were not recorded. Keep future testing consistent and interpret time differences cautiously.</p>}
    </div> : <div className="sprint-performance__empty"><strong>No measured sprint times yet</strong><p>Time a 5 m or 10 m effort in a suitable space, then record its method and protocol. No result is inferred from your workout prescription.</p></div>}
    {entries.length > 0 && <details className="sprint-performance__records"><summary>Measured sprint records · {entries.length}</summary>
      {entries.slice(0, limit).map(entry => <article key={entry.id}><div><strong>{entry.distanceM} m · {time(entry.seconds)} seconds</strong><small>{entry.date} · {methodLabel(entry.timingMethod)}</small><p>{entry.protocol}{entry.conditions ? ` · ${entry.conditions}` : ''}</p>{entry.notes && <p>{entry.notes}</p>}</div>
        <div className="sprint-performance__record-actions">{onSaveSprint && <button className="icon-button" type="button" disabled={locked} aria-label={`Edit ${entry.distanceM} metre sprint on ${entry.date}`} onClick={() => edit(entry)}><Pencil size={17} aria-hidden="true" /></button>}
          {onDeleteSprint && (deleteId === entry.id ? <><button type="button" className="text-button" disabled={locked} onClick={() => void remove(entry.id)}>Confirm delete sprint result</button><button type="button" className="text-button" disabled={busy} onClick={() => setDeleteId(null)}>Keep sprint result</button></>
            : <button type="button" className="icon-button" disabled={locked} aria-label={`Delete ${entry.distanceM} metre sprint on ${entry.date}`} onClick={() => setDeleteId(entry.id)}><Trash2 size={17} aria-hidden="true" /></button>)}</div>
      </article>)}
      {entries.length > limit && <button type="button" className="text-button" onClick={() => setLimit(limit + 8)}>Show more sprint results</button>}
    </details>}
    <JointReadiness performance={performance} today={today} saving={locked} onSave={onSaveReadiness} />
    <details className="sprint-performance__testing"><summary>Testing cadence</summary><p>When practical, review measured jump performance about every two weeks and sprint performance about every four weeks under consistent conditions. A six-week performance check is optional; it does not restart your training cycle or add compulsory maximal efforts.</p></details>
    {(error || loadError) && <p role="alert">{error || loadError}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
