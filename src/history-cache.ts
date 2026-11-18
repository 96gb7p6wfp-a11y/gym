import { exercisePerformanceIdentity, type PerformanceExerciseReference } from './exercise-identity.ts';
import type { ReportSession } from './weekly-report.ts';

interface HistorySessionReference {
  status: string;
  date: string;
  startedAt: number;
  deletedAt?: number | null;
}

const latestFirst = (a: HistorySessionReference, b: HistorySessionReference) =>
  b.date.localeCompare(a.date) || b.startedAt - a.startedAt;

/**
 * Session updates are immutable. Editing the active workout does not invalidate
 * historical calculations when the completed records themselves are unchanged.
 */
export class CompletedHistoryProjection<T extends HistorySessionReference> {
  private inputs: readonly T[] = [];
  private metadata: readonly (readonly [string, number, number | null | undefined])[] = [];
  private result: readonly T[] = Object.freeze([]);

  derive(sessions: readonly T[]): readonly T[] {
    const completed = sessions.filter(session => session.status === 'completed');
    // Compare storage order, not the sorted result: a historical import can use
    // a different order without making every subsequent active edit expensive.
    const unchanged = completed.length === this.inputs.length && completed.every((session, index) => {
      const previous = this.metadata[index];
      return session === this.inputs[index] && session.date === previous[0]
        && session.startedAt === previous[1] && session.deletedAt === previous[2];
    });
    if (unchanged) return this.result;
    this.inputs = completed;
    this.metadata = completed.map(session => [session.date, session.startedAt, session.deletedAt] as const);
    this.result = Object.freeze(completed.slice().sort(latestFirst));
    return this.result;
  }
}

type HistoricalExercise = ReportSession['exercises'][number];
export interface PreviousPerformance {
  readonly session: ReportSession;
  readonly exercise: HistoricalExercise;
}
interface MatchingSession {
  session: ReportSession;
  exercises: readonly HistoricalExercise[];
}

/** Read-only index for one immutable completed-history snapshot. */
export class PreviousPerformanceIndex {
  private readonly byIdentity = new Map<string, MatchingSession[]>();
  private readonly queries = new Map<string, PreviousPerformance | null>();
  private readonly maxEntries: number;

  constructor(sessions: readonly ReportSession[], maxEntries = 128) {
    this.maxEntries = Number.isFinite(maxEntries) ? Math.max(1, Math.trunc(maxEntries)) : 128;
    const eligible = sessions.filter(session => session.status === 'completed' && session.deletedAt == null)
      .sort(latestFirst);
    for (const session of eligible) {
      const groups = new Map<string, HistoricalExercise[]>();
      for (const exercise of session.exercises) {
        if (exercise.preparationOnly) continue;
        const identity = exercisePerformanceIdentity(exercise);
        const group = groups.get(identity);
        if (group) group.push(exercise);
        else groups.set(identity, [exercise]);
      }
      for (const [identity, exercises] of groups) {
        const history = this.byIdentity.get(identity);
        const entry = { session, exercises };
        if (history) history.push(entry);
        else this.byIdentity.set(identity, [entry]);
      }
    }
  }

  find(exercise: PerformanceExerciseReference, date: string, excludedSessionId = ''): PreviousPerformance | null {
    const identity = exercisePerformanceIdentity(exercise);
    const key = JSON.stringify([identity, exercise.key, date, excludedSessionId]);
    if (this.queries.has(key)) return this.queries.get(key)!;
    let result: PreviousPerformance | null = null;
    for (const entry of this.byIdentity.get(identity) ?? []) {
      if (entry.session.id === excludedSessionId || entry.session.date > date) continue;
      const matched = entry.exercises.find(candidate => candidate.key === exercise.key)
        ?? (entry.exercises.length === 1 ? entry.exercises[0] : null);
      if (matched) result = { session: entry.session, exercise: matched };
      // An ambiguous latest session is not permission to reuse older values.
      break;
    }
    if (this.queries.size >= this.maxEntries) this.queries.delete(this.queries.keys().next().value!);
    this.queries.set(key, result);
    return result;
  }
}
