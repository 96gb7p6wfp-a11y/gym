import { useMemo } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronRight, Plus } from 'lucide-react';
import { dateKey, addDays, sessionDuration, sumNutrients } from './domain';
import { getSessionPurpose } from './training-purpose';
import { getTrainingCadence } from './training-cadence';
import { currentReportDate, reportWeekStart } from './weekly-report';
import { getDailyMotivation } from './coaching-summary';
import './today.css';

/** A session cover, rather than a collection of daily statistics. */
export function TodayView({ date, plan, session, otherSession, completed, activities, nutrition, now = Date.now(),
  sessions = [], weeklyPlan = [], performance, bodyWeight, today = currentReportDate(),
  volleyballSchedule, onStart, onPreview, onTrain, onBrowseTrain, onViewLog, onNutrition, onPlan, onActivity,
  onProgress, disabled, programLabel, blockComplete = false, programOffer, onReviewProgram, scheduledEvents = [] }) {
  const day = new Date(`${date}T12:00:00`);
  const active = session?.status === 'active';
  const unscheduled = !active && !completed && plan.exercises.filter(exercise => !exercise.optionalWork).length === 0 && plan.kind !== 'recovery';
  const shownPlan = active ? session : completed ?? plan;
  const purpose = getSessionPurpose(shownPlan, (day.getDay() + 6) % 7);
  const cadence = useMemo(() => getTrainingCadence({ sessions, activities, plan: weeklyPlan,
    today, weekStart: reportWeekStart(date) }), [sessions, activities, weeklyPlan, today, date]);
  const extras = activities.filter(({ activity }) => activity.date === date && activity.deletedAt === null);
  const targets = nutrition?.find(record => record.payload.kind === 'targets')?.payload;
  const totals = sumNutrients((nutrition ?? []).filter(record => record.date === date && record.payload.kind === 'meal').flatMap(record => record.payload.foods));
  const setCount = active || completed
    ? shownPlan.exercises.reduce((count, exercise) => count + exercise.logs.filter(log => log.done).length, 0) : 0;
  const plannedSetCount = active ? session.exercises.reduce((count, exercise) => count + exercise.logs.length, 0) : 0;
  const completedMinutes = completed ? Math.round(sessionDuration(completed) / 60000) : 0;
  let nextVolleyball;
  const berlinTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  for (let offset = 0; offset <= 7; offset++) {
    const next = addDays(day, offset);
    if (volleyballSchedule.days.includes((next.getDay() + 6) % 7) && (offset > 0 || berlinTime < volleyballSchedule.endTime)) { nextVolleyball = next; break; }
  }
  const weekLabel = cadence.weekStart === reportWeekStart(today) ? 'This week'
    : `Week of ${new Date(`${cadence.weekStart}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const progressLabel = `${cadence.completedGymDays} of ${cadence.plannedGymDays} planned gym days recorded`;
  const action = otherSession || active ? onTrain : completed ? () => onViewLog(completed) : blockComplete ? onPlan : unscheduled ? onTrain : onStart;
  const actionLabel = otherSession ? `Resume ${new Date(`${otherSession.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} workout` : active ? 'Continue workout' : completed ? 'View workout'
    : blockComplete ? 'Plan next block' : unscheduled ? 'Choose workout'
      : plan.kind === 'recovery' ? 'Start recovery' : 'Start workout';
  const sessionMeta = active && shownPlan.kind === 'recovery' && !plannedSetCount ? 'Gentle mobility · follow your stretch checklist'
    : active && shownPlan.kind === 'sport' ? 'On court · reflect after training'
    : active ? `${setCount} / ${plannedSetCount} sets complete`
    : completed ? `${completedMinutes} min · ${completed.kind === 'recovery' ? 'recovery recorded' : completed.kind === 'sport' ? 'training recorded' : `${setCount} completed sets`}`
      : plan.kind === 'sport' ? /match/i.test(plan.name) ? `Match · ${plan.startTime ?? 'time not set'} · log actual duration`
        : `${volleyballSchedule.startTime}–${volleyballSchedule.endTime} · Berlin time`
        : `${plan.durationRange ?? `${plan.minutes} min`}${plan.kind === 'recovery' ? ' · mobility & stretching' : ` · ${plan.exercises.filter(exercise => !exercise.optionalWork).length} exercises`}`;
  const remainingCalories = targets?.calories == null ? null : Math.max(0, Math.round(targets.calories - totals.calories));
  const fuelDetail = remainingCalories === null ? 'Meals & daily targets'
    : `${remainingCalories.toLocaleString('en-GB')} kcal remaining · ${Math.round(totals.protein)}${targets.protein ? ` / ${Math.round(targets.protein)}` : ''} g protein`;

  return <div className="today-view journal-today">
    <section className="day-cover" aria-label="Your day" data-session-state={active ? 'active' : completed ? 'complete' : shownPlan.kind === 'recovery' ? 'recovery' : 'ready'}>
      <div className="day-cover__edition">
        <p className="day-motivation" aria-label="Today motivation">{getDailyMotivation({ kind: shownPlan.kind, active, completed: !!completed && !active })}</p>
        <button type="button" className="icon-button" aria-label="Choose training day" onClick={onBrowseTrain ?? onTrain}><CalendarDays size={19} aria-hidden="true" /></button>
      </div>
      <h2 key={`${date}-${purpose.title}`} className="day-cover__title">{purpose.title}</h2>
      <p className="day-cover__purpose">{purpose.subtitle}</p>
      <div className="day-cover__plan-row"><p className="day-cover__prescription">{sessionMeta}{programLabel && !active && !completed && <span className="day-cover__phase"> · {programLabel}</span>}</p>
        {!active && !completed && <button type="button" className="day-cover__preview" disabled={disabled} onClick={onPreview}>View workout<ChevronRight size={14} aria-hidden="true" /></button>}
      </div>
      {active && plannedSetCount > 0 && <div className="day-cover__track" role="progressbar" aria-label="Current workout" aria-valuemin={0} aria-valuemax={plannedSetCount} aria-valuenow={setCount}><span style={{ width: `${plannedSetCount ? setCount / plannedSetCount * 100 : 0}%` }} /></div>}
      <button className="btn day-cover__start" disabled={disabled} onClick={action}>{actionLabel}<ArrowRight size={20} aria-hidden="true" /></button>
    </section>

    <section className="day-week" aria-label="Training progress">
      <button type="button" onClick={onProgress} aria-label={`View training progress: ${progressLabel}`}>
        <span>{weekLabel}</span><span><strong>{cadence.completedGymDays} / {cadence.plannedGymDays}</strong> gym days<ChevronRight size={16} aria-hidden="true" /></span>
      </button>
    </section>

    {programOffer && <button type="button" className="program-review-row" onClick={onReviewProgram}><span>{programOffer}</span><strong>Review plan<ChevronRight size={17} aria-hidden="true" /></strong></button>}
    <div className="day-agenda">
      {nextVolleyball && <section className="day-next" aria-label="Next training event">
        <p className="day-caption">Next on court</p>
        <div><strong>Volleyball</strong><span>{dateKey(nextVolleyball) === date ? 'Today' : nextVolleyball.toLocaleDateString('en-GB', { weekday: 'short' })} · {volleyballSchedule.startTime}–{volleyballSchedule.endTime}</span></div>
      </section>}
      {scheduledEvents.length > 0 && <section className="day-scheduled" aria-label="Also planned">
        <p className="day-caption">Also today</p>
        {scheduledEvents.map(event => <div key={event.name}><strong>{event.name}</strong><span>{event.detail}</span></div>)}
      </section>}
      <button type="button" className="day-fuel" onClick={onNutrition} aria-label="View today’s nutrition">
        <span><strong>Fuel</strong><span>{fuelDetail}</span></span><ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>

    {extras.length > 0 && <section className="day-recorded" aria-label={`${day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} activity timeline`}>
      <div className="day-recorded__heading"><p className="day-caption">Recorded today</p><button type="button" onClick={onActivity}>View all</button></div>
      {extras.slice(0, 3).map(({ activity }) => <button key={activity.id} onClick={onActivity}><span><strong>{activity.name}</strong><span>{activity.durationMinutes} min{activity.distanceKm !== null ? ` · ${activity.distanceKm} km` : ''}</span></span><Check size={16} aria-label="Recorded" /></button>)}
    </section>}

    <div className="day-utilities"><button type="button" onClick={onPlan}>{blockComplete ? 'Plan next block' : 'Weekly plan'}<ChevronRight size={16} aria-hidden="true" /></button><button type="button" onClick={onActivity}>Add activity<Plus size={16} aria-hidden="true" /></button></div>
    <span className="sr-only">{dateKey(day)}</span>
  </div>;
}
