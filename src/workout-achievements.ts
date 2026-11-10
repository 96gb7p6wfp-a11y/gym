import { exercisePerformanceIdentity, normalizeEquipmentLabel } from './exercise-identity.ts';
import { areComparableSetEfforts, isOneRepMaxExercise } from './performance-insights.ts';
import type { ReportSession } from './weekly-report.ts';

type Exercise = ReportSession['exercises'][number];
type SetLog = Exercise['logs'][number];
export type WorkoutAchievementStatus = 'baseline' | 'new-record' | 'repeated-best' | 'ordinary';
export interface WorkoutAchievement {
  identity: string;
  exerciseKey: string;
  name: string;
  status: WorkoutAchievementStatus;
  label: string;
  valueLabel: string;
  context: string;
  comparison?: string;
  exercise: Exercise;
  log: SetLog;
}
export interface WorkoutAchievements {
  records: WorkoutAchievement[];
  newRecordCount: number;
  baselineCount: number;
  highlight: WorkoutAchievement | null;
  comparison: string | null;
}
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const positive = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const validReps = (value: number | null | undefined): value is number => positive(value) && Number.isInteger(value);
const validRir = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10;
const statusRank: Record<WorkoutAchievementStatus, number> = { 'new-record': 0, 'repeated-best': 1, baseline: 2, ordinary: 3 };

