import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ActivityRecord } from './activities';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { SegmentedControl } from './components/design';
import { createReachJumpEntries, JumpEntrySchema, type JumpEntry, type PerformanceData } from './performance-data';
import { getPerformanceSummary, type JumpSummary } from './performance-insights';
import { currentReportDate, type ReportNutritionRecord, type ReportPlanDay, type ReportSession } from './weekly-report';
import './performance-details.css';

const number = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const signed = (n: number | null) => n === null ? '—' : `${n > 0 ? '+' : ''}${number(n)}`;
const typeLabel = (type: JumpEntry['type']) => ({ standing: 'Standing', approach: 'Approach', block: 'Block' }[type]);
export interface PerformanceDetailsProps {
  sessions: readonly ReportSession[];
  activities?: readonly ActivityRecord[];
  plan?: readonly ReportPlanDay[];
  nutritionRecords?: readonly ReportNutritionRecord[];
  performance?: PerformanceData;
  bodyWeight?: number;
  today?: string;
  initialView?: 'jump' | 'strength' | 'weight';
  initialAction?: 'log-jump';
  onLogWeight?: () => void;
  onSaveJump?: (entry: JumpEntry) => void | Promise<void>;
  onSaveJumps?: (entries: JumpEntry[]) => void | Promise<void>;
  onDeleteJump?: (id: string) => void | Promise<void>;
}

function JumpMeasurementGuide() {
  return <details className="performance-measure-guide">
    <summary>How to measure</summary>
    <ol>
      <li>Measure standing reach with feet flat and one arm fully extended.</li>
      <li>Warm up briefly, including a few easy jumps.</li>
      <li>Measure your highest touch during a standing or approach jump.</li>
      <li>Take three attempts with enough rest between jumps.</li>
      <li>Save the best valid touch. Jump height is touch minus standing reach.</li>
      <li>Retest using the same reach, surface, shoes and technique.</li>
    </ol>
    <p><strong>Wall + tape</strong> · Mark reach and jump touch on a clear wall with a safe landing area.</p>
    <p><strong>Known-height reference</strong> · Use a safely reachable, accurately measured marker. Do not jump near obstacles or hang from equipment.</p>
    <p><strong>Slow-motion video</strong> · Useful for reviewing technique. Heights inferred from video are estimates; select “Video estimate” when recording them.</p>
  </details>;
}

