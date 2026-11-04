import { exercisePerformanceIdentity, getJumpSummaries, getWeightSummary } from './performance-insights.ts';
import { isGymTraining } from './training-classification.ts';
import { reportWeekStart, shiftReportDate, type ReportSession, type ReportNutritionRecord } from './weekly-report.ts';
import type { PerformanceData } from './performance-data.ts';

export type JourneyRange = 28 | 84 | 'all';
export interface JourneyPoint { date: string; value: number; sessionId?: string; rir: number | null }
export interface JourneySeries { id: string; metric: 'strength' | 'jump' | 'weight'; name: string; unit: string; context: string; points: JourneyPoint[] }
const round = (n: number) => Math.round(n * 100) / 100;
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const dateValid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;

/** Read-only: compare a chosen movement at a fixed rep count, never its largest percentage gain. */
export function getTrainingJourney({ sessions, nutritionRecords = [], performance, today, range = 84 }: {
  sessions: readonly ReportSession[]; nutritionRecords?: readonly ReportNutritionRecord[];
  performance?: PerformanceData; today: string; range?: JourneyRange;
}) {
  const unique = new Map(sessions.map(session => [session.id, session]));
  const live = [...unique.values()].filter(session => session.status === 'completed' && session.deletedAt == null
    && dateValid(session.date) && session.date <= today).sort((a,b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt);
  const earliest = [today, ...live.map(s => s.date), ...nutritionRecords.filter(r => dateValid(r.date) && r.date <= today).map(r => r.date),
    ...(performance?.jumps ?? []).filter(j => dateValid(j.date) && j.date <= today).map(j => j.date)].sort()[0];
  const start = range === 'all' ? earliest : shiftReportDate(today, -(range - 1));
  const recorded = live.filter(session => session.date >= start);
  const gym = recorded.filter(isGymTraining);
  const gymDates = new Set(gym.map(s => s.date));
  const weeks = new Map<string, { date: string; workouts: number; days: Set<string>; sets: number; volumeKg: number }>();
  // All history remains bounded by stored records; empty weeks are shown in 4/12-week views only.
  if (range !== 'all') for (let date = reportWeekStart(start); date <= today; date = shiftReportDate(date, 7)) weeks.set(date, { date, workouts: 0, days: new Set(), sets: 0, volumeKg: 0 });
  const groups = new Map<string, { name: string; reps: number; equipmentLabel?: string; points: JourneyPoint[] }>();
  for (const session of gym) {
    const week = reportWeekStart(session.date);
    const bucket = weeks.get(week) ?? { date: week, workouts: 0, days: new Set<string>(), sets: 0, volumeKg: 0 };
    bucket.workouts++; bucket.days.add(session.date);
    // Combine repeated instances in one session before taking its best matched-rep set.
    const daily = new Map<string, { name: string; reps: number; equipmentLabel?: string; value: number; rir: number | null }>();
    for (const exercise of session.exercises) {
      if (exercise.preparationOnly) continue;
      bucket.sets += exercise.logs.filter(log => log.done).length;
      if (exercise.mode !== 'weight' || exercise.measurement || exercise.quantityUnit || /assisted.*pull.?up|pull.?up.*assisted/i.test(exercise.name)) continue;
      for (const log of exercise.logs) {
        if (!log.done || !valid(log.kg) || !valid(log.reps) || !Number.isInteger(log.reps) || log.reps <= 0) continue;
        bucket.volumeKg += log.kg * log.reps;
        const id = `${exercisePerformanceIdentity(exercise)}:${Boolean(exercise.perSide)}:${log.reps}`;
        const old = daily.get(id);
        if (!old || log.kg > old.value) daily.set(id, { name: exercise.name, reps: log.reps, equipmentLabel: exercise.equipmentLabel?.trim().replace(/\s+/g, ' ') || undefined, value: log.kg, rir: log.rir ?? null });
      }
    }
    for (const [id, point] of daily) {
      const group = groups.get(id) ?? { name: point.name, reps: point.reps, equipmentLabel: point.equipmentLabel, points: [] };
      group.points.push({ date: session.date, value: point.value, rir: point.rir, sessionId: session.id }); groups.set(id, group);
    }
    weeks.set(week, bucket);
  }
  const series: JourneySeries[] = [...groups].map(([id, group]) => ({ id: `strength:${id}`, metric: 'strength', name: `${group.name} · ${group.reps} reps${group.equipmentLabel ? ` · ${group.equipmentLabel}` : ''}`, unit: 'kg',
    context: `Best completed set at the same reps and movement setup. ${group.equipmentLabel ? `Equipment: ${group.equipmentLabel}.` : 'Equipment was not labeled; verify the same setup yourself.'} Compare recorded RIR too; this is load, not a strength score.`, points: group.points }));
  const jumps = getJumpSummaries(live, performance?.jumps ?? [], today);
  for (const jump of jumps) {
    const points = jump.points.filter(p => p.date >= start);
    if (!points.length) continue;
    series.push({ id: `jump:${jump.type}:${jump.measurement}`, metric: 'jump', name: `${jump.type[0].toUpperCase()}${jump.type.slice(1)} ${jump.measurement === 'height' ? 'jump height' : 'highest touch'}`, unit: 'cm',
      context: 'Best recorded result per test day. Compare the same method, surface, shoes and reach. Video estimates are excluded.',
      points: points.map(p => ({ date: p.date, value: p.cm, rir: null })) });
  }
  const weight = getWeightSummary(nutritionRecords.filter(r => r.date >= start), today);
  const weightPoints = weight.weeks.filter(p => p.adequate && p.date >= reportWeekStart(start)
    && weight.points.filter(d => d.date >= start && d.date >= p.date && d.date <= shiftReportDate(p.date, 6)).length >= 3);
  if (weightPoints.length) series.push({ id: 'weight:weekly', metric: 'weight', name: 'Body weight · weekly averages', unit: 'kg',
    context: 'At least 3 check-in days spread across 4 days per week. Weight change does not measure muscle gained.',
    points: weightPoints.map(p => ({ date: p.date, value: p.kg, rir: null })) });
  series.sort((a,b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
  const weekList = [...weeks.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(w => ({ ...w, days: w.days.size, volumeKg: round(w.volumeKg) }));
  return { start, end: today, sessions: recorded, gymDays: gymDates.size, gymWorkouts: gym.length,
    sets: weekList.reduce((n,w)=>n+w.sets,0), series, weeks: weekList,
    sparseWeightDays: weight.points.filter(p => p.date >= start).length };
}

/** A negative or single-day result stays negative/unknown; nothing is invented between observations. */
export function journeyChange(series: JourneySeries) {
  const first = series.points[0], last = series.points.at(-1);
  if (!first || !last || first.date === last.date) return null;
  return { first, last, delta: round(last.value - first.value), percent: first.value > 0 ? round((last.value-first.value)/first.value*100) : null };
}
