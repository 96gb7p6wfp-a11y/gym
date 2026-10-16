import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { DecimalWeightInput } from './DecimalWeightInput';
import { PlanDaySchema } from './domain.js';
import { addPlanExercise, movePlanExercise, removePlanExercise, replacePlanExercise, type CustomWorkout, type PlanDay, type PlanExercise, type TrainingGoal } from './workout-customization';
import { ExerciseLibrarySheet } from './ExerciseLibrarySheet';
import { toPlanExercise } from './exercise-library';
import './workout-builder.css';

export const WORKOUT_GOALS: { value: TrainingGoal; label: string }[] = [
  { value: 'strength', label: 'Strength' }, { value: 'hypertrophy', label: 'Muscle development' },
  { value: 'power', label: 'Power' }, { value: 'jump', label: 'Jump performance' },
  { value: 'mobility', label: 'Mobility' }, { value: 'recovery', label: 'Recovery' },
  { value: 'capacity', label: 'Athletic capacity' }, { value: 'sport', label: 'Volleyball' },
];

type WorkoutBuilderProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialWorkout?: PlanDay | CustomWorkout | null;
  onSave: (workout: PlanDay) => Promise<boolean | void> | boolean | void;
  title?: string;
  submitLabel?: string;
};

function blankWorkout(): PlanDay {
  return { name: '', goal: 'strength', kind: 'strength', minutes: 45, note: '', exercises: [] };
}

