import { useState } from 'react';
import { getExerciseGuide, type GuideExercise } from './exercise-guides';
import './exercise-guides.css';

export interface ExerciseGuideProps {
  exercise: GuideExercise;
  compact?: boolean;
}

const alternatives: Record<string, string[]> = {
  'machine chest press / bench press': ['Machine Chest Press', 'Incline Dumbbell Press'],
  'machine chest press': ['Incline Dumbbell Press'],
  'incline dumbbell press': ['Machine Chest Press'],
  'neutral-grip lat pulldown / pull-up': ['Neutral-Grip Lat Pulldown'],
  'biceps curl': ['Hammer Curl'],
  'hammer curl': ['Biceps Curl'],
};

export function ExerciseGuide({ exercise, compact = false }: ExerciseGuideProps) {
  const guide = getExerciseGuide(exercise);
  const [section, setSection] = useState<'technique' | 'alternatives'>('technique');
  const swaps = alternatives[exercise.name.trim().toLowerCase()] ?? [];
  return (
    <details className={`exercise-guide${compact ? ' exercise-guide--compact' : ''}`}>
      <summary aria-label={`Exercise details for ${exercise.name}`}>Exercise details</summary>
      <div className="exercise-guide__content">
        {(exercise.group || exercise.cue) && <div className="exercise-guide__intro">
          {exercise.group && <span>{exercise.group}</span>}
          {exercise.cue && <p>{exercise.cue}</p>}
        </div>}
        {swaps.length > 0 && <div className="exercise-guide__sections" role="group" aria-label={`Guide sections for ${exercise.name}`}>
          <button type="button" aria-pressed={section === 'technique'} onClick={() => setSection('technique')}>Technique</button>
          <button type="button" aria-pressed={section === 'alternatives'} onClick={() => setSection('alternatives')}>Alternatives</button>
        </div>}
        {section === 'alternatives' && swaps.length > 0 ? <div className="exercise-guide__alternatives">
          <p>Choose a comfortable alternative. Update your plan to make the switch.</p>
          {swaps.map((name) => {
            const alternative = getExerciseGuide({ name });
            return <div key={name}>
              <strong>{name}</strong>
              <a href={alternative.demonstration.url} target="_blank" rel="noopener noreferrer">View technique<span aria-hidden="true"> ↗</span></a>
            </div>;
          })}
        </div> : <>
        {guide.isGeneric && <p className="exercise-guide__custom">Custom movement: general guidance</p>}
        <div className="exercise-guide__loading">
          <strong>Load &amp; reps · {guide.loading.label}</strong>
          {guide.loading.target && <p className="exercise-guide__target">Your target: {guide.loading.target}</p>}
          <p>{guide.loading.advice}</p>
          {guide.loading.progression && <p>{guide.loading.progression}</p>}
        </div>
        <ol className="exercise-guide__steps">
          {guide.steps.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
        <p><strong>Feel it</strong>{guide.feel}</p>
        <div className="exercise-guide__mistakes">
          <strong>Avoid</strong>
          <ul>{guide.mistakes.map((mistake, index) => <li key={index}>{mistake}</li>)}</ul>
        </div>
        <p><strong>Safety</strong>{guide.caution}</p>
        <a href={guide.demonstration.url} target="_blank" rel="noopener noreferrer">
          {guide.demonstration.label}<span aria-hidden="true"> ↗</span>
        </a>
        </>}
      </div>
    </details>
  );
}

export default ExerciseGuide;
