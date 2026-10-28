import { useEffect, useState, type MouseEvent } from 'react';
import { MasterProgramSettingsSchema, createVolleyballMasterPlan, getMasterProgramPhase, getMasterProgramWeek, resolveMasterProgramPlan, type MasterProgramSettings, type MasterReadiness } from './volleyball-master-plan';
import type { PlanDay } from './workout-customization';
import { berlinDate } from './calendar-date';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import './volleyball-master-program.css';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const newSettings = (startDate: string): MasterProgramSettings => ({ version: 1, revision: '8.1', startDate, matchWeeks: [] });

function ProgramPreview({ settings, date, basePlan, matchWeekend }: { settings: MasterProgramSettings; date: string; basePlan?: PlanDay[]; matchWeekend?: PlanDay[] }) {
  const previewDate = getMasterProgramWeek(settings.startDate, date) ? date : settings.startDate;
  const week = getMasterProgramWeek(settings.startDate, previewDate)!;
  const plan = resolveMasterProgramPlan(basePlan ?? createVolleyballMasterPlan(), settings, previewDate, matchWeekend);
  return <div className="master-program__preview" aria-label="Program schedule preview">
    <p className="master-program__preview-phase">Week {week} · {getMasterProgramPhase(week)} · {settings.matchWeeks.includes(week) ? 'Sunday match' : 'No Sunday match'}</p>
    <ol>{plan.map((day, index) => {
      const required = day.exercises.filter(exercise => exercise.optionalWork !== true);
      const optional = day.exercises.length - required.length;
      return <li key={index}><span>{weekdays[index]}</span><details className="master-program__preview-day">
        <summary><span><strong>{day.name}</strong><small>{day.kind === 'sport' ? day.name === 'Match' || day.name === 'Volleyball Match' ? `${day.startTime ? `${day.startTime} · Berlin` : 'Time not set'} · record actual duration` : '20:00–22:00 · Berlin' : day.durationRange ?? `${day.minutes} min`}{day.kind === 'strength' ? ` · ${required.length} movements${optional ? ` + ${optional} optional` : ''}` : ''}</small>{settings.revision === '8.1' && index === 4 && <small>School PE · about 2 h · log actual activity once</small>}</span></summary>
        {day.exercises.length > 0 ? <ul>{day.exercises.map(exercise => <li key={exercise.key}><div><strong>{exercise.name}{exercise.optionalWork ? ' · optional' : ''}</strong><small>{exercise.sets} × {exercise.target}{exercise.perSide ? ' / side' : ''}{exercise.rest ? ` · ${exercise.rest} sec rest` : ''}</small>{exercise.benefit && <small>{exercise.benefit}</small>}</div></li>)}</ul> : <p className="small-note">Rest, an easy walk or gentle mobility. Nothing to make up.</p>}
        {day.extraSession && <p className="small-note">Optional · {day.extraSession.name} · {day.extraSession.durationRange ?? `${day.extraSession.minutes} min`}</p>}
      </details></li>;
    })}</ol>
  </div>;
}

