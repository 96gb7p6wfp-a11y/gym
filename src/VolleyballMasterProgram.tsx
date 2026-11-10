import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { MasterProgramSettingsSchema, createRecommendedMasterPlan, getMasterProgramPhase, getMasterProgramWeek, resolveMasterProgramPlan, type MasterProgramSettings, type MasterReadiness } from './volleyball-master-plan';
import type { PlanDay } from './workout-customization';
import { berlinDate } from './calendar-date';
import { trainingPlanVersion } from './training-plan-status';
import { rebaseObjectChanges } from './profile-updates';
import { CoachDateSchema, getCalendarMatch, getCoachPhase, sundayForDate, type CoachPhase } from './coach-schedule';
import type { MasterProgramUpgradeOptions, MasterProgramUpgradeReview } from './master-program-upgrade';
import type { TrainingGuidance } from './training-guidance';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import './volleyball-master-program.css';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function sundayDate(startDate: string, week: number): string {
  const date = new Date(`${startDate}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return 'Choose a start Monday';
  date.setUTCDate(date.getUTCDate() + (week - 1) * 7 + 6);
  return date.toISOString().slice(0, 10);
}
const newSettings = (startDate: string, guidance?: TrainingGuidance): MasterProgramSettings => ({
  version: 1, revision: '13.1', startDate, matchWeeks: [], ...(guidance ? { clearance: structuredClone(guidance) } : {}),
});

function UpgradeCustomizationReview({ review, acknowledged, onAcknowledge, disabled }: {
  review: MasterProgramUpgradeReview; acknowledged: boolean;
  onAcknowledge: (value: boolean) => void; disabled: boolean;
}) {
  return <section className="master-program__customization-review" aria-label="Personal customization review">
    <h3>Your saved changes</h3>
    {review.preserved.length > 0 && <details>
      <summary>Compatible exercise changes kept<span>{review.preserved.length}</span></summary>
      <ul>{review.preserved.map((item, index) => <li key={`${item.variant}-${item.day}-${index}`}>
        <strong>{weekdays[item.day]}{item.variant === 'match' ? ' · match week' : ''}</strong><p>{item.message}</p>
      </li>)}</ul>
    </details>}
    {review.needsReview.length > 0 ? <>
      <p>Some saved changes cannot be matched safely to the new recommendations. Your current program stays active until you choose to apply an upgrade.</p>
      <ul aria-label="Changes needing your review">{review.needsReview.map((item, index) => <li key={`${item.variant}-${item.day}-${index}`}>
        <strong>{weekdays[item.day]} · {item.dayName}{item.variant === 'match' ? ' · match week' : ''}</strong><p>{item.message}</p>
      </li>)}</ul>
      <label className="master-program__upgrade-choice">
        <input type="checkbox" checked={acknowledged} disabled={disabled}
          aria-label="Use V13.1 recommendations for unmapped edits" onChange={event => onAcknowledge(event.target.checked)} />
        <span>Use V13.1 recommendations for changes that cannot be carried over. My current week will be archived for recovery.</span>
      </label>
      <p className="small-note">Compatible exercise settings are still kept. This choice changes future weekly recommendations; it does not replace recorded workouts.</p>
    </> : <p>Compatible exercise settings carry over. Your current week is saved for recovery, and recorded workouts stay unchanged.</p>}
  </section>;
}

function ProgramPreview({ settings, date, basePlan, matchWeekend, baseline = false }: { settings: MasterProgramSettings; date: string; basePlan?: PlanDay[]; matchWeekend?: PlanDay[]; baseline?: boolean }) {
  const selectedWeek = getMasterProgramWeek(settings.startDate, date);
  const continuingV9 = settings.revision === '9' && date >= settings.startDate && !selectedWeek;
  const previewDate = selectedWeek || continuingV9 ? date : settings.startDate;
  const week = getMasterProgramWeek(settings.startDate, previewDate);
  const v9 = settings.revision === '9';
  const match = v9 ? getCalendarMatch(settings, sundayForDate(previewDate)).scheduled : week !== null && settings.matchWeeks.includes(week);
  const plan = baseline || v9 ? createRecommendedMasterPlan(settings, match) : resolveMasterProgramPlan(basePlan ?? createRecommendedMasterPlan(settings), settings, previewDate, matchWeekend);
  return <div className="master-program__preview" aria-label="Program schedule preview">
    <p className="master-program__preview-phase">{v9 ? 'Full V9 base · ' : baseline ? 'Base prescription · ' : week ? `Week ${week} · ${getMasterProgramPhase(week)} · ` : 'Base week continues · '}{match ? 'Sunday match' : 'No Sunday match'}</p>
    {(baseline || v9) && <p className="small-note">Full planning reference. The executable recommendation respects your recorded guidance and this date’s readiness.</p>}
    <ol>{plan.map((day, index) => {
      const required = day.exercises.filter(exercise => exercise.optionalWork !== true);
      const optional = day.exercises.length - required.length;
      return <li key={index}><span>{weekdays[index]}</span><details className="master-program__preview-day">
        <summary><span><strong>{day.name}</strong><small>{day.kind === 'sport' ? day.name === 'Match' || day.name === 'Volleyball Match' ? `${day.startTime ? `${day.startTime} · Berlin` : 'Time not set'} · record actual duration` : '20:00–22:00 · Berlin' : day.durationRange ?? `${day.minutes} min`}{day.kind === 'strength' ? ` · ${required.length} movements${optional ? ` + ${optional} optional` : ''}` : ''}</small>{!!settings.revision && index === 4 && <small>School PE · about 2 h · log actual activity once</small>}</span></summary>
        {day.exercises.length > 0 ? <ul>{day.exercises.map((exercise, exerciseIndex) => <li key={exercise.key}><div>{exercise.section && exercise.section !== day.exercises[exerciseIndex - 1]?.section && <small className="master-program__section">{exercise.section}</small>}<strong>{exercise.name}{exercise.optionalWork ? ' · optional' : ''}</strong><small>{exercise.sets} × {exercise.target}{exercise.perSide ? ' / side' : ''}{exercise.restRange ? ` · ${exercise.restRange} rest` : exercise.rest ? ` · ${exercise.rest} sec rest` : ''}{exercise.targetRir != null ? ` · RIR ${exercise.targetRir}` : ''}</small>{exercise.benefit && <small>{exercise.benefit}</small>}</div></li>)}</ul> : <p className="small-note">Rest, an easy walk or gentle mobility. Nothing to make up.</p>}
        {day.extraSession && <p className="small-note">Optional · {day.extraSession.name} · {day.extraSession.durationRange ?? `${day.extraSession.minutes} min`}</p>}
      </details></li>;
    })}</ol>
  </div>;
}

function V9TrainingPhases({ settings, date, disabled, onSave }: {
  settings: MasterProgramSettings; date: string; disabled: boolean;
  onSave: (settings: MasterProgramSettings) => Promise<boolean>;
}) {
  const [startDate, setStartDate] = useState(date), [endDate, setEndDate] = useState(date);
  const [phase, setPhase] = useState<CoachPhase>('normal');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const current = getCoachPhase(settings, date);
  async function apply() {
    if (disabled || pending.current) return;
    if (!CoachDateSchema.safeParse(startDate).success || !CoachDateSchema.safeParse(endDate).success || endDate < startDate) {
      setError('Choose valid dates, with the end on or after the start.'); return;
    }
    pending.current = true; setError('');
    try {
      const row = { startDate, endDate, phase };
      const trainingPhases = [...(settings.trainingPhases ?? []).filter(item => JSON.stringify(item) !== JSON.stringify(row)), row];
      if (!(await onSave({ ...settings, periodizationMode: 'manual', trainingPhases }))) setError('The phase could not save. Your existing schedule stays.');
    } catch { setError('Could not save this phase. Try again.'); }
    finally { pending.current = false; }
  }
  return <details className="master-program__phases"><summary>Optional training phases</summary>
    <p className="small-note">Normal training is the default. Choose a reduced-volume or evaluation period only when you decide it is useful. A faster workout is not a reason to add more sets.</p>
    <p className="small-note">Selected date · {current.phase === 'normal' ? 'Normal training' : current.phase === 'deload' ? 'Reduced volume' : 'Evaluation'}{current.source === 'legacy-cycle' ? ' · explicitly enabled saved cycle' : current.source === 'explicit' ? ' · accepted dates' : ''}</p>
    <label className="field-label">Training phase<select aria-label="Training phase" disabled={disabled} value={phase} onChange={event => setPhase(event.target.value as CoachPhase)}><option value="normal">Normal training</option><option value="deload">Reduced volume</option><option value="evaluation">Evaluation</option></select></label>
    <div className="master-program__phase-dates"><label className="field-label">From<input type="date" aria-label="Phase start date" value={startDate} disabled={disabled} onChange={event => setStartDate(event.target.value)} /></label><label className="field-label">Through<input type="date" aria-label="Phase end date" min={startDate} value={endDate} disabled={disabled} onChange={event => setEndDate(event.target.value)} /></label></div>
    <button className="btn secondary full" type="button" disabled={disabled} onClick={() => void apply()}>Apply phase to selected dates</button>
    <p className="small-note">Only the selected dates change. Existing records and earlier accepted phase choices remain saved.</p>
    <details><summary>Previous phase choices</summary>{settings.trainingPhases?.length ? <ul>{[...settings.trainingPhases].reverse().map((row, index) => <li key={`${row.startDate}-${row.endDate}-${index}`}>{row.startDate} → {row.endDate} · {row.phase === 'normal' ? 'Normal training' : row.phase === 'deload' ? 'Reduced volume' : 'Evaluation'}</li>)}</ul> : <p className="small-note">No phase has been explicitly selected.</p>}</details>
    {error && <p role="alert" className="builder-error">{error}</p>}
  </details>;
}

export function VolleyballMasterProgram({ settings, guidance, defaultStartDate, selectedDate, today = berlinDate(), basePlan, matchWeekend, onSave, onUpgrade, upgradeReview, upgradePreview, onRestorePrevious, hasPreviousPlan = false, disabled = false, upgradeOpen, onUpgradeOpenChange, onReviewV9, onOpenCalendar }: {
  settings?: MasterProgramSettings; defaultStartDate: string; selectedDate: string; today?: string;
  guidance?: TrainingGuidance;
  basePlan?: PlanDay[]; matchWeekend?: PlanDay[];
  onSave: (settings: MasterProgramSettings | undefined) => Promise<boolean>;
  onUpgrade?: (options?: MasterProgramUpgradeOptions) => Promise<boolean | void>; onRestorePrevious?: () => Promise<boolean | void>;
  upgradeReview?: MasterProgramUpgradeReview;
  upgradePreview?: { plan: PlanDay[]; matchWeekend?: PlanDay[] };
  hasPreviousPlan?: boolean; disabled?: boolean;
  upgradeOpen?: boolean; onUpgradeOpenChange?: (open: boolean) => void;
  onReviewV9?: () => void;
  onOpenCalendar?: () => void;
}) {
  const [draft, setDraft] = useState<MasterProgramSettings>(() => structuredClone(settings ?? newSettings(defaultStartDate, guidance)));
  const savedDraft = JSON.stringify({ active: Boolean(settings), settings: settings ?? newSettings(defaultStartDate, guidance) });
  const previousSaved = useRef({ active: Boolean(settings), settings: structuredClone(settings ?? newSettings(defaultStartDate, guidance)) });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [restore, setRestore] = useState(false), [restorePrevious, setRestorePrevious] = useState(false);
  const [internalUpgrade, setInternalUpgrade] = useState(false), [nextBlock, setNextBlock] = useState(false);
  const [useRecommendations, setUseRecommendations] = useState(false);
  const upgrade = upgradeOpen ?? internalUpgrade;
  function setUpgrade(open: boolean) { setInternalUpgrade(open); onUpgradeOpenChange?.(open); }
  const [nextStart, setNextStart] = useState(defaultStartDate);
  const [changedStart, setChangedStart] = useState<MasterProgramSettings | null>(null);
  useEffect(() => {
    const next = JSON.parse(savedDraft) as { active: boolean; settings: MasterProgramSettings };
    const previous = previousSaved.current;
    // Re-rendered profile objects and a new suggested next-block date must not
    // erase deliberate edits. Real saved changes merge around those edits.
    setDraft(current => previous.active === next.active
      ? rebaseObjectChanges(previous.settings, next.settings, current) : structuredClone(next.settings));
    previousSaved.current = next;
  }, [savedDraft]);
  useEffect(() => { if (upgrade) setUseRecommendations(false); }, [upgrade]);
  const week = settings && getMasterProgramWeek(settings.startDate, today);
  const v9 = settings?.revision === '9';
  const legacy = !!settings && settings.revision !== '13.1' && settings.revision !== '9';
  const complete = !!settings && today >= settings.startDate && !week;
  const locked = disabled || busy;
  const reviewSettings = settings ? { ...settings, revision: '13.1' as const } : newSettings(defaultStartDate, guidance);
  const parsedDraft = MasterProgramSettingsSchema.safeParse(draft);
  const previewValid = parsedDraft.success;
  const savedProgram = MasterProgramSettingsSchema.safeParse(settings ?? newSettings(defaultStartDate, guidance));
  const draftDirty = !parsedDraft.success || !savedProgram.success || JSON.stringify(parsedDraft.data) !== JSON.stringify(savedProgram.data);
  const upgradeNeedsReview = Boolean(upgradeReview?.needsReview.length);
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
    if (upgradeNeedsReview && !useRecommendations) {
      setError('Review your customized week and confirm how the new recommendations should be applied.'); return;
    }
    setBusy(true); setError('');
    try { if (await onUpgrade({ weeklyCustomizationPolicy: useRecommendations ? 'recommendations' : 'preserve' }) !== false) setUpgrade(false); else setError('The upgrade could not save. Try again.'); }
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
  const optionalOptions = draft.revision === '9' ? [] : draft.revision === '13.1' ? [
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
  return <section className={`master-program${v9 ? ' master-program--weekly' : ''}`} aria-label={v9 ? 'Volleyball training plan' : '8-week volleyball-first program'}>
    <div className="master-program__heading"><div><p className="eyebrow">{settings ? 'YOUR TRAINING PLAN' : 'RECOMMENDED PERFORMANCE PLAN'}</p><h2>{v9 ? 'Volleyball Performance Plan V9' : <>Volleyball Performance Master Plan{settings ? settings.revision ? ` ${trainingPlanVersion(settings)}` : ' · Original' : ' V13.1'}</>}</h2></div><span>{v9 ? 'Weekly training' : week ? `Week ${week} · ${getMasterProgramPhase(week)}` : settings ? today < settings.startDate ? `Starts ${settings.startDate}` : 'Block complete' : 'Ready when you are'}</span></div>
    <p className="master-program__purpose">{v9 ? 'Four gym sessions. Volleyball. Recovery when you need it.' : 'Jump Higher · Hit Harder · Build Muscle'}</p>
    {!v9 && onReviewV9 && <div className="master-program__upgrade master-program__v9-offer"><p>Review the complete V9 prescription and upcoming date edits before changing your training plan.</p><button type="button" className="btn full" disabled={locked} onClick={onReviewV9}>Upgrade Training Plan to V9</button></div>}
    {v9 && onReviewV9 && <button type="button" className="text-button" disabled={locked} onClick={onReviewV9}>Review upcoming V9 workouts</button>}
    {legacy && onUpgrade && <div className="master-program__upgrade"><p>Your current block continues unchanged. Review V13.1 before applying it.</p><button type="button" className="btn full" disabled={locked} onClick={() => { setError(''); setUpgrade(true); }}>Upgrade to V13.1</button></div>}
    <details className="master-program__preview-disclosure"><summary>{v9 ? 'Your weekly schedule' : legacy ? 'Current program preview' : 'Program preview'}</summary>{previewValid ? <ProgramPreview settings={draft} date={selectedDate} basePlan={settings ? basePlan : undefined} matchWeekend={settings ? matchWeekend : undefined} baseline={!settings} /> : <p className="small-note">Choose a valid Monday to preview this block.</p>}</details>
    <details className="master-program__config" open={!settings}>
      <summary>{v9 ? 'Training preferences & guidance' : settings ? 'Schedule & options' : 'Set up your block'}</summary>
      {v9 && <div className="master-program__calendar-note"><p>Full V9 is the normal planning reference. Your check-in and recorded guidance determine the executable recommendation. Select a Sunday in Train to turn a match on or off.</p>{onOpenCalendar && <button className="text-button" type="button" disabled={locked} onClick={onOpenCalendar}>Open training calendar</button>}</div>}
      {!v9 && <>
      <label className="field-label">Start Monday<input type="date" value={draft.startDate} disabled={locked} onChange={event => setDraft({ ...draft, startDate: event.target.value })} /></label>
      <fieldset className="master-program__matches" disabled={locked}><legend>Sunday match weeks</legend><p>{draft.revision === '9' ? 'Confirm the actual Sunday date. No match: full Saturday Lower B when readiness and guidance allow. Confirmed match: a separate short Saturday primer. Match time may remain unset.' : draft.revision === '13.1' ? 'No match: Lower Strength B Saturday when recovered, recovery Sunday. Match: optional Saturday preparation, Sunday competition.' : draft.revision === '8.1' ? 'Your saved V8.1 weekend stays: recovery Saturday, Heavy Lower B Sunday.' : 'Your saved weekend schedule stays until you choose Upgrade to V13.1.'}</p>
        <div>{Array.from({ length: 8 }, (_, index) => index + 1).map(value => <label key={value}><input type="checkbox" aria-label={`Week ${value}`} checked={draft.matchWeeks.includes(value)} onChange={event => setDraft({ ...draft,
          matchWeeks: event.target.checked ? [...draft.matchWeeks, value].sort((a, b) => a - b) : draft.matchWeeks.filter(item => item !== value),
          matchTimes: event.target.checked ? draft.matchTimes : draft.matchTimes?.filter(item => item.week !== value),
        })} /><span>Week {value}</span>{draft.revision === '9' && <small>{sundayDate(draft.startDate, value)}</small>}</label>)}</div>
      </fieldset>
      {draft.revision === '13.1' && <label className="master-program__prior-match"><input type="checkbox" disabled={locked} checked={draft.previousSundayMatch ?? false} onChange={event => setDraft({ ...draft, previousSundayMatch: event.target.checked })} /><span>Match on the Sunday before this block</span></label>}
      </>}
      {(draft.revision === '13.1' || draft.revision === '9') && <details className="master-program__clearance"><summary>Impact & lifting guidance</summary>
        <p className="small-note">Unknown clearance keeps preparation conservative. Individual clinician restrictions take priority; ask for guidance before increasing impact or heavy straining.</p>
        {([['impact', 'Impact clearance'], ['heavyLifting', 'Heavy lifting clearance']] as const).map(([key, label]) => <label className="field-label" key={key}>{label}<select aria-label={label} disabled={locked} value={draft.clearance?.[key] ?? 'unknown'} onChange={event => setDraft({ ...draft, clearance: { impact: 'unknown', heavyLifting: 'unknown', ...draft.clearance, [key]: event.target.value as 'unknown' | 'cleared' | 'restricted' } })}><option value="unknown">Unknown / awaiting guidance</option><option value="cleared">Cleared within my guidance</option><option value="restricted">Restricted</option></select></label>)}
        <label className="field-label">Personal guidance note<textarea aria-label="Personal guidance note" rows={3} maxLength={500} disabled={locked} value={draft.clearance?.note ?? ''} placeholder="Optional restrictions or preparation instructions" onChange={event => setDraft({ ...draft, clearance: { impact: 'unknown', heavyLifting: 'unknown', ...draft.clearance, note: event.target.value } })} /></label>
        <p className="small-note">Kept when changing programs and included in your backups. Unconfirmed or restricted lifting means easy preparation; unconfirmed or restricted impact removes maximal jumps. Changes apply to future workouts. This is your reported status, not medical approval from Setline.</p>
      </details>}
      {!v9 && draft.matchWeeks.length > 0 && <details className="master-program__match-times"><summary>Match times (optional)</summary><p className="small-note">Leave blank if unknown. Times use Europe/Berlin.</p>{draft.matchWeeks.map(value => <label className="field-label" key={value}>Week {value} match time<input type="time" disabled={locked} value={draft.matchTimes?.find(item => item.week === value)?.startTime ?? ''} onChange={event => setDraft({ ...draft, matchTimes: [...(draft.matchTimes ?? []).filter(item => item.week !== value), ...(event.target.value ? [{ week: value, startTime: event.target.value }] : [])].sort((a, b) => a.week - b.week) })} /></label>)}</details>}
      {draft.revision !== '9' && <details><summary>Optional work</summary><div className="master-program__optional">
        {optionalOptions.map(([key, label]) => <label key={key}><input type="checkbox" disabled={locked} checked={draft.optional?.[key] ?? false} onChange={event => setDraft({ ...draft, optional: { mondayArms: false, thursdayArms: false, tuesdayPogos: false, ...draft.optional, [key]: event.target.checked } })} />{label}</label>)}
        <p>Off by default. Add only when time, movement quality and recovery allow.</p></div></details>}
      <button className="btn full" type="button" disabled={locked} onClick={() => settings && draft.startDate !== settings.startDate ? setChangedStart(draft) : void save(draft)}>{busy ? 'Saving…' : settings ? 'Save program' : 'Use this plan'}</button>
      <p className="small-note master-program__save-status" role="status" aria-label="Program changes">{draftDirty ? 'Program changes are not saved yet.' : 'Program settings are up to date.'}</p>
      {!settings && <p className="small-note">Your current weekly plan is kept so you can return to it. History stays unchanged. No Sunday match is assumed.</p>}
    </details>
    {v9 && settings && <details className="master-program__advanced"><summary>Advanced training options</summary>
      <V9TrainingPhases settings={settings} date={selectedDate} disabled={locked} onSave={save} />
      <details className="master-program__archive"><summary>Archived cycle details</summary><p className="small-note">Your saved cycle started {settings.startDate}. Historical block labels and match selections remain available for interpretation; they do not schedule new dates.</p><p className="small-note">Originally confirmed Sundays: {settings.matchWeeks.length ? settings.matchWeeks.map(value => sundayDate(settings.startDate, value)).join(', ') : 'none'}. Select actual match dates in Train.</p><p className="small-note">Calendar phases are {settings.periodizationMode === 'legacy-cycle' ? 'explicitly enabled from your saved cycle' : 'manual: no automatic Week 4 or Week 8 reduction'}. Enabling the saved cycle reapplies its original reduced-volume and evaluation rules. Recorded and active workouts stay unchanged.</p>
        {settings.periodizationMode === 'legacy-cycle' ? <button type="button" className="btn secondary full" disabled={locked} onClick={() => void save({ ...settings, periodizationMode: 'manual' })}>Use readiness-led training</button> : <button type="button" className="text-button" disabled={locked} onClick={() => void save({ ...settings, periodizationMode: 'legacy-cycle' })}>Enable saved cycle reductions</button>}
      </details>
    </details>}
    {complete && !legacy && !v9 && <div className="master-program__next-block"><p>This block is complete. Review your tests before choosing a new start.</p><button className="btn full" type="button" disabled={locked} onClick={() => { setNextStart(defaultStartDate); setError(''); setNextBlock(true); }}>Plan next block</button></div>}
    <details className="master-program__rules"><summary>Training rules & retest</summary>
      <h3>Jump quality first</h3><p>FAST → LONG PENULTIMATE → QUICK PLANT → ARMS → UP. Stop or reduce explosive work if height, control or landing quality falls. Contacts are a ceiling, not a target to force.</p>
      <h3>{v9 ? 'Normal training · optional lighter periods' : 'Build · deload · retest'}</h3><p>{v9 ? 'Your full V9 prescription is the reference. Readiness adjusts a single date. A reduced-volume or evaluation period applies only when explicitly selected in Advanced training options; old cycle numbers do not silently reduce the dose.' : 'Weeks 1–3: build quality. Week 4: reduce demanding sets and jump contacts. Weeks 5–7: return to base volume. Week 8: reduce strength volume and test fresh; no extra full-volume jump workout.'}</p>
      <h3>Progress without grinding</h3><p>{v9 ? 'Meet the top of the rep range in every working set at the prescribed RIR with sound technique before considering the smallest practical load increase. Wednesday has three Hack Squat working sets in the complex, not a second three-set block afterward.' : 'Hack Squat 4 × 4–6: keep the load until all four sets reach six clean reps with about two reps left. Then consider the smallest practical increase, often 2.5–5%.'} Suggestions never change your weight automatically. Jump contacts and box heights never rise automatically.</p>
      <h3>Readiness</h3><p>{v9 ? 'Great and Normal retain the full eligible session. Tired suggests specific reductions; Poor recommends recovery. Your answer applies only to that date. Friday PE and volleyball count, but missing reports are unknown rather than proof of recovery.' : <>{settings?.revision === '8.1' ? 'Your V8.1 lower-body checks remain Wednesday and non-match Sunday.' : 'Check Monday, Wednesday and Saturday Lower B; a moved lower session is checked on Sunday.'} Green: recovered, controlled movement. Yellow: reduce jumps and selected hard sets. Red: stop painful or unstable work and choose suitable recovery. A jump-height drop can be a fatigue signal, not a diagnosis.</>}</p><p>{v9 ? 'The full base remains visible when training is modified. Great never overrides restricted or unconfirmed medical guidance. A confirmed Sunday match means a separate Saturday primer or rest, without a catch-up gym session.' : 'Friday PE and volleyball count toward recovery. Moving Saturday Lower B to Sunday always needs confirmation, and a Sunday match takes priority.'} Persistent or worsening symptoms need professional assessment.</p>
      <h3>{v9 ? 'Wednesday strength–power complex' : 'Thursday paired work'}</h3><p>{v9 ? 'Three rounds: Hack Squat → 3–4 minutes rest → two CMJs → 2–3 minutes rest → repeat. Reset fully and stop explosive work when speed, landing control or jump quality deteriorates. Thursday separates agility from the full upper-body block.' : 'Two rounds pair Cable Lateral Raise with Reverse Pec Deck; the third reverse-fly set remains separate. Three rounds pair Incline Dumbbell Curl with Rope Triceps Extension. Rest 60–90 seconds after each pair, or longer if quality drops. The whole workout is not a circuit.'}</p>
      <h3>{v9 ? 'Performance checks' : 'Week 8 retest'}</h3><p>{v9 ? 'Retest jumps about every two weeks and 5 m / 10 m sprints about every four weeks when practical, using the same protocol and timing method. Record only measured results. A review after several weeks can guide an explicitly accepted evaluation period without restarting your program.' : 'Standing reach · standing vertical · approach touch and vertical · weekly body-weight trend · Hack Squat · pull-ups. Record actual dated measurements in Progress and lift performance in Train.'}</p>{!v9 && <p>Approximate reference only: reach 235 cm, standing touch ~310 cm, approach touch 315–317 cm. These suggest ~75 cm and ~80–82 cm verticals; they are never saved as test results.</p>}
    </details>
    {settings && (hasPreviousPlan && onRestorePrevious ? <div className="master-program__saved"><button className="text-button" type="button" disabled={locked} onClick={() => { setError(''); setRestorePrevious(true); }}>Restore previous program</button><details><summary>Older weekly plan</summary>{savedPlanButton}</details></div> : savedPlanButton)}
    {error && <p role="alert" className="builder-error">{error}</p>}
    <Dialog open={upgrade} onOpenChange={(open: boolean) => { if (!busy) setUpgrade(open); }}>
      <DialogContent className="app-dialog master-program-upgrade-sheet">
        <DialogHeader className=""><DialogTitle className="">Upgrade to V13.1</DialogTitle><DialogDescription className="">Review the new recommendations. Your current cycle start and match weeks stay.</DialogDescription></DialogHeader>
        <h3 className="master-program__review-heading">Review changes</h3>
        <p className="master-program__upgrade-note">Monday combines approach power and Upper A. Wednesday is strength-focused, without the old complex. Thursday includes ten exercises and two short supersets. No match: Lower Strength B Saturday when recovered, recovery Sunday. Match: optional 10–15 min Saturday preparation, Sunday competition.</p>
        {upgradeReview && <UpgradeCustomizationReview review={upgradeReview} acknowledged={useRecommendations} onAcknowledge={setUseRecommendations} disabled={locked} />}
        <ProgramPreview settings={reviewSettings} date={selectedDate} basePlan={upgradePreview?.plan} matchWeekend={upgradePreview?.matchWeekend} baseline={!upgradePreview} />
        <p className="master-program__upgrade-note">Your current personalized program is saved for restore. Your date-specific edits, active workout and completed sessions stay unchanged. Your recorded impact and lifting guidance still applies.</p>
        <button className="btn full" type="button" disabled={locked || (upgradeNeedsReview && !useRecommendations)} onClick={() => void applyUpgrade()}>{busy ? 'Applying…' : 'Apply V13.1'}</button>
        <button className="btn secondary full" type="button" disabled={busy} onClick={() => setUpgrade(false)}>Keep current program</button>
        {error && <p role="alert" className="builder-error">{error}</p>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={restorePrevious} onOpenChange={setRestorePrevious}><AlertDialogContent className="app-dialog"><AlertDialogHeader className=""><AlertDialogTitle className="">Restore your previous program?</AlertDialogTitle><AlertDialogDescription className="">Your saved personal program and its cycle settings return. Workout history, active sessions, nutrition and measurements stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className=""><AlertDialogCancel className="">{v9 ? 'Keep V9' : 'Keep V13.1'}</AlertDialogCancel><AlertDialogAction className="" disabled={locked} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); void applyRestorePrevious(); }}>Restore previous program</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={restore} onOpenChange={setRestore}><AlertDialogContent className="app-dialog"><AlertDialogHeader className=""><AlertDialogTitle className="">Return to your saved plan?</AlertDialogTitle><AlertDialogDescription className="">The weekly plan from before this block returns. History, meals, measurements and active workouts stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className=""><AlertDialogCancel className="">Keep program</AlertDialogCancel><AlertDialogAction className="" disabled={locked} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); void save(undefined); }}>Restore saved plan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={nextBlock} onOpenChange={(open: boolean) => { if (!busy) setNextBlock(open); }}><DialogContent className="app-dialog"><DialogHeader className=""><DialogTitle className="">Plan the next block?</DialogTitle><DialogDescription className="">Start a new eight-week cycle using your current weekly plan. Match weeks start empty; choose the new competition dates afterward. Your records stay.</DialogDescription></DialogHeader><label className="field-label">Next start Monday<input type="date" value={nextStart} disabled={locked} onChange={event => setNextStart(event.target.value)} /></label><button className="btn full" type="button" disabled={locked} onClick={() => settings && void save({ ...settings, startDate: nextStart, matchWeeks: [], matchTimes: [] })}>Start next block</button>{error && <p role="alert" className="builder-error">{error}</p>}</DialogContent></Dialog>
    <AlertDialog open={changedStart !== null} onOpenChange={(open: boolean) => { if (!open) setChangedStart(null); }}><AlertDialogContent className="app-dialog"><AlertDialogHeader className=""><AlertDialogTitle className="">Change this block’s start?</AlertDialogTitle><AlertDialogDescription className="">Changing the start date changes the current week and phase. Existing workout snapshots stay unchanged. Apply the schedule starting {changedStart?.startDate}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className=""><AlertDialogCancel className="">Keep start date</AlertDialogCancel><AlertDialogAction className="" disabled={locked} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); if (changedStart) void save(changedStart); }}>Apply schedule</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

export function MasterProgramReadiness({ settings, date, disabled, onSave, scheduleOnly = false }: {
  settings: MasterProgramSettings; date: string; disabled?: boolean;
  scheduleOnly?: boolean;
  onSave: (settings: MasterProgramSettings) => Promise<boolean>;
}) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const week = getMasterProgramWeek(settings.startDate, date);
  const v131 = settings.revision === '13.1';
  const v9 = settings.revision === '9';
  const match = settings.matchWeeks.includes(week ?? 0);
  const previousDate = new Date(new Date(`${date}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const moved = v131 && day === 0 && settings.rescheduledLowerDates?.includes(previousDate);
  const movingFrom = day === 6 ? date : previousDate;
  const canMove = v131 && !match && day === 6 && !settings.rescheduledLowerDates?.includes(date);
  const needsCheck = v9 ? day === 3 || (day === 6 && !match) : v131 ? day === 1 || day === 3 || (!match && ((day === 6 && !settings.rescheduledLowerDates?.includes(date)) || !!moved))
    : settings.revision === '8.1' ? day === 3 || (day === 0 && !match) : day === 6;
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => needsCheck && !settings.readiness?.some(row => row.date === date));
  useEffect(() => { setExpanded(needsCheck && !settings.readiness?.some(row => row.date === date)); }, [date, needsCheck]);
  if ((!week && !v9) || (scheduleOnly && !canMove && !moved)) return null;
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
  const context = v9 ? day === 6 ? match ? 'A confirmed Sunday match selects the short primer. No heavy lifting or maximal jumps; full rest is valid when fatigued.' : 'Friday PE and volleyball count. Check legs, sleep, pain and landing quality before full Lower B. Missing logs are unknown, not proof of recovery.'
    : day === 3 ? 'Tuesday volleyball counts. Check recovery before acceleration, the jump block and heavy strength. Use an unobstructed sprint lane with enough deceleration distance.'
      : day === 4 ? 'Use clear, non-slip space for agility, then check shoulder quality before throwing and upper-body work.'
        : 'Check movement quality and your reported guidance. Power needs speed and control, not exhaustion.'
    : v131 ? day === 1 ? 'Check recovery after Sunday before maximal approach work. Shoulder quality matters for the upper-body session.'
    : day === 3 ? 'Tuesday volleyball counts. Check legs and movement quality before strength and the small jump dose.'
      : 'Friday PE and volleyball count. Lower B is optional when recovery is poor; full rest is valid.'
    : settings.revision !== '8.1' ? 'Friday PE and volleyball count. Check legs, sleep, pain and jump quality before this session.'
      : day === 1 ? 'After a demanding Sunday match, check shoulder soreness before slams and pressing.'
        : day === 3 ? 'Tuesday volleyball counts. Check legs, pain and landing quality before the main jump session.'
          : day === 0 ? 'Friday PE and volleyball still count. Reduce today’s work if Saturday rest was not enough.'
            : 'Check how you feel. A primer should leave you refreshed; full rest is always an option.';
  return <details className={scheduleOnly ? 'master-schedule-options' : 'master-readiness'} open={scheduleOnly ? undefined : expanded} onToggle={event => { if (!scheduleOnly) setExpanded(event.currentTarget.open); }}>
    <summary>{scheduleOnly ? 'Weekend schedule' : <>Readiness{status ? ` · ${status[0].toUpperCase()}${status.slice(1)}` : ' · check during warm-up'}</>}</summary>
    {!scheduleOnly && <><p>{context}</p>
    <div role="group" aria-label="Program readiness">{(['green', 'yellow', 'red'] as const).map(value => <button className="btn secondary" type="button" key={value} disabled={disabled || busy} aria-pressed={status === value} onClick={() => void select(value)}>{value[0].toUpperCase()}{value.slice(1)}</button>)}</div>
    <p>{status === 'red' ? 'Stop painful or unstable work. Choose pain-free recovery; seek assessment if problems persist or worsen.' : status === 'yellow' ? 'Reduced work. Keep technique controlled and avoid aggressive load increases.' : status === 'green' ? 'Follow today’s preparation and prescribed session. Movement quality and personal restrictions still come first.' : 'Green: recovered and controlled. Yellow: heavy legs, poor sleep or reduced quality. Red: concerning pain, unstable landings or poor coordination.'}</p></>}
    {(canMove || moved) && <button className="text-button master-readiness__move" type="button" disabled={disabled || busy} onClick={() => { setError(''); setMoveOpen(true); }}>{moved ? 'Return Lower B to Saturday' : 'Move Lower B to Sunday'}</button>}
    {!scheduleOnly && <small className="master-readiness__disclaimer">Self-reported readiness, not a measured recovery score.</small>}
    {error && <p role="alert">{error}</p>}
    <AlertDialog open={moveOpen} onOpenChange={setMoveOpen}><AlertDialogContent className="app-dialog"><AlertDialogHeader className=""><AlertDialogTitle className="">{moved ? 'Return Lower B to Saturday?' : 'Move Lower B to Sunday?'}</AlertDialogTitle><AlertDialogDescription className="">{moved ? 'The Sunday session returns to Saturday and Sunday becomes recovery. Existing records and personal day edits will not be overwritten.' : 'Saturday becomes recovery and this one Lower B session moves to Sunday. It is not duplicated. A Sunday match always takes priority. Existing records and personal day edits will not be overwritten.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className=""><AlertDialogCancel className="">Keep schedule</AlertDialogCancel><AlertDialogAction className="" disabled={disabled || busy} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); void moveLower(); }}>{busy ? 'Saving…' : moved ? 'Return to Saturday' : 'Move to Sunday'}</AlertDialogAction></AlertDialogFooter>{error && <p role="alert" className="builder-error">{error}</p>}</AlertDialogContent></AlertDialog>
  </details>;
}
