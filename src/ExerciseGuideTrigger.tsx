import { lazy, Suspense, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { GuideExercise } from './exercise-guides';
import './exercise-guides.css';

export interface ExerciseGuideProps {
  exercise: GuideExercise;
  compact?: boolean;
}

const ExerciseGuideSheet = lazy(() => import('./ExerciseGuide').then(module => ({ default: module.ExerciseGuideSheet })));

/** A workout's optional guide must not hold up its essential logging controls. */
export function ExerciseGuide({ exercise, compact = false }: ExerciseGuideProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <div className={`exercise-guide${compact ? ' exercise-guide--compact' : ''}`}>
    <button ref={trigger} type="button" className="exercise-guide__trigger" aria-label={`Exercise details for ${exercise.name}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Exercise details<ChevronRight size={17} aria-hidden="true" /></button>
    {open && <Suspense fallback={<p className="small-note" role="status">Loading exercise guide…</p>}>
      <ExerciseGuideSheet exercise={exercise} open={open} onOpenChange={setOpen} onCloseAutoFocus={(event: Event) => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }} />
    </Suspense>}
  </div>;
}

export default ExerciseGuide;
