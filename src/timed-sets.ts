/** A timer is owned by one logged set, rather than the whole movement. */
export interface TimedSetLog {
  readonly id: string;
  readonly done: boolean;
  readonly seconds: number | null;
}

export interface TimedSetExercise {
  readonly elapsedMs: number;
  readonly runningSince: number | null;
  readonly timerSetId?: string | null;
  readonly logs: readonly TimedSetLog[];
}

export interface TimedSetAction {
  action: 'start' | 'pause' | 'reset';
  setId: string;
  /** Start target, or the final countdown duration when pausing at zero. */
  seconds?: number;
}

const MAX_DURATION_MS = 604_800_000;
const MAX_SET_SECONDS = 86_400;

function elapsed(exercise: TimedSetExercise, now: number): number {
  return Math.min(MAX_DURATION_MS, Math.max(0, exercise.elapsedMs)
    + (exercise.runningSince == null ? 0 : Math.max(0, now - exercise.runningSince)));
}

function validSeconds(seconds: number | undefined): boolean {
  return seconds === undefined || (Number.isFinite(seconds) && seconds > 0);
}

function targetSeconds(seconds: number): number {
  return Math.min(MAX_SET_SECONDS, Math.max(1, Math.round(seconds)));
}

/**
 * Pure session mutation: pause/resume survives refresh, and a different set
 * begins at zero. A partial pause leaves the intended duration unchanged.
 */
export function applyTimedSetAction<T extends TimedSetExercise>(
  exercise: T, options: TimedSetAction, now: number,
): T {
  const log = exercise.logs.find((entry) => entry.id === options.setId);
  if (!log || !['start', 'pause', 'reset'].includes(options.action)
    || !Number.isFinite(now) || now < 0 || !validSeconds(options.seconds)) return exercise;

  if (options.action === 'start') {
    if (log.done) return exercise;
    const sameSet = exercise.timerSetId === log.id;
    return {
      ...exercise,
      timerSetId: log.id,
      elapsedMs: sameSet ? exercise.elapsedMs : 0,
      runningSince: sameSet && exercise.runningSince != null ? exercise.runningSince : now,
      logs: options.seconds === undefined ? exercise.logs : exercise.logs.map((entry) =>
        entry.id === log.id ? { ...entry, seconds: targetSeconds(options.seconds!) } : entry),
    };
  }

  if (options.action === 'reset') {
    return { ...exercise, timerSetId: log.id, elapsedMs: 0, runningSince: null };
  }

  // A stale control must not pause a timer belonging to a different set.
  if (exercise.timerSetId !== log.id) return exercise;
  const accumulated = elapsed(exercise, now);
  return {
    ...exercise,
    elapsedMs: options.seconds === undefined ? accumulated
      : Math.min(accumulated, targetSeconds(options.seconds) * 1000),
    runningSince: null,
  };
}

/**
 * Record the current set's full elapsed time, including paused segments. Older
 * sessions without an owner retain the previous running-segment/manual rules.
 */
export function recordedTimedSetSeconds(
  exercise: TimedSetExercise, log: TimedSetLog, now: number,
): number | null {
  if (exercise.timerSetId != null) {
    if (exercise.timerSetId === log.id
      && (exercise.elapsedMs > 0 || exercise.runningSince != null)) {
      return Math.min(MAX_SET_SECONDS, Math.max(1, Math.round(elapsed(exercise, now) / 1000)));
    }
    return log.seconds;
  }
  return exercise.runningSince == null ? log.seconds
    : Math.min(MAX_SET_SECONDS, Math.max(1, Math.round(Math.max(0, now - exercise.runningSince) / 1000)));
}
