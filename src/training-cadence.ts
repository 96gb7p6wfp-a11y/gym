import type { ActivityRecord } from './activities.ts';
import { isGymTraining } from './training-classification.ts';
import { reportWeekStart, shiftReportDate, type ReportPlanDay, type ReportSession } from './weekly-report.ts';

export interface TrainingCadenceDay {
  date: string;
  label: string;
  kind: 'gym' | 'sport' | 'recovery';
  status: 'complete' | 'future' | 'planned' | 'recovery';
  isToday: boolean;
  hasGym: boolean;
  hasActivity: boolean;
}
type CadencePlanDay = ReportPlanDay & { extraSession?: ReportPlanDay };
const normalizedName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');

/** A week of training, rather than a daily streak that treats recovery as failure. */
export function getTrainingCadence({ sessions, activities = [], plan, today, weekStart = reportWeekStart(today) }: {
  sessions: readonly ReportSession[];
  activities?: readonly ActivityRecord[];
  plan: readonly CadencePlanDay[];
  today: string;
  weekStart?: string;
}) {
  const start = reportWeekStart(weekStart);
  const dates = Array.from({ length: 7 }, (_, index) => shiftReportDate(start, index));
  const weekDates = new Set(dates);
  const saved = sessions.filter(session => session.status === 'completed' && session.deletedAt == null && session.date <= today && weekDates.has(session.date));
  const recorded = activities.filter(({ activity }) => activity.deletedAt === null && activity.date <= today && weekDates.has(activity.date));
  const mainGymNames = new Set(plan.filter(isGymTraining).map(day => normalizedName(day.name)));
  const optionalPrimerNames = new Set(plan.flatMap(day => day.extraSession && /primer|technique/i.test(day.extraSession.name)
    && !mainGymNames.has(normalizedName(day.extraSession.name)) ? [normalizedName(day.extraSession.name)] : []));
  const completedGymDates = [...new Set(saved.filter(session => isGymTraining(session)
    && !optionalPrimerNames.has(normalizedName(session.name))).map(session => session.date))].sort();
  const volleyballDates = new Set([
    ...saved.filter(session => /volleyball/i.test(session.name)).map(session => session.date),
    ...recorded.filter(({ activity }) => /volleyball/i.test(activity.name)).map(({ activity }) => activity.date),
  ]);
  const activeDates = new Set([...saved.map(session => session.date), ...recorded.map(({ activity }) => activity.date)]);
  const days: TrainingCadenceDay[] = dates.map((date, index) => {
    const scheduled = plan[index];
    // Optional primers and extra sessions are not additional weekly obligations.
    const kind = isGymTraining(scheduled) ? 'gym' : scheduled?.kind === 'sport' ? 'sport' : 'recovery';
    const hasGym = completedGymDates.includes(date);
    const hasActivity = activeDates.has(date);
    return {
      date, label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][index], kind,
      status: hasActivity ? 'complete' : kind === 'recovery' ? 'recovery' : date > today ? 'future' : 'planned',
      isToday: date === today, hasGym, hasActivity,
    };
  });
  return {
    weekStart: start, dates, days, completedGymDates,
    completedGymDays: completedGymDates.length,
    plannedGymDays: days.filter(day => day.kind === 'gym').length,
    volleyballDays: volleyballDates.size,
    recordedActivityDays: activeDates.size,
  };
}
