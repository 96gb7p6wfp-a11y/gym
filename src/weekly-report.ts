import type { z } from 'zod';
import { SessionSchema, PlanDaySchema, NutritionPayloadSchema, completedSets, estimatedCalories as loggedWeightVolume, getCalories, sessionDuration } from './domain.js';
import { estimateActivity, type ActivityRecord } from './activities.ts';

export type ReportSession = z.infer<typeof SessionSchema>;
export type ReportPlanDay = z.infer<typeof PlanDaySchema>;

export interface ReportNutritionRecord {
  date: string;
  payload: unknown;
}

export interface ReportNutritionSummary {
  available: boolean;
  mealLoggedDays: number;
  mealsLogged: number;
  meanLoggedProteinGrams: number | null;
}

export interface WeeklyReportInput {
  weekStart: string;
  sessions: readonly ReportSession[];
  activities: readonly ActivityRecord[];
  plan: readonly ReportPlanDay[];
  bodyWeight?: number;
  nutritionRecords?: readonly ReportNutritionRecord[];
}

export interface ReportTotals {
  workouts: number;
  gymDays: number;
  extraActivities: number;
  activeDays: number;
  minutes: number;
  completedSets: number;
  volumeKg: number;
  activeCalories: number;
  runKm: number;
  cycleKm: number;
}

export interface PerformanceComparison {
  key: string;
  name: string;
  kind: 'weight' | 'touch' | 'height' | 'distance';
  previous: number;
  current: number;
  previousReps?: number;
  currentReps?: number;
}

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  dates: string[];
  previousWeekStart: string;
  totals: ReportTotals;
  previous: ReportTotals;
  plannedGymDays: number;
  completedPlannedGymDays: number;
  minutesChangePercent: number | null;
  performance: PerformanceComparison[];
  insights: string[];
  actions: string[];
  hasData: boolean;
  limitedData: boolean;
  nutrition: ReportNutritionSummary;
}

function calendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid report date.');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Choose a valid report date.');
  }
  return date;
}

