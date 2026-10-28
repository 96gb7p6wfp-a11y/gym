import { NutritionPayloadSchema } from './domain.js';
import { isGymTraining } from './training-classification.ts';
import type { ActivityRecord } from './activities.ts';
import type { JumpEntry, PerformanceData } from './performance-data.ts';
import { findLibraryExercise } from './exercise-library.ts';
import { reportWeekStart, shiftReportDate, type ReportNutritionRecord, type ReportPlanDay, type ReportSession } from './weekly-report.ts';

type LoggedExercise = ReportSession['exercises'][number];
type LoggedSet = LoggedExercise['logs'][number];
export type ProgressionExercise = Pick<LoggedExercise, 'key' | 'name' | 'group' | 'target' | 'mode'> & Partial<Pick<LoggedExercise, 'measurement' | 'quantityUnit' | 'targetRpe'>> & { exerciseId?: string };
export interface ProgressionRecommendation {
  kind: 'load' | 'reps' | 'hold' | 'reduce' | 'quality' | 'baseline';
  title: string;
  cue: string;
  reason: string;
  intent: string;
  kg?: number;
  reps?: number;
  previous?: { kg: number | null; reps: number };
}
export interface ProgressionContext { volleyballWithin24Hours?: boolean; loadIncrementKg?: number; lowFatigueSession?: boolean; readiness?: { energy: 'low' | 'normal' | 'high'; soreness: 'low' | 'moderate' | 'high' } }
export interface WeightPoint { date: string; kg: number }
export interface WeightWeek { date: string; kg: number; days: number; adequate: boolean }
export interface WeightSummary {
  points: WeightPoint[];
  weeks: WeightWeek[];
  current: number | null;
  weeklyAverage: number | null;
  weeklyDays: number;
  change30Days: number | null;
  stableThreeWeeks: boolean;
  insight: string | null;
}
export interface JumpSummary {
  type: JumpEntry['type'];
  measurement: JumpEntry['measurement'];
  points: { date: string; cm: number; id?: string }[];
  current: number;
  best: number;
  change30Days: number | null;
}
export interface PersonalRecord {
  key: string; exerciseKey: string; name: string;
  kind: 'weight' | 'reps' | 'estimated-1rm' | 'volume' | 'height' | 'touch' | 'distance';
  value: number; unit: 'kg' | 'reps' | 'cm'; date: string;
  context: string; isNew: boolean; sessionId?: string;
}
export interface PerformanceSummary {
  weight: WeightSummary;
  jumps: JumpSummary[];
  records: PersonalRecord[];
  strengthChanges: { name: string; previous: number; current: number; reps: number; percent: number }[];
  gymSessions: number; volleyballSessions: number; consistencyPercent: number | null;
  weeklyVolumeKg: number; weeklySets: number;
  load: { level: 'unknown' | 'limited' | 'steady' | 'higher'; label: string; cue: string };
  insights: string[];
}

