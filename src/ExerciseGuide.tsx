import { useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { getExerciseGuide, type GuideExercise } from './exercise-guides';
import { findLibraryExercise, rankAlternatives } from './exercise-library';
import './exercise-guides.css';

export interface ExerciseGuideProps {
  exercise: GuideExercise;
  compact?: boolean;
}

/** A shared sheet lets compact exercise rows open the complete existing guide. */
export function ExerciseGuideSheet({ exercise, open, onOpenChange, onCloseAutoFocus, children }: {
  exercise: GuideExercise;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  children?: ReactNode;
}) {
  const movement = findLibraryExercise({ name: exercise.name, key: exercise.key });
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="app-dialog exercise-guide-sheet" onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader className="exercise-guide__header">
        <DialogDescription className="exercise-guide__category">{movement?.category ?? exercise.group ?? 'Exercise guide'}</DialogDescription>
        <DialogTitle className="exercise-guide__title">{exercise.name}</DialogTitle>
      </DialogHeader>
      {children}
      <ExerciseGuideBody key={exercise.name} exercise={exercise} />
    </DialogContent>
  </Dialog>;
}

/** Shared by workout details and the library, without nesting another sheet. */
export function ExerciseGuideBody({ exercise }: { exercise: GuideExercise }) {
  const guide = getExerciseGuide(exercise);
  // A renamed saved movement must not inherit guidance from an unrelated key.
  const movement = findLibraryExercise({ name: exercise.name, key: exercise.key });
  const [section, setSection] = useState<'technique' | 'alternatives'>('technique');
  const [loadingOpen, setLoadingOpen] = useState(false);
  const swaps = movement ? rankAlternatives(movement.id, 4) : [];
  const steps = guide.isGeneric && movement ? movement.cues : guide.steps;
  const mistakes = guide.isGeneric && movement ? movement.mistakes : guide.mistakes;
  const intent = movement && (['Power', 'Plyometric', 'Speed'].includes(movement.category)
    ? 'Move explosively. Stop when speed or jump quality drops.'
    : movement.category === 'Hypertrophy' ? 'Controlled reps. Use your full comfortable range.'
    : movement.category === 'Strength' ? 'Controlled lowering. A strong, clean return.'
    : movement.category === 'Mobility' || movement.category === 'Recovery' ? 'Move gently. Keep breathing.'
    : 'Stay steady. Keep your ribs and pelvis controlled.');

  return <div className="exercise-guide__content">
    {movement ? <dl className="exercise-guide__overview">
      <div><dt>Targets</dt><dd>{movement.muscles.join(' · ')}</dd></div>
      <div><dt>Improves</dt><dd>{movement.primaryBenefit}<span>{movement.secondaryBenefit}</span></dd></div>
      <div><dt>Intent</dt><dd>{intent}</dd></div>
    </dl> : (exercise.group || exercise.cue) && <div className="exercise-guide__intro">
      {exercise.group && <span>{exercise.group}</span>}
      {exercise.cue && <p>{exercise.cue}</p>}
    </div>}
    <div className="exercise-guide__sections" role="group" aria-label={`Guide sections for ${exercise.name}`}>
      <button type="button" aria-pressed={section === 'technique'} onClick={() => setSection('technique')}>Technique</button>
      <button type="button" aria-pressed={section === 'alternatives'} onClick={() => setSection('alternatives')}>Alternatives</button>
    </div>
    {section === 'alternatives' ? <div className="exercise-guide__alternatives">
      {swaps.length ? <>
        <p>Similar purpose. Choose what fits your equipment and recovery.</p>
        {swaps.map(({ exercise: alternativeExercise, tradeoff }) => {
          const alternative = getExerciseGuide({ name: alternativeExercise.name });
          return <div key={alternativeExercise.id}>
            <strong>{alternativeExercise.name}</strong><p>{tradeoff}</p>
            <a href={alternative.demonstration.url} target="_blank" rel="noopener noreferrer">View technique<ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>;
        })}
        <p className="exercise-guide__alternative-note">Use Replace exercise in your workout to make a change.</p>
      </> : <p>No close alternatives yet. Search the library for a movement with a similar goal.</p>}
    </div> : <>
      {guide.isGeneric && !movement && <p className="exercise-guide__custom">Custom movement · general guidance</p>}
      <section className="exercise-guide__technique"><h3>Technique</h3>
        <ol className="exercise-guide__steps">{steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
      </section>
      <section className="exercise-guide__feel"><h3>Feel it</h3><p>{guide.isGeneric && movement ? movement.muscles.join(' · ') : guide.feel}</p></section>
      <section className="exercise-guide__mistakes"><h3>Avoid</h3><ul>{mistakes.map((mistake, index) => <li key={index}>{mistake}</li>)}</ul></section>
      <section className="exercise-guide__safety"><h3>Safety</h3><p>{guide.isGeneric && movement ? 'Use a setup you can control. Stop for sharp pain, dizziness or loss of technique.' : guide.caution}</p></section>
      <button type="button" className="exercise-guide__load-toggle" aria-expanded={loadingOpen} onClick={() => setLoadingOpen(value => !value)}>Load &amp; reps<span aria-hidden="true">{loadingOpen ? '−' : '+'}</span></button>
      <div className="exercise-guide__loading" hidden={!loadingOpen}>
        <strong>{guide.loading.label}</strong>
        {guide.loading.target && <p className="exercise-guide__target">Your target: {guide.loading.target}</p>}
        <p>{guide.loading.advice}</p>
        {guide.loading.progression && <p>{guide.loading.progression}</p>}
      </div>
      <a className="exercise-guide__video" href={guide.demonstration.url} target="_blank" rel="noopener noreferrer">{guide.demonstration.label}<ArrowUpRight size={17} aria-hidden="true" /></a>
    </>}
  </div>;
}

export function ExerciseGuide({ exercise, compact = false }: ExerciseGuideProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <div className={`exercise-guide${compact ? ' exercise-guide--compact' : ''}`}>
    <button ref={trigger} type="button" className="exercise-guide__trigger" aria-label={`Exercise details for ${exercise.name}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Exercise details<ChevronRight size={17} aria-hidden="true" /></button>
    <ExerciseGuideSheet exercise={exercise} open={open} onOpenChange={setOpen} onCloseAutoFocus={(event: Event) => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }} />
  </div>;
}

export default ExerciseGuide;