/** Calendar arithmetic deliberately avoids 24-hour millisecond offsets across DST. */
export function shiftReportDate(value: string, days: number): string {
  const date = calendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function reportWeekStart(value: string): string {
  const date = calendarDate(value);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

export function currentReportDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function collectWeek(dates: readonly string[], sessions: readonly ReportSession[], records: readonly ActivityRecord[]) {
  const dateSet = new Set(dates);
  const workouts = sessions.filter(session => session.status === 'completed' && session.deletedAt == null && dateSet.has(session.date));
  const activities = records.filter(({ activity }) => activity.deletedAt === null && dateSet.has(activity.date)).map(({ activity }) => activity);
  const totals: ReportTotals = {
    workouts: workouts.length,
    gymDays: new Set(workouts.filter(session => session.kind === 'strength').map(session => session.date)).size,
    extraActivities: activities.length,
    activeDays: new Set([...workouts.map(session => session.date), ...activities.map(activity => activity.date)]).size,
    minutes: Math.round((workouts.reduce((total, session) => total + sessionDuration(session), 0) / 60_000
      + activities.reduce((total, activity) => total + activity.durationMinutes, 0)) * 10) / 10,
    completedSets: workouts.reduce((total, session) => total + completedSets(session), 0),
    // The legacy domain helper is named estimatedCalories but returns kg × reps.
    volumeKg: workouts.reduce((total, session) => total + loggedWeightVolume(session.exercises), 0),
    activeCalories: Math.round(workouts.reduce((total, session) => total + getCalories(session), 0)
      + activities.reduce((total, activity) => total + estimateActivity(activity).calories, 0)),
    runKm: activities.filter(activity => activity.type === 'run').reduce((total, activity) => total + (activity.distanceKm ?? 0), 0),
    cycleKm: activities.filter(activity => activity.type === 'cycle').reduce((total, activity) => total + (activity.distanceKm ?? 0), 0),
  };
  return { workouts, activities, totals };
}

type PerformanceValue = PerformanceComparison & { date: string; startedAt: number };

function completedPerformance(session: ReportSession): PerformanceValue[] {
  return session.exercises.flatMap<PerformanceValue>(exercise => {
    const base = { key: exercise.key, name: exercise.name, date: session.date, startedAt: session.startedAt };
    // Measurements represent different things: touch, jump height and distance never mix.
    if (exercise.measurement) {
      const values = exercise.logs.filter(log => log.done && (log.measurementCm ?? 0) > 0
        && (exercise.mode === 'timed' ? (log.seconds ?? 0) > 0 : (log.reps ?? 0) > 0)).map(log => log.measurementCm!);
      if (!values.length) return [];
      return [{ ...base, kind: exercise.measurement, previous: 0, current: Math.max(...values) }];
    }
    if (exercise.mode !== 'weight') return [];
    const best = exercise.logs.filter(log => log.done && (log.kg ?? 0) > 0 && (log.reps ?? 0) > 0)
      .reduce<(typeof exercise.logs)[number] | undefined>((top, log) => !top || log.kg! > top.kg!
        || (log.kg === top.kg && log.reps! > top.reps!) ? log : top, undefined);
    return best ? [{ ...base, kind: 'weight' as const, previous: 0, current: best.kg!, currentReps: best.reps! }] : [];
  });
}

function performanceIdentity(value: PerformanceValue): string {
  // A custom rename can keep the old key, but must not inherit its comparisons.
  return JSON.stringify([value.key, value.kind, value.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB')]);
}

function comparePerformance(current: readonly ReportSession[], previous: readonly ReportSession[]): PerformanceComparison[] {
  const before = new Map<string, PerformanceValue>();
  for (const session of [...previous].sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)) {
    for (const value of completedPerformance(session)) before.set(performanceIdentity(value), value);
  }
  const after = new Map<string, PerformanceValue>();
  for (const session of current) {
    for (const value of completedPerformance(session)) {
      const key = performanceIdentity(value);
      const old = after.get(key);
      if (!old || value.current > old.current || (value.current === old.current && (value.currentReps ?? 0) > (old.currentReps ?? 0))) after.set(key, value);
    }
  }
  return [...after.entries()].flatMap(([key, value]) => {
    const earlier = before.get(key);
    if (!earlier) return [];
    return [{ key: value.key, name: value.name, kind: value.kind, previous: earlier.current, current: value.current,
      ...(value.kind === 'weight' ? { previousReps: earlier.currentReps, currentReps: value.currentReps } : {}) }];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function weekDates(start: string) {
  return Array.from({ length: 7 }, (_, index) => shiftReportDate(start, index));
}

function collectNutrition(dates: readonly string[], records?: readonly ReportNutritionRecord[]): ReportNutritionSummary {
  const dailyProtein = new Map<string, number>();
  const dateSet = new Set(dates);
  let mealsLogged = 0;
  for (const record of records ?? []) {
    if (!dateSet.has(record.date)) continue;
    const parsed = NutritionPayloadSchema.safeParse(record.payload);
    if (!parsed.success || parsed.data.kind !== 'meal') continue;
    const protein = parsed.data.foods.reduce((total, food) => total + food.protein, 0);
    dailyProtein.set(record.date, (dailyProtein.get(record.date) ?? 0) + protein);
    mealsLogged++;
  }
  return {
    available: records !== undefined,
    mealLoggedDays: dailyProtein.size,
    mealsLogged,
    meanLoggedProteinGrams: dailyProtein.size
      ? Math.round([...dailyProtein.values()].reduce((total, grams) => total + grams, 0) / dailyProtein.size * 10) / 10
      : null,
  };
}

export function getWeeklyReport(input: WeeklyReportInput): WeeklyReportData {
  const weekStart = reportWeekStart(input.weekStart);
  const dates = weekDates(weekStart);
  const previousWeekStart = shiftReportDate(weekStart, -7);
  const current = collectWeek(dates, input.sessions, input.activities);
  const previous = collectWeek(weekDates(previousWeekStart), input.sessions, input.activities);
  const plannedGymDates = dates.filter((_, index) => input.plan[index]?.kind === 'strength');
  const completedGymDates = new Set(current.workouts.filter(session => session.kind === 'strength').map(session => session.date));
  const completedPlannedGymDays = plannedGymDates.filter(date => completedGymDates.has(date)).length;
  const hasData = current.totals.workouts + current.totals.extraActivities > 0;
  const limitedData = current.totals.workouts + current.totals.extraActivities < 2 || previous.totals.workouts + previous.totals.extraActivities < 2;
  const minutesChangePercent = previous.totals.minutes > 0
    ? Math.round((current.totals.minutes - previous.totals.minutes) / previous.totals.minutes * 100) : null;
  const performance = comparePerformance(current.workouts, previous.workouts);
  const nutrition = collectNutrition(dates, input.nutritionRecords);
  const nutritionInsight = nutrition.mealLoggedDays
    ? `Meals logged on ${nutrition.mealLoggedDays}/7 days: ${nutrition.meanLoggedProteinGrams} g protein/day recorded; partial logs, other meals unknown.`
    : null;
  const insights: string[] = [];
  const actions: string[] = [];

  if (!hasData) {
    insights.push('No completed workouts or extra activities recorded this week.');
    insights.push('This report uses saved logs; it cannot assess unrecorded training.');
    actions.push('Record your sessions and any runs or rides.');
    actions.push('Follow your plan and keep recovery days easy.');
    if (nutritionInsight) insights.push(nutritionInsight);
  } else {
    insights.push(`${completedPlannedGymDays}/${plannedGymDates.length} planned gym days recorded; ${current.totals.activeDays} active ${current.totals.activeDays === 1 ? 'day' : 'days'} in total.`);
    if (previous.totals.minutes === 0) insights.push('No previous-week training baseline; percentage trends are unavailable.');
    else if (limitedData) insights.push('Only a few logs to compare; duration changes are observations, not a fitness assessment.');
    else insights.push(`Recorded time ${minutesChangePercent! >= 0 ? 'increased' : 'decreased'} ${Math.abs(minutesChangePercent!)}% versus last week; intensity may differ.`);

    const recoveryEffort = current.activities.some(activity => activity.intensity === 'hard' && input.plan[dates.indexOf(activity.date)]?.kind === 'recovery')
      || current.workouts.some(session => session.kind !== 'recovery' && input.plan[dates.indexOf(session.date)]?.kind === 'recovery');
    const hardLegDayCardio = current.activities.some(activity => activity.intensity === 'hard' && ['run', 'cycle'].includes(activity.type)
      && /lower|jump/i.test(input.plan[dates.indexOf(activity.date)]?.name ?? ''));
    if (recoveryEffort) insights.push(`Hard activity on a planned recovery day.${nutritionInsight ? ` ${nutritionInsight}` : ''}`);
    else if (hardLegDayCardio) insights.push(`Hard cardio shared a lower-body or jump day.${nutritionInsight ? ` ${nutritionInsight}` : ''}`);
    else if (nutritionInsight) insights.push(nutritionInsight);
    else if (performance.length) insights.push('Matching exercises have recorded comparisons below; setup and technique may affect results.');
    else insights.push('No matching exercise measurements in both weeks yet.');

    actions.push(minutesChangePercent !== null && minutesChangePercent > 20
      ? 'Time rose notably: adjust gradually and ease off if recovery feels poor.'
      : 'Repeat consistent sessions; add load only with controlled technique.');
    actions.push(recoveryEffort || hardLegDayCardio
      ? 'Move hard cardio away from jump work; keep a recovery day easy.'
      : 'Keep an easy recovery day and aim for 7–9 hours of sleep.');
  }
  const weight = input.bodyWeight;
  actions.push(weight !== undefined && Number.isFinite(weight) && weight >= 20 && weight <= 400
    ? `Include carbs around training and roughly ${Math.round(weight * 1.4)}–${Math.round(weight * 2)} g protein/day.`
    : 'Include carbs around training and protein in regular meals.');

  return { weekStart, weekEnd: dates[6], dates, previousWeekStart, totals: current.totals, previous: previous.totals,
    plannedGymDays: plannedGymDates.length, completedPlannedGymDays, minutesChangePercent, performance,
    insights: insights.slice(0, 3), actions: actions.slice(0, 3), hasData, limitedData, nutrition };
}
