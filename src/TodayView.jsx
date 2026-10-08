import { ArrowUpRight, Check, ChevronRight } from 'lucide-react';
import { dateKey, addDays, sumNutrients } from './domain';
import { shortSessionName } from './presentation';

export function TodayView({ date, plan, session, completed, activities, nutrition,
  volleyballSchedule, onStart, onTrain, onViewLog, onNutrition, onPlan, onActivity, disabled, daySelector }) {
  const day = new Date(`${date}T12:00:00`);
  const active = session?.status === 'active';
  const title = shortSessionName(active ? session.name : plan.name);
  const extras = activities.filter(({ activity }) => activity.date === date && activity.deletedAt === null);
  const targets = nutrition?.find(record => record.payload.kind === 'targets')?.payload;
  const totals = sumNutrients((nutrition ?? []).filter(record => record.date === date && record.payload.kind === 'meal').flatMap(record => record.payload.foods));
  let nextVolleyball;
  for (let offset = 1; offset <= 7; offset++) {
    const next = addDays(day, offset);
    if (volleyballSchedule.days.includes((next.getDay() + 6) % 7)) {
      nextVolleyball = next;
      break;
    }
  }
  const dateLabel = day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return <div className="today-view">
    <section className={`today-hero ${plan.kind === 'recovery' ? 'today-hero--recovery' : ''}`} aria-label="Your day">
      <div className="today-hero__top"><span className="eyebrow">{active ? 'IN PROGRESS' : completed ? 'WORKOUT COMPLETE' : plan.kind === 'recovery' ? 'TAKE IT EASY' : 'TODAY’S SESSION'}</span><span className="today-hero__mark" aria-hidden="true">{completed && !active ? <Check size={24} /> : <ArrowUpRight size={24} />}</span></div>
      <h2>{title}</h2>
      <p>{active ? `${session.exercises.reduce((count, exercise) => count + exercise.logs.filter(log => log.done).length, 0)} sets complete · pick up where you left off`
        : plan.kind === 'sport' ? `${volleyballSchedule.startTime}–${volleyballSchedule.endTime} · Berlin time`
        : `${plan.minutes} min${plan.kind === 'recovery' ? ' · move, recover, recharge' : ` · ${plan.exercises.length} exercises`}`}</p>
      <button className="btn today-primary" disabled={disabled} onClick={active ? onTrain : completed ? () => onViewLog(completed) : onStart}>
        {active ? 'Continue workout' : completed ? 'View workout' : plan.kind === 'recovery' ? 'Start recovery' : 'Start workout'}<ChevronRight size={18} aria-hidden="true" />
      </button>
      <button className="today-plan-link" onClick={onPlan}>Weekly plan <ChevronRight size={14} aria-hidden="true" /></button>
    </section>
    {daySelector}
    {nextVolleyball && <div className="today-next"><div><span className="eyebrow">NEXT UP</span><strong>Volleyball</strong></div><p>{nextVolleyball.toLocaleDateString('en-GB', { weekday: 'long' })}<br /><span>{volleyballSchedule.startTime}–{volleyballSchedule.endTime}</span></p></div>}
    <button className="today-nutrition" onClick={onNutrition}>
      <div><span className="eyebrow">FUEL YOUR DAY</span><strong>{targets?.calories ? `${Math.max(0, Math.round(targets.calories - totals.calories)).toLocaleString('en-GB')} kcal left` : 'Your daily nutrition'}</strong><span>{targets?.protein ? `${Math.max(0, Math.round(targets.protein - totals.protein))} g protein to go` : 'Log a meal or set your targets'}</span></div><ChevronRight size={20} aria-hidden="true" />
    </button>
    {extras.length > 0 && <section className="today-timeline" aria-label={`${dateLabel} activity timeline`}><div className="section-line"><h3>Also today</h3><button className="text-button" onClick={onActivity}>View all</button></div>{extras.slice(0, 3).map(({ activity }) => <button key={activity.id} onClick={onActivity}><span className="timeline-dot" /><span><strong>{activity.name}</strong><small>{activity.durationMinutes} min{activity.distanceKm !== null ? ` · ${activity.distanceKm} km` : ''}</small></span><Check size={16} aria-label="Recorded" /></button>)}</section>}
    <button className="today-add-activity text-button" onClick={onActivity}>Add an activity <span aria-hidden="true">+</span></button>
    <span className="sr-only">{dateKey(day)}</span>
  </div>;
}
