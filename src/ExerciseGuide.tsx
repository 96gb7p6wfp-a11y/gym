import { getExerciseGuide, type GuideExercise } from './exercise-guides';
import './exercise-guides.css';

export interface ExerciseGuideProps {
  exercise: GuideExercise;
  compact?: boolean;
}

export function ExerciseGuide({ exercise, compact = false }: ExerciseGuideProps) {
  const guide = getExerciseGuide(exercise);
  return (
    <details className={`exercise-guide${compact ? ' exercise-guide--compact' : ''}`}>
      <summary>How to do {exercise.name}</summary>
      <div className="exercise-guide__content">
        {guide.isGeneric && <p className="exercise-guide__custom">Custom movement: general guidance</p>}
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
      </div>
    </details>
  );
}

export default ExerciseGuide;
