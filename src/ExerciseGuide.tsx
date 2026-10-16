import { useState } from 'react';
import { getExerciseGuide, type GuideExercise } from './exercise-guides';
import { findLibraryExercise, rankAlternatives } from './exercise-library';
import './exercise-guides.css';

export interface ExerciseGuideProps {
  exercise: GuideExercise;
  compact?: boolean;
}

export function ExerciseGuide({ exercise, compact = false }: ExerciseGuideProps) {
  const guide = getExerciseGuide(exercise);
  // Resolve the current name, rather than inheriting advice from a renamed key.
  const movement = findLibraryExercise({ name: exercise.name, key: exercise.key });
  const [section, setSection] = useState<'technique' | 'alternatives'>('technique');
  const [loadingOpen, setLoadingOpen] = useState(false);
  const swaps = movement ? rankAlternatives(movement.id, 4) : [];
  const steps = guide.isGeneric && movement ? movement.cues.slice(0, 3) : guide.steps;
  const mistakes = guide.isGeneric && movement ? movement.mistakes.slice(0, 3) : guide.mistakes;
  return (
    <details className={`exercise-guide${compact ? ' exercise-guide--compact' : ''}`}>
      <summary aria-label={`Exercise details for ${exercise.name}`}>Exercise details</summary>
      <div className="exercise-guide__content">
        {movement ? <dl className="exercise-guide__overview">
          <div><dt>Primary goal</dt><dd>{movement.category === 'Hypertrophy' ? 'Muscle development' : movement.category}</dd></div>
          <div><dt>Targets</dt><dd>{movement.muscles.join(' · ')}</dd></div>
          <div><dt>Helps improve</dt><dd>{movement.primaryBenefit}<span>{movement.secondaryBenefit}</span></dd></div>
        </dl> : (exercise.group || exercise.cue) && <div className="exercise-guide__intro">
          {exercise.group && <span>{exercise.group}</span>}
          {exercise.cue && <p>{exercise.cue}</p>}
        </div>}
        {swaps.length > 0 && <div className="exercise-guide__sections" role="group" aria-label={`Guide sections for ${exercise.name}`}>
          <button type="button" aria-pressed={section === 'technique'} onClick={() => setSection('technique')}>Technique</button>
          <button type="button" aria-pressed={section === 'alternatives'} onClick={() => setSection('alternatives')}>Alternatives</button>
        </div>}
        {section === 'alternatives' && swaps.length > 0 ? <div className="exercise-guide__alternatives">
          <p>Similar purpose, with a different setup. Use Replace exercise to switch.</p>
          {swaps.map(({ exercise: alternativeExercise, tradeoff }) => {
            const alternative = getExerciseGuide({ name: alternativeExercise.name });
            return <div key={alternativeExercise.id}>
              <strong>{alternativeExercise.name}</strong>
              <p>{tradeoff}</p>
              <a href={alternative.demonstration.url} target="_blank" rel="noopener noreferrer">View technique<span aria-hidden="true"> ↗</span></a>
            </div>;
          })}
        </div> : <>
        {guide.isGeneric && !movement && <p className="exercise-guide__custom">Custom movement: general guidance</p>}
        <strong className="exercise-guide__technique-heading">Technique</strong>
        <ol className="exercise-guide__steps">
          {steps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
        <p><strong>Feel it</strong>{guide.isGeneric && movement ? movement.muscles.join(' · ') : guide.feel}</p>
        <div className="exercise-guide__mistakes">
          <strong>Avoid</strong>
          <ul>{mistakes.map((mistake, index) => <li key={index}>{mistake}</li>)}</ul>
        </div>
        <p><strong>Safety</strong>{guide.isGeneric && movement
          ? 'Use a setup you can control. Stop for sharp pain, dizziness or loss of technique.' : guide.caution}</p>
        <button type="button" className="exercise-guide__load-toggle" aria-expanded={loadingOpen}
          onClick={() => setLoadingOpen(!loadingOpen)}>Load &amp; reps <span aria-hidden="true">{loadingOpen ? '−' : '+'}</span></button>
        <div className="exercise-guide__loading" hidden={!loadingOpen}>
          <strong>Load &amp; reps · {guide.loading.label}</strong>
          {guide.loading.target && <p className="exercise-guide__target">Your target: {guide.loading.target}</p>}
          <p>{guide.loading.advice}</p>
          {guide.loading.progression && <p>{guide.loading.progression}</p>}
        </div>
        <a href={guide.demonstration.url} target="_blank" rel="noopener noreferrer">
          {guide.demonstration.label}<span aria-hidden="true"> ↗</span>
        </a>
        </>}
      </div>
    </details>
  );
}

export default ExerciseGuide;
