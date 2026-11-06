import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Clock3, MoreHorizontal, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { DecimalWeightInput } from './DecimalWeightInput';
import { ExerciseGuideSheet } from './ExerciseGuide';
import { ExerciseLibrarySheet } from './ExerciseLibrarySheet';
import { ExerciseSchema } from './domain.js';
import { findLibraryExercise, toPlanExercise, type LibraryExercise } from './exercise-library';
import { getSessionPurpose } from './training-purpose';
import { addPlanExercise, movePlanExercise, removePlanExercise, replacePlanExercise, type PlanDay, type PlanExercise } from './workout-customization';
import type { StretchStep } from './stretch-routine';
import { getQuickWarmupPresentation } from './session-preparation';
import { masterJumpContacts } from './volleyball-master-plan';
import { workoutTitle } from './presentation';
import { previewRestLabel, PreviewSessionDetails } from './WorkoutPreview';
import { compareWorkoutPrescriptions, getWorkoutPrescription, isGentleV9MatchPrimer, type WorkoutPrescription } from './training-prescription';
import { WorkoutPrescriptionSummary } from './WorkoutPrescriptionSummary';
import { findComplexPair } from './training-flow';
import './workout-plan-preview.css';

export interface WorkoutPlanPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanDay;
  dayLabel: string;
  warmup: StretchStep[];
  disabled?: boolean;
  onChange: (plan: PlanDay) => Promise<boolean | void> | boolean | void;
  onStart: () => void;
  previous?: (exercise: PlanExercise) => string | undefined;
  prescription?: WorkoutPrescription;
  onReviewProgram?: () => void;
  onReviewGuidance?: () => void;
  onReviewReset?: () => void;
  basePlan?: PlanDay;
  sourceInfo?: string;
  onReviewV9Draft?: () => void;
}

