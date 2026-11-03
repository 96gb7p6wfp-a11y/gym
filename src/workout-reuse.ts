import { areComparableExercises } from './performance-insights.ts';
import type { ReportSession } from './weekly-report.ts';

type Exercise = ReportSession['exercises'][number];
type ExerciseReference = Pick<Exercise, 'key' | 'name' | 'mode'> & Partial<Pick<Exercise, 'measurement' | 'quantityUnit' | 'perSide'>> & { exerciseId?: string; preparationOnly?: boolean; defaultKg?: number | null };
export interface PreviousSetReuse {
  date: string;
  patch: { kg?: number | null; reps: number };
}

/** Reuse is a draft for one set, never evidence that today's work was performed. */
export function previousSetReuse(exercise: ExerciseReference, setIndex: number, sessions: readonly ReportSession[], date: string, sessionId: string): PreviousSetReuse | null {
  if (exercise.preparationOnly || (exercise.mode === 'bodyweight' && exercise.defaultKg === 0) || exercise.mode === 'timed' || !Number.isInteger(setIndex) || setIndex < 0) return null;
  const history = sessions.filter(session => session.id !== sessionId && session.status === 'completed'
    && session.deletedAt == null && session.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt);
  for (const session of history) {
    const candidates = session.exercises.filter(item => !item.preparationOnly && areComparableExercises(item, exercise)
      && item.quantityUnit === exercise.quantityUnit && Boolean(item.perSide) === Boolean(exercise.perSide));
    if (!candidates.length) continue;
    const previous = candidates.find(item => item.key === exercise.key) ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (!previous) return null;
    // Keep original ordinals: an unfinished set 1 cannot become a completed set 2.
    const log = previous.logs[setIndex];
    if (!log?.done || log.reps == null || !Number.isInteger(log.reps) || log.reps <= 0 || log.reps > 1000) return null;
    if (exercise.measurement) return { date: session.date, patch: { reps: log.reps } };
    if (log.kg !== null && (!Number.isFinite(log.kg) || log.kg < 0 || log.kg > 2000)) return null;
    if (exercise.mode === 'weight' && log.kg === null) return null;
    return { date: session.date, patch: { kg: log.kg, reps: log.reps } };
  }
  return null;
}
