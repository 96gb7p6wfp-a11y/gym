import { useEffect, useState, type MouseEvent } from 'react';
import { MasterProgramSettingsSchema, createRecommendedMasterPlan, createVolleyballMasterPlan, getMasterProgramPhase, getMasterProgramWeek, resolveMasterProgramPlan, type MasterProgramSettings, type MasterReadiness } from './volleyball-master-plan';
import type { PlanDay } from './workout-customization';
import { berlinDate } from './calendar-date';
import { trainingPlanVersion } from './training-plan-status';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import './volleyball-master-program.css';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const newSettings = (startDate: string): MasterProgramSettings => ({ version: 1, revision: '13.1', startDate, matchWeeks: [] });

function ProgramPreview({ settings, date, basePlan, matchWeekend, baseline = false }: { settings: MasterProgramSettings; date: string; basePlan?: PlanDay[]; matchWeekend?: PlanDay[]; baseline?: boolean }) {
  const previewDate = getMasterProgramWeek(settings.startDate, date) ? date : settings.startDate;
  const week = getMasterProgramWeek(settings.startDate, previewDate)!;
  const match = settings.matchWeeks.includes(week);
  const plan = baseline ? createVolleyballMasterPlan(match) : resolveMasterProgramPlan(basePlan ?? createRecommendedMasterPlan(settings), settings, previewDate, matchWeekend);
  return <div className="master-program__preview" aria-label="Program schedule preview">
    <p className="master-program__preview-phase">{baseline ? 'Base prescription · ' : `Week ${week} · ${getMasterProgramPhase(week)} · `}{match ? 'Sunday match' : 'No Sunday match'}</p>
    {baseline && <p className="small-note">This is the recommended baseline, not medical clearance. Actual sessions adapt to your recorded guidance, week and readiness. Unknown impact or lifting clearance keeps preparation conservative.</p>}
    <ol>{plan.map((day, index) => {
      const required = day.exercises.filter(exercise => exercise.optionalWork !== true);
      const optional = day.exercises.length - required.length;
      return <li key={index}><span>{weekdays[index]}</span><details className="master-program__preview-day">
        <summary><span><strong>{day.name}</strong><small>{day.kind === 'sport' ? day.name === 'Match' || day.name === 'Volleyball Match' ? `${day.startTime ? `${day.startTime} · Berlin` : 'Time not set'} · record actual duration` : '20:00–22:00 · Berlin' : day.durationRange ?? `${day.minutes} min`}{day.kind === 'strength' ? ` · ${required.length} movements${optional ? ` + ${optional} optional` : ''}` : ''}</small>{!!settings.revision && index === 4 && <small>School PE · about 2 h · log actual activity once</small>}</span></summary>
        {day.exercises.length > 0 ? <ul>{day.exercises.map(exercise => <li key={exercise.key}><div><strong>{exercise.name}{exercise.optionalWork ? ' · optional' : ''}</strong><small>{exercise.sets} × {exercise.target}{exercise.perSide ? ' / side' : ''}{exercise.rest ? ` · ${exercise.rest} sec rest` : ''}</small>{exercise.benefit && <small>{exercise.benefit}</small>}</div></li>)}</ul> : <p className="small-note">Rest, an easy walk or gentle mobility. Nothing to make up.</p>}
        {day.extraSession && <p className="small-note">Optional · {day.extraSession.name} · {day.extraSession.durationRange ?? `${day.extraSession.minutes} min`}</p>}
      </details></li>;
    })}</ol>
  </div>;
}

