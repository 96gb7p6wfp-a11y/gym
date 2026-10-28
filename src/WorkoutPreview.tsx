import { useId, useRef, useState } from 'react';
import { ChevronRight, Dumbbell } from 'lucide-react';
import { ExerciseGuideSheet } from './ExerciseGuide';
import { findLibraryExercise } from './exercise-library';
import type { PlanExercise } from './workout-customization';
import './workout-preview.css';

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
          aria-describedby={`${id}-${index}-purpose ${id}-${index}-dose`}
          onClick={event => { trigger.current = event.currentTarget; setSelected(exercise); setOpen(true); }}>
          <span className="workout-preview__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span className="workout-preview__copy">
            <strong>{exercise.name}</strong>
            <span id={`${id}-${index}-purpose`}>{exercise.benefit ?? findLibraryExercise(exercise)?.primaryBenefit ?? exercise.group}</span>
          </span>
          <span className="workout-preview__dose" id={`${id}-${index}-dose`}>
            <strong>{exercise.sets} {exercise.sets === 1 ? 'set' : 'sets'}</strong>
            <span>{exercise.target}{exercise.perSide ? ' / side' : ''}</span>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </li>)}
    </ol>
    {optional.length > 0 && <details className="workout-preview__optional"><summary>Optional work<span>{optional.length}</span></summary><p>Use View workout to include optional movements for this date.</p>{optional.map(exercise => <button type="button" key={exercise.key} onClick={event => { trigger.current = event.currentTarget; setSelected(exercise); setOpen(true); }}><span>{exercise.name}</span><small>{exercise.sets} × {exercise.target}</small><ChevronRight size={15} aria-hidden="true" /></button>)}</details>}
    {selected && <ExerciseGuideSheet exercise={selected} open={open} onOpenChange={setOpen}
      onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }}>
      {last && <div className="workout-preview__previous"><span>Previous</span><strong>{last}</strong></div>}
    </ExerciseGuideSheet>}
  </>;
}
