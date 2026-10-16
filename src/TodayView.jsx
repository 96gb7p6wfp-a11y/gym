import { useMemo } from 'react';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import { dateKey, addDays, sessionDuration, sumNutrients } from './domain';
import { getSessionPurpose } from './training-purpose';
import { getPerformanceSummary } from './performance-insights';
import { getTrainingCadence } from './training-cadence';
import { getTrendCoordinates } from './progress-chart';
import { currentReportDate, reportWeekStart, shiftReportDate } from './weekly-report';

const number = value => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });

export function TodayView({ date, plan, session, completed, activities, nutrition,
  sessions = [], weeklyPlan = [], performance, bodyWeight, today = currentReportDate(),
  volleyballSchedule, onStart, onTrain, onViewLog, onNutrition, onPlan, onActivity,
  onProgress, disabled, daySelector }) {
  const day = new Date(`${date}T12:00:00`);
  const active = session?.status === 'active';
  const unscheduled = !active && !completed && plan.exercises.length === 0;
  const shownPlan = active ? session : completed ?? plan;
  const purpose = getSessionPurpose(shownPlan, (day.getDay() + 6) % 7);
  const cadence = useMemo(() => getTrainingCadence({ sessions, activities, plan: weeklyPlan,
    today, weekStart: reportWeekStart(date) }), [sessions, activities, weeklyPlan, today, date]);
  const summary = useMemo(() => getPerformanceSummary({ sessions, activities, plan: weeklyPlan,
    performance, nutritionRecords: nutrition, bodyWeight, today }),
  [sessions, activities, weeklyPlan, performance, nutrition, bodyWeight, today]);
  const jump = summary.jumps.find(item => item.type === 'approach' && item.measurement === 'height')
    ?? summary.jumps.find(item => item.measurement === 'height');
  const jumpPoints = jump?.points.filter(point => point.date >= shiftReportDate(today, -29)) ?? [];
  const jumpCoordinates = getTrendCoordinates(jumpPoints.map(point => ({ date: point.date, value: point.cm })), 112, 36, 4);
  const extras = activities.filter(({ activity }) => activity.date === date && activity.deletedAt === null);
  const targets = nutrition?.find(record => record.payload.kind === 'targets')?.payload;
  const totals = sumNutrients((nutrition ?? []).filter(record => record.date === date && record.payload.kind === 'meal').flatMap(record => record.payload.foods));
  const setCount = active || completed
    ? shownPlan.exercises.reduce((count, exercise) => count + exercise.logs.filter(log => log.done).length, 0) : 0;
  const plannedSetCount = active ? session.exercises.reduce((count, exercise) => count + exercise.logs.length, 0) : 0;
  const completedMinutes = completed ? Math.round(sessionDuration(completed) / 60000) : 0;
  let nextVolleyball;
  for (let offset = 1; offset <= 7; offset++) {
    const next = addDays(day, offset);
    if (volleyballSchedule.days.includes((next.getDay() + 6) % 7)) { nextVolleyball = next; break; }
  }
  const weekLabel = cadence.weekStart === reportWeekStart(today) ? 'This week'
    : `Week of ${new Date(`${cadence.weekStart}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const progressLabel = `${cadence.completedGymDays} of ${cadence.plannedGymDays} planned gym days recorded`;
  const action = active ? onTrain : completed ? () => onViewLog(completed) : unscheduled ? onTrain : onStart;
  const actionLabel = active ? 'Continue workout' : completed ? 'View workout'
    : unscheduled ? plan.kind === 'recovery' ? 'View recovery' : 'Choose workout'
      : plan.kind === 'recovery' ? 'Start recovery' : 'Start workout';

  return <div className="today-view">
    <section className={`today-hero${shownPlan.kind === 'recovery' ? ' today-hero--recovery' : ''}`} aria-label="Your day">
      <p className="today-session-status">{active ? 'IN PROGRESS' : completed ? 'WORKOUT COMPLETE' : shownPlan.kind === 'recovery' ? 'RECOVERY DAY' : 'YOUR WORKOUT'}</p>
      <h2>{purpose.title}</h2>
      <p className="today-hero__purpose">{purpose.subtitle}</p>
      <p className="today-hero__meta">{active ? `${setCount} / ${plannedSetCount} sets complete`
        : completed ? `${completedMinutes} min · ${setCount} completed sets`
          : plan.kind === 'sport' ? `${volleyballSchedule.startTime}–${volleyballSchedule.endTime} · Berlin time`
            : `${plan.minutes} min${plan.kind === 'recovery' ? ' · easy pace' : ` · ${plan.exercises.length} exercises`}`}</p>
      {active && <div className="today-session-track" role="progressbar" aria-label="Current workout" aria-valuemin={0} aria-valuemax={plannedSetCount} aria-valuenow={setCount}><span style={{ width: `${plannedSetCount ? setCount / plannedSetCount * 100 : 0}%` }} /></div>}
      <button className="btn today-primary" disabled={disabled} onClick={action}>{actionLabel}<ArrowRight size={19} aria-hidden="true" /></button>
    </section>

    <section className="today-performance" aria-label="Training progress">
      <button type="button" className="today-week-progress" onClick={onProgress} aria-label={`View training progress: ${progressLabel}`}>
        <div className="today-progress-heading"><span>{weekLabel}</span><strong>{cadence.completedGymDays}<small> / {cadence.plannedGymDays} gym days</small></strong></div>
        <div className="today-progress-track" aria-hidden="true">{Array.from({ length: Math.max(1, cadence.plannedGymDays) }, (_, index) => <span key={index} className={index < cadence.completedGymDays ? 'is-complete' : ''} />)}</div>
      </button>
      {jump && <button type="button" className="today-jump-progress" onClick={onProgress} aria-label={`View ${jump.type} jump progress: ${number(jump.current)} centimetres`}>
        <span><small>{jump.type[0].toUpperCase()}{jump.type.slice(1)} jump</small><strong>{number(jump.current)}<span> cm</span></strong></span>
        {jumpCoordinates.length > 1 && <svg viewBox="0 0 112 36" aria-hidden="true"><polyline points={jumpCoordinates.map(point => `${point.x},${point.y}`).join(' ')} /><circle cx={jumpCoordinates.at(-1).x} cy={jumpCoordinates.at(-1).y} r="3" /></svg>}
        <span className="today-jump-change">{jump.change30Days === null ? 'Latest test' : `${jump.change30Days > 0 ? '+' : ''}${number(jump.change30Days)} cm`}<ChevronRight size={15} aria-hidden="true" /></span>
      </button>}
    </section>

    {nextVolleyball && <div className="today-next"><span>Next · Volleyball</span><strong>{nextVolleyball.toLocaleDateString('en-GB', { weekday: 'short' })} · {volleyballSchedule.startTime}</strong></div>}

    <div className="today-schedule">{daySelector}<button className="today-plan-link text-button" onClick={onPlan}>Weekly plan<ChevronRight size={16} aria-hidden="true" /></button></div>

    <button className="today-nutrition" onClick={onNutrition}>
      <div><span>Nutrition</span><strong>{targets?.calories ? `${Math.max(0, Math.round(targets.calories - totals.calories)).toLocaleString('en-GB')} kcal left` : 'Plan today’s intake'}</strong>{targets?.protein && <small>{Math.max(0, Math.round(targets.protein - totals.protein))} g protein to go</small>}</div><ChevronRight size={18} aria-hidden="true" />
    </button>
    {extras.length > 0 && <section className="today-timeline" aria-label={`${day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} activity timeline`}><div className="section-line"><h3>Also today</h3><button className="text-button" onClick={onActivity}>View all</button></div>{extras.slice(0, 3).map(({ activity }) => <button key={activity.id} onClick={onActivity}><span className="timeline-dot" /><span><strong>{activity.name}</strong><small>{activity.durationMinutes} min{activity.distanceKm !== null ? ` · ${activity.distanceKm} km` : ''}</small></span><Check size={16} aria-label="Recorded" /></button>)}</section>}
    <button className="today-add-activity text-button" onClick={onActivity}>Add activity<span aria-hidden="true">+</span></button>
    <span className="sr-only">{dateKey(day)}</span>
  </div>;
}