export function JumpEntrySheet({ open, onOpenChange, today = currentReportDate(), onSave, onSaveMany }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today?: string;
  onSave: (entry: JumpEntry) => void | Promise<void>;
  onSaveMany?: (entries: JumpEntry[]) => void | Promise<void>;
}) {
  const [date, setDate] = useState(today);
  const [entryMethod, setEntryMethod] = useState('reach');
  const [type, setType] = useState<JumpEntry['type']>('approach');
  const [measurement, setMeasurement] = useState<JumpEntry['measurement']>('height');
  const [source, setSource] = useState<'measured' | 'video-estimate'>('measured');
  const [reach, setReach] = useState('');
  const [standingTouch, setStandingTouch] = useState('');
  const [approachTouch, setApproachTouch] = useState('');
  const [cm, setCm] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wasOpen = useRef(false);
  const numeric = (value: string) => Number(value.trim().replace(',', '.'));
  const standingHeight = numeric(standingTouch) - numeric(reach);
  const approachHeight = numeric(approachTouch) - numeric(reach);
  useEffect(() => {
    // A midnight/foreground date refresh must not erase an unfinished test.
    if (open && !wasOpen.current) {
      setDate(today); setEntryMethod('reach'); setSource('measured');
      setReach(''); setStandingTouch(''); setApproachTouch(''); setCm(''); setNotes(''); setError('');
    }
    wasOpen.current = open;
  }, [open, today]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError('');
    if (date > today) { setError('Choose today or an earlier measurement date.'); return; }
    let entries: JumpEntry[];
    try {
      if (entryMethod === 'reach') {
        entries = createReachJumpEntries({ date, standingReachCm: numeric(reach),
          standingTouchCm: standingTouch.trim() ? numeric(standingTouch) : undefined,
          approachTouchCm: approachTouch.trim() ? numeric(approachTouch) : undefined, notes, source });
      } else {
        const parsed = JumpEntrySchema.safeParse({ id: crypto.randomUUID(), date, type, measurement, cm: numeric(cm), notes, source });
        if (!parsed.success) throw new Error('Enter a valid date and measurement above 0 cm.');
        entries = [parsed.data];
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check the reach and touch heights.'); return;
    }
    setBusy(true);
    try {
      if (onSaveMany) await onSaveMany(entries);
      else for (const entry of entries) await onSave(entry);
      onOpenChange(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Try again.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(value: boolean) => { if (!busy) { setError(''); onOpenChange(value); } }}>
    <DialogContent className="app-dialog performance-jump-sheet">
      <DialogHeader className=""><DialogTitle className="">Log jump</DialogTitle><DialogDescription className="">Measure your touch. We’ll calculate your jump.</DialogDescription></DialogHeader>
      <form onSubmit={save} className="performance-jump-form">
        <SegmentedControl label="Entry method" value={entryMethod} options={[{ value: 'reach', label: 'Reach + touch' }, { value: 'direct', label: 'Other measurement' }]} onChange={setEntryMethod} />
        {entryMethod === 'reach' ? <>
          <label>Standing reach<span className="performance-jump-input performance-reach-input"><input required inputMode="decimal" type="text" aria-label="Standing reach in centimetres" value={reach} onChange={event => setReach(event.target.value)} autoComplete="off" placeholder="235" /><span>cm</span></span></label>
          <p className="performance-field-hint">Feet flat. Use the same reaching arm for every test.</p>
          <div className="performance-touch-fields">
            <label>Standing-jump touch<span className="performance-jump-input"><input inputMode="decimal" type="text" aria-label="Standing-jump touch in centimetres" value={standingTouch} onChange={event => setStandingTouch(event.target.value)} autoComplete="off" placeholder="310" /><span>cm</span></span></label>
            <label>Approach-jump touch<span className="performance-jump-input"><input inputMode="decimal" type="text" aria-label="Approach-jump touch in centimetres" value={approachTouch} onChange={event => setApproachTouch(event.target.value)} autoComplete="off" placeholder="315" /><span>cm</span></span></label>
          </div>
          <p className="performance-field-hint">Enter either touch height, or both. Use your best valid attempt.</p>
          {numeric(reach) > 0 && ((standingTouch.trim() && standingHeight > 0) || (approachTouch.trim() && approachHeight > 0)) && <div className="performance-calculated-jumps" aria-live="polite" aria-label="Calculated jump heights">
            {standingTouch.trim() && standingHeight > 0 && <p><span>Standing vertical</span><strong>{number(standingHeight)} cm</strong></p>}
            {approachTouch.trim() && approachHeight > 0 && <p><span>Approach vertical</span><strong>{number(approachHeight)} cm</strong></p>}
          </div>}
        </> : <>
          <SegmentedControl label="Jump type" value={type} options={['standing', 'approach', 'block'].map(value => ({ value, label: typeLabel(value as JumpEntry['type']) }))} onChange={value => setType(value as JumpEntry['type'])} />
          <SegmentedControl label="Measurement" value={measurement} options={[{ value: 'height', label: 'Jump height' }, { value: 'touch', label: 'Highest touch' }]} onChange={value => setMeasurement(value as JumpEntry['measurement'])} />
          <label>{measurement === 'height' ? 'Jump height' : 'Highest touch'}<span className="performance-jump-input"><input required inputMode="decimal" type="text" aria-label={`${measurement === 'height' ? 'Jump height' : 'Highest touch'} in centimetres`} value={cm} onChange={event => setCm(event.target.value)} autoComplete="off" placeholder={measurement === 'height' ? '65' : '305'} /><span>cm</span></span></label>
          <p className="performance-field-hint">{measurement === 'height' ? 'Height above standing reach or takeoff. Use this for a known jump height.' : 'Absolute highest touch. Kept separate from jump height.'}</p>
        </>}
        <label>Date<input type="date" required value={date} max={today} onChange={event => setDate(event.target.value)} /></label>
        <details className="performance-notes performance-source">
          <summary>Measurement method · {source === 'measured' ? 'Measured' : 'Video estimate'}</summary>
          <SegmentedControl label="Measurement source" value={source} options={[{ value: 'measured', label: 'Measured' }, { value: 'video-estimate', label: 'Video estimate' }]} onChange={value => setSource(value as typeof source)} />
          <p className="performance-disclaimer">Video-based heights are estimates. They stay out of measured trends and personal bests.</p>
        </details>
        {source === 'video-estimate' && <p className="performance-estimate-note">Video estimate · not a confirmed personal record.</p>}
        <details className="performance-notes"><summary>Add a note</summary><textarea aria-label="Jump notes" maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Test setup or how it felt" /></details>
        <JumpMeasurementGuide />
        {error && <p role="alert" className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save jump'}</button>
      </form>
    </DialogContent>
  </Dialog>;
}

function JumpCard({ jump }: { jump: JumpSummary }) {
  const min = Math.min(...jump.points.map(point => point.cm)), max = Math.max(...jump.points.map(point => point.cm));
  const points = jump.points.slice(-12);
  const coordinates = points.map((point, index) => `${8 + index / Math.max(1, points.length - 1) * 284},${64 - (point.cm - min) / Math.max(5, max - min) * 48}`).join(' ');
  return <section className="performance-jump-card" aria-label={`${typeLabel(jump.type)} ${jump.measurement === 'height' ? 'jump height' : 'highest touch'}`}><div className="performance-card-heading"><h3>{typeLabel(jump.type)}{jump.measurement === 'height' && jump.type !== 'block' ? ' Vertical' : ''}</h3><span>{jump.measurement === 'height' ? 'Jump height' : 'Highest touch'}</span></div><dl className="performance-three-values"><div><dt>Latest</dt><dd>{number(jump.current)}<small>cm</small></dd></div><div><dt>Personal best</dt><dd>{number(jump.best)}<small>cm</small></dd></div><div><dt>30 days</dt><dd>{signed(jump.change30Days)}{jump.change30Days !== null && <small>cm</small>}</dd></div></dl>{points.length > 1 ? <svg viewBox="0 0 300 80" className="performance-mini-chart" role="img" aria-label={`${typeLabel(jump.type)} ${jump.measurement === 'height' ? 'jump height' : 'highest touch'} trend`}><polyline points={coordinates} /></svg> : <p className="performance-disclaimer performance-next-test">One test day recorded. Repeat the same setup to build a trend.</p>}</section>;
}

export function PerformanceDetails({ sessions, activities, plan, nutritionRecords, performance, bodyWeight, today = currentReportDate(), initialView = 'jump', initialAction, onLogWeight, onSaveJump, onSaveJumps, onDeleteJump }: PerformanceDetailsProps) {
  const [view, setView] = useState(initialView);
  const [jumpOpen, setJumpOpen] = useState(initialAction === 'log-jump');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setView(initialView); if (initialAction === 'log-jump') setJumpOpen(true); }, [initialView, initialAction]);
  const summary = getPerformanceSummary({ sessions, activities, plan, nutritionRecords, performance, bodyWeight, today });
  const weight = summary.weight;
  const records = summary.records.filter(record => record.kind !== 'reps' || record.isNew).slice(0, 16);
  const entries = [...(performance?.jumps ?? [])].filter(entry => entry.date <= today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  async function deleteJump(id: string) {
    setError('');
    try { await onDeleteJump?.(id); setDeleteId(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove. Try again.'); }
  }
  return <section className="performance-details" aria-label="Performance details"><SegmentedControl label="Performance view" value={view} options={[{ value: 'jump', label: 'Jump' }, { value: 'strength', label: 'Strength' }, { value: 'weight', label: 'Body weight' }]} onChange={value => setView(value as typeof view)} />
    {view === 'jump' && <div className="performance-section"><div className="performance-section-heading"><div><p className="eyebrow">Takeoff + sport performance</p><h2>Your jump</h2></div>{onSaveJump && <button type="button" className="progress-check-in" onClick={() => setJumpOpen(true)}><Plus size={16} aria-hidden="true" />Log jump</button>}</div><JumpMeasurementGuide />{(['standing', 'approach'] as const).map(type => {
      const jump = summary.jumps.find(item => item.type === type && item.measurement === 'height');
      return jump ? <JumpCard key={type} jump={jump} /> : <div key={type} className="performance-empty" aria-label={`${typeLabel(type)} vertical baseline`}><strong>{typeLabel(type)} Vertical</strong><p>Record standing reach and your best {type === 'standing' ? 'standing-jump' : 'approach-jump'} touch to get a baseline.</p></div>;
    })}{summary.jumps.filter(jump => jump.measurement !== 'height' || jump.type === 'block').map(jump => <JumpCard key={`${jump.type}:${jump.measurement}`} jump={jump} />)}<p className="performance-disclaimer">Jump height and highest touch are separate measurements. Compare the same test, surface and setup.</p>{entries.length > 0 && <details className="performance-records"><summary>Recent jump entries</summary><div>{entries.map(entry => <div className="performance-entry" key={entry.id}><span><strong>{typeLabel(entry.type)} · {number(entry.cm)} cm</strong><small>{entry.date} · {entry.measurement === 'height' ? 'Jump height' : 'Highest touch'} · {entry.source === 'video-estimate' ? 'Video estimate' : 'Measured'}</small>{entry.standingReachCm !== undefined && <small>Touch {number(entry.touchCm!)} − reach {number(entry.standingReachCm)} cm</small>}{entry.notes && <small>{entry.notes}</small>}</span>{onDeleteJump && (deleteId === entry.id ? <span className="performance-delete-actions"><button type="button" onClick={() => void deleteJump(entry.id)}>Remove</button><button type="button" onClick={() => setDeleteId(null)}>Keep</button></span> : <button type="button" aria-label={`Remove ${typeLabel(entry.type).toLowerCase()} jump on ${entry.date}`} onClick={() => setDeleteId(entry.id)}><Trash2 size={16} /></button>)}</div>)}</div></details>}</div>}
    {view === 'strength' && <div className="performance-section"><div className="performance-section-heading"><div><p className="eyebrow">Last 30 days</p><h2>Stronger, with purpose</h2></div></div>{summary.strengthChanges.length > 0 ? <div className="performance-strength-list">{summary.strengthChanges.slice(0, 3).map(item => <div key={`${item.name}:${item.reps}`}><span><strong>{item.name}</strong><small>{number(item.previous)} → {number(item.current)} kg · {item.reps} reps</small></span><b>{signed(item.current - item.previous)}<small>kg</small></b></div>)}</div> : <div className="performance-empty"><strong>Build a comparable baseline</strong><p>Repeat the same exercise and rep range to see useful strength changes.</p></div>}<div className="performance-volume"><div><span>Weekly volume</span><strong>{number(summary.weeklyVolumeKg)}<small>kg</small></strong></div><div><span>Completed sets</span><strong>{summary.weeklySets}</strong></div></div><div className="performance-load"><strong>{summary.load.label}</strong><p>{summary.load.cue}</p><small>Based on recorded sets, activities and check-ins. Not a measured fatigue score.</small></div><details className="performance-records"><summary>Personal records</summary>{records.length ? <div>{records.map(record => <div className="performance-entry" key={record.key}><span><strong>{record.name}</strong><small>{({ weight: 'Weight', reps: 'Reps', 'estimated-1rm': 'Estimated 1RM', volume: 'Session volume', height: 'Jump height', touch: 'Highest touch', distance: 'Jump distance' })[record.kind]} · {record.context}</small></span><b>{number(record.value)}<small>{record.unit}</small></b></div>)}</div> : <p>Completed sets build your records.</p>}<p className="performance-disclaimer">Estimated 1RM uses sets of 2–10 reps and is a rough comparison, not a max-test target. Compare the same equipment and setup.</p></details></div>}
    {view === 'weight' && <div className="performance-section"><div className="performance-section-heading"><div><p className="eyebrow">Muscle gain, gradually</p><h2>Body weight</h2></div>{onLogWeight && <button className="progress-check-in" type="button" onClick={onLogWeight}><Plus size={16} aria-hidden="true" />Check in</button>}</div><dl className="performance-three-values performance-weight-values"><div><dt>{weight.points.length ? 'Current' : 'Profile'}</dt><dd>{weight.current === null ? '—' : number(weight.current)}<small>kg</small></dd></div><div><dt>Weekly average</dt><dd>{weight.weeklyAverage === null ? '—' : number(weight.weeklyAverage)}{weight.weeklyAverage !== null && <small>kg</small>}</dd></div><div><dt>30 days</dt><dd>{signed(weight.change30Days)}{weight.change30Days !== null && <small>kg</small>}</dd></div></dl><p className="performance-disclaimer">30-day change compares weekly averages with at least 3 check-in days spread across 4 days. Daily fluctuations are normal.</p>{weight.insight ? <p className="performance-load">{weight.insight}</p> : <p className="performance-coach">Check in 3–4 mornings each week, under similar conditions. Follow the weekly average before changing food intake.</p>}{weight.weeks.length > 0 && <div className="performance-weight-weeks">{weight.weeks.slice(-5).reverse().map(week => <div key={week.date}><span>Week of {week.date}<small>{week.days} check-in {week.days === 1 ? 'day' : 'days'}{week.adequate ? '' : ' · limited sample'}</small></span><strong>{number(week.kg)}<small>kg</small></strong></div>)}</div>}</div>}
    {error && <p className="error-text" role="alert">{error}</p>}{onSaveJump && <JumpEntrySheet open={jumpOpen} onOpenChange={setJumpOpen} today={today} onSave={onSaveJump} onSaveMany={onSaveJumps} />}
  </section>;
}
