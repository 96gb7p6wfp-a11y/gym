/** Optional provenance protects intentional blanks as well as planned zeroes. */
export type SetInputSource = 'manual' | 'planned' | 'history' | 'last-set';
export interface SetInputSources {
  kg?: SetInputSource;
  reps?: SetInputSource;
}

export interface CarryForwardLog {
  id: string;
  kg: number | null;
  reps: number | null;
  done: boolean;
  inputSources?: SetInputSources;
}

export interface CarryForwardExercise {
  key?: string;
  mode: 'weight' | 'bodyweight' | 'timed';
  measurement?: 'touch' | 'height' | 'distance';
  quantityUnit?: 'm';
  preparationOnly?: boolean;
  logs: readonly CarryForwardLog[];
}

interface CarryForwardSession {
  id: string;
  status: string;
  exercises: readonly (CarryForwardExercise & { key: string })[];
}

export interface LastSetSuggestion {
  sourceSetId: string;
  sourceSetNumber: number;
  patch: { kg: number | null; reps: number };
}

/** User input, including a deliberate clear, must survive later suggestions. */
export function markSetInput<Log extends CarryForwardLog>(log: Log, patch: Partial<Log>): Log {
  const inputSources = { ...log.inputSources };
  for (const field of ['kg', 'reps'] as const) {
    if (Object.hasOwn(patch, field)) inputSources[field] = 'manual';
  }
  return {
    ...log, ...patch,
    ...(Object.keys(inputSources).length ? { inputSources } : {}),
  };
}

/** Same movement and session only; measurements, timed work and prep are excluded. */
export function lastSetSuggestion(exercise: CarryForwardExercise, targetId: string): LastSetSuggestion | null {
  if (exercise.mode === 'timed' || exercise.measurement || exercise.quantityUnit || exercise.preparationOnly) return null;
  const targetIndex = exercise.logs.findIndex(log => log.id === targetId);
  if (targetIndex <= 0 || exercise.logs[targetIndex].done) return null;
  let sourceIndex = targetIndex - 1;
  while (sourceIndex >= 0 && !exercise.logs[sourceIndex].done) sourceIndex -= 1;
  const prior = exercise.logs[sourceIndex];
  if (!prior || prior.reps == null || !Number.isInteger(prior.reps) || prior.reps <= 0 || prior.reps > 1000) return null;
  if (prior.kg != null && (!Number.isFinite(prior.kg) || prior.kg < 0 || prior.kg > 2000)) return null;
  if (exercise.mode === 'weight' && prior.kg == null) return null;
  return { sourceSetId: prior.id, sourceSetNumber: sourceIndex + 1, patch: { kg: prior.kg, reps: prior.reps } };
}

/** Nonempty legacy values remain deliberate; no source metadata is invented on read. */
export function missingSetValuesFromLast(exercise: CarryForwardExercise, targetId: string):
  ({ kg?: number | null; reps?: number; inputSources: SetInputSources }) | null {
  const suggestion = lastSetSuggestion(exercise, targetId);
  if (!suggestion) return null;
  const target = exercise.logs.find(log => log.id === targetId)!;
  const patch: { kg?: number | null; reps?: number; inputSources: SetInputSources } = { inputSources: { ...target.inputSources } };
  if ((target.kg == null && target.inputSources?.kg === undefined && suggestion.patch.kg != null)
    || (['history', 'planned'].includes(target.inputSources?.kg ?? '') && target.kg !== suggestion.patch.kg)
    || (target.inputSources?.kg === 'last-set' && target.kg !== suggestion.patch.kg)) {
    patch.kg = suggestion.patch.kg;
    patch.inputSources.kg = 'last-set';
  }
  if ((target.reps == null && target.inputSources?.reps === undefined)
    || (['history', 'planned'].includes(target.inputSources?.reps ?? '') && target.reps !== suggestion.patch.reps)
    || (target.inputSources?.reps === 'last-set' && target.reps !== suggestion.patch.reps)) {
    patch.reps = suggestion.patch.reps;
    patch.inputSources.reps = 'last-set';
  }
  return Object.hasOwn(patch, 'kg') || Object.hasOwn(patch, 'reps') ? patch : null;
}

/**
 * Run in the authoritative completion transition, before its single persistence
 * write. Filling a draft never completes it, arms a button or starts a timer.
 * A paired movement prepares its own later set without touching its partner.
 */
export function carryForwardAfterCompletion<Session extends CarryForwardSession>(session: Session,
  target: { sessionId: string; exerciseKey: string; setId: string }): Session {
  if (session.id !== target.sessionId || session.status !== 'active') return session;
  const exercise = session.exercises.find(entry => entry.key === target.exerciseKey);
  const completedIndex = exercise?.logs.findIndex(log => log.id === target.setId) ?? -1;
  if (!exercise || completedIndex < 0 || !exercise.logs[completedIndex].done) return session;
  const next = exercise.logs.slice(completedIndex + 1).find(log => !log.done);
  if (!next) return session;
  const patch = missingSetValuesFromLast(exercise, next.id);
  if (!patch) return session;
  return {
    ...session,
    exercises: session.exercises.map(entry => entry !== exercise ? entry : {
      ...entry, logs: entry.logs.map(log => log.id !== next.id ? log : { ...log, ...patch }),
    }),
  } as Session;
}
