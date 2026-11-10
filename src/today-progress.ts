import type { ActivityRecord } from './activities.ts';
import { getCoachJumpSeries, getCoachStrengthTrends, type CoachJumpSeries } from './coach-progress.ts';
import type { PerformanceData } from './performance-data.ts';
import { getWeightSummary } from './performance-insights.ts';
import { getTrainingCadence } from './training-cadence.ts';
import { reportWeekStart, shiftReportDate, type ReportNutritionRecord, type ReportPlanDay, type ReportSession } from './weekly-report.ts';

export interface TodayProgressMetric {
  id: 'strength' | 'approach' | 'standing' | 'weight';
  label: string;
  name: string;
  value: string;
  unit: 'kg' | 'reps' | 'cm';
  detail: string;
  date: string;
  positive: boolean;
  comparison?: string;
}
export interface TodayProgressInput {
  sessions: readonly ReportSession[];
  nutritionRecords?: readonly ReportNutritionRecord[];
  performance?: PerformanceData;
  today: string;
  athleteMode?: boolean;
}
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`;
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Keep ambiguous same-day protocols in detailed Progress, rather than choosing a favorable test. */
function latestJump(series: readonly CoachJumpSeries[], type: 'approach' | 'standing') {
  const matching = series.filter(item => item.type === type);
  const latest = matching[0];
  return latest && matching.filter(item => item.latest.date === latest.latest.date).length === 1 ? latest : undefined;
}

/** Read-only home projection: measurements, never profile estimates or planned performances. */
export function getTodayProgress({ sessions, nutritionRecords = [], performance, today, athleteMode = true }: TodayProgressInput): {
  metrics: TodayProgressMetric[];
  insight: string;
} {
  const recent = getCoachStrengthTrends(sessions, today, '12w');
  const strength = recent[0] ?? getCoachStrengthTrends(sessions, today, 'all')[0];
  const jumps = athleteMode ? getCoachJumpSeries(sessions, performance?.jumps ?? [], today, 'all') : [];
  const approach = latestJump(jumps, 'approach');
  const standing = latestJump(jumps, 'standing');
  const weight = getWeightSummary(nutritionRecords, today);
  const metrics: TodayProgressMetric[] = [];
  const strengthComparable = strength?.previous && strength.effortMatched && !strength.configurationNote;
  if (strength) {
    const change = strengthComparable ? strength.change : null;
    metrics.push({ id: 'strength', label: 'Strength', name: strength.name,
      value: change == null ? number(strength.latest.value) : signed(change), unit: strength.unit,
      detail: change == null ? `${strength.latest.reps} reps recorded${strength.configurationNote ? ' · assistance not recorded' : strength.latest.rir == null ? ' · effort not recorded' : ` · RIR ${strength.latest.rir}`}`
        : strength.unit === 'kg' ? `at the same ${strength.latest.reps} reps · RIR ${strength.latest.rir}` : `at the same ${number(strength.latest.kg)} kg added load · RIR ${strength.latest.rir}`,
      date: strength.latest.date, positive: change != null && change > 0,
      ...(strengthComparable ? { comparison: `${number(strength.previous!.value)} → ${number(strength.latest.value)} ${strength.unit}${strength.equipmentLabel ? ` · ${strength.equipmentLabel}` : ' · equipment not labeled'}` } : {}),
    });
  }
  for (const [type, jump] of [['approach', approach], ['standing', standing]] as const) {
    if (!jump) continue;
    // A recorded height remains useful; a gain needs compatible recorded setup.
    const change = jump.setupKnown ? jump.change : null;
    metrics.push({ id: type, label: type === 'approach' ? 'Approach jump' : 'Standing vertical', name: 'Jump height',
      value: change == null ? number(jump.latest.cm) : signed(change), unit: 'cm',
      detail: change == null ? jump.setupKnown ? 'Latest measured test' : 'Latest height · repeat the same setup' : 'since the previous comparable test',
      date: jump.latest.date, positive: change != null && change > 0,
      ...(change != null && jump.previous ? { comparison: `${number(jump.previous.cm)} → ${number(jump.latest.cm)} cm · same recorded setup` } : {}),
    });
  }
  if (weight.points.length) {
    const adequateWeeks = weight.weeks.filter(week => week.adequate);
    const latestWeek = adequateWeeks.at(-1);
    const showAverage = latestWeek && latestWeek.date >= shiftReportDate(reportWeekStart(today), -7);
    const previousWeek = showAverage ? adequateWeeks.at(-2) : undefined;
    const last = weight.points.at(-1)!;
    metrics.push({ id: 'weight', label: 'Body weight', name: showAverage ? 'Weekly average' : 'Latest check-in',
      value: number(showAverage ? latestWeek.kg : last.kg), unit: 'kg',
      detail: showAverage ? `${latestWeek.days} check-in days · week of ${shortDate(latestWeek.date)}` : `Recorded ${shortDate(last.date)} · daily changes can fluctuate`,
      date: showAverage ? latestWeek.date : last.date, positive: false,
      ...(showAverage && previousWeek ? { comparison: `${signed(latestWeek.kg - previousWeek.kg)} kg between recorded weekly averages` } : {}),
    });
  }

  let insight: string;
  if (strengthComparable && strength.change! > 0 && strength.latest.date >= shiftReportDate(today, -28)) {
    insight = `You logged ${signed(strength.change!)} ${strength.unit} on ${strength.name} at the same ${strength.unit === 'kg' ? `${strength.latest.reps} reps` : 'added load'} and RIR. Keep the same setup to make the next comparison useful.`;
  } else if (approach?.setupKnown && approach.previous && approach.change != null && approach.latest.date >= shiftReportDate(today, -28)) {
    insight = approach.change === 0 ? 'Your last two comparable approach-jump tests recorded the same height. Keep the same setup for your next test.'
      : `Your approach jump measured ${signed(approach.change)} cm versus the previous comparable test. Repeat the same reach, surface and technique when testing.`;
  } else if (athleteMode && (!approach || approach.latest.date < shiftReportDate(today, -14))) {
    insight = approach ? `Your last approach-jump test was ${shortDate(approach.latest.date)}. A fresh test in the same setup is a useful next check when practical.`
      : 'Record standing reach and approach touch when practical to establish your jump baseline.';
  } else if (strength && !strengthComparable) {
    insight = 'Repeat one main lift with the same equipment, repetition target and effort to build a useful strength comparison.';
  } else {
    insight = 'Follow today’s prescribed work and record the sets you actually complete. Consistent records make your next recommendation more useful.';
  }
  return { metrics, insight };
}

/** Completed days, not scheduled attendance or an inferred streak. */
export function getTodayConsistency({ sessions, activities = [], plan, today }: {
  sessions: readonly ReportSession[];
  activities?: readonly ActivityRecord[];
  plan: readonly ReportPlanDay[];
  today: string;
}) {
  // Ending an empty strength session does not establish a completed gym day.
  const recordedSessions = sessions.filter(session => session.kind !== 'strength'
    || session.exercises.some(exercise => exercise.logs.some(log => log.done)));
  const cadence = getTrainingCadence({ sessions: recordedSessions, activities, plan, today });
  const within = (date: string) => date >= cadence.weekStart && date <= today && cadence.dates.includes(date);
  const isVolleyball = (name: string, sport?: string) => sport ? sport === 'volleyball' : /volleyball/i.test(name);
  const volleyballDates = new Set([
    ...recordedSessions.filter(session => session.kind === 'sport' && session.status === 'completed' && session.deletedAt == null
      && within(session.date) && isVolleyball(session.name, session.trainingExposure?.sport)).map(session => session.date),
    ...activities.filter(({ activity }) => activity.deletedAt == null && within(activity.date)
      && isVolleyball(activity.name, activity.trainingExposure?.sport)).map(({ activity }) => activity.date),
  ]);
  return { ...cadence, volleyballDays: volleyballDates.size };
}
