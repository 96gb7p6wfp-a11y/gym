import { exerciseLoadIncrement, LOAD_INCREMENT_OPTIONS, type LoadStepExercise } from './workout-input-steps';

export function LoadStepControl({ exercise, onChange }: {
  exercise: LoadStepExercise;
  onChange: (increment: number) => unknown;
}) {
  const step = exerciseLoadIncrement(exercise);
  const options = [...new Set<number>([...LOAD_INCREMENT_OPTIONS, step])].sort((a, b) => a - b);
  return <label className="load-step-control"><span>Weight step<small>Use your equipment’s available increment.</small></span>
    <select aria-label={`${exercise.name} weight increment in kilograms`} value={step}
      onChange={event => onChange(Number(event.target.value))}>
      {options.map(value => <option key={value} value={value}>{value} kg</option>)}
    </select>
  </label>;
}