/** Compact hours/minutes, with no decimal-minute string competing for a grid cell. */
export function formatWorkoutDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '—';
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${number(hours)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`;
}

/** Logging units are retained: a sprint is metres, a hold is seconds, a touch is not jump height. */
export function formatWorkoutSet(exercise: Exercise, log: SetLog): string {
  const side = exercise.perSide ? ' / side' : '';
  if (exercise.measurement && positive(log.measurementCm)) {
    const metric = { height: 'jump height', touch: 'highest touch', distance: 'jump distance' }[exercise.measurement];
    return `${number(log.measurementCm)} cm · ${metric}`;
  }
  if (exercise.mode === 'timed' && positive(log.seconds)) {
    return `${number(log.seconds)} sec${side}${positive(log.kg) ? ` · ${number(log.kg)} kg` : ''}`;
  }
  if (exercise.quantityUnit === 'm') return `${number(log.reps ?? 0)} m${positive(log.seconds) ? ` · ${number(log.seconds)} sec measured` : ''}`;
  const load = exercise.mode === 'bodyweight' ? positive(log.kg) ? `Bodyweight + ${number(log.kg)} kg` : 'Bodyweight'
    : `${number(log.kg ?? 0)} kg`;
  return `${load} × ${number(log.reps ?? 0)}${side}`;
}
function recorded(exercise: Exercise, log: SetLog): boolean {
  if (!log.done) return false;
  if (exercise.measurement) return positive(log.measurementCm);
  if (exercise.mode === 'timed') return positive(log.seconds);
  return validReps(log.reps) && (exercise.mode === 'bodyweight' || exercise.quantityUnit === 'm' || (log.kg != null && Number.isFinite(log.kg) && log.kg >= 0));
}
function comparableStrength(exercise: Exercise): boolean {
  if (exercise.measurement || exercise.quantityUnit || exercise.preparationOnly) return false;
  if (exercise.mode === 'weight') return isOneRepMaxExercise(exercise);
  return exercise.mode === 'bodyweight' && /pull.?up|chin.?up|push.?up/i.test(exercise.name)
    && !/assisted|assistance/i.test(exercise.name);
}
function previousSessions(session: ReportSession, sessions: readonly ReportSession[]) {
  // A duplicated copy of the current snapshot must not become its own baseline.
  const unique = new Map<string, ReportSession>();
  for (const item of sessions) {
    if (item.id === session.id || item.status !== 'completed' || item.deletedAt != null) continue;
    if (item.date < session.date || item.date === session.date && item.startedAt < session.startedAt) unique.set(item.id, item);
  }
  return [...unique.values()];
}
function contextFor(exercise: Exercise, log: SetLog, prior?: SetLog): string {
  const machine = exercise.mode === 'bodyweight' ? `${number(log.kg ?? 0)} kg added · body mass not matched`
    : normalizeEquipmentLabel(exercise.equipmentLabel) ? exercise.equipmentLabel!.trim() : 'Equipment not labeled';
  const effort = prior && validRir(prior.rir) && validRir(log.rir) && prior.rir === log.rir
    ? `RIR ${number(log.rir)} matched` : 'Effort not recorded in both sets';
  return `${machine} · ${effort}`;
}

/**
 * One achievement per movement configuration, not one per set/record formula.
 * Only observed comparable load/repetition bests are celebrated. The first
 * performance and a new rep/effort cohort are baselines, never improvements.
 * Workout jump logs have no protocol field, so they cannot prove test progress;
 * protocol-matched jump comparisons remain in the dedicated performance tests.
 * Pure projection: no session, historic log or storage metadata is modified.
 */
export function getWorkoutAchievements(session: ReportSession, sessions: readonly ReportSession[]): WorkoutAchievements {
  if (session.status !== 'completed' || session.deletedAt != null) return { records: [], newRecordCount: 0, baselineCount: 0, highlight: null, comparison: null };
  const previous = previousSessions(session, sessions);
  const current = new Map<string, { exercise: Exercise; logs: SetLog[] }>();
  for (const exercise of session.exercises) {
    if (exercise.preparationOnly) continue;
    const logs = exercise.logs.filter(log => recorded(exercise, log));
    if (!logs.length) continue;
    const identity = exercisePerformanceIdentity(exercise), group = current.get(identity);
    if (group) group.logs.push(...logs); else current.set(identity, { exercise, logs: [...logs] });
  }
  const records: WorkoutAchievement[] = [];
  for (const [identity, { exercise, logs }] of current) {
    const oldExercises = previous.flatMap(item => item.exercises).filter(item => !item.preparationOnly && exercisePerformanceIdentity(item) === identity);
    const oldLogs = oldExercises.flatMap(item => item.logs.filter(log => recorded(item, log)));
    const strength = comparableStrength(exercise);
    const candidates = logs.map(log => {
      let status: WorkoutAchievementStatus = oldLogs.length ? 'ordinary' : 'baseline';
      let label = oldLogs.length ? 'Logged performance' : 'First recorded performance';
      let context = exercise.measurement ? 'Workout measurement · test setup not recorded' : '';
      let comparison: string | undefined;
      if (strength && validReps(log.reps) && (exercise.mode === 'bodyweight' || positive(log.kg))) {
        const peers = oldLogs.filter(prior => validReps(prior.reps) && areComparableSetEfforts(prior, log));
        const sameReps = peers.filter(prior => prior.reps === log.reps && (exercise.mode === 'bodyweight' || positive(prior.kg)));
        const sameLoad = peers.filter(prior => (prior.kg ?? 0) === (log.kg ?? 0));
        const loadBest = [...sameReps].sort((a, b) => (b.kg ?? 0) - (a.kg ?? 0))[0];
        const repsBest = [...sameLoad].sort((a, b) => b.reps! - a.reps!)[0];
        // A small rep-cohort best must not eclipse an older stronger set that
        // already reached at least these reps with at least this load.
        const dominated = peers.some(prior => (prior.kg ?? 0) >= (log.kg ?? 0) && prior.reps! >= log.reps!
          && ((prior.kg ?? 0) > (log.kg ?? 0) || prior.reps! > log.reps!));
        const loadGain = loadBest && positive(log.kg) && log.kg > (loadBest.kg ?? 0) ? log.kg - (loadBest.kg ?? 0) : 0;
        const repsGain = repsBest && log.reps > repsBest.reps! ? log.reps - repsBest.reps! : 0;
        if (dominated) {
          status = 'ordinary'; label = 'Logged performance';
          context = 'A stronger comparable performance is already recorded';
        } else if (loadGain || repsGain) {
          status = 'new-record'; label = 'New personal record';
          const source = loadGain ? loadBest! : repsBest!;
          const effortMatched = validRir(source.rir) && validRir(log.rir) && source.rir === log.rir;
          comparison = loadGain ? `${exercise.name}: +${number(loadGain)} kg at the same ${number(log.reps)} reps.`
            : `${exercise.name}: +${number(repsGain)} reps ${exercise.mode === 'bodyweight'
              ? positive(log.kg) ? `with the same ${number(log.kg)} kg added` : 'with no added load'
              : `at the same ${number(log.kg ?? 0)} kg`}.`;
          if (!effortMatched) comparison += ' Effort was not recorded in both sets.';
          context = contextFor(exercise, log, source);
        } else if ((loadBest && (log.kg ?? 0) === (loadBest.kg ?? 0)) || (repsBest && log.reps === repsBest.reps)) {
          status = 'repeated-best'; label = 'Personal best matched';
          context = contextFor(exercise, log, loadBest ?? repsBest);
        } else if (!sameReps.length && !sameLoad.length) {
          status = 'baseline'; label = oldLogs.length ? 'New comparison baseline' : 'First recorded performance';
          context = oldLogs.length ? 'No earlier set matches this rep/load target and recorded effort' : 'Repeat the same setup to build a comparison';
        }
      } else if (!oldLogs.length) context ||= 'A starting point for your own history';
      return { identity, exerciseKey: exercise.key, name: exercise.name, status, label, valueLabel: formatWorkoutSet(exercise, log), context, comparison, exercise, log };
    });
    candidates.sort((a, b) => statusRank[a.status] - statusRank[b.status]
      || (b.log.kg ?? 0) - (a.log.kg ?? 0) || (b.log.reps ?? 0) - (a.log.reps ?? 0));
    records.push(candidates[0]);
  }
  const ordered = [...records].sort((a, b) => statusRank[a.status] - statusRank[b.status]);
  return { records, newRecordCount: records.filter(item => item.status === 'new-record').length,
    baselineCount: records.filter(item => item.status === 'baseline').length, highlight: ordered[0] ?? null,
    comparison: ordered.find(item => item.comparison)?.comparison ?? null };
}
