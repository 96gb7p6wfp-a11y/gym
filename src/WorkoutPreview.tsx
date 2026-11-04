import { useId, useRef, useState } from 'react';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { ExerciseGuideSheet } from './ExerciseGuide';
import type { PlanExercise } from './workout-customization';
import './workout-preview.css';

/** Rest labels describe the saved configuration without changing the prescription. */
export function previewRestLabel(exercise: PlanExercise): string {
  if (exercise.superset) return `${exercise.superset.restAfterRound} sec after pair`;
  return exercise.rest > 0 ? `${exercise.rest} sec rest` : 'No timed rest';
}

/** Saved, session-specific guidance stays available alongside the library technique. */
export function PreviewSessionDetails({ exercise }: { exercise: PlanExercise }) {
  return <section className="preview-session-details" aria-label="Saved session details">
    <h3>Your session</h3>
    <p>{exercise.sets} × {exercise.target}{exercise.perSide ? ' / side' : ''}{exercise.defaultKg != null ? ` · ${exercise.defaultKg} kg` : ''} · {previewRestLabel(exercise)}</p>
    {exercise.equipmentLabel && <p>Equipment · {exercise.equipmentLabel}</p>}
    {exercise.superset ? <p>Superset {exercise.superset.label} · follow the prescribed sequence.</p>
      : /complex pair/i.test(exercise.group) && <p>{exercise.group} · follow the prescribed sequence.</p>}
    {exercise.targetRpe != null && <p>Target RPE {exercise.targetRpe}</p>}
    {exercise.benefit && <p>{exercise.benefit}</p>}
    {exercise.cue && <p className="preview-session-details__note">{exercise.cue}</p>}
  </section>;
}

/** Read-only session sequence. Editing and starting a workout stay explicit. */
export function WorkoutPreview({ exercises, previous }: {
  exercises: PlanExercise[];
  previous: (exercise: PlanExercise) => string | undefined;
}) {
  const [selected, setSelected] = useState<PlanExercise | null>(null);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const working = exercises.filter(exercise => exercise.optionalWork !== true);
  const optional = exercises.filter(exercise => exercise.optionalWork === true);

  if (!exercises.length) return <div className="empty-state">
    <Dumbbell aria-hidden="true" />
    <h3>No exercises yet</h3>
    <p>Edit this day to add your movements.</p>
  </div>;

  const last = selected ? previous(selected) : undefined;
  return <>
    <ol className="workout-preview" aria-label="Planned exercises">
      {working.map((exercise, index) => <li className="workout-preview__item" key={exercise.key}>
        <button className="workout-preview__row" type="button"
          aria-label={`Exercise details for ${exercise.name}`} aria-haspopup="dialog"
          aria-expanded={open && selected?.key === exercise.key}
          aria-describedby={`${id}-${index}-dose`}
          onClick={event => { trigger.current = event.currentTarget; setSelected(exercise); setOpen(true); }}>
          <span className="workout-preview__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span className="workout-preview__copy">
            <strong>{exercise.name}</strong>
            <span className="workout-preview__dose" id={`${id}-${index}-dose`}>{exercise.sets} × {exercise.target}{exercise.perSide ? ' / side' : ''} · {previewRestLabel(exercise)}</span>
            {exercise.equipmentLabel && <span className="workout-preview__equipment">{exercise.equipmentLabel}</span>}
            {exercise.superset ? <span className="workout-preview__pair">Superset {exercise.superset.label}</span>
              : /complex pair/i.test(exercise.group) && <span className="workout-preview__pair">{exercise.group}</span>}
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </li>)}
    </ol>
    {optional.length > 0 && <details className="workout-preview__optional"><summary>Optional work<span>{optional.length}</span></summary><p>Use View workout to include optional movements for this date.</p>{optional.map(exercise => <button type="button" key={exercise.key} onClick={event => { trigger.current = event.currentTarget; setSelected(exercise); setOpen(true); }}><span>{exercise.name}</span><small>{exercise.sets} × {exercise.target}</small><ChevronRight size={15} aria-hidden="true" /></button>)}</details>}
    {selected && <ExerciseGuideSheet exercise={selected} open={open} onOpenChange={setOpen}
      onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }}>
      <PreviewSessionDetails exercise={selected} />
      {last && <div className="workout-preview__previous"><span>Previous</span><strong>{last}</strong></div>}
    </ExerciseGuideSheet>}
  </>;
}