/** This editor only changes the selected day's plan. It never creates a session. */
export function WorkoutPlanPreview({ open, onOpenChange, plan, dayLabel, warmup, disabled = false, onChange, onStart, previous, prescription: suppliedPrescription, onReviewProgram, onReviewGuidance, onReviewReset, basePlan, sourceInfo, onReviewV9Draft }: WorkoutPlanPreviewProps) {
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [guide, setGuide] = useState<PlanExercise | null>(null);
  const [editor, setEditor] = useState<PlanExercise | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [replaceKey, setReplaceKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [weightValid, setWeightValid] = useState(true);
  const [showBase, setShowBase] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const committing = useRef(false);
  const previousOpen = useRef(false);
  const rowTrigger = useRef<HTMLButtonElement | null>(null);
  const menuExercise = plan.exercises.find(exercise => exercise.key === menuKey);
  const replacement = plan.exercises.find(exercise => exercise.key === replaceKey);
  const baseChanges = basePlan ? compareWorkoutPrescriptions(basePlan, plan) : [];
  const hasBaseDifference = Boolean(basePlan && (baseChanges.length || basePlan.kind !== plan.kind || basePlan.name !== plan.name));
  const viewingBase = showBase && Boolean(basePlan);
  const displayPlan = viewingBase ? basePlan! : plan;
  const displayWarmup = viewingBase ? displayPlan.warmup ?? [] : warmup;
  const purpose = getSessionPurpose(displayPlan);
  const preparation = getQuickWarmupPresentation(displayPlan);
  const recommendation = suppliedPrescription ?? getWorkoutPrescription({ plan, originalPlan: basePlan });
  const prescription = viewingBase ? getWorkoutPrescription({ plan: displayPlan }) : recommendation;
  const limitation = recommendation.reasons.find(reason => reason.code.startsWith('clearance-lifting-') || reason.code.startsWith('clearance-impact-'));
  const reviewGuidance = onReviewGuidance ?? onReviewProgram;
  const workingExercises = displayPlan.exercises.filter(exercise => exercise.optionalWork !== true);
  const optionalExercises = displayPlan.exercises.filter(exercise => exercise.optionalWork === true);
  const workingSets = workingExercises.reduce((count, exercise) => count + exercise.sets, 0);
  const contacts = masterJumpContacts(displayPlan);
  const supersets = [...new Set(workingExercises.flatMap(exercise => exercise.superset ? [exercise.superset.id] : []))]
    .map(id => workingExercises.filter(exercise => exercise.superset?.id === id).sort((a, b) => a.superset!.order - b.superset!.order))
    .filter(pair => pair.length === 2 && pair[0].superset!.order === 1 && pair[1].superset!.order === 2);
  const trapBar = plan.programRevision === '8.1' && /heavy lower b/i.test(plan.name) ? findLibraryExercise('Trap Bar Deadlift') : undefined;
  const locked = disabled || busy;
  const sprintEntries = plan.exercises.filter(exercise => exercise.prescribedDistanceM != null);
  const restLabel = (exercise: PlanExercise) => exercise.restRange ? `${exercise.restRange} rest` : previewRestLabel(exercise);
  const plannedSequence = workingExercises.map(exercise => ({ ...exercise, logs: [] }));

  useLayoutEffect(() => {
    if (open && !previousOpen.current) {
      setMenuKey(null); setGuide(null); setEditor(null); setLibraryOpen(false); setReplaceKey(null); setError(''); setEditError(''); setShowBase(hasBaseDifference); setLocationMessage('');
    }
    previousOpen.current = open;
  }, [open, hasBaseDifference]);

  async function commit(next: PlanDay): Promise<boolean> {
    if (disabled || viewingBase || committing.current) return false;
    committing.current = true; setBusy(true); setError(''); setEditError('');
    try {
      const result = await onChange(next);
      if (result === false) throw new Error('Your changes could not be saved. Try again.');
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Your changes could not be saved. Try again.';
      setError(message); setEditError(message);
      return false;
    } finally { committing.current = false; setBusy(false); }
  }

  function openOptions(exercise: PlanExercise) {
    if (viewingBase) return;
    setMenuKey(exercise.key); setEditor(null); setEditError(''); setWeightValid(true);
  }
  async function chooseExercise(item: LibraryExercise) {
    const next = replaceKey ? replacePlanExercise(plan, replaceKey, toPlanExercise(item)) : addPlanExercise(plan, toPlanExercise(item));
    if (await commit(next)) { setReplaceKey(null); setMenuKey(null); }
  }
  async function move(offset: -1 | 1) {
    if (!menuExercise) return;
    const index = workingExercises.findIndex(exercise => exercise.key === menuExercise.key);
    const destination = workingExercises[index + offset];
    if (!destination) return;
    await commit(movePlanExercise(plan, menuExercise.key, plan.exercises.findIndex(exercise => exercise.key === destination.key)));
  }
  async function savePrescription() {
    if (!editor || !weightValid) { setEditError('Check the planned weight before saving.'); return; }
    const checked = ExerciseSchema.safeParse(editor);
    if (!checked.success) {
      const field = checked.error.issues[0]?.path.at(-1);
      setEditError(field === 'sets' ? 'Use 1–20 working sets.' : field === 'target' ? 'Keep the rep target under 60 characters.' : field === 'rest' || field === 'restAfterRound' ? 'Use 0–600 seconds of rest.' : field === 'targetRpe' ? 'Use a target RPE between 1 and 10.' : 'Check the exercise details before saving.');
      return;
    }
    if (!editor.target.trim()) { setEditError('Enter a rep or time target.'); return; }
    if (editor.prescribedDistanceM != null && (!Number.isInteger(editor.prescribedDistanceM) || editor.prescribedDistanceM < 1 || editor.prescribedDistanceM > 1000)) {
      setEditError('Use whole metres from 1 to 1,000 for this acceleration effort.'); return;
    }
    const edited = checked.data;
    const exercises = plan.exercises.map(exercise => {
      if (exercise.key === editor.key) return edited;
      if (edited.superset && exercise.superset?.id === edited.superset.id) return {
        ...exercise, superset: { ...exercise.superset, restAfterRound: edited.superset.restAfterRound },
      };
      return exercise;
    });
    if (await commit({ ...plan, exercises })) { setEditor(null); setMenuKey(null); }
  }

  return <>
    <Dialog open={open} onOpenChange={(next: boolean) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="app-dialog workout-plan-preview-sheet" aria-label="Workout preview" aria-labelledby={undefined}>
        <DialogHeader className="plan-preview__header">
          <p className="eyebrow">Workout preview · {dayLabel}</p>
          <DialogTitle className="">{workoutTitle(displayPlan)}</DialogTitle>
          <DialogDescription className="">{prescription.label === 'Preparation' ? prescription.objective : purpose.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="plan-preview__metadata"><div className="plan-preview__summary"><span><Clock3 size={15} aria-hidden="true" />{prescription.duration}</span><span>{workingExercises.length} exercises · {workingSets} sets</span></div>
        <p className="plan-preview__scope">{viewingBase ? 'Full V9 base · read-only reference. Starting uses the recommendation below.' : `For ${dayLabel} only. Weekly plan unchanged.`}</p></div>
        {hasBaseDifference && viewingBase && <section className="plan-preview__recommendation" aria-label="Executable recommendation">
          <div><span>Recommended for {dayLabel}</span><strong>{plan.name}</strong><p>{recommendation.mandatoryExercises} exercises · {recommendation.workingSets} sets · {recommendation.duration}</p></div>
          <p className="plan-preview__recommendation-reason">{limitation?.title ?? (recommendation.reasons.find(reason => /readiness|deload|evaluation|phase|today-edit/.test(reason.code))?.title ?? 'Adjusted for this date. The full base stays unchanged.')}</p>
          {limitation && reviewGuidance && <button type="button" className="text-button" disabled={locked} onClick={() => { onOpenChange(false); reviewGuidance(); }}>Review training guidance<ChevronRight size={16} aria-hidden="true" /></button>}
          <details className="plan-preview__changes"><summary>See specific changes<span>{baseChanges.length}</span></summary>{baseChanges.length > 0 ? <ul>{baseChanges.map(change => <li key={`${change.key}-${change.kind}`}><strong>{change.name}</strong><span>{change.before}</span><span>{change.after}</span></li>)}</ul> : <p>The session name or purpose was changed for this date. Your saved exercise prescription is shown below.</p>}</details>
        </section>}
        {hasBaseDifference && !viewingBase && basePlan && <button type="button" className="plan-preview__baseline-link" onClick={() => setShowBase(true)}>
          <span>Full baseline</span><strong>{basePlan.name}</strong><small>{basePlan.exercises.filter(exercise => !exercise.optionalWork).length} exercises · {basePlan.exercises.filter(exercise => !exercise.optionalWork).reduce((sum, exercise) => sum + exercise.sets, 0)} sets · {getWorkoutPrescription({ plan: basePlan }).duration}</small><ChevronRight size={18} aria-hidden="true" />
        </button>}
        {basePlan && <div className="plan-preview__variant" role="group" aria-label="V9 prescription view">{([['Full V9 base', true], ['Recommended today', false]] as const).map(([label, value]) => <button type="button" key={label} disabled={busy} aria-pressed={showBase === value} onClick={() => { setShowBase(value); setMenuKey(null); setEditor(null); setGuide(null); setLibraryOpen(false); setReplaceKey(null); }}>{label}</button>)}</div>}
        {onReviewV9Draft && <button type="button" className="text-button" disabled={locked} onClick={() => { onOpenChange(false); onReviewV9Draft(); }}>Review saved date edit</button>}
        {!viewingBase && onReviewReset && <button type="button" className="text-button" onClick={onReviewReset}>Review date-only reset</button>}
        {!viewingBase && <WorkoutPrescriptionSummary prescription={prescription} onReviewGuidance={reviewGuidance ? () => { onOpenChange(false); reviewGuidance(); } : undefined} compact={Boolean(basePlan)} />}
        {viewingBase && <p className="plan-preview__reference-note">Planning reference only. Your recorded guidance and today’s readiness govern what starts; this view cannot authorize restricted heavy or high-impact work.</p>}
        {sourceInfo && <details className="plan-preview__source"><summary>Plan source</summary><p>{sourceInfo}</p></details>}
        {displayPlan.programSessionId === 'v9-match-primer' ? <p className="small-note">The primer is the short preparation session. No additional long warm-up checklist is required.</p> : <details className="plan-preview__warmup">
          <summary><span><strong>Warm-up</strong><span>{preparation.duration} · {displayWarmup.length} movements</span></span><ChevronRight size={19} aria-hidden="true" /></summary>
          <ol aria-label="Preview warm-up exercises">{displayWarmup.map(step => <li key={step.key}><strong>{step.name}</strong><span>{step.target}</span><p>{step.cue}</p></li>)}</ol>
          <p className="plan-preview__ramp">{preparation.rampUp}</p>
        </details>}
        <section className="plan-preview__main" aria-label="Main workout">
          <h3>Main workout</h3>
          {workingExercises.length > 0 ? <ol className="plan-preview__list" aria-label="Scheduled exercises">
            {workingExercises.map((exercise, index) => {
              const last = previous?.(exercise);
              const complex = displayPlan.programRevision === '9' ? findComplexPair(plannedSequence, exercise.key) : null;
              return <li key={exercise.key} className={`plan-preview__exercise${complex?.first.key === exercise.key ? ' plan-preview__exercise--complex' : ''}`}>
              <button type="button" className="plan-preview__exercise-main" aria-label={`Exercise details for ${exercise.name}`} aria-haspopup="dialog" onClick={event => { rowTrigger.current = event.currentTarget; setGuide(exercise); }}>
                <span className="plan-preview__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="plan-preview__exercise-copy">{exercise.section && exercise.section !== workingExercises[index - 1]?.section && <span className="plan-preview__section">{exercise.section}</span>}<strong>{exercise.name}</strong><span className="plan-preview__dose">{exercise.sets} × {exercise.target}{exercise.perSide ? ' / side' : ''}{exercise.defaultKg != null ? ` · ${exercise.defaultKg} kg` : ''} · {restLabel(exercise)}{exercise.targetRir != null ? ` · RIR ${exercise.targetRir}` : ''}</span>
                  {exercise.superset ? <span className="plan-preview__pair">Superset {exercise.superset.label}</span>
                    : /complex pair/i.test(exercise.group) && <span className="plan-preview__pair">{exercise.group}</span>}
                  {exercise.equipmentLabel && <span className="plan-preview__equipment">{exercise.equipmentLabel}</span>}
                  {last && <span className="plan-preview__previous">Previous · {last}</span>}
                </span>
              </button>
              {!viewingBase && <button type="button" className="icon-button plan-preview__options" aria-label={`Options for ${exercise.name}`} aria-haspopup="dialog" disabled={locked} onClick={() => openOptions(exercise)}><MoreHorizontal size={22} aria-hidden="true" /></button>}
              {complex?.first.key === exercise.key && <p className="plan-preview__complex" aria-label="Strength–power sequence">{Math.min(complex.first.sets, complex.second.sets)} rounds: {complex.first.name} → {complex.first.restRange ?? `${complex.first.rest} sec`} rest → {complex.second.name} → {complex.second.restRange ?? `${complex.second.rest} sec`} rest → repeat. These are the prescribed working sets, not an additional block.</p>}
            </li>;
            })}
          </ol> : <p className="plan-preview__empty">{displayPlan.kind === 'recovery' ? 'An easy day. View your preparation above, then start your mobility routine.' : 'Add a movement to prepare your session.'}</p>}
          {displayPlan.programRevision === '8.1' && contacts.planned > 0 && <p className="plan-preview__contacts">{contacts.planned} planned main jump contacts. A ceiling, not a target; stop sooner if quality drops.</p>}
          {(displayPlan.programRevision === '13.1' || displayPlan.programRevision === '9') && contacts.planned > 0 && <p className="plan-preview__contacts">{contacts.planned} planned gym jump contacts. A starting recommendation, not a quota. Excludes preparation, volleyball and PE; stop sooner if quality drops.</p>}
          {supersets.length > 0 && <details className="plan-preview__optional plan-preview__supersets"><summary>Superset order<ChevronRight size={17} aria-hidden="true" /></summary><ul aria-label="Prescribed supersets">{supersets.map(pair => {
            const rounds = Math.min(pair[0].superset!.rounds ?? Infinity, pair[1].superset!.rounds ?? Infinity, pair[0].sets, pair[1].sets);
            return <li key={pair[0].superset!.id}><div><strong>Superset {pair[0].superset!.label}</strong><p>{pair[0].name} → {pair[1].name}<br />{rounds} paired rounds · {pair[0].superset!.restAfterRound} sec after each pair</p>{pair.filter(exercise => exercise.sets > rounds).map(exercise => <p key={exercise.key}>{exercise.name}: {exercise.sets - rounds} remaining {exercise.sets - rounds === 1 ? 'set' : 'sets'} separately · {exercise.rest} sec rest.</p>)}</div></li>;
          })}</ul><p>Take longer rest if performance drops. This does not make the session a circuit.</p></details>}
          {optionalExercises.length > 0 && <details className="plan-preview__optional"><summary>Optional work<span>{optionalExercises.length}</span><ChevronRight size={17} aria-hidden="true" /></summary><p>Only include what fits your time and readiness.</p><ul aria-label="Optional exercises">{optionalExercises.map(exercise => <li key={exercise.key}><button type="button" className="plan-preview__optional-detail" aria-label={`Exercise details for ${exercise.name}`} onClick={event => { rowTrigger.current = event.currentTarget; setGuide(exercise); }}><strong>{exercise.name}</strong><span>{exercise.benefit ?? findLibraryExercise(exercise)?.primaryBenefit ?? exercise.group}</span><span>{exercise.sets} × {exercise.target}{exercise.perSide ? ' / side' : ''} · {restLabel(exercise)}</span></button>{!viewingBase && <button type="button" className="icon-button" aria-label={`Include ${exercise.name}`} disabled={locked} onClick={() => void commit({ ...plan, exercises: plan.exercises.map(item => item.key === exercise.key ? { ...item, optionalWork: false } : item) })}><Plus size={20} aria-hidden="true" /></button>}</li>)}</ul></details>}
          {trapBar && <details className="plan-preview__optional plan-preview__trap-bar"><summary>Trap-bar alternative<ChevronRight size={17} aria-hidden="true" /></summary><p>New to the trap bar? Start with your 20 kg empty bar and easy technique practice. Once movement is consistent, Trap Bar Deadlift 3 × 4–6 can replace Leg Press. Use Leg Press’s replacement menu; do not add both. No trap-bar jumps.</p><button type="button" className="text-button" onClick={() => setGuide({ ...toPlanExercise(trapBar), sets: 3, target: '4–6 reps', defaultKg: 20, rest: 180, targetRpe: 8, cue: 'Practice with the 20 kg empty bar first. Progress gradually after consistent technique. Replace Leg Press, never add both.' })}>View technique<ChevronRight size={16} aria-hidden="true" /></button></details>}
          {!viewingBase && sprintEntries.length > 0 && <details className="plan-preview__sprint"><summary>Sprint location &amp; options</summary><p>Use a genuinely clear, non-slip lane with enough deceleration distance. Never sprint between gym machines. Perform this block at a suitable sports hall or outdoor location, or explicitly omit it for this date.</p><button type="button" className="text-button" disabled={locked} onClick={async () => { if (await commit({ ...plan, note: `Acceleration location: use a clear sports hall or suitable outdoor lane, with full deceleration distance. ${plan.note}`.slice(0, 500) })) setLocationMessage('Acceleration remains planned at a suitable location. Record only efforts actually performed.'); }}>Perform acceleration elsewhere</button><button type="button" className="text-button" disabled={locked} onClick={async () => { if (await commit({ ...plan, name: `Modified — ${plan.name.replace(/^Modified — /, '')}`.slice(0, 80), exercises: plan.exercises.filter(exercise => exercise.prescribedDistanceM == null), note: `Modified for this date: acceleration omitted because no suitable sprint lane is available. No replacement work was added. ${plan.note}`.slice(0, 500) })) setLocationMessage('Acceleration omitted for this date. Other prescribed work stays; the weekly base is unchanged.'); }}>Omit acceleration for this date</button>{locationMessage && <p role="status">{locationMessage}</p>}</details>}
          {!viewingBase && <button type="button" className="text-button plan-preview__add" disabled={locked || plan.exercises.length >= 40} onClick={() => { setReplaceKey(null); setLibraryOpen(true); }}><Plus size={19} aria-hidden="true" />Add exercise</button>}
        </section>
        <div className="plan-preview__start">
          {error && <p className="plan-preview__error" role="alert">{error}</p>}
          <button type="button" className="btn full" disabled={locked || (!plan.exercises.some(exercise => !exercise.optionalWork) && plan.kind !== 'recovery')} onClick={() => { onOpenChange(false); onStart(); }}>{viewingBase || hasBaseDifference ? 'Start recommended workout' : 'Start workout'}</button>
          <span>{viewingBase || hasBaseDifference ? `Starts ${plan.name} · ${recommendation.mandatoryExercises} exercises · ${recommendation.workingSets} sets.` : isGentleV9MatchPrimer(plan) ? 'The primer is your preparation. Record only what you perform.' : 'Warm up first. Your workout starts when you’re ready.'}</span>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={open && Boolean(menuExercise)} onOpenChange={(next: boolean) => { if (!next && !busy) { setMenuKey(null); setEditor(null); } }}>
      <DialogContent className="app-dialog plan-exercise-options-sheet">
        <DialogHeader className=""><DialogTitle className="">{editor ? 'Edit exercise' : menuExercise?.name}</DialogTitle><DialogDescription className="">For {dayLabel} only</DialogDescription></DialogHeader>
        {menuExercise && (editor ? <form className="plan-preview__editor" onSubmit={event => { event.preventDefault(); void savePrescription(); }}>
          <fieldset disabled={locked}>
            <div className="plan-preview__fields">
              <label className="field-label">Sets<input type="number" inputMode="numeric" min={1} max={20} value={Number.isFinite(editor.sets) ? editor.sets : ''} onChange={event => setEditor({ ...editor, sets: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /></label>
              {editor.prescribedDistanceM != null ? <label className="field-label">Distance per effort · metres<input type="number" inputMode="numeric" min={1} max={1000} step={1} value={Number.isFinite(editor.prescribedDistanceM) ? editor.prescribedDistanceM : ''} onChange={event => {
                const value = event.target.value === '' ? Number.NaN : Number(event.target.value);
                setEditor({ ...editor, prescribedDistanceM: value, target: event.target.value === '' ? '' : `${event.target.value} m` });
              }} /></label> : <label className="field-label">{editor.quantityUnit === 'm' ? 'Distance target · metres' : editor.mode === 'timed' ? 'Time target' : 'Reps / time'}<input maxLength={60} value={editor.target} autoComplete="off" onChange={event => setEditor({ ...editor, target: event.target.value })} /></label>}
              {editor.mode !== 'timed' && !editor.measurement && editor.quantityUnit !== 'm' && <label className="field-label">Planned weight · kg<DecimalWeightInput value={editor.defaultKg ?? null} label={`${editor.name} planned weight in kilograms`} placeholder={editor.mode === 'bodyweight' ? 'BW' : 'Optional'} onValidityChange={setWeightValid} onChange={(value, valid) => { setEditor({ ...editor, defaultKg: value }); setWeightValid(valid); }} /></label>}
              <label className="field-label">{editor.superset ? 'Rest after pair · seconds' : 'Rest · seconds'}<input type="number" inputMode="numeric" min={0} max={600} step={15} value={Number.isFinite(editor.superset?.restAfterRound ?? editor.rest) ? editor.superset?.restAfterRound ?? editor.rest : ''} onChange={event => {
                const rest = event.target.value === '' ? Number.NaN : Number(event.target.value);
                setEditor(editor.superset ? { ...editor, restRange: undefined, superset: { ...editor.superset, restAfterRound: rest } } : { ...editor, rest, restRange: undefined });
              }} /></label>
            </div>
            <details className="plan-preview__more"><summary>More options</summary><label className="field-label">Equipment label · optional<input maxLength={80} value={editor.equipmentLabel ?? ''} autoComplete="off" placeholder="e.g. Technogym Chest Press" onChange={event => setEditor({ ...editor, equipmentLabel: event.target.value || undefined })} /></label><label className="field-label">Target RPE<input type="number" inputMode="decimal" min={1} max={10} step={0.5} placeholder="Optional" value={editor.targetRpe ?? ''} onChange={event => setEditor({ ...editor, targetRpe: event.target.value === '' ? undefined : Number(event.target.value), targetRir: undefined })} /></label><label className="field-label">Target RIR<input type="number" inputMode="decimal" min={0} max={10} step={0.5} placeholder="Optional" value={editor.targetRir ?? ''} onChange={event => setEditor({ ...editor, targetRir: event.target.value === '' ? undefined : Number(event.target.value), targetRpe: undefined })} /></label><label className="field-label">Notes<textarea rows={2} maxLength={500} value={editor.cue ?? ''} onChange={event => setEditor({ ...editor, cue: event.target.value })} /></label></details>
          </fieldset>
          {editError && <p className="plan-preview__error" role="alert">{editError}</p>}
          <button type="submit" className="btn full" disabled={locked || !weightValid}>{busy ? 'Saving…' : 'Save for this day'}</button>
          <button type="button" className="text-button" disabled={busy} onClick={() => setEditor(null)}>Back to options</button>
        </form> : <div className="plan-preview__menu">
          <button type="button" disabled={locked} onClick={() => { setGuide(menuExercise); setMenuKey(null); }}><span>Technique & alternatives</span><ChevronRight size={18} aria-hidden="true" /></button>
          <button type="button" disabled={locked} onClick={() => { setEditor(structuredClone(menuExercise)); setWeightValid(true); setEditError(''); }}><span>Sets, reps & rest</span><ChevronRight size={18} aria-hidden="true" /></button>
          <button type="button" disabled={locked} onClick={() => { setReplaceKey(menuExercise.key); setMenuKey(null); setLibraryOpen(true); }}><span>Replace exercise</span><RefreshCw size={18} aria-hidden="true" /></button>
          <div className="plan-preview__reorder"><span>Move exercise</span><button type="button" className="icon-button" aria-label={`Move ${menuExercise.name} up`} disabled={locked || workingExercises[0]?.key === menuExercise.key} onClick={() => void move(-1)}><ArrowUp size={20} aria-hidden="true" /></button><button type="button" className="icon-button" aria-label={`Move ${menuExercise.name} down`} disabled={locked || workingExercises.at(-1)?.key === menuExercise.key} onClick={() => void move(1)}><ArrowDown size={20} aria-hidden="true" /></button></div>
          <button type="button" className="plan-preview__remove" disabled={locked} onClick={async () => { if (await commit(removePlanExercise(plan, menuExercise.key))) setMenuKey(null); }}><span>Remove exercise</span><Trash2 size={18} aria-hidden="true" /></button>
          {editError && <p className="plan-preview__error" role="alert">{editError}</p>}
        </div>)}
      </DialogContent>
    </Dialog>
    <ExerciseLibrarySheet open={open && libraryOpen} onOpenChange={setLibraryOpen} onSelect={item => void chooseExercise(item)} replacementFor={replacement} title={replaceKey ? 'Replace exercise' : 'Add exercise'} />
    {guide && <ExerciseGuideSheet exercise={guide} open={open && Boolean(guide)} onOpenChange={next => { if (!next) setGuide(null); }} onCloseAutoFocus={event => { event.preventDefault(); rowTrigger.current?.focus({ preventScroll: true }); }}><PreviewSessionDetails exercise={guide} /></ExerciseGuideSheet>}
  </>;
}
