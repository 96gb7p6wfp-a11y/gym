import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronRight, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { dateKey, addDays, sessionDuration, sumNutrients } from './domain';
import { getSessionPurpose } from './training-purpose';
import { getPerformanceSummary } from './performance-insights';
import { getTrainingCadence } from './training-cadence';
import { currentReportDate, reportWeekStart } from './weekly-report';

const number = value => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });

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
  const summary = useMemo(() => getPerformanceSummary({ sessions, activities, plan: weeklyPlan,
    performance, nutritionRecords: nutrition, bodyWeight, today }),
  [sessions, activities, weeklyPlan, performance, nutrition, bodyWeight, today]);
  const jump = summary.jumps.find(item => item.type === 'approach' && item.measurement === 'height')
    ?? summary.jumps.find(item => item.measurement === 'height');
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
    <section className="today-session" aria-label="Your day">
      <div className="today-session__topline"><p>{active ? 'In progress' : completed ? 'Workout complete' : shownPlan.kind === 'recovery' ? 'Restore performance' : programLabel ?? 'Your training'}</p><button type="button" className="icon-button" aria-label="Choose training day" onClick={() => setDayPickerOpen(true)}><CalendarDays size={19} aria-hidden="true" /></button></div>
      <h2>{purpose.title}</h2><p className="today-session__purpose">{purpose.subtitle}</p>
      <p className="today-session__meta">{active ? `${setCount} / ${plannedSetCount} sets complete` : completed ? `${completedMinutes} min · ${setCount} completed sets` : plan.kind === 'sport' ? plan.name === 'Match' ? 'Match · log your actual duration' : `${volleyballSchedule.startTime}–${volleyballSchedule.endTime} · Berlin time` : `${plan.minutes} min${plan.kind === 'recovery' ? ' · easy pace' : ` · ${plan.exercises.length} exercises`}`}</p>
      {active && <div className="today-session-track" role="progressbar" aria-label="Current workout" aria-valuemin={0} aria-valuemax={plannedSetCount} aria-valuenow={setCount}><span style={{ width: `${plannedSetCount ? setCount / plannedSetCount * 100 : 0}%` }} /></div>}
      <button className="btn today-primary" disabled={disabled} onClick={action}>{actionLabel}<ArrowRight size={20} aria-hidden="true" /></button>
    </section>
    <section className="today-ledger" aria-label="Training progress">
      <button type="button" onClick={onProgress} aria-label={`View training progress: ${progressLabel}`}><span className="today-ledger__label">{weekLabel}</span><strong>{cadence.completedGymDays}<small>/ {cadence.plannedGymDays}</small></strong><span className="today-ledger__detail">Gym days</span></button>
      {jump ? <button type="button" onClick={onProgress} aria-label={`View ${jump.type} jump progress: ${number(jump.current)} centimetres`}><span className="today-ledger__label">{jump.type[0].toUpperCase()}{jump.type.slice(1)} jump</span><strong>{number(jump.current)}<small>cm</small></strong><span className="today-ledger__detail">{jump.change30Days === null ? 'Latest test' : `${jump.change30Days > 0 ? '+' : ''}${number(jump.change30Days)} cm`}</span></button> : <button type="button" onClick={onProgress} aria-label="View body weight progress"><span className="today-ledger__label">Body weight</span><strong>{number(summary.weight.weeklyAverage ?? summary.weight.current ?? bodyWeight)}<small>kg</small></strong><span className="today-ledger__detail">{summary.weight.weeklyAverage !== null ? 'Weekly average' : summary.weight.points.length ? 'Latest check-in' : 'Profile weight'}</span></button>}
      <button type="button" onClick={onNutrition} aria-label="View today’s nutrition"><span className="today-ledger__label">Protein</span><strong>{Math.round(totals.protein)}<small>g</small></strong><span className="today-ledger__detail">{targets?.protein ? `of ${Math.round(targets.protein)} g` : 'Logged today'}</span></button>
    </section>
    {nextVolleyball && <section className="today-agenda" aria-label="Next training event"><p className="eyebrow">Next</p><div className="today-agenda__event"><span className="today-agenda__date">{nextVolleyball.toLocaleDateString('en-GB', { weekday: 'short' })}</span><span><strong>Volleyball</strong><small>{volleyballSchedule.startTime}–{volleyballSchedule.endTime} · Berlin time</small></span></div></section>}
    {scheduledEvents.length > 0 && <section className="today-agenda" aria-label="Also planned"><p className="eyebrow">Also today</p>{scheduledEvents.map(event => <div className="today-agenda__event" key={event.name}><span><strong>{event.name}</strong><small>{event.detail}</small></span></div>)}</section>}
    <div className="today-links"><button type="button" onClick={onPlan}><span>Weekly plan</span><ChevronRight size={18} aria-hidden="true" /></button><button type="button" onClick={onNutrition}><span>Nutrition<small>{targets?.calories ? `${Math.max(0, Math.round(targets.calories - totals.calories)).toLocaleString('en-GB')} kcal remaining` : 'Plan today’s intake'}</small></span><ChevronRight size={18} aria-hidden="true" /></button></div>
    {extras.length > 0 && <section className="today-timeline" aria-label={`${day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} activity timeline`}><div className="section-line"><h3>Recorded today</h3><button className="text-button" onClick={onActivity}>View all</button></div>{extras.slice(0, 3).map(({ activity }) => <button key={activity.id} onClick={onActivity}><span><strong>{activity.name}</strong><small>{activity.durationMinutes} min{activity.distanceKm !== null ? ` · ${activity.distanceKm} km` : ''}</small></span><Check size={16} aria-label="Recorded" /></button>)}</section>}
    <button className="today-add-activity text-button" onClick={onActivity}>Add activity<Plus size={18} aria-hidden="true" /></button>
    <Dialog open={dayPickerOpen} onOpenChange={setDayPickerOpen}><DialogContent className="app-dialog today-day-sheet"><DialogHeader><DialogTitle>Choose a day</DialogTitle><DialogDescription>Your week at a glance.</DialogDescription></DialogHeader>{daySelector}<button className="btn full" onClick={() => setDayPickerOpen(false)}>Done</button></DialogContent></Dialog>
    <span className="sr-only">{dateKey(day)}</span>
  </div>;
}
