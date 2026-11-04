import { areComparableExercises, type PerformanceExerciseReference } from './performance-insights.ts';
import type { ReportSession } from './weekly-report.ts';

export interface PreviousPerformanceExercise extends PerformanceExerciseReference {
  preparationOnly?: boolean;
}

export interface PreviousSetMetric {
  done: boolean;
  kg: number | null;
  reps: number | null;
  seconds: number | null;
  measurementCm?: number | null;
}

export interface PreviousPerformance {
  label: string;
  date: string;
  sessionId: string;
  exerciseKey: string;
  setId: string;
}

const positive = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonnegative = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 });

/** A missing metric stays unknown: it is never displayed as zero or a different logging type. */
export function formatPreviousSet(exercise: Pick<PreviousPerformanceExercise, 'mode' | 'measurement' | 'quantityUnit' | 'perSide'>, log: PreviousSetMetric | null | undefined): string | undefined {
  if (!log?.done) return undefined;
  const side = exercise.perSide ? ' per side' : '';
  if (exercise.measurement) {
    if (!positive(log.measurementCm)) return undefined;
    const metric = exercise.measurement === 'touch' ? 'Maximum touch' : exercise.measurement === 'height' ? 'Jump height' : 'Distance';
    return `${metric} ${number(log.measurementCm)} cm${side}`;
  }
  if (exercise.mode === 'timed') return positive(log.seconds) ? `${number(log.seconds)} sec${side}` : undefined;
  if (!positive(log.reps)) return undefined;
  const quantity = `${number(log.reps)} ${exercise.quantityUnit === 'm' ? 'm' : 'reps'}`;
  if (exercise.mode === 'bodyweight' && (log.kg == null || log.kg === 0)) return `${quantity}${side}`;
  if (!nonnegative(log.kg)) return undefined;
  return `${number(log.kg)} kg × ${number(log.reps)}${exercise.quantityUnit === 'm' ? ' m' : ''}${side}`;
}

/** The same set ordinal from the latest comparable completed session, without altering history. */
export function previousPerformance(exercise: PreviousPerformanceExercise, sessions: readonly ReportSession[], date: string, excludedSessionId = '', setIndex = 0): PreviousPerformance | undefined {
  if (exercise.preparationOnly || !Number.isInteger(setIndex) || setIndex < 0) return undefined;
  const history = sessions.filter(session => session.id !== excludedSessionId && session.status === 'completed'
    && session.deletedAt == null && session.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt);
  for (const session of history) {
    const candidates = session.exercises.filter(item => !item.preparationOnly && areComparableExercises(item, exercise));
    if (!candidates.length) continue;
    const previous = candidates.find(item => item.key === exercise.key) ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (!previous) return undefined;
    // Filtering completed logs first would silently move set 2 into set 1's slot.
    const log = previous.logs[setIndex];
    const label = formatPreviousSet(previous, log);
    return label && log ? { label, date: session.date, sessionId: session.id, exerciseKey: previous.key, setId: log.id } : undefined;
  }
  return undefined;
}
