import { useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { getExerciseDemonstrationLinks, getExerciseGuide, type GuideExercise } from './exercise-guides';
import { findLibraryExercise, rankAlternatives } from './exercise-library';
import { MuscleMap } from './MuscleMap';
import { ExerciseTechniqueDiagram } from './ExerciseTechniqueDiagram';
import { AdditionalExerciseMedia, ExerciseMedia } from './ExerciseMedia';
import './exercise-guides.css';

export interface ExerciseGuideProps {
  exercise: GuideExercise;
  compact?: boolean;
}

/** The same guide in an adjacent iPad pane; it owns no training records. */
export function ExerciseGuidePanel({ exercise, children, onClose }: {
  exercise: GuideExercise; children?: ReactNode; onClose?: () => void;
}) {
  const guide = getExerciseGuide(exercise);
  const movement = findLibraryExercise({ name: exercise.name });
  return <section className="exercise-guide-panel" aria-label={`Exercise guide for ${guide.displayName}`}>
    <header className="exercise-guide-panel__header"><div>
      <p className="exercise-guide__category">{movement?.category ?? exercise.group ?? 'Exercise guide'}</p>
      <h2 tabIndex={-1}>{guide.displayName}</h2>
    </div>{onClose && <button type="button" aria-label="Close exercise guide" onClick={onClose}><X size={20} aria-hidden="true" /></button>}</header>
    {children}<ExerciseGuideBody key={exercise.name} exercise={exercise} />
  </section>;
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
  const guide = getExerciseGuide(exercise);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="app-dialog exercise-guide-sheet" onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader className="exercise-guide__header">
        <DialogDescription className="exercise-guide__category">{movement?.category ?? exercise.group ?? 'Exercise guide'}</DialogDescription>
        <DialogTitle className="exercise-guide__title">{guide.displayName}</DialogTitle>
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
  const steps = guide.steps;
  const mistakes = guide.mistakes;
  const links = getExerciseDemonstrationLinks(guide);
  const intent = movement && (['Power', 'Plyometric', 'Speed'].includes(movement.category)
    ? 'Move explosively. Stop when speed or jump quality drops.'
    : movement.category === 'Hypertrophy' ? 'Controlled reps. Use your full comfortable range.'
    : movement.category === 'Strength' ? 'Controlled lowering. A strong, clean return.'
    : movement.category === 'Mobility' || movement.category === 'Recovery' ? 'Move gently. Keep breathing.'
    : 'Stay steady. Keep your ribs and pelvis controlled.');

  return <div className="exercise-guide__content">
    <div className="exercise-guide__sections" role="group" aria-label={`Guide sections for ${exercise.name}`}>
      <button type="button" aria-pressed={section === 'technique'} onClick={() => setSection('technique')}>Technique</button>
      <button type="button" aria-pressed={section === 'alternatives'} onClick={() => setSection('alternatives')}>Alternatives</button>
    </div>
    {section === 'alternatives' ? <div className="exercise-guide__alternatives">
      {swaps.length ? <>
        {swaps.map(({ exercise: alternativeExercise, tradeoff }) => {
          const alternative = getExerciseGuide({ name: alternativeExercise.name });
          return <div key={alternativeExercise.id}>
            <strong>{alternativeExercise.name}</strong><p>{tradeoff}</p>
            {alternative.demonstration.kind === 'search' && <a href={alternative.demonstration.url} target="_blank" rel="noopener noreferrer">Search technique<ArrowUpRight size={16} aria-hidden="true" /></a>}
          </div>;
        })}
        <p className="exercise-guide__alternative-note">Use Replace exercise in your workout to make a change.</p>
      </> : <p>No close alternatives yet. Search the library for a movement with a similar goal.</p>}
    </div> : <>
      {guide.isGeneric && !movement && <p className="exercise-guide__custom">Custom movement · general guidance</p>}
      {guide.isAmbiguous && <p className="exercise-guide__variant-note">Legacy exercise choice · choose an exact variation for future entries. Your saved records stay unchanged.</p>}
      <ExerciseMedia exercise={{ name: exercise.name }} />
      <section className="exercise-guide__equipment"><h3>Equipment</h3><p>{guide.instructions.equipment}</p></section>
      <section className="exercise-guide__technique"><h3>Technique</h3>
        <ol className="exercise-guide__steps">{steps.slice(0, 3).map((step, index) => <li key={index}><div><strong>{['Setup', 'Movement', 'Key cue'][index]}</strong><span>{step}</span></div></li>)}</ol>
        {steps.length > 3 && <details className="exercise-guide__disclosure"><summary>More technique</summary><ol className="exercise-guide__steps" start={4}>{steps.slice(3).map((step, index) => <li key={index}>{step}</li>)}</ol></details>}
      </section>
      <section className="exercise-guide__avoid"><h3>Avoid</h3><p>{guide.instructions.avoid}</p></section>
      {movement && !guide.isAmbiguous && <section className="exercise-guide__targets"><h3>Target muscles</h3><p>{movement.muscles.join(' · ')}</p></section>}
      <section className="exercise-guide__purpose"><h3>Purpose</h3><p>{guide.instructions.purpose}</p></section>
      <AdditionalExerciseMedia exercise={{ name: exercise.name }} />
      {guide.diagram && <details className="exercise-guide__disclosure exercise-guide__diagram"><summary>Movement diagram</summary><ExerciseTechniqueDiagram variant={guide.diagram} /></details>}
      <details className="exercise-guide__disclosure exercise-guide__form"><summary>Form &amp; safety</summary>
        <div className="exercise-guide__disclosure-body">
          <section className="exercise-guide__feel"><h3>Feel it</h3><p>{guide.isGeneric && movement ? movement.muscles.join(' · ') : guide.feel}</p></section>
          <section className="exercise-guide__mistakes"><h3>Avoid</h3><ul>{mistakes.map((mistake, index) => <li key={index}>{mistake}</li>)}</ul></section>
          <section className="exercise-guide__safety"><h3>Safety</h3><p>{movement?.precautions?.length ? movement.precautions.join(' ') : guide.isGeneric && movement ? 'Use a setup you can control. Stop for sharp pain, dizziness or loss of technique.' : guide.caution}</p></section>
        </div>
      </details>
      <button type="button" className="exercise-guide__load-toggle" aria-expanded={loadingOpen} onClick={() => setLoadingOpen(value => !value)}>Load &amp; reps<span aria-hidden="true">{loadingOpen ? '−' : '+'}</span></button>
      <div className="exercise-guide__loading" hidden={!loadingOpen}>
        <strong>{guide.loading.label}</strong>
        {guide.loading.target && <p className="exercise-guide__target">Your target: {guide.loading.target}</p>}
        <p>{guide.loading.advice}</p>
        {guide.loading.progression && <p>{guide.loading.progression}</p>}
      </div>
      {movement ? <details className="exercise-guide__disclosure exercise-guide__about"><summary>About this exercise</summary>
        <MuscleMap muscles={movement.muscles} />
        <dl className="exercise-guide__overview">
          <div><dt>Targets</dt><dd>{movement.muscles.join(' · ')}</dd></div>
          <div><dt>Improves</dt><dd>{movement.primaryBenefit}<span>{movement.secondaryBenefit}</span></dd></div>
          <div><dt>Intent</dt><dd>{intent}</dd></div>
          <div><dt>Equipment</dt><dd>{movement.equipment.join(' · ')}</dd></div>
          <div><dt>Level</dt><dd>{movement.difficulty}</dd></div>
          <div><dt>Starting point</dt><dd>{movement.recommendedSets} × {movement.recommendedReps}{movement.perSide ? ' / side' : ''}</dd></div>
        </dl>
      </details> : exercise.group && <p className="exercise-guide__custom">{exercise.group}</p>}
      {guide.techniqueReference && <a className="exercise-guide__video" href={guide.techniqueReference.url} target="_blank" rel="noopener noreferrer">{guide.techniqueReference.label}<ArrowUpRight size={17} aria-hidden="true" /></a>}
    </>}
    <div className="exercise-guide__research" aria-label="Exercise demonstration links">
      <a className="exercise-guide__video" href={links.google} target="_blank" rel="noopener noreferrer">Search Google<ArrowUpRight size={17} aria-hidden="true" /></a>
      <a className="exercise-guide__video" href={links.youtube} target="_blank" rel="noopener noreferrer">YouTube Demonstration<ArrowUpRight size={17} aria-hidden="true" /></a>
    </div>
    <p className="exercise-guide__media-note">{guide.research.precision === 'unconfirmed'
      ? 'The saved name needs an exact variation. Search results are unreviewed; confirm the movement and equipment before following them.'
      : links.verifiedYouTube ? 'Assigned YouTube demonstration · general Google search results have not been reviewed.'
        : 'General demonstration searches · results have not been reviewed. Match the exact variation and direction shown above.'}</p>
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
