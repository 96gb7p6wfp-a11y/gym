import { Check } from 'lucide-react';
import { completedSets, estimatedCalories as loggedVolume, sessionDuration } from './domain';
import { formatWorkoutDuration, getWorkoutAchievements } from './workout-achievements';
import type { ReportSession } from './weekly-report';
import './workout-completion.css';

export interface WorkoutCompletionProps {
  session: ReportSession;
  sessions: readonly ReportSession[];
  onDone?: () => void;
  onStretch?: () => void;
  volleyballSchedule?: { days: readonly number[] };
}
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });

/** Read-only feedback on the saved workout. Finishing never changes past records. */
export function WorkoutCompletion({ session, sessions, onDone, onStretch, volleyballSchedule }: WorkoutCompletionProps) {
  const achievements = getWorkoutAchievements(session, sessions);
  const duration = Math.max(0, sessionDuration(session));
  const sets = completedSets(session);
  const recoveryOnly = session.kind === 'recovery' && !session.exercises.length;
  const checkedMovements = (session.cooldown ?? []).filter(step => step.done).length;
  const volume = loggedVolume(session.exercises);
  const day = new Date(`${session.date}T12:00:00Z`);
  const nextDay = ((day.getUTCDay() + 6) % 7 + 1) % 7;
  const volleyballTomorrow = (volleyballSchedule?.days ?? [1, 4]).includes(nextDay);
  const cue = recoveryOnly ? 'Recovery recorded. Keep the rest of your day easy.'
    : volleyballTomorrow ? 'Volleyball tomorrow. Keep extra leg work light and recover well.'
    : session.kind === 'sport' ? 'Refuel, rehydrate and keep extra jumps light if your legs feel heavy.'
      : 'Refuel and hydrate before your next session.';
  const { highlight, newRecordCount } = achievements;

  return <section className="workout-completion" aria-label="Workout complete summary" data-has-records={newRecordCount > 0}>
    <header className="workout-completion__heading"><span aria-hidden="true"><Check size={21} strokeWidth={2} /></span><h2>{recoveryOnly ? 'Recovery complete' : session.kind === 'sport' ? 'Training recorded' : 'Workout complete'}</h2></header>
    <p className="workout-completion__session">{session.name}</p>
    <div className={`workout-completion__metrics${newRecordCount ? ' workout-completion__metrics--records' : ''}`}>
      <div role="group" aria-label="Training duration"><strong>{formatWorkoutDuration(duration)}</strong><span>{duration > 0 ? 'Training duration' : 'Duration not recorded'}</span></div>
      {recoveryOnly ? <div role="group" aria-label="Recovery movements checked"><strong>{number(checkedMovements)}</strong><span>{checkedMovements === 1 ? 'Movement checked' : 'Movements checked'}</span></div>
        : (session.kind !== 'sport' || sets > 0) && <div role="group" aria-label="Completed sets"><strong>{number(sets)}</strong><span>Sets completed</span></div>}
      {newRecordCount > 0 && <div className="workout-completion__metric--record" role="group" aria-label="New personal records"><strong>{number(newRecordCount)}</strong><span>{newRecordCount === 1 ? 'Personal record' : 'Personal records'}</span></div>}
    </div>
    {highlight && <div className="workout-completion__highlight" aria-label="Today’s highlight">
      <span>Today’s highlight</span><h3>{highlight.name}</h3><strong>{highlight.valueLabel}</strong>
      <small>{highlight.label}</small>
      {achievements.comparison && <p className="workout-completion__comparison">{achievements.comparison}</p>}
    </div>}
    {sets === 0 && session.kind === 'strength' && <p className="workout-completion__empty">Session saved. No completed sets recorded.</p>}
    <p className="workout-completion__cue">{cue}</p>
    {(volume > 0 || achievements.records.length > 0) && <details className="workout-completion__details">
      <summary>Performance notes</summary>
      {volume > 0 && <div className="workout-completion__volume"><span>Logged load-volume</span><strong>{number(volume)}<small>kg logged</small></strong></div>}
      {achievements.records.length > 0 && <ul className="workout-completion__achievements" aria-label="Recorded performances">
        {achievements.records.map(record => <li key={record.identity} data-achievement={record.status}>
          <strong>{record.name} · {record.label}</strong><span>{record.valueLabel}</span>{record.context && <small>{record.context}</small>}
        </li>)}
      </ul>}
    </details>}
    {onDone && <button type="button" className="btn workout-completion__done" onClick={onDone}>Done</button>}
    {onStretch && <button type="button" className="workout-completion__stretch" onClick={onStretch}>Optional cooldown</button>}
  </section>;
}
export default WorkoutCompletion;