export function VolleyballMasterProgram({ settings, defaultStartDate, selectedDate, today = berlinDate(), basePlan, matchWeekend, onSave, onUpgrade, onRestorePrevious, hasPreviousPlan = false, disabled = false }: {
  settings?: MasterProgramSettings; defaultStartDate: string; selectedDate: string; today?: string;
  basePlan?: PlanDay[]; matchWeekend?: PlanDay[];
  onSave: (settings: MasterProgramSettings | undefined) => Promise<boolean>;
  onUpgrade?: () => Promise<boolean | void>; onRestorePrevious?: () => Promise<boolean | void>;
  hasPreviousPlan?: boolean; disabled?: boolean;
}) {
  const [draft, setDraft] = useState<MasterProgramSettings>(settings ?? newSettings(defaultStartDate));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [restore, setRestore] = useState(false), [restorePrevious, setRestorePrevious] = useState(false);
  const [upgrade, setUpgrade] = useState(false), [nextBlock, setNextBlock] = useState(false);
  const [nextStart, setNextStart] = useState(defaultStartDate);
  const [changedStart, setChangedStart] = useState<MasterProgramSettings | null>(null);
  useEffect(() => { setDraft(settings ?? newSettings(defaultStartDate)); }, [settings, defaultStartDate]);
  const week = settings && getMasterProgramWeek(settings.startDate, today);
  const legacy = !!settings && settings.revision !== '8.1';
  const complete = !!settings && today >= settings.startDate && !week;
  const locked = disabled || busy;
  const reviewSettings = settings ? { ...settings, revision: '8.1' as const } : newSettings(defaultStartDate);
  const previewValid = MasterProgramSettingsSchema.safeParse(draft).success;
  async function save(next: MasterProgramSettings | undefined): Promise<boolean> {
    const parsed = next && MasterProgramSettingsSchema.safeParse(next);
    if (parsed && !parsed.success) { setError('Choose a valid Monday and match weeks.'); return false; }
    setBusy(true); setError('');
    try {
      if (!(await onSave(parsed ? parsed.data : undefined))) { setError('Your program could not save. Try again.'); return false; }
      setRestore(false); setNextBlock(false); setChangedStart(null); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the program.'); return false; }
    finally { setBusy(false); }
  }
  async function applyUpgrade() {
    if (!onUpgrade || locked) return;
    setBusy(true); setError('');
    try { if (await onUpgrade() !== false) setUpgrade(false); else setError('The upgrade could not save. Try again.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not upgrade. Your existing plan stays.'); }
    finally { setBusy(false); }
  }
  async function applyRestorePrevious() {
    if (!onRestorePrevious || locked) return;
    setBusy(true); setError('');
    try { if (await onRestorePrevious() !== false) setRestorePrevious(false); else setError('The previous program could not restore. Try again.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restore the previous program.'); }
    finally { setBusy(false); }
  }
  const optionalOptions = draft.revision === '8.1' ? [
    ['thursdayPlyoPushup', 'Thursday · plyometric push-ups'],
    ['thursdayArms', 'Thursday · curls + pushdowns'],
    ['wednesdayShortFoot', 'Wednesday · short-foot holds'],
    ['sundaySplitSquatJump', 'Sunday · bodyweight split-squat jumps'],
    ['primerPogos', 'Match primer · light pogos'],
    ['primerSlam', 'Match primer · light medicine-ball slams'],
    ['easyRun', 'Thursday · optional easy 5 km reminder'],
  ] as const : [
    ['mondayArms', 'Monday · curls + pushdowns'], ['thursdayArms', 'Thursday · curls + pushdowns'], ['tuesdayPogos', 'Tuesday · light pogos'],
  ] as const;
  const savedPlanButton = <button className="text-button" type="button" disabled={locked} onClick={() => setRestore(true)}>Return to saved plan</button>;
  return <section className="master-program" aria-label="8-week volleyball-first program">
    <div className="master-program__heading"><div><p className="eyebrow">8-WEEK PERFORMANCE PLAN</p><h2>Volleyball Master Plan V8.1</h2></div><span>{week ? `${legacy ? 'Current block · ' : ''}Week ${week} · ${getMasterProgramPhase(week)}` : settings ? today < settings.startDate ? `Starts ${settings.startDate}` : 'Block complete' : 'Ready when you are'}</span></div>
    <p className="master-program__purpose">Jump Higher · Hit Harder · Stay Athletic</p>
    {legacy && onUpgrade && <div className="master-program__upgrade"><p>Your current block continues unchanged. Review V8.1 before applying it.</p><button type="button" className="btn full" disabled={locked} onClick={() => { setError(''); setUpgrade(true); }}>Upgrade to V8.1</button></div>}
    <details className="master-program__preview-disclosure"><summary>{legacy ? 'Current program preview' : 'Program preview'}</summary>{previewValid ? <ProgramPreview settings={draft} date={selectedDate} basePlan={settings ? basePlan : undefined} matchWeekend={settings ? matchWeekend : undefined} /> : <p className="small-note">Choose a valid Monday to preview this block.</p>}</details>
    <details className="master-program__config" open={!settings}>
      <summary>{settings ? 'Schedule & options' : 'Set up your block'}</summary>
      <label className="field-label">Start Monday<input type="date" value={draft.startDate} disabled={locked} onChange={event => setDraft({ ...draft, startDate: event.target.value })} /></label>
      <fieldset className="master-program__matches" disabled={locked}><legend>Sunday match weeks</legend><p>{draft.revision === '8.1' ? 'No match: recover Saturday, Heavy Lower B Sunday. Match: short Saturday primer, Sunday competition.' : 'Your saved weekend schedule stays until you choose Upgrade to V8.1.'}</p>
        <div>{Array.from({ length: 8 }, (_, index) => index + 1).map(value => <label key={value}><input type="checkbox" checked={draft.matchWeeks.includes(value)} onChange={event => setDraft({ ...draft,
          matchWeeks: event.target.checked ? [...draft.matchWeeks, value].sort((a, b) => a - b) : draft.matchWeeks.filter(item => item !== value),
          matchTimes: event.target.checked ? draft.matchTimes : draft.matchTimes?.filter(item => item.week !== value),
        })} /><span>Week {value}</span></label>)}</div>
      </fieldset>
      {draft.matchWeeks.length > 0 && <details className="master-program__match-times"><summary>Match times (optional)</summary><p className="small-note">Leave blank if unknown. Times use Europe/Berlin.</p>{draft.matchWeeks.map(value => <label className="field-label" key={value}>Week {value} match time<input type="time" disabled={locked} value={draft.matchTimes?.find(item => item.week === value)?.startTime ?? ''} onChange={event => setDraft({ ...draft, matchTimes: [...(draft.matchTimes ?? []).filter(item => item.week !== value), ...(event.target.value ? [{ week: value, startTime: event.target.value }] : [])].sort((a, b) => a.week - b.week) })} /></label>)}</details>}
      <details><summary>Optional work</summary><div className="master-program__optional">
        {optionalOptions.map(([key, label]) => <label key={key}><input type="checkbox" disabled={locked} checked={draft.optional?.[key] ?? false} onChange={event => setDraft({ ...draft, optional: { mondayArms: false, thursdayArms: false, tuesdayPogos: false, ...draft.optional, [key]: event.target.checked } })} />{label}</label>)}
        <p>Off by default. Add only when time, movement quality and recovery allow.</p></div></details>
      <button className="btn full" type="button" disabled={locked} onClick={() => settings && draft.startDate !== settings.startDate ? setChangedStart(draft) : void save(draft)}>{busy ? 'Saving…' : settings ? 'Save program' : 'Use this plan'}</button>
      {!settings && <p className="small-note">Your current weekly plan is kept so you can return to it. History stays unchanged. No Sunday match is assumed.</p>}
    </details>
    {complete && !legacy && <div className="master-program__next-block"><p>This block is complete. Review your tests before choosing a new start.</p><button className="btn full" type="button" disabled={locked} onClick={() => { setNextStart(defaultStartDate); setError(''); setNextBlock(true); }}>Plan next block</button></div>}
    <details className="master-program__rules"><summary>Training rules & retest</summary>
      <h3>Jump quality first</h3><p>FAST → LONG PENULTIMATE → QUICK PLANT → ARMS → UP. Stop or reduce explosive work if height, control or landing quality falls. Contacts are a ceiling, not a target to force.</p>
      <h3>Build · deload · retest</h3><p>Weeks 1–3: build quality. Week 4: reduce demanding sets and jump contacts. Weeks 5–7: return to base volume. Week 8: reduce strength volume and test fresh; no extra full-volume jump workout.</p>
      <h3>Progress without grinding</h3><p>Hack Squat 70 kg at 6/5/5: repeat 70. Clean 6/6/6 with about 2 reps left: consider a small increase. Suggestions use repeated comparable performance; weeks alone never trigger more weight. Box heights and jump contacts never rise automatically.</p>
      <h3>Readiness</h3><p>Wednesday and non-match Sunday are the key lower-body checks. Green: normal, pain-free movement. Yellow: reduce supplementary jumps and demanding work. Red: stop painful or unstable work and choose pain-free recovery. These are self-reported choices, not a measured recovery score.</p><p>Persistent or worsening knee, Achilles, shoulder or back problems need professional assessment. Missed heavy work never moves automatically to Monday.</p>
      <h3>Trap-bar technique</h3><p>Begin with unloaded or empty 20 kg bar practice. Once technique is consistent, Trap Bar Deadlift 3 × 4–6 can replace Leg Press; never add both. Trap-bar jumps are not prescribed.</p>
      <h3>Week 8 retest</h3><p>Standing reach · standing vertical · approach touch and vertical · weekly body-weight trend · Hack Squat · pull-ups. Record actual dated measurements in Progress and lift performance in Train.</p><p>Approximate reference only: reach 235 cm, standing touch ~310 cm, approach touch 315–317 cm. These suggest ~75 cm and ~80–82 cm verticals; they are never saved as test results.</p>
    </details>
    {settings && (hasPreviousPlan && onRestorePrevious ? <div className="master-program__saved"><button className="text-button" type="button" disabled={locked} onClick={() => { setError(''); setRestorePrevious(true); }}>Restore previous program</button><details><summary>Older weekly plan</summary>{savedPlanButton}</details></div> : savedPlanButton)}
    {error && <p role="alert" className="builder-error">{error}</p>}
    <Dialog open={upgrade} onOpenChange={(open: boolean) => { if (!busy) setUpgrade(open); }}><DialogContent className="app-dialog master-program-upgrade-sheet"><DialogHeader className=""><DialogTitle className="">Upgrade to V8.1</DialogTitle><DialogDescription className="">Review the new recommendations. Your current cycle start and match weeks stay.</DialogDescription></DialogHeader><p className="master-program__upgrade-note">No match: Saturday Recovery / Optional Mobility, Sunday Heavy Lower B. Match week: Saturday Pre-Match Primer (12–18 min), Sunday Volleyball Match.</p><ProgramPreview settings={reviewSettings} date={selectedDate} /><p className="master-program__upgrade-note">Your current personalized program is saved for restore. V8.1 replaces the weekly recommendations; your date-specific edits, active workout and completed sessions stay unchanged.</p><button className="btn full" type="button" disabled={locked} onClick={() => void applyUpgrade()}>{busy ? 'Applying…' : 'Apply V8.1'}</button>{error && <p role="alert" className="builder-error">{error}</p>}</DialogContent></Dialog>
    <AlertDialog open={restorePrevious} onOpenChange={setRestorePrevious}><AlertDialogContent className="app-dialog"><AlertDialogHeader className=""><AlertDialogTitle className="">Restore your previous program?</AlertDialogTitle><AlertDialogDescription className="">Your saved personal program and its cycle settings return. Workout history, active sessions, nutrition and measurements stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className=""><AlertDialogCancel className="">Keep V8.1</AlertDialogCancel><AlertDialogAction className="" disabled={locked} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); void applyRestorePrevious(); }}>Restore previous program</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={restore} onOpenChange={setRestore}><AlertDialogContent className="app-dialog"><AlertDialogHeader className=""><AlertDialogTitle className="">Return to your saved plan?</AlertDialogTitle><AlertDialogDescription className="">The weekly plan from before this block returns. History, meals, measurements and active workouts stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className=""><AlertDialogCancel className="">Keep program</AlertDialogCancel><AlertDialogAction className="" disabled={locked} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); void save(undefined); }}>Restore saved plan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={nextBlock} onOpenChange={(open: boolean) => { if (!busy) setNextBlock(open); }}><DialogContent className="app-dialog"><DialogHeader className=""><DialogTitle className="">Plan the next block?</DialogTitle><DialogDescription className="">Start a new eight-week cycle using your current weekly plan. Match weeks start empty; choose the new competition dates afterward. Your records stay.</DialogDescription></DialogHeader><label className="field-label">Next start Monday<input type="date" value={nextStart} disabled={locked} onChange={event => setNextStart(event.target.value)} /></label><button className="btn full" type="button" disabled={locked} onClick={() => settings && void save({ ...settings, startDate: nextStart, matchWeeks: [], matchTimes: [] })}>Start next block</button>{error && <p role="alert" className="builder-error">{error}</p>}</DialogContent></Dialog>
    <AlertDialog open={changedStart !== null} onOpenChange={(open: boolean) => { if (!open) setChangedStart(null); }}><AlertDialogContent className="app-dialog"><AlertDialogHeader className=""><AlertDialogTitle className="">Change this block’s start?</AlertDialogTitle><AlertDialogDescription className="">Changing the start date changes the current week and phase. Existing workout snapshots stay unchanged. Apply the schedule starting {changedStart?.startDate}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className=""><AlertDialogCancel className="">Keep start date</AlertDialogCancel><AlertDialogAction className="" disabled={locked} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); if (changedStart) void save(changedStart); }}>Apply schedule</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