/** A draft-only editor. Nothing reaches the saved plan until Save succeeds. */
export function WorkoutBuilder({ open, onOpenChange, initialWorkout, onSave, title = 'Create workout', submitLabel = 'Save workout' }: WorkoutBuilderProps) {
  const [draft, setDraft] = useState<PlanDay>(blankWorkout);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wasOpen = useRef(false);
  const invalidWeights = useRef(new Set<string>());
  const formId = useId();

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(initialWorkout ? structuredClone(initialWorkout) : blankWorkout());
      setEditingIndex(null); setLibraryOpen(false); setReplaceIndex(null); setError('');
      invalidWeights.current.clear();
    }
    wasOpen.current = open;
  }, [open, initialWorkout]);

  function patchExercise(index: number, patch: Partial<PlanExercise>) {
    setDraft(current => ({ ...current, exercises: current.exercises.map((exercise, i) => i === index ? { ...exercise, ...patch } : exercise) }));
    setError('');
  }

  function moveExercise(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= draft.exercises.length) return;
    setDraft(current => movePlanExercise(current, current.exercises[index].key, target));
    setEditingIndex(target);
  }

  function selectExercise(exercise: PlanExercise) {
    setDraft(current => {
      if (replaceIndex !== null) {
        invalidWeights.current.delete(current.exercises[replaceIndex].key);
        return replacePlanExercise(current, current.exercises[replaceIndex].key, exercise);
      }
      return addPlanExercise(current, exercise);
    });
    setEditingIndex(replaceIndex ?? draft.exercises.length);
    setLibraryOpen(false); setReplaceIndex(null); setError('');
  }

  async function save() {
    if (busy) return;
    setError('');
    if (invalidWeights.current.size) { setEditingIndex(draft.exercises.findIndex(exercise => invalidWeights.current.has(exercise.key))); setError('Check the starting weight. Use 0–2,000 kg.'); return; }
    const checked = PlanDaySchema.safeParse({ ...draft, name: draft.name.trim() });
    if (!checked.success) {
      const issue = checked.error.issues[0];
      const field = issue.path.at(-1);
      setError(field === 'name' ? 'Give your workout a name.' : field === 'sets' ? 'Use 1–20 sets per exercise.' : field === 'rest' ? 'Use a rest time from 0–600 seconds.' : field === 'targetRpe' ? 'Use a target RPE from 1–10, or leave it empty.' : 'Check the workout details before saving.');
      return;
    }
    if (!draft.exercises.length && draft.kind !== 'recovery') { setError('Add an exercise to your workout.'); return; }
    setBusy(true);
    try {
      // Preserve valid day metadata such as a separately scheduled primer.
      const result = await onSave({ ...draft, ...checked.data });
      if (result === false) throw new Error('Could not save this workout. Try again.');
      onOpenChange(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this workout. Try again.'); }
    finally { setBusy(false); }
  }

  return <>
    <Dialog open={open} onOpenChange={(next: boolean) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="app-dialog workout-builder-sheet">
        <DialogHeader className="">
          <DialogTitle className="">{title}</DialogTitle>
          <DialogDescription className="">Make it yours. Saved workout history stays unchanged.</DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={event => { event.preventDefault(); void save(); }} className="workout-builder">
          <fieldset disabled={busy} className="builder-fields">
            <div className="builder-basics">
              <label className="field-label">Workout name<input autoComplete="off" maxLength={80} value={draft.name} placeholder="Extra upper, jump session…" onChange={event => { setDraft(current => ({ ...current, name: event.target.value })); setError(''); }} /></label>
              <label className="field-label">Training goal<select value={draft.goal ?? ''} onChange={event => setDraft(current => ({ ...current, goal: event.target.value as TrainingGoal }))}>{!draft.goal && <option value="">Recommended session purpose</option>}{WORKOUT_GOALS.map(goal => <option key={goal.value} value={goal.value}>{goal.label}</option>)}</select></label>
            </div>

            <div className="builder-section-heading"><h3>Exercises</h3><span>{draft.exercises.length} movements</span></div>
            {draft.exercises.length === 0 && <p className="builder-empty">Choose the movements that fit your session.</p>}
            <ol className="builder-exercises">
              {draft.exercises.map((exercise, index) => {
                const expanded = editingIndex === index;
                return <li key={exercise.key} className={expanded ? 'is-editing' : ''}>
                  <button className="builder-exercise-row" type="button" aria-label={`Edit ${exercise.name}`} aria-expanded={expanded} onClick={() => setEditingIndex(expanded ? null : index)}>
                    <span className="builder-exercise-order">{index + 1}</span>
                    <span className="builder-exercise-copy"><strong>{exercise.name}</strong><span>{exercise.sets} × {exercise.target}{exercise.perSide ? ' / side' : ''}</span></span>
                    {expanded ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
                  </button>
                  {expanded && <div className="builder-exercise-edit">
                    <div className="builder-prescription-grid">
                      <label className="field-label">Sets<input type="number" inputMode="numeric" min={1} max={20} value={Number.isFinite(exercise.sets) ? exercise.sets : ''} onChange={event => patchExercise(index, { sets: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /></label>
                      <label className="field-label">Target<input maxLength={60} value={exercise.target} placeholder={exercise.mode === 'timed' ? '20 sec' : '8–12 reps'} onChange={event => patchExercise(index, { target: event.target.value })} /></label>
                      {exercise.mode !== 'timed' && !exercise.measurement && <label className="field-label">Starting weight · kg<DecimalWeightInput value={exercise.defaultKg ?? null} placeholder={exercise.mode === 'bodyweight' ? 'BW' : 'Optional'} label={`${exercise.name} starting weight in kilograms`} onValidityChange={() => { /* Keep invalid drafts blocked even when a row collapses. */ }} onChange={(defaultKg, valid) => { patchExercise(index, { defaultKg }); valid ? invalidWeights.current.delete(exercise.key) : invalidWeights.current.add(exercise.key); }} /></label>}
                      <label className="field-label">Rest · sec<input type="number" inputMode="numeric" min={0} max={600} step={15} value={Number.isFinite(exercise.rest) ? exercise.rest : ''} onChange={event => patchExercise(index, { rest: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /></label>
                    </div>
                    <details className="builder-exercise-options">
                      <summary>More options</summary>
                      <div className="builder-prescription-grid">
                        <label className="field-label">Movement<input maxLength={120} value={exercise.name} onChange={event => patchExercise(index, { name: event.target.value })} /></label>
                        <label className="field-label">Target RPE<input type="number" inputMode="decimal" min={1} max={10} step={0.5} placeholder="Optional" value={exercise.targetRpe ?? ''} onChange={event => patchExercise(index, { targetRpe: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
                        <label className="field-label">Logging<select value={exercise.mode} onChange={event => patchExercise(index, { mode: event.target.value as PlanExercise['mode'], quantityUnit: undefined })}><option value="weight">Weight + reps</option><option value="bodyweight">Bodyweight + reps</option><option value="timed">Time</option></select></label>
                      </div>
                      <label className="field-label">Technique / pairing notes<textarea maxLength={500} rows={2} value={exercise.cue ?? ''} onChange={event => patchExercise(index, { cue: event.target.value })} /></label>
                      <label className="builder-check"><input type="checkbox" checked={exercise.perSide} onChange={event => patchExercise(index, { perSide: event.target.checked })} />Reps / time are per side</label>
                    </details>
                    <div className="builder-exercise-actions">
                      <button className="text-button" type="button" onClick={() => { setReplaceIndex(index); setLibraryOpen(true); }}><RefreshCw size={16} /> Replace</button>
                      <div className="builder-order-actions"><button className="icon-button" type="button" aria-label={`Move ${exercise.name} up`} disabled={index === 0} onClick={() => moveExercise(index, -1)}><ArrowUp size={18} /></button><button className="icon-button" type="button" aria-label={`Move ${exercise.name} down`} disabled={index === draft.exercises.length - 1} onClick={() => moveExercise(index, 1)}><ArrowDown size={18} /></button></div>
                      <button className="icon-button builder-remove" type="button" aria-label={`Remove ${exercise.name}`} onClick={() => { invalidWeights.current.delete(exercise.key); setDraft(current => removePlanExercise(current, exercise.key)); setEditingIndex(null); }}><Trash2 size={17} /></button>
                    </div>
                  </div>}
                </li>;
              })}
            </ol>
            <button className="btn secondary full builder-add" type="button" disabled={draft.exercises.length >= 40} onClick={() => { setReplaceIndex(null); setLibraryOpen(true); }}><Plus size={18} /> Add exercise</button>
            <details className="builder-session-options"><summary>Session details</summary><div className="builder-prescription-grid"><label className="field-label">Planned minutes<input type="number" inputMode="numeric" min={1} max={600} value={Number.isFinite(draft.minutes) ? draft.minutes : ''} onChange={event => setDraft(current => ({ ...current, minutes: event.target.value === '' ? Number.NaN : Number(event.target.value) }))} /></label><label className="field-label">Session type<select value={draft.kind} onChange={event => setDraft(current => ({ ...current, kind: event.target.value as PlanDay['kind'] }))}><option value="strength">Gym</option><option value="sport">Volleyball</option><option value="recovery">Recovery</option></select></label></div><label className="field-label">Session note<textarea maxLength={500} rows={2} value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} /></label></details>
          </fieldset>
          <div className="builder-save">
            {error && <p className="builder-error" role="alert">{error}</p>}
            <button className="btn full" type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <ExerciseLibrarySheet open={open && libraryOpen} onOpenChange={setLibraryOpen} onSelect={item => selectExercise(toPlanExercise(item))} replacementFor={replaceIndex === null ? undefined : draft.exercises[replaceIndex]} title={replaceIndex === null ? 'Add exercise' : 'Replace exercise'} />
  </>;
}

export default WorkoutBuilder;
