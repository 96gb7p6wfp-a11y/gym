import { Check } from 'lucide-react';
import { completedSets, estimatedCalories as loggedVolume, sessionDuration } from './domain';
import { getPersonalRecords, type PersonalRecord } from './performance-insights';
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
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');

/** A finished session is also included while the parent's saved list catches up. */
export function WorkoutCompletion({ session, sessions, onDone, onStretch, volleyballSchedule }: WorkoutCompletionProps) {
  const history = [...sessions.filter(entry => entry.id !== session.id), session];
  const records = getPersonalRecords(history, session.date).filter(record => record.isNew
    && record.sessionId === session.id && record.date === session.date
    && session.exercises.some(exercise => (exercise.exerciseId ?? exercise.key) === record.exerciseKey
      && normalize(exercise.name) === normalize(record.name)));
  const duration = Math.max(0, sessionDuration(session));
  const minutes = duration > 0 ? number(duration / 60_000) : '—';
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
      : 'Refuel, hydrate and give your next session fresh legs.';

  // Prefer a genuine record's movement; otherwise highlight one completed set.
  // This is a logged performance, not a cross-exercise strength comparison.
  const highlightRecord = records.find(record => ['height', 'touch', 'distance', 'weight'].includes(record.kind));
  const preferred = highlightRecord ? session.exercises.find(exercise => matchesRecord(exercise, highlightRecord)) : undefined;
  const candidates = (preferred ? [preferred] : session.exercises).flatMap(exercise => exercise.logs
    .filter(log => log.done && (exercise.measurement ? (log.measurementCm ?? 0) > 0
      : exercise.mode === 'timed' ? (log.seconds ?? 0) > 0 : (log.reps ?? 0) > 0))
    .map(log => ({ exercise, log })));
  const highlight = candidates.sort((a, b) => {
    if (preferred?.measurement) return (b.log.measurementCm ?? 0) - (a.log.measurementCm ?? 0);
    if (preferred?.mode === 'timed') return (b.log.seconds ?? 0) - (a.log.seconds ?? 0);
    return (b.log.kg ?? 0) - (a.log.kg ?? 0) || (b.log.reps ?? 0) - (a.log.reps ?? 0);
  })[0];
  const highlightValue = !highlight ? null : highlight.exercise.measurement
    ? `${number(highlight.log.measurementCm!)} cm · ${{ height: 'jump height', touch: 'highest touch', distance: 'distance' }[highlight.exercise.measurement]}`
    : highlight.exercise.mode === 'timed' ? highlight.log.seconds! >= 60
      ? `${number(highlight.log.seconds! / 60)} min` : `${number(highlight.log.seconds!)} sec`
      : `${highlight.log.kg != null && highlight.log.kg > 0 ? `${number(highlight.log.kg)} kg` : 'Bodyweight'} × ${highlight.log.reps}`;

  return <section className="workout-completion" aria-label="Workout complete summary" data-has-records={records.length > 0}>
    <header className="workout-completion__heading"><span aria-hidden="true"><Check size={21} strokeWidth={2} /></span><h2>{recoveryOnly ? 'Recovery complete' : session.kind === 'sport' ? 'Training recorded' : 'Workout complete'}</h2></header>
    <div className={`workout-completion__metrics${records.length ? ' workout-completion__metrics--records' : ''}`}>
      <div><strong>{minutes}</strong><span>{duration > 0 ? 'minutes' : 'duration not recorded'}</span></div>
      {recoveryOnly ? <div><strong>{checkedMovements}</strong><span>{checkedMovements === 1 ? 'movement checked' : 'movements checked'}</span></div>
        : (session.kind !== 'sport' || sets > 0) && <div><strong>{sets}</strong><span>{sets === 1 ? 'set' : 'sets'}</span></div>}
      {records.length > 0 && <div><strong>{records.length}</strong><span>{records.length === 1 ? 'new record' : 'new records'}</span></div>}
    </div>
    {volume > 0 && <div className="workout-completion__volume"><span>Volume</span><strong>{number(volume)}<small>kg logged</small></strong></div>}
    {highlight && <div className="workout-completion__highlight"><span>{highlightRecord ? 'Best progress' : 'Top logged set'}</span><h3>{highlight.exercise.name}</h3><strong>{highlightValue}</strong></div>}
    {sets === 0 && session.kind === 'strength' && <p className="workout-completion__empty">Session saved. No completed sets recorded.</p>}
    <p className="workout-completion__cue">{cue}</p>
    {onStretch && <button type="button" className="btn workout-completion__stretch" onClick={onStretch}>{recoveryOnly ? 'View stretches' : 'Stretch now'}</button>}
    {onDone && <button type="button" className={`btn workout-completion__done${onStretch ? ' workout-completion__done--secondary' : ''}`} onClick={onDone}>Done</button>}
  </section>;
}

function matchesRecord(exercise: ReportSession['exercises'][number], record: PersonalRecord) {
  return (exercise.exerciseId ?? exercise.key) === record.exerciseKey && normalize(exercise.name) === normalize(record.name);
}

export default WorkoutCompletion;
