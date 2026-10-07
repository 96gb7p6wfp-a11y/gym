import { getShortRoutine, type DailyGuidanceInput } from './coaching';
import './guidance.css';

export function ShortRoutine({ input }: { input: DailyGuidanceInput }) {
  const routine = getShortRoutine(input);
  return <section className="panel short-routine" aria-label="Before and after training">
    <div><h3>Before training</h3><p>{routine.before}</p></div>
    <div><h3>After training</h3><p>{routine.after}</p></div>
  </section>;
}