export function VolleyballMasterProgram({ settings, defaultStartDate, selectedDate, today = berlinDate(), basePlan, matchWeekend, onSave, onUpgrade, onRestorePrevious, hasPreviousPlan = false, disabled = false, upgradeOpen, onUpgradeOpenChange }: {
  settings?: MasterProgramSettings; defaultStartDate: string; selectedDate: string; today?: string;
  basePlan?: PlanDay[]; matchWeekend?: PlanDay[];
  onSave: (settings: MasterProgramSettings | undefined) => Promise<boolean>;
  onUpgrade?: () => Promise<boolean | void>; onRestorePrevious?: () => Promise<boolean | void>;
  hasPreviousPlan?: boolean; disabled?: boolean;
  upgradeOpen?: boolean; onUpgradeOpenChange?: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<MasterProgramSettings>(settings ?? newSettings(defaultStartDate));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [restore, setRestore] = useState(false), [restorePrevious, setRestorePrevious] = useState(false);
  const [internalUpgrade, setInternalUpgrade] = useState(false), [nextBlock, setNextBlock] = useState(false);
  const upgrade = upgradeOpen ?? internalUpgrade;
  function setUpgrade(open: boolean) { setInternalUpgrade(open); onUpgradeOpenChange?.(open); }
  const [nextStart, setNextStart] = useState(defaultStartDate);
  const [changedStart, setChangedStart] = useState<MasterProgramSettings | null>(null);
  useEffect(() => { setDraft(settings ?? newSettings(defaultStartDate)); }, [settings, defaultStartDate]);
  const week = settings && getMasterProgramWeek(settings.startDate, today);
  const legacy = !!settings && settings.revision !== '13.1';
  const complete = !!settings && today >= settings.startDate && !week;
  const locked = disabled || busy;
  const reviewSettings = settings ? { ...settings, revision: '13.1' as const } : newSettings(defaultStartDate);
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
  const optionalOptions = draft.revision === '13.1' ? [
    ['easyRun', 'Optional easy running reminder'],
  ] as const : draft.revision === '8.1' ? [
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
    <div className="master-program__heading"><div><p className="eyebrow">{settings ? 'SAVED TRAINING PROGRAM' : 'RECOMMENDED PERFORMANCE PLAN'}</p><h2>Volleyball Performance Master Plan{settings ? settings.revision ? ` ${trainingPlanVersion(settings)}` : ' · Original' : ' V13.1'}</h2></div><span>{week ? `Week ${week} · ${getMasterProgramPhase(week)}` : settings ? today < settings.startDate ? `Starts ${settings.startDate}` : 'Block complete' : 'Ready when you are'}</span></div>
    <p className="master-program__purpose">Jump Higher · Hit Harder · Build Muscle</p>
    {legacy && onUpgrade && <div className="master-program__upgrade"><p>Your current block continues unchanged. Review V13.1 before applying it.</p><button type="button" className="btn full" disabled={locked} onClick={() => { setError(''); setUpgrade(true); }}>Upgrade to V13.1</button></div>}
    <details className="master-program__preview-disclosure"><summary>{legacy ? 'Current program preview' : 'Program preview'}</summary>{previewValid ? <ProgramPreview settings={draft} date={selectedDate} basePlan={settings ? basePlan : undefined} matchWeekend={settings ? matchWeekend : undefined} baseline={!settings} /> : <p className="small-note">Choose a valid Monday to preview this block.</p>}</details>
    <details className="master-program__config" open={!settings}>
      <summary>{settings ? 'Schedule & options' : 'Set up your block'}</summary>
      <label className="field-label">Start Monday<input type="date" value={draft.startDate} disabled={locked} onChange={event => setDraft({ ...draft, startDate: event.target.value })} /></label>
      <fieldset className="master-program__matches" disabled={locked}><legend>Sunday match weeks</legend><p>{draft.revision === '13.1' ? 'No match: Lower Strength B Saturday when recovered, recovery Sunday. Match: optional Saturday preparation, Sunday competition.' : draft.revision === '8.1' ? 'Your saved V8.1 weekend stays: recovery Saturday, Heavy Lower B Sunday.' : 'Your saved weekend schedule stays until you choose Upgrade to V13.1.'}</p>
        <div>{Array.from({ length: 8 }, (_, index) => index + 1).map(value => <label key={value}><input type="checkbox" checked={draft.matchWeeks.includes(value)} onChange={event => setDraft({ ...draft,
          matchWeeks: event.target.checked ? [...draft.matchWeeks, value].sort((a, b) => a - b) : draft.matchWeeks.filter(item => item !== value),
          matchTimes: event.target.checked ? draft.matchTimes : draft.matchTimes?.filter(item => item.week !== value),
        })} /><span>Week {value}</span></label>)}</div>
      </fieldset>
      {draft.revision === '13.1' && <label className="master-program__prior-match"><input type="checkbox" disabled={locked} checked={draft.previousSundayMatch ?? false} onChange={event => setDraft({ ...draft, previousSundayMatch: event.target.checked })} /><span>Match on the Sunday before this block</span></label>}
      {draft.revision === '13.1' && <details className="master-program__clearance"><summary>Impact & lifting guidance</summary>
        <p className="small-note">Unknown clearance keeps preparation conservative. Individual clinician restrictions take priority; ask for guidance before increasing impact or heavy straining.</p>
        {([['impact', 'Impact clearance'], ['heavyLifting', 'Heavy lifting clearance']] as const).map(([key, label]) => <label className="field-label" key={key}>{label}<select aria-label={label} disabled={locked} value={draft.clearance?.[key] ?? 'unknown'} onChange={event => setDraft({ ...draft, clearance: { impact: 'unknown', heavyLifting: 'unknown', ...draft.clearance, [key]: event.target.value as 'unknown' | 'cleared' | 'restricted' } })}><option value="unknown">Unknown / awaiting guidance</option><option value="cleared">Cleared within my guidance</option><option value="restricted">Restricted</option></select></label>)}
        <label className="field-label">Personal guidance note<textarea rows={3} maxLength={500} disabled={locked} value={draft.clearance?.note ?? ''} placeholder="Optional restrictions or preparation instructions" onChange={event => setDraft({ ...draft, clearance: { impact: 'unknown', heavyLifting: 'unknown', ...draft.clearance, note: event.target.value } })} /></label>
        <p className="small-note">Stored with your local program and included in your backups. This is your reported status, not medical approval from Setline.</p>
      </details>}
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
      <h3>Progress without grinding</h3><p>Hack Squat 4 × 4–6: keep the load until all four sets reach six clean reps with about two reps left. Then consider the smallest practical increase, often 2.5–5%. Suggestions never change your weight automatically. Jump contacts and box heights never rise automatically.</p>
      <h3>Readiness</h3><p>{settings?.revision === '8.1' ? 'Your V8.1 lower-body checks remain Wednesday and non-match Sunday.' : 'Check Monday, Wednesday and Saturday Lower B; a moved lower session is checked on Sunday.'} Green: recovered, controlled movement. Yellow: reduce jumps and selected hard sets. Red: stop painful or unstable work and choose suitable recovery. A jump-height drop can be a fatigue signal, not a diagnosis.</p><p>Friday PE and volleyball count toward recovery. Moving Saturday Lower B to Sunday always needs confirmation, and a Sunday match takes priority. Persistent or worsening symptoms need professional assessment.</p>
      <h3>Thursday paired work</h3><p>Two rounds pair Cable Lateral Raise with Reverse Pec Deck; the third reverse-fly set remains separate. Three rounds pair Incline Dumbbell Curl with Rope Triceps Extension. Rest 60–90 seconds after each pair, or longer if quality drops. The whole workout is not a circuit.</p>
      <h3>Week 8 retest</h3><p>Standing reach · standing vertical · approach touch and vertical · weekly body-weight trend · Hack Squat · pull-ups. Record actual dated measurements in Progress and lift performance in Train.</p><p>Approximate reference only: reach 235 cm, standing touch ~310 cm, approach touch 315–317 cm. These suggest ~75 cm and ~80–82 cm verticals; they are never saved as test results.</p>
    </details>
    {settings && (hasPreviousPlan && onRestorePrevious ? <div className="master-program__saved"><button className="text-button" type="button" disabled={locked} onClick={() => { setError(''); setRestorePrevious(true); }}>Restore previous program</button><details><summary>Older weekly plan</summary>{savedPlanButton}</details></div> : savedPlanButton)}
    {error && <p role="alert" className="builder-error">{error}</p>}
    <Dialog open={upgrade} onOpenChange={(open: boolean) => { if (!busy) setUpgrade(open); }}><DialogContent className="app-dialog master-program-upgrade-sheet"><DialogHeader className=""><DialogTitle className="">Upgrade to V13.1</DialogTitle><DialogDescription className="">Review the new recommendations. Your current cycle start and match weeks stay.</DialogDescription></DialogHeader><h3 className="master-program__review-heading">Review changes</h3><p className="master-program__upgrade-note">Monday combines approach power and Upper A. Wednesday is strength-focused, without the old complex. Thursday includes ten exercises and two short supersets. No match: Lower Strength B Saturday when recovered, recovery Sunday. Match: optional 10–15 min Saturday preparation, Sunday competition.</p><ProgramPreview settings={reviewSettings} date={selectedDate} baseline /><p className="master-program__upgrade-note">Your current personalized program is saved for restore. V13.1 replaces the weekly recommendations; your date-specific edits, active workout and completed sessions stay unchanged.</p><button className="btn full" type="button" disabled={locked} onClick={() => void applyUpgrade()}>{busy ? 'Applying…' : 'Apply V13.1'}</button>{error && <p role="alert" className="builder-error">{error}</p>}</DialogContent></Dialog>
    <AlertDialog open={restorePrevious} onOpenChange={setRestorePrevious}><AlertDialogContent className="app-dialog"><AlertDialogHeader className=""><AlertDialogTitle className="">Restore your previous program?</AlertDialogTitle><AlertDialogDescription className="">Your saved personal program and its cycle settings return. Workout history, active sessions, nutrition and measurements stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className=""><AlertDialogCancel className="">Keep V13.1</AlertDialogCancel><AlertDialogAction className="" disabled={locked} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); void applyRestorePrevious(); }}>Restore previous program</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
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
  const v131 = settings.revision === '13.1';
  const match = settings.matchWeeks.includes(week ?? 0);
  const previousDate = new Date(new Date(`${date}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const moved = v131 && day === 0 && settings.rescheduledLowerDates?.includes(previousDate);
  const movingFrom = day === 6 ? date : previousDate;
  const canMove = v131 && !match && day === 6 && !settings.rescheduledLowerDates?.includes(date);
  const needsCheck = v131 ? day === 1 || day === 3 || (!match && ((day === 6 && !settings.rescheduledLowerDates?.includes(date)) || !!moved))
    : settings.revision === '8.1' ? day === 3 || (day === 0 && !match) : day === 6;
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
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
  async function moveLower() {
    if (busy || disabled) return;
    setBusy(true); setError('');
    const dates = (settings.rescheduledLowerDates ?? []).filter(value => value !== movingFrom);
    try {
      if (await onSave({ ...settings, rescheduledLowerDates: moved ? dates : [...dates, movingFrom].sort() })) setMoveOpen(false);
      else setError('This session could not move. Existing workouts and day edits stay unchanged.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not move this session.'); }
    finally { setBusy(false); }
  }
  const context = v131 ? day === 1 ? 'Check recovery after Sunday before maximal approach work. Shoulder quality matters for the upper-body session.'
    : day === 3 ? 'Tuesday volleyball counts. Check legs and movement quality before strength and the small jump dose.'
      : 'Friday PE and volleyball count. Lower B is optional when recovery is poor; full rest is valid.'
    : settings.revision !== '8.1' ? 'Friday PE and volleyball count. Check legs, sleep, pain and jump quality before this session.'
      : day === 1 ? 'After a demanding Sunday match, check shoulder soreness before slams and pressing.'
        : day === 3 ? 'Tuesday volleyball counts. Check legs, pain and landing quality before the main jump session.'
          : day === 0 ? 'Friday PE and volleyball still count. Reduce today’s work if Saturday rest was not enough.'
            : 'Check how you feel. A primer should leave you refreshed; full rest is always an option.';
  return <details className="master-readiness" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>Readiness{status ? ` · ${status[0].toUpperCase()}${status.slice(1)}` : ' · check during warm-up'}</summary>
    <p>{context}</p>
    <div role="group" aria-label="Program readiness">{(['green', 'yellow', 'red'] as const).map(value => <button className="btn secondary" type="button" key={value} disabled={disabled || busy} aria-pressed={status === value} onClick={() => void select(value)}>{value[0].toUpperCase()}{value.slice(1)}</button>)}</div>
    <p>{status === 'red' ? 'Stop painful or unstable work. Choose pain-free recovery; seek assessment if problems persist or worsen.' : status === 'yellow' ? 'Reduced work. Keep technique controlled and avoid aggressive load increases.' : status === 'green' ? 'Follow today’s preparation and prescribed session. Movement quality and personal restrictions still come first.' : 'Green: recovered and controlled. Yellow: heavy legs, poor sleep or reduced quality. Red: concerning pain, unstable landings or poor coordination.'}</p>
    {(canMove || moved) && <button className="text-button master-readiness__move" type="button" disabled={disabled || busy} onClick={() => { setError(''); setMoveOpen(true); }}>{moved ? 'Return Lower B to Saturday' : 'Move Lower B to Sunday'}</button>}
    <small className="master-readiness__disclaimer">Self-reported readiness, not a measured recovery score.</small>
    {error && <p role="alert">{error}</p>}
    <AlertDialog open={moveOpen} onOpenChange={setMoveOpen}><AlertDialogContent className="app-dialog"><AlertDialogHeader className=""><AlertDialogTitle className="">{moved ? 'Return Lower B to Saturday?' : 'Move Lower B to Sunday?'}</AlertDialogTitle><AlertDialogDescription className="">{moved ? 'The Sunday session returns to Saturday and Sunday becomes recovery. Existing records and personal day edits will not be overwritten.' : 'Saturday becomes recovery and this one Lower B session moves to Sunday. It is not duplicated. A Sunday match always takes priority. Existing records and personal day edits will not be overwritten.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className=""><AlertDialogCancel className="">Keep schedule</AlertDialogCancel><AlertDialogAction className="" disabled={disabled || busy} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); void moveLower(); }}>{busy ? 'Saving…' : moved ? 'Return to Saturday' : 'Move to Sunday'}</AlertDialogAction></AlertDialogFooter>{error && <p role="alert" className="builder-error">{error}</p>}</AlertDialogContent></AlertDialog>
  </details>;
}
