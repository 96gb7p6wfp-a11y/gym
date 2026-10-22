import { useEffect, useRef, useState } from 'react';
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
import { getWarmupPresentation } from './session-preparation';
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
}

/** This editor only changes the selected day's plan. It never creates a session. */
export function WorkoutPlanPreview({ open, onOpenChange, plan, dayLabel, warmup, disabled = false, onChange, onStart }: WorkoutPlanPreviewProps) {
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [guide, setGuide] = useState<PlanExercise | null>(null);
  const [editor, setEditor] = useState<PlanExercise | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [replaceKey, setReplaceKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [weightValid, setWeightValid] = useState(true);
  const committing = useRef(false);
  const previousOpen = useRef(false);
  const rowTrigger = useRef<HTMLButtonElement | null>(null);
  const menuExercise = plan.exercises.find(exercise => exercise.key === menuKey);
  const replacement = plan.exercises.find(exercise => exercise.key === replaceKey);
  const purpose = getSessionPurpose(plan);
  const preparation = getWarmupPresentation(plan);
  const workingSets = plan.exercises.reduce((count, exercise) => count + exercise.sets, 0);
  const locked = disabled || busy;

  useEffect(() => {
    if (open && !previousOpen.current) {
      setMenuKey(null); setGuide(null); setEditor(null); setLibraryOpen(false); setReplaceKey(null); setError(''); setEditError('');
    }
    previousOpen.current = open;
  }, [open]);

  async function commit(next: PlanDay): Promise<boolean> {
    if (disabled || committing.current) return false;
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
    setMenuKey(exercise.key); setEditor(null); setEditError(''); setWeightValid(true);
  }
  async function chooseExercise(item: LibraryExercise) {
    const next = replaceKey ? replacePlanExercise(plan, replaceKey, toPlanExercise(item)) : addPlanExercise(plan, toPlanExercise(item));
    if (await commit(next)) { setReplaceKey(null); setMenuKey(null); }
  }
  async function move(offset: -1 | 1) {
    if (!menuExercise) return;
    const index = plan.exercises.findIndex(exercise => exercise.key === menuExercise.key);
    await commit(movePlanExercise(plan, menuExercise.key, index + offset));
  }
  async function savePrescription() {
    if (!editor || !weightValid) { setEditError('Check the planned weight before saving.'); return; }
    const checked = ExerciseSchema.safeParse(editor);
    if (!checked.success) {
      const field = checked.error.issues[0]?.path.at(-1);
      setEditError(field === 'sets' ? 'Use 1–20 working sets.' : field === 'target' ? 'Keep the rep target under 60 characters.' : field === 'rest' ? 'Use 0–600 seconds of rest.' : field === 'targetRpe' ? 'Use a target RPE between 1 and 10.' : 'Check the exercise details before saving.');
      return;
    }
    if (!editor.target.trim()) { setEditError('Enter a rep or time target.'); return; }
    const exercises = plan.exercises.map(exercise => exercise.key === editor.key ? checked.data : exercise);
    if (await commit({ ...plan, exercises })) { setEditor(null); setMenuKey(null); }
  }

  return <>
    <Dialog open={open} onOpenChange={(next: boolean) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="app-dialog workout-plan-preview-sheet" aria-label="Workout preview" aria-labelledby={undefined}>
        <DialogHeader className="plan-preview__header">
          <p className="eyebrow">Workout preview · {dayLabel}</p>
          <DialogTitle className="">{plan.name}</DialogTitle>
          <DialogDescription className="">{purpose.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="plan-preview__metadata"><div className="plan-preview__summary"><span><Clock3 size={15} aria-hidden="true" />About {plan.minutes} min</span><span>{plan.exercises.length} exercises · {workingSets} sets</span></div>
        <p className="plan-preview__scope">For {dayLabel} only. Weekly plan unchanged.</p></div>
        <details className="plan-preview__warmup">
          <summary><span><strong>Warm-up</strong><span>{preparation.duration} · {warmup.length} movements</span></span><ChevronRight size={19} aria-hidden="true" /></summary>
          <ol aria-label="Preview warm-up exercises">{warmup.map(step => <li key={step.key}><strong>{step.name}</strong><span>{step.target}</span><p>{step.cue}</p></li>)}</ol>
        </details>
        <section className="plan-preview__main" aria-label="Main workout">
          <h3>Main workout</h3>
          {plan.exercises.length > 0 ? <ol className="plan-preview__list" aria-label="Scheduled exercises">
            {plan.exercises.map((exercise, index) => <li key={exercise.key} className="plan-preview__exercise">
              <button type="button" className="plan-preview__exercise-main" aria-label={`Exercise details for ${exercise.name}`} aria-haspopup="dialog" onClick={event => { rowTrigger.current = event.currentTarget; setGuide(exercise); }}>
                <span className="plan-preview__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="plan-preview__exercise-copy"><strong>{exercise.name}</strong><span>{findLibraryExercise(exercise)?.primaryBenefit ?? exercise.group}</span><span className="plan-preview__dose">{exercise.sets} × {exercise.target}{exercise.perSide ? ' / side' : ''}{exercise.defaultKg != null ? ` · ${exercise.defaultKg} kg` : ''}<span>{exercise.rest > 0 ? `${exercise.rest} sec rest` : 'No timed rest'}</span></span></span>
              </button>
              <button type="button" className="icon-button plan-preview__options" aria-label={`Options for ${exercise.name}`} aria-haspopup="dialog" disabled={locked} onClick={() => openOptions(exercise)}><MoreHorizontal size={22} aria-hidden="true" /></button>
            </li>)}
          </ol> : <p className="plan-preview__empty">{plan.kind === 'recovery' ? 'An easy day. View your preparation above, then start your mobility routine.' : 'Add a movement to prepare your session.'}</p>}
          <button type="button" className="text-button plan-preview__add" disabled={locked || plan.exercises.length >= 40} onClick={() => { setReplaceKey(null); setLibraryOpen(true); }}><Plus size={19} aria-hidden="true" />Add exercise</button>
        </section>
        <div className="plan-preview__start">
          {error && <p className="plan-preview__error" role="alert">{error}</p>}
          <button type="button" className="btn full" disabled={locked || (!plan.exercises.length && plan.kind !== 'recovery')} onClick={() => { onOpenChange(false); onStart(); }}>Start workout</button>
          <span>Warm up first. Your workout starts when you’re ready.</span>
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
              <label className="field-label">Reps / time<input maxLength={60} value={editor.target} autoComplete="off" onChange={event => setEditor({ ...editor, target: event.target.value })} /></label>
              {editor.mode !== 'timed' && !editor.measurement && <label className="field-label">Planned weight · kg<DecimalWeightInput value={editor.defaultKg ?? null} label={`${editor.name} planned weight in kilograms`} placeholder={editor.mode === 'bodyweight' ? 'BW' : 'Optional'} onValidityChange={setWeightValid} onChange={(value, valid) => { setEditor({ ...editor, defaultKg: value }); setWeightValid(valid); }} /></label>}
              <label className="field-label">Rest · seconds<input type="number" inputMode="numeric" min={0} max={600} step={15} value={Number.isFinite(editor.rest) ? editor.rest : ''} onChange={event => setEditor({ ...editor, rest: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /></label>
            </div>
            <details className="plan-preview__more"><summary>More options</summary><label className="field-label">Target RPE<input type="number" inputMode="decimal" min={1} max={10} step={0.5} placeholder="Optional" value={editor.targetRpe ?? ''} onChange={event => setEditor({ ...editor, targetRpe: event.target.value === '' ? undefined : Number(event.target.value) })} /></label><label className="field-label">Notes<textarea rows={2} maxLength={500} value={editor.cue ?? ''} onChange={event => setEditor({ ...editor, cue: event.target.value })} /></label></details>
          </fieldset>
          {editError && <p className="plan-preview__error" role="alert">{editError}</p>}
          <button type="submit" className="btn full" disabled={locked || !weightValid}>{busy ? 'Saving…' : 'Save for this day'}</button>
          <button type="button" className="text-button" disabled={busy} onClick={() => setEditor(null)}>Back to options</button>
        </form> : <div className="plan-preview__menu">
          <button type="button" disabled={locked} onClick={() => { setGuide(menuExercise); setMenuKey(null); }}><span>Technique & alternatives</span><ChevronRight size={18} aria-hidden="true" /></button>
          <button type="button" disabled={locked} onClick={() => { setEditor(structuredClone(menuExercise)); setWeightValid(true); setEditError(''); }}><span>Sets, reps & rest</span><ChevronRight size={18} aria-hidden="true" /></button>
          <button type="button" disabled={locked} onClick={() => { setReplaceKey(menuExercise.key); setMenuKey(null); setLibraryOpen(true); }}><span>Replace exercise</span><RefreshCw size={18} aria-hidden="true" /></button>
          <div className="plan-preview__reorder"><span>Move exercise</span><button type="button" className="icon-button" aria-label={`Move ${menuExercise.name} up`} disabled={locked || plan.exercises[0]?.key === menuExercise.key} onClick={() => void move(-1)}><ArrowUp size={20} aria-hidden="true" /></button><button type="button" className="icon-button" aria-label={`Move ${menuExercise.name} down`} disabled={locked || plan.exercises.at(-1)?.key === menuExercise.key} onClick={() => void move(1)}><ArrowDown size={20} aria-hidden="true" /></button></div>
          <button type="button" className="plan-preview__remove" disabled={locked} onClick={async () => { if (await commit(removePlanExercise(plan, menuExercise.key))) setMenuKey(null); }}><span>Remove exercise</span><Trash2 size={18} aria-hidden="true" /></button>
          {editError && <p className="plan-preview__error" role="alert">{editError}</p>}
        </div>)}
      </DialogContent>
    </Dialog>
    <ExerciseLibrarySheet open={open && libraryOpen} onOpenChange={setLibraryOpen} onSelect={item => void chooseExercise(item)} replacementFor={replacement} title={replaceKey ? 'Replace exercise' : 'Add exercise'} />
    {guide && <ExerciseGuideSheet exercise={guide} open={open && Boolean(guide)} onOpenChange={next => { if (!next) setGuide(null); }} onCloseAutoFocus={event => { event.preventDefault(); rowTrigger.current?.focus({ preventScroll: true }); }} />}
  </>;
}
