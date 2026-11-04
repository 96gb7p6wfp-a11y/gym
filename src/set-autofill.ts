interface CarryForwardLog {
  id: string;
  kg: number | null;
  reps: number | null;
  done: boolean;
}

interface CarryForwardExercise {
  mode: 'weight' | 'bodyweight' | 'timed';
  measurement?: 'touch' | 'height' | 'distance';
  logs: readonly CarryForwardLog[];
}

/** The last *completed* set of this exercise is only a draft suggestion. */
export function lastSetSuggestion(exercise: CarryForwardExercise, targetId: string): { kg?: number | null; reps?: number | null } | null {
  if (exercise.mode === 'timed' || exercise.measurement) return null;
  const targetIndex = exercise.logs.findIndex(log => log.id === targetId);
  if (targetIndex <= 0 || exercise.logs[targetIndex].done) return null;
  const prior = exercise.logs.slice(0, targetIndex).reverse().find(log => log.done);
  if (!prior || prior.reps == null || !Number.isInteger(prior.reps) || prior.reps <= 0 || prior.reps > 1000) return null;
  if (prior.kg != null && (!Number.isFinite(prior.kg) || prior.kg < 0 || prior.kg > 2000)) return null;
  if (exercise.mode === 'weight' && prior.kg == null) return null;
  return { kg: prior.kg, reps: prior.reps };
}

/** Fill truly empty fields only; an entered or planned zero is a deliberate value. */
export function missingSetValuesFromLast(exercise: CarryForwardExercise, targetId: string): { kg?: number | null; reps?: number | null } | null {
  const suggestion = lastSetSuggestion(exercise, targetId);
  if (!suggestion) return null;
  const target = exercise.logs.find(log => log.id === targetId)!;
  const patch: { kg?: number | null; reps?: number | null } = {};
  if (target.kg == null && suggestion.kg != null) patch.kg = suggestion.kg;
  if (target.reps == null && suggestion.reps != null) patch.reps = suggestion.reps;
  return Object.keys(patch).length ? patch : null;
}
