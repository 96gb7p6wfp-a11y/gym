import { exercisePerformanceIdentity, normalizeEquipmentLabel } from './exercise-identity.ts';
import { getJumpSummaries, isOneRepMaxExercise, type JumpSummary } from './performance-insights.ts';
import type { JumpEntry } from './performance-data.ts';
import type { ActivityRecord } from './activities.ts';
import { isGymTraining } from './training-classification.ts';
import { shiftReportDate, type ReportSession } from './weekly-report.ts';

export type CoachProgressPeriod = '4w' | '12w' | 'all';
export const coachPeriodLabel = (period: CoachProgressPeriod) => period === '4w' ? '4 weeks' : period === '12w' ? '12 weeks' : 'All time';
export const coachPeriodStart = (today: string, period: CoachProgressPeriod) => period === 'all' ? '0000-01-01' : shiftReportDate(today, period === '4w' ? -27 : -83);
const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const validRir = (value: number | null | undefined): value is number => finite(value) && value >= 0 && value <= 10;
const clean = (value?: string) => value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB') ?? '';
const round = (value: number) => Math.round(value * 1000) / 1000;
const dateValid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(new Date(`${date}T12:00:00Z`).getTime()) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
export interface CoachStrengthPoint { date: string; value: number; kg: number; reps: number; rir: number | null }
export interface CoachStrengthTrend {
  id: string; name: string; equipmentLabel?: string; unit: 'kg' | 'reps'; points: CoachStrengthPoint[];
  latest: CoachStrengthPoint; previous: CoachStrengthPoint | null; change: number | null;
  effortMatched: boolean; recordedDays: number; improvementAcrossDays: boolean; configurationNote?: string;
}
const liftPriority = (name: string) => /hack squat/i.test(name) ? 0 : /romanian deadlift|\brdl\b/i.test(name) ? 1
  : /chest.*press|incline.*press|bench.*press/i.test(name) ? 2 : /pull.?up|chin.?up/i.test(name) ? 3 : 4;

/** Fixed-repetition or fixed-added-load cohorts, never a larger weight at fewer reps.
 * Unknown RIR is labeled unknown. Known different RIR and equipment are separate.
 * The latest day's most-observed cohort wins, not the most favorable improvement.
 */
export function getCoachStrengthTrends(sessions: readonly ReportSession[], today: string, period: CoachProgressPeriod): CoachStrengthTrend[] {
  const start = coachPeriodStart(today, period);
  type Sample = CoachStrengthPoint & { name: string; equipmentLabel?: string; unit: 'kg' | 'reps' };
  const groups = new Map<string, Sample[]>();
  for (const session of sessions) {
    if (session.status !== 'completed' || session.deletedAt != null || !dateValid(session.date) || session.date > today || session.date < start) continue;
    for (const exercise of session.exercises) {
      const bodyweight = exercise.mode === 'bodyweight' && !exercise.preparationOnly && !exercise.measurement && !exercise.quantityUnit
        && /pull.?up|chin.?up|push.?up/i.test(exercise.name);
      if (!bodyweight && !isOneRepMaxExercise(exercise)) continue;
      const id = exercisePerformanceIdentity(exercise);
      for (const log of exercise.logs) {
        if (!log.done || !finite(log.reps) || log.reps <= 0 || !Number.isInteger(log.reps)) continue;
        if (!bodyweight && (!finite(log.kg) || log.kg <= 0)) continue;
        if (bodyweight && log.kg != null && (!finite(log.kg) || log.kg < 0)) continue;
        const kg = log.kg ?? 0;
        const sample: Sample = { date: session.date, value: bodyweight ? log.reps : kg, kg, reps: log.reps,
          rir: validRir(log.rir) ? log.rir : null, name: exercise.name,
          equipmentLabel: normalizeEquipmentLabel(exercise.equipmentLabel) ? exercise.equipmentLabel!.trim().replace(/\s+/g, ' ') : undefined,
          unit: bodyweight ? 'reps' : 'kg' };
        const group = groups.get(id);
        if (group) group.push(sample); else groups.set(id, [sample]);
      }
    }
  }
  const trends: CoachStrengthTrend[] = [];
  for (const [id, samples] of groups) {
    const ordered = [...samples].sort((a, b) => a.date.localeCompare(b.date));
    const latestDay = ordered.at(-1)!.date;
    const latest = ordered.filter(item => item.date === latestDay);
    const cohortKey = (item: Sample) => JSON.stringify([item.unit === 'kg' ? item.reps : item.kg, item.rir]);
    const cohorts = new Map<string, Sample[]>();
    for (const item of latest) cohorts.set(cohortKey(item), [...(cohorts.get(cohortKey(item)) ?? []), item]);
    const chosen = [...cohorts.values()].sort((a, b) => b.length - a.length || Number(a[0].rir === null) - Number(b[0].rir === null)
      || (a[0].unit === 'kg' ? a[0].reps - b[0].reps : a[0].kg - b[0].kg) || (a[0].rir ?? -1) - (b[0].rir ?? -1))[0];
    const target = chosen[0];
    const comparable = ordered.filter(item => (item.unit === 'kg' ? item.reps === target.reps : item.kg === target.kg)
      && (target.rir === null || item.rir === null || target.rir === item.rir));
    const days = new Map<string, Sample[]>();
    for (const item of comparable) days.set(item.date, [...(days.get(item.date) ?? []), item]);
    const points: CoachStrengthPoint[] = [...days.values()].map(items => {
      // Prefer the same known effort; unknown effort remains a fallback, never an invented RIR.
      const sameEffort = items.filter(item => item.rir === target.rir);
      const eligible = sameEffort.length ? sameEffort : items;
      const best = [...eligible].sort((a, b) => b.value - a.value)[0];
      return { date: best.date, value: best.value, kg: best.kg, reps: best.reps, rir: best.rir };
    }).sort((a, b) => a.date.localeCompare(b.date));
    const last = points.at(-1)!;
    const configurationNote = target.unit === 'reps' && /assisted|assistance/i.test(target.name)
      ? 'Assistance is not recorded as a comparable setting. Keep the same assistance and record its configuration before judging pull-up progress.' : undefined;
    const previous = configurationNote ? null : points.at(-2) ?? null;
    const effortMatched = Boolean(previous && last.rir !== null && previous.rir === last.rir);
    const improvementAcrossDays = !configurationNote && points.length >= 3 && points.every(point => point.rir !== null && point.rir === last.rir)
      && points.every((point, index) => index === 0 || point.value >= points[index - 1].value)
      && points.at(-1)!.value > points[0].value;
    trends.push({ id, name: target.name, equipmentLabel: target.equipmentLabel, unit: target.unit, points: configurationNote ? [last] : points, latest: last, previous,
      change: previous ? round(last.value - previous.value) : null, effortMatched, recordedDays: points.length, improvementAcrossDays, ...(configurationNote ? { configurationNote } : {}) });
  }
  return trends.sort((a, b) => liftPriority(a.name) - liftPriority(b.name) || b.recordedDays - a.recordedDays || b.latest.date.localeCompare(a.latest.date) || a.name.localeCompare(b.name));
}

