import { Check, ChevronDown } from 'lucide-react';
import type { ActivityRecord } from './activities';
import { getSessionPurpose } from './training-purpose';
import { shiftReportDate, type ReportPlanDay, type ReportSession } from './weekly-report';
import './weekly-performance.css';

export interface WeeklyPerformanceProps {
  plan: readonly ReportPlanDay[];
  sessions: readonly ReportSession[];
  activities?: readonly ActivityRecord[];
  weekStart: string;
  volleyballSchedule?: { startTime: string; endTime: string };
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const normalized = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
function matchesPlan(session: ReportSession, day: ReportPlanDay) {
  if (session.kind !== day.kind) return false;
  return normalized(session.name) === normalized(day.name)
    || normalized(getSessionPurpose(session).title) === normalized(getSessionPurpose(day).title);
}

function weeklyFocus(plan: readonly ReportPlanDay[]) {
  const hasJump = plan.some(day => day.goal === 'jump' || /jump|explosive lower|complex lower/i.test(day.name));
  const hasPower = hasJump || plan.some(day => day.goal === 'power' || /power/i.test(day.name));
  const hasUpper = plan.some(day => /upper/i.test(day.name) || day.exercises.some(exercise => /chest|back|shoulder|arms/i.test(exercise.group)));
  if (hasPower && hasUpper) return 'Explosive power + upper-body strength';
  if (hasJump) return 'Jump power + landing quality';
  if (hasPower) return 'Explosive power + quality reps';
  if (plan.some(day => day.goal === 'hypertrophy')) return 'Muscle development + consistency';
  if (plan.some(day => day.goal === 'strength' || day.kind === 'strength')) return 'Strength + movement quality';
  if (plan.length && plan.every(day => day.kind === 'recovery')) return 'Recovery + movement quality';
  return 'Follow your plan';
}

function activityLabel(record: ActivityRecord) {
  const activity = record.activity;
  const label = ({ cycle: 'Cycling', run: 'Run', walk: 'Walk', swim: 'Swim', other: activity.name } as const)[activity.type];
  return `${label}${activity.distanceKm === null ? '' : ` ${Number(activity.distanceKm.toFixed(1))} km`}`;
}

/** A quiet calendar, separate from the numerical weekly report. Only saved logs earn a check. */
export function WeeklyPerformance({ plan, sessions, activities = [], weekStart, volleyballSchedule }: WeeklyPerformanceProps) {
  const savedSessions = [...new Map(sessions.filter(session => session.status === 'completed' && session.deletedAt == null).map(session => [session.id, session])).values()];
  const savedActivities = [...new Map(activities.filter(record => record.activity.deletedAt == null).map(record => [record.activity.id, record])).values()];
  const dates = Array.from({ length: 7 }, (_, index) => shiftReportDate(weekStart, index));
  const clock = (value: string) => value.endsWith(':00') ? value.slice(0, -3) : value;
  return <details className="weekly-performance">
    <summary><span>Week schedule</span><ChevronDown aria-hidden="true" size={18} /></summary>
    <div className="weekly-performance__body">
      <ol className="weekly-performance__days">
        {dates.map(date => {
          const dayIndex = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
          const day = plan[dayIndex];
          const purpose = day ? getSessionPurpose(day, dayIndex) : null;
          const completed = savedSessions.filter(session => session.date === date);
          const didPlan = Boolean(day && completed.some(session => matchesPlan(session, day)));
          const primer = (day as ReportPlanDay & { extraSession?: ReportPlanDay } | undefined)?.extraSession;
          const secondary: string[] = [];
          if (primer) secondary.push(`${getSessionPurpose(primer, dayIndex).title}${completed.some(session => matchesPlan(session, primer)) ? ' ✓' : ''}`);
          for (const session of completed) {
            if ((!day || !matchesPlan(session, day)) && (!primer || !matchesPlan(session, primer))) secondary.push(`${getSessionPurpose(session, dayIndex).title} ✓`);
          }
          secondary.push(...savedActivities.filter(record => record.activity.date === date).map(activityLabel));
          const otherWork = [...new Set(secondary)].join(' · ');
          const isVolleyball = day && (day.kind === 'sport' || day.goal === 'sport') && /volleyball/i.test(day.name);
          const time = isVolleyball && volleyballSchedule ? `${clock(volleyballSchedule.startTime)}–${clock(volleyballSchedule.endTime)}` : null;
          return <li key={date} className="weekly-performance__day">
            <div className="weekly-performance__date"><span>{weekdays[dayIndex]}</span><time dateTime={date}>{Number(date.slice(-2))}</time></div>
            <div className="weekly-performance__training"><strong>{purpose?.title ?? 'Unscheduled'}</strong>{otherWork && <span className="weekly-performance__extra" title={otherWork}>{otherWork}</span>}</div>
            <div className="weekly-performance__status">{time && <span>{time}</span>}{didPlan && <span className="weekly-performance__done" aria-label={`${weekdays[dayIndex]} workout complete`}><Check size={19} aria-hidden="true" /></span>}</div>
          </li>;
        })}
      </ol>
      <div className="weekly-performance__focus"><span>Weekly focus</span><p>{weeklyFocus(plan)}</p></div>
    </div>
  </details>;
}

export default WeeklyPerformance;