export function MasterProgramReadiness({ settings, date, disabled, onSave }: {
  settings: MasterProgramSettings; date: string; disabled?: boolean;
  onSave: (settings: MasterProgramSettings) => Promise<boolean>;
}) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const week = getMasterProgramWeek(settings.startDate, date);
  const needsCheck = settings.revision === '8.1' ? day === 3 || (day === 0 && !settings.matchWeeks.includes(week ?? 0)) : day === 6;
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => needsCheck && !settings.readiness?.some(row => row.date === date));
  useEffect(() => { setExpanded(needsCheck && !settings.readiness?.some(row => row.date === date)); }, [date, needsCheck]);
  if (!week) return null;
  const status = settings.readiness?.find(row => row.date === date)?.status;
  async function select(value: MasterReadiness) {
    setBusy(true); setError('');
    try { if (!(await onSave({ ...settings, readiness: [...(settings.readiness ?? []).filter(row => row.date !== date), { date, status: value }] }))) setError('Readiness could not save. Try again.'); }
    catch { setError('Could not save readiness. Try again.'); }
    finally { setBusy(false); }
  }
  const context = settings.revision !== '8.1' ? 'Friday PE and volleyball count. Check legs, sleep, pain and jump quality before this session.'
    : day === 1 ? 'After a demanding Sunday match, check shoulder soreness before slams and pressing.'
      : day === 3 ? 'Tuesday volleyball counts. Check legs, pain and landing quality before the main jump session.'
        : day === 0 ? 'Friday PE and volleyball still count. Reduce today’s work if Saturday rest was not enough.'
          : 'Check how you feel. A primer should leave you refreshed; full rest is always an option.';
  return <details className="master-readiness" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>Readiness{status ? ` · ${status[0].toUpperCase()}${status.slice(1)}` : ' · check during warm-up'}</summary>
    <p>{context}</p>
    <div role="group" aria-label="Program readiness">{(['green', 'yellow', 'red'] as const).map(value => <button className="btn secondary" type="button" key={value} disabled={disabled || busy} aria-pressed={status === value} onClick={() => void select(value)}>{value[0].toUpperCase()}{value.slice(1)}</button>)}</div>
    <p>{status === 'red' ? 'Stop painful or unstable work. Choose pain-free recovery; seek assessment if problems persist or worsen.' : status === 'yellow' ? 'Reduced work. Keep technique controlled and avoid aggressive load increases.' : status === 'green' ? 'Normal prescribed session. Quality still comes first.' : 'Green: normal and pain-free. Yellow: heavy legs, poor sleep or reduced quality. Red: sharp/worsening pain or unstable landings.'}</p>
    <small className="master-readiness__disclaimer">Self-reported readiness, not a measured recovery score.</small>
    {error && <p role="alert">{error}</p>}
  </details>;
}