const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places;
const number = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const positive = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00Z`).getTime()) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export interface PerformanceExerciseReference { key: string; name: string; mode: string; measurement?: string; exerciseId?: string }
/** Reused by charts and comparisons so a renamed or remeasured movement cannot inherit unrelated results. */
export function exercisePerformanceIdentity(exercise: PerformanceExerciseReference): string {
  return JSON.stringify([exercise.exerciseId ?? exercise.key, exercise.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB'), exercise.mode, exercise.measurement ?? null]);
}
export function areComparableExercises(a: PerformanceExerciseReference, b: PerformanceExerciseReference): boolean {
  return exercisePerformanceIdentity(a) === exercisePerformanceIdentity(b);
}
const identity = exercisePerformanceIdentity;
const savedSessions = (sessions: readonly ReportSession[], today: string) => sessions.filter(s => s.status === 'completed' && s.deletedAt == null && s.date <= today).sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt);
const strengthSets = (exercise: LoggedExercise) => exercise.logs.filter(log => log.done && positive(log.kg) && positive(log.reps));
const measuredSets = (exercise: LoggedExercise) => exercise.logs.filter(log => log.done && positive(log.measurementCm) && (exercise.mode === 'timed' ? positive(log.seconds) : positive(log.reps)));
const lowerBody = (exercise: ProgressionExercise) => /squat|lunge|deadlift|hip thrust|leg press|hamstring|calf|calves|lower|quad|glute|jump|nordic|leg curl|leg extension|step.?up|hip.?flex|adduct|tibialis|copenhagen|good.?morning|romanian|\brdl\b/i.test(`${exercise.name} ${exercise.group} ${findLibraryExercise(exercise)?.muscles.join(' ') ?? ''}`);
const powerExercise = (exercise: ProgressionExercise) => ['Power', 'Plyometric', 'Speed'].includes(findLibraryExercise(exercise)?.category ?? '') || /jump|plyo|bound|pogo|hop|throw|slam|explosive|sprint|power clean|hang clean|snatch/i.test(`${exercise.name} ${exercise.group}`);
export function exerciseIntent(exercise: ProgressionExercise): string {
  if (powerExercise(exercise)) return 'Fast intent · stop when speed or landing quality drops';
  if (exercise.mode === 'timed') return 'Steady position · comfortable breathing';
  const range = repRange(exercise.target);
  return range && range[1] <= 6 ? 'Controlled lowering · strong lift' : 'Controlled reps · full comfortable range';
}
function repRange(target: string): [number, number] | null {
  if (/sec|min|\bhold\b/i.test(target)) return null;
  const match = target.match(/(\d+)\s*(?:[–—-]\s*(\d+))?/);
  if (!match) return null;
  const low = Number(match[1]), high = Number(match[2] ?? match[1]);
  return low > 0 && high >= low && high <= 50 ? [low, high] : null;
}
function previousPerformance(exercise: ProgressionExercise, sessions: readonly ReportSession[], date: string) {
  return savedSessions(sessions, date).flatMap(session => session.exercises.filter(item => identity(item) === identity(exercise)).map(item => ({ exercise: item, date: session.date })));
}

/** Suggestions are advisory. No saved load, set, rep or nutrition target is changed. */
export function getProgressionRecommendation(exercise: ProgressionExercise, sessions: readonly ReportSession[], date: string, context: ProgressionContext = {}): ProgressionRecommendation {
  const history = previousPerformance(exercise, sessions, date);
  const latest = history.at(-1)?.exercise;
  const previous = history.at(-2)?.exercise;
  const intent = exerciseIntent(exercise);
  const base = { intent };
  if (context.lowFatigueSession || (exercise.targetRpe != null && exercise.targetRpe <= 6)) return { ...base, kind: 'quality', title: 'Keep this easy', cue: 'Follow the planned effort. Keep plenty in reserve; do not add load or sets today.', reason: 'Primer or reduced-readiness work prioritizes freshness over overload.' };
  if (exercise.quantityUnit) return { ...base, kind: 'quality', title: 'Distance + posture', cue: 'Use the planned metres per side. Stay tall; do not chase reps or extra load.', reason: 'Carry distance is not a repetition or a 1RM test.' };
  if (/assisted.*pull.?up|pull.?up.*assisted/i.test(exercise.name)) return { ...base, kind: 'quality', title: 'Clean pulling first', cue: 'Build to clean 8/8/8, then gradually reduce assistance. Kg records added load only.', reason: 'More assistance is not more strength; keep the assistance setup in workout notes.' };
  if (context.readiness?.energy === 'low' || (context.readiness?.soreness === 'high' && lowerBody(exercise))) return { ...base, kind: powerExercise(exercise) ? 'quality' : 'hold', title: 'Keep it easy today', cue: powerExercise(exercise) ? 'Use fewer crisp contacts. Stop if jump height or landing control falls.' : 'Keep a comfortable load. Reduce a set if your warm-up feels heavy.', reason: 'Your energy or leg soreness check-in suggests moderating this movement.' };
  if (powerExercise(exercise) || exercise.measurement) return {
    ...base, kind: 'quality', title: 'Quality first', cue: 'Keep reps fast. Finish before jump height or landing control drops.',
    reason: 'Explosive work progresses through crisp, repeatable output, not automatic load increases.',
  };
  if (/trap.?bar.*deadlift/i.test(exercise.name) && history.length < 2) return {
    ...base, kind: 'quality', title: 'Technique first',
    cue: 'Practice the unloaded hinge, then the 20 kg empty bar. Build consistent, pain-free reps before adding load.',
    reason: 'This is an unfamiliar lift. Replace the leg press rather than adding another heavy movement.',
  };
  if (exercise.mode === 'timed') return { ...base, kind: 'quality', title: 'Own the full interval', cue: 'Keep the planned time with a steady position.', reason: 'Add time only when every interval stays controlled.' };
  const range = repRange(exercise.target);
  const completed = latest?.logs.filter(log => log.done && positive(log.reps) && (exercise.mode === 'bodyweight' || positive(log.kg))) ?? [];
  if (!completed.length || !range) return { ...base, kind: 'baseline', title: 'Build your baseline', cue: 'Use a controlled load and leave about 2 reps in reserve.', reason: 'A completed comparable session is needed before suggesting progression.' };
  // Compare sets at the same load; a changed exercise name or mode has its own history.
  const best = [...completed].sort((a, b) => (b.kg ?? 0) - (a.kg ?? 0) || b.reps! - a.reps!)[0];
  const priorSets = previous?.logs.filter(log => log.done && positive(log.reps) && log.kg === best.kg) ?? [];
  const priorReps = priorSets.length ? Math.max(...priorSets.map(log => log.reps!)) : null;
  const previousLabel = { kg: best.kg, reps: best.reps! };
  const decline = priorReps !== null && priorReps - best.reps! >= 2;
  const failedRange = completed.some(log => log.reps! < range[0] && log.rir !== null && log.rir <= 1);
  if (decline || failedRange) return {
    ...base, previous: previousLabel, kind: 'reduce', title: 'Keep it lighter today',
    cue: 'Repeat a comfortable load, or reduce about 5% if the warm-up feels heavy.',
    reason: decline ? 'Reps fell at the same load. Prioritize recovery and technique.' : 'The last session fell short of the planned range near your limit.',
  };
  if (context.volleyballWithin24Hours && lowerBody(exercise)) return {
    ...base, previous: previousLabel, kind: 'hold', title: 'Protect volleyball quality', cue: 'Keep your load. Leave 2–3 reps in reserve; skip extra leg sets.',
    kg: best.kg ?? undefined, reps: Math.max(range[0], Math.min(range[1], best.reps!)), reason: 'Volleyball is within 24 hours; avoid chasing lower-body fatigue.',
  };
  const recent = history.slice(-2);
  const fullUpperRange = recent.length === 2 && recent.every(item => item.exercise.logs.length > 0 && item.exercise.logs.every(log => log.done && log.kg === best.kg && positive(log.reps) && log.reps >= range[1] && log.rir !== null && log.rir >= 2));
  if (fullUpperRange && exercise.mode === 'weight' && positive(best.kg)) {
    const increment = context.loadIncrementKg ?? 0.5;
    if (positive(increment)) {
      const desired = Math.max(increment, Math.floor(best.kg * 0.025 / increment) * increment);
      const increase = round(best.kg + desired, 3);
      if (increase <= best.kg * 1.05 + 0.0001) return {
        ...base, previous: previousLabel, kind: 'load', title: `${number(increase)} kg × ${range[0]}`, kg: increase, reps: range[0],
        cue: 'Small load increase. Start at the bottom of your rep range.', reason: 'All sets reached the top of the range with 2+ reps in reserve in two sessions.',
      };
    }
  }
  const easy = completed.every(log => log.rir !== null && log.rir >= 2);
  if (easy && best.reps! < range[1]) return {
    ...base, previous: previousLabel, kind: 'reps', title: `${best.kg == null ? '' : `${number(best.kg)} kg × `}${best.reps! + 1} reps`,
    kg: best.kg ?? undefined, reps: best.reps! + 1, cue: 'Keep the load. Try one extra controlled rep.', reason: 'You stayed inside the range with reps in reserve.',
  };
  return { ...base, previous: previousLabel, kind: 'hold', title: 'Repeat with quality', kg: best.kg ?? undefined, reps: Math.max(range[0], Math.min(range[1], best.reps!)), cue: 'Keep the load and rep range. Leave about 2 reps in reserve.', reason: fullUpperRange ? 'The next available weight step is too large; keep building control.' : 'Build consistent sets before increasing load. Record reps in reserve when useful.' };
}

export function getWeightSummary(records: readonly ReportNutritionRecord[], today: string, profileWeight?: number): WeightSummary {
  const daily = new Map<string, number[]>();
  for (const record of records) {
    if (!validDate(record.date) || record.date > today) continue;
    const parsed = NutritionPayloadSchema.safeParse(record.payload);
    if (parsed.success && parsed.data.kind === 'weight') daily.set(record.date, [...(daily.get(record.date) ?? []), parsed.data.kg]);
  }
  const points = [...daily].map(([date, weights]) => ({ date, kg: weights.reduce((sum, kg) => sum + kg, 0) / weights.length })).sort((a, b) => a.date.localeCompare(b.date));
  const buckets = new Map<string, WeightPoint[]>();
  for (const point of points) { const week = reportWeekStart(point.date); buckets.set(week, [...(buckets.get(week) ?? []), point]); }
  const weeks: WeightWeek[] = [...buckets].map(([date, checks]) => ({ date, kg: round(checks.reduce((sum, p) => sum + p.kg, 0) / checks.length, 2), days: checks.length, adequate: checks.length >= 3 && checks.at(-1)!.date >= shiftReportDate(checks[0].date, 3) }));
  const week = weeks.find(item => item.date === reportWeekStart(today));
  const completeWeeks = [3, 2, 1].map(n => weeks.find(item => item.date === shiftReportDate(reportWeekStart(today), -7 * n)));
  const adequatelySampled = completeWeeks.every(item => item?.adequate);
  const stableThreeWeeks = adequatelySampled && Math.max(...completeWeeks.map(item => item!.kg)) - Math.min(...completeWeeks.map(item => item!.kg)) <= 0.200001;
  const recent = weeks.filter(item => item.adequate && item.date >= shiftReportDate(today, -30));
  return {
    points, weeks, current: points.at(-1)?.kg ?? (positive(profileWeight) ? profileWeight : null),
    weeklyAverage: week?.kg ?? null, weeklyDays: week?.days ?? 0,
    change30Days: recent.length >= 2 ? round(recent.at(-1)!.kg - recent[0].kg, 2) : null,
    stableThreeWeeks,
    insight: stableThreeWeeks ? 'Weight has been stable for 3 weeks. Consider +100–150 kcal/day, then review your weekly average.' : null,
  };
}

function inferredJumpType(name: string): JumpEntry['type'] | null {
  if (/approach|spike jump/i.test(name)) return 'approach';
  if (/block jump/i.test(name)) return 'block';
  // A paused squat jump is a different test from a standing countermovement jump.
  // Keep its records in the exercise chart instead of merging testing protocols.
  if (/standing|countermovement|\bcmj\b/i.test(name)) return 'standing';
  return null;
}
export function getJumpSummaries(sessions: readonly ReportSession[], jumps: readonly JumpEntry[], today: string): JumpSummary[] {
  const series = new Map<string, { type: JumpEntry['type']; measurement: JumpEntry['measurement']; points: JumpSummary['points'] }>();
  const add = (type: JumpEntry['type'], measurement: JumpEntry['measurement'], point: JumpSummary['points'][number]) => {
    const key = `${type}:${measurement}`;
    const group = series.get(key) ?? { type, measurement, points: [] };
    group.points.push(point); series.set(key, group);
  };
  // Video estimates remain available in the log, but do not become confirmed
  // PRs, trends or improvements alongside directly measured tests.
  for (const jump of jumps) if (jump.source !== 'video-estimate' && validDate(jump.date) && jump.date <= today && positive(jump.cm)) add(jump.type, jump.measurement, { date: jump.date, cm: jump.cm, id: jump.id });
  for (const session of savedSessions(sessions, today)) for (const exercise of session.exercises) {
    if (exercise.quantityUnit || /assisted.*pull.?up|pull.?up.*assisted/i.test(exercise.name)) continue;
    const type = inferredJumpType(exercise.name);
    if (!type || !exercise.measurement || exercise.measurement === 'distance') continue;
    const values = measuredSets(exercise).map(log => log.measurementCm!);
    if (values.length) add(type, exercise.measurement, { date: session.date, cm: Math.max(...values) });
  }
  return [...series.values()].map(group => {
    // A day's best result is the comparable daily measurement.
    const days = new Map<string, JumpSummary['points'][number]>();
    for (const point of group.points) if (!days.has(point.date) || days.get(point.date)!.cm < point.cm) days.set(point.date, point);
    const points = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
    const recent = points.filter(p => p.date >= shiftReportDate(today, -29));
    return { ...group, points, current: points.at(-1)!.cm, best: Math.max(...points.map(p => p.cm)), change30Days: recent.length >= 2 ? round(recent.at(-1)!.cm - recent[0].cm) : null };
  }).sort((a, b) => ['standing', 'approach', 'block'].indexOf(a.type) - ['standing', 'approach', 'block'].indexOf(b.type) || a.measurement.localeCompare(b.measurement));
}

/** Estimated 1RM is intentionally limited to 2–10 completed weighted reps. */
export function estimateOneRepMax(kg: number, reps: number): number | null {
  return positive(kg) && Number.isInteger(reps) && reps >= 2 && reps <= 10 ? round(kg * (1 + reps / 30)) : null;
}
export function getPersonalRecords(sessions: readonly ReportSession[], today: string): PersonalRecord[] {
  const records = new Map<string, PersonalRecord>();
  function consider(exercise: LoggedExercise, session: Pick<ReportSession, 'id' | 'date'>, kind: PersonalRecord['kind'], value: number, unit: PersonalRecord['unit'], context: string, qualifier = '') {
    const key = `${identity(exercise)}:${kind}:${qualifier}`;
    const old = records.get(key);
    if (!old || value > old.value) records.set(key, { key, exerciseKey: exercise.exerciseId ?? exercise.key, name: exercise.name, kind, value: round(value), unit, date: session.date, sessionId: session.id, context, isNew: !!old && (old.sessionId !== session.id || old.isNew) });
  }
  for (const session of savedSessions(sessions, today)) for (const exercise of session.exercises) {
    if (exercise.quantityUnit || /assisted.*pull.?up|pull.?up.*assisted/i.test(exercise.name)) continue;
    if (exercise.measurement) {
      for (const log of measuredSets(exercise)) consider(exercise, session, exercise.measurement, log.measurementCm!, 'cm', `${exercise.measurement === 'touch' ? 'Highest touch' : exercise.measurement === 'distance' ? 'Jump distance' : 'Jump height'} · ${log.reps ?? 1} reps`);
      continue;
    }
    if (exercise.mode === 'bodyweight') {
      for (const log of exercise.logs.filter(log => log.done && positive(log.reps))) {
        consider(exercise, session, 'reps', log.reps!, 'reps', positive(log.kg) ? `With ${number(log.kg)} kg added` : 'Bodyweight', String(log.kg ?? 0));
        if (positive(log.kg)) consider(exercise, session, 'weight', log.kg, 'kg', `Added load · ${log.reps} reps`);
      }
      continue;
    }
    if (exercise.mode !== 'weight') continue;
    const logs = strengthSets(exercise);
    for (const log of logs) {
      consider(exercise, session, 'weight', log.kg!, 'kg', `${log.reps} reps`);
      consider(exercise, session, 'reps', log.reps!, 'reps', `At ${number(log.kg!)} kg`, String(log.kg));
      const estimate = estimateOneRepMax(log.kg!, log.reps!);
      if (estimate !== null) consider(exercise, session, 'estimated-1rm', estimate, 'kg', `Estimated · ${number(log.kg!)} kg × ${log.reps}`);
    }
    if (logs.length) consider(exercise, session, 'volume', logs.reduce((total, log) => total + log.kg! * log.reps!, 0), 'kg', 'One-session logged volume');
  }
  return [...records.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

export function getPerformanceSummary({ sessions, activities = [], plan = [], nutritionRecords = [], performance, today, bodyWeight }: {
  sessions: readonly ReportSession[]; activities?: readonly ActivityRecord[]; plan?: readonly ReportPlanDay[];
  nutritionRecords?: readonly ReportNutritionRecord[]; performance?: Pick<PerformanceData, 'jumps' | 'readiness'>; today: string; bodyWeight?: number;
}): PerformanceSummary {
  const saved = savedSessions(sessions, today);
  const month = saved.filter(s => s.date >= shiftReportDate(today, -29));
  const weekStart = reportWeekStart(today);
  const week = saved.filter(s => s.date >= weekStart);
  const liveActivities = activities.filter(record => record.activity.deletedAt === null && record.activity.date <= today);
  const volleyballSessions = month.filter(s => /volleyball/i.test(s.name)).length + liveActivities.filter(record => record.activity.date >= shiftReportDate(today, -29) && /volleyball/i.test(record.activity.name)).length;
  const records = getPersonalRecords(saved, today);
  const weight = getWeightSummary(nutritionRecords, today, bodyWeight);
  const jumps = getJumpSummaries(saved, performance?.jumps ?? [], today);
  for (const jump of jumps) {
    const best = jump.points.find(point => point.cm === jump.best)!;
    records.push({ key: `manual-jump:${jump.type}:${jump.measurement}`, exerciseKey: `jump:${jump.type}`, name: `${jump.type[0].toUpperCase()}${jump.type.slice(1)} jump`, kind: jump.measurement, value: jump.best, unit: 'cm', date: best.date, context: jump.measurement === 'height' ? 'Jump height' : 'Highest touch', isNew: jump.points.some(point => point.date < best.date && point.cm < best.cm) });
  }
  records.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const gymSessions = month.filter(isGymTraining).length;
  let dueDays = 0, completedDays = 0;
  for (let i = 29; i >= 0; i--) {
    const date = shiftReportDate(today, -i), day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    if (isGymTraining(plan[day])) { dueDays++; if (month.some(s => isGymTraining(s) && s.date === date)) completedDays++; }
  }
  const volume = (items: readonly ReportSession[]) => items.reduce((total, s) => total + s.exercises.filter(e => e.mode === 'weight' && !e.measurement && !e.quantityUnit && !/assisted.*pull.?up|pull.?up.*assisted/i.test(e.name)).reduce((sum, e) => sum + strengthSets(e).reduce((n, log) => n + log.kg! * log.reps!, 0), 0), 0);
  const setCount = (items: readonly ReportSession[]) => items.reduce((total, s) => total + s.exercises.reduce((n, e) => n + e.logs.filter(l => l.done).length, 0), 0);
  const last7 = saved.filter(s => s.date >= shiftReportDate(today, -6));
  const before7 = saved.filter(s => s.date >= shiftReportDate(today, -13) && s.date < shiftReportDate(today, -6));
  const recentActivities = liveActivities.filter(r => r.activity.date >= shiftReportDate(today, -6));
  const oldSets = setCount(before7), newSets = setCount(last7);
  const sampled = new Set(last7.map(s => s.date)).size >= 2 && new Set(before7.map(s => s.date)).size >= 2 && oldSets > 0;
  const setIncrease = sampled ? (newSets - oldSets) / oldSets : null;
  const oldVolume = volume(before7), currentVolume = volume(last7);
  const volumeIncrease = sampled && oldVolume > 0 ? (currentVolume - oldVolume) / oldVolume : null;
  const hardMinutes = recentActivities.filter(r => r.activity.intensity === 'hard').reduce((sum, r) => sum + r.activity.durationMinutes, 0);
  const readiness = performance?.readiness.filter(r => r.date === today).at(-1);
  const load: PerformanceSummary['load'] = readiness && (readiness.energy === 'low' || readiness.soreness === 'high')
    ? { level: 'higher', label: 'Take it easier', cue: 'Your check-in suggests a lighter day. Reduce load or a set if movement quality drops.' }
    : sampled && ((setIncrease ?? 0) > 0.2 || (volumeIncrease ?? 0) > 0.2 || hardMinutes >= 90)
      ? { level: 'higher', label: 'More work recorded', cue: 'More sets, weighted work or hard activity recorded. Keep jumps crisp and avoid adding extra leg volume.' }
      : sampled ? { level: 'steady', label: (setIncrease ?? 0) < -0.2 ? 'Less recorded load' : 'Load is steady', cue: (setIncrease ?? 0) < -0.2 ? 'Fewer sets were recorded than last week. This alone does not measure recovery.' : 'Recorded set count is similar to last week. Let warm-up quality guide today.' }
        : last7.length + recentActivities.length ? { level: 'limited', label: 'Building a baseline', cue: 'More consistent logs are needed to compare load. This is not a recovery assessment.' }
          : { level: 'unknown', label: 'No load baseline', cue: 'Log training and how you feel to build context. Recovery cannot be inferred from missing logs.' };
  const strengthChanges: PerformanceSummary['strengthChanges'] = [];
  const exerciseGroups = new Map<string, { date: string; exercise: LoggedExercise }[]>();
  for (const session of month) for (const exercise of session.exercises) if (exercise.mode === 'weight' && !exercise.measurement && !exercise.quantityUnit && !/assisted.*pull.?up|pull.?up.*assisted/i.test(exercise.name) && strengthSets(exercise).length) exerciseGroups.set(identity(exercise), [...(exerciseGroups.get(identity(exercise)) ?? []), { date: session.date, exercise }]);
  for (const items of exerciseGroups.values()) {
    const first = items[0], last = items.at(-1)!;
    if (first.date === last.date) continue;
    const matches = strengthSets(last.exercise).flatMap(log => {
      const before = strengthSets(first.exercise).filter(old => old.reps === log.reps);
      if (!before.length) return [];
      const old = Math.max(...before.map(l => l.kg!));
      return [{ name: last.exercise.name, previous: old, current: log.kg!, reps: log.reps!, percent: round((log.kg! - old) / old * 100) }];
    });
    if (matches.length) strengthChanges.push(matches.sort((a, b) => b.percent - a.percent)[0]);
  }
  strengthChanges.sort((a, b) => b.percent - a.percent);
  const jumpImprovement = jumps.find(j => j.measurement === 'height' && (j.change30Days ?? 0) > 0);
  const bestStrength = strengthChanges.find(item => item.percent > 0);
  const insights = [
    weight.insight,
    jumpImprovement ? `${jumpImprovement.type[0].toUpperCase()}${jumpImprovement.type.slice(1)} jump is up ${number(jumpImprovement.change30Days!)} cm across recorded tests.` : null,
    bestStrength ? `${bestStrength.name}: +${number(bestStrength.current - bestStrength.previous)} kg at ${bestStrength.reps} reps.` : null,
    load.level === 'higher' ? load.cue : null,
  ].filter((item): item is string => item !== null).slice(0, 3);
  return { weight, jumps, records, strengthChanges, gymSessions, volleyballSessions, consistencyPercent: dueDays ? Math.round(completedDays / dueDays * 100) : null, weeklyVolumeKg: round(volume(week)), weeklySets: setCount(week), load, insights };
}
