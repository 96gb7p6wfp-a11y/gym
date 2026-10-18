import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronRight, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { dateKey, addDays, sessionDuration, sumNutrients } from './domain';
import { getSessionPurpose } from './training-purpose';
import { getTrainingCadence } from './training-cadence';
import { currentReportDate, reportWeekStart } from './weekly-report';
import './today.css';

/** A session cover, rather than a collection of daily statistics. */
export function TodayView({ date, plan, session, completed, activities, nutrition,
  sessions = [], weeklyPlan = [], performance, bodyWeight, today = currentReportDate(),
  volleyballSchedule, onStart, onTrain, onViewLog, onNutrition, onPlan, onActivity,
  onProgress, disabled, daySelector, programLabel, scheduledEvents = [] }) {
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const day = new Date(`${date}T12:00:00`);
  const active = session?.status === 'active';
  const unscheduled = !active && !completed && plan.exercises.length === 0;
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
  const sessionMeta = active ? `${setCount} / ${plannedSetCount} sets complete`
    : completed ? `${completedMinutes} min · ${setCount} completed sets`
      : plan.kind === 'sport' ? plan.name === 'Match' ? 'Match · log your actual duration'
        : `${volleyballSchedule.startTime}–${volleyballSchedule.endTime} · Berlin time`
        : `${plan.minutes} min${plan.kind === 'recovery' ? ' · easy pace' : ` · ${plan.exercises.length} exercises`}`;
  const remainingCalories = targets?.calories == null ? null : Math.max(0, Math.round(targets.calories - totals.calories));
  const fuelDetail = remainingCalories === null ? 'Meals & daily targets'
    : `${remainingCalories.toLocaleString('en-GB')} kcal remaining · ${Math.round(totals.protein)}${targets.protein ? ` / ${Math.round(targets.protein)}` : ''} g protein`;

  return <div className="today-view journal-today">
    <section className="day-cover" aria-label="Your day">
      <div className="day-cover__edition">
        <p>{active ? 'In progress' : completed ? 'Workout complete' : programLabel ?? 'Your session'}</p>
        <button type="button" className="icon-button" aria-label="Choose training day" onClick={() => setDayPickerOpen(true)}><CalendarDays size={19} aria-hidden="true" /></button>
      </div>
      <h2 className="day-cover__title">{purpose.title}</h2>
      <p className="day-cover__purpose">{purpose.subtitle}</p>
      <p className="day-cover__prescription">{sessionMeta}</p>
      {active && <div className="day-cover__track" role="progressbar" aria-label="Current workout" aria-valuemin={0} aria-valuemax={plannedSetCount} aria-valuenow={setCount}><span style={{ width: `${plannedSetCount ? setCount / plannedSetCount * 100 : 0}%` }} /></div>}
      <button className="btn day-cover__start" disabled={disabled} onClick={action}>{actionLabel}<ArrowRight size={20} aria-hidden="true" /></button>
    </section>

    <section className="day-week" aria-label="Training progress">
      <button type="button" onClick={onProgress} aria-label={`View training progress: ${progressLabel}`}>
        <span>{weekLabel}</span><span><strong>{cadence.completedGymDays} / {cadence.plannedGymDays}</strong> gym days<ChevronRight size={16} aria-hidden="true" /></span>
      </button>
    </section>

    <div className="day-agenda">
      {nextVolleyball && <section className="day-next" aria-label="Next training event">
        <p className="day-caption">Next on court</p>
        <div><strong>Volleyball</strong><span>{nextVolleyball.toLocaleDateString('en-GB', { weekday: 'short' })} · {volleyballSchedule.startTime}–{volleyballSchedule.endTime}</span></div>
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

    <div className="day-utilities"><button type="button" onClick={onPlan}>Weekly plan<ChevronRight size={16} aria-hidden="true" /></button><button type="button" onClick={onActivity}>Add activity<Plus size={16} aria-hidden="true" /></button></div>
    <Dialog open={dayPickerOpen} onOpenChange={setDayPickerOpen}><DialogContent className="app-dialog today-day-sheet"><DialogHeader><DialogTitle>Choose a day</DialogTitle><DialogDescription>Your week at a glance.</DialogDescription></DialogHeader>{daySelector}<button className="btn full" onClick={() => setDayPickerOpen(false)}>Done</button></DialogContent></Dialog>
    <span className="sr-only">{dateKey(day)}</span>
  </div>;
}