export interface CoachJumpSeries {
  key: string; type: JumpEntry['type']; points: { date: string; cm: number; id?: string }[];
  latest: { date: string; cm: number }; previous: { date: string; cm: number } | null;
  best: number; change: number | null; conditions: string; setupKnown: boolean; source: 'tests' | 'workout';
}
/** Touches, estimates and incompatible standing-reach/condition protocols never share a trend. */
export function getCoachJumpSeries(sessions: readonly ReportSession[], jumps: readonly JumpEntry[], today: string, period: CoachProgressPeriod): CoachJumpSeries[] {
  const groups = new Map<string, { type: JumpEntry['type']; points: CoachJumpSeries['points']; conditions: string; setupKnown: boolean; source: 'tests' | 'workout' }>();
  for (const entry of jumps) {
    if (entry.measurement !== 'height' || entry.source === 'video-estimate' || !dateValid(entry.date) || entry.date > today || !finite(entry.cm) || entry.cm <= 0) continue;
    const key = JSON.stringify([entry.type, entry.standingReachCm ?? null, clean(entry.conditions)]);
    const series = groups.get(key) ?? { type: entry.type, points: [], conditions: entry.conditions?.trim() ?? '', setupKnown: entry.standingReachCm != null && Boolean(entry.conditions?.trim()), source: 'tests' as const };
    series.points.push({ date: entry.date, cm: entry.cm, id: entry.id }); groups.set(key, series);
  }
  for (const series of getJumpSummaries(sessions, [], today).filter(item => item.measurement === 'height')) {
    groups.set(`workout:${series.type}`, { type: series.type, points: series.points, conditions: '', setupKnown: false, source: 'workout' });
  }
  return [...groups].map(([key, group]) => {
    const days = new Map<string, CoachJumpSeries['points'][number]>();
    for (const point of group.points) if (!days.has(point.date) || days.get(point.date)!.cm < point.cm) days.set(point.date, point);
    const all = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
    const points = all.filter(point => point.date >= coachPeriodStart(today, period));
    const latest = all.at(-1)!, previous = points.length >= 2 ? points.at(-2)! : null;
    return { key, type: group.type, points, latest, previous, best: Math.max(...all.map(item => item.cm)), change: previous ? round(latest.cm - previous.cm) : null,
      conditions: group.conditions, setupKnown: group.setupKnown, source: group.source };
  }).sort((a, b) => b.latest.date.localeCompare(a.latest.date) || a.key.localeCompare(b.key));
}

export function primaryCoachJump(series: readonly CoachJumpSeries[], type: JumpEntry['type']): CoachJumpSeries | undefined {
  return series.find(item => item.type === type);
}
export function coachJumpSummary(series: CoachJumpSeries): JumpSummary {
  return { type: series.type, measurement: 'height', points: series.points, current: series.latest.cm, best: series.best,
    change30Days: series.change };
}

/** Recorded attendance, not a compliance score inferred from today's plan. */
export function getCoachConsistency(sessions: readonly ReportSession[], activities: readonly ActivityRecord[], today: string, period: CoachProgressPeriod) {
  const start = coachPeriodStart(today, period);
  const recorded = sessions.filter(item => item.status === 'completed' && item.deletedAt == null && dateValid(item.date) && item.date >= start && item.date <= today);
  const gym = recorded.filter(item => isGymTraining(item) && !['v9-match-primer', 'v9-approach-technique'].includes(item.programSessionId ?? ''));
  const sport = recorded.filter(item => item.kind === 'sport' && /volleyball/i.test(item.name));
  const extra = activities.filter(item => item.activity.deletedAt == null && dateValid(item.activity.date) && item.activity.date >= start && item.activity.date <= today && /volleyball/i.test(item.activity.name));
  return { gymDays: new Set(gym.map(item => item.date)).size, gymSessions: gym.length, volleyballRecords: sport.length + extra.length };
}
