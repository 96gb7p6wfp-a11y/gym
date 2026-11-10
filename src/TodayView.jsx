import { useMemo } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronRight, Plus } from 'lucide-react';
import { dateKey, addDays, sessionDuration, sumNutrients } from './domain';
import { getSessionPurpose } from './training-purpose';
import { getTodayConsistency, getTodayProgress } from './today-progress';
import { currentReportDate, reportWeekStart } from './weekly-report';
import { workoutTitle } from './presentation';
import './today.css';

/** Today's session, real progress, recorded consistency and one useful next step. */
export function TodayView({ date, plan, session, otherSession, completed, activities, nutrition, now = Date.now(),
  sessions = [], weeklyPlan = [], performance, bodyWeight, today = currentReportDate(), athleteMode = true,
  volleyballSchedule, onStart, onPreview, onTrain, onBrowseTrain, onViewLog, onNutrition, onPlan, onActivity,
  onProgress, disabled, programLabel, blockComplete = false, programOffer, onReviewProgram, scheduledEvents = [], prescription, referencePlan, referencePrescription, readinessFeeling }) {
  const day = new Date(`${date}T12:00:00`);
  const active = session?.status === 'active';
  const unscheduled = !active && !completed && plan.exercises.filter(exercise => !exercise.optionalWork).length === 0 && plan.kind !== 'recovery';
  const coach = plan.programRevision === '9';
  const shownPlan = active ? session : completed ?? referencePlan ?? plan;
  const adjusted = coach && !active && !completed && prescription?.changes.length > 0;
  const title = workoutTitle(shownPlan);
  const sessionLabel = active ? 'Session in progress' : completed ? 'Workout recorded'
    : shownPlan.programSessionId === 'v9-match-primer' ? 'Pre-match primer'
    : shownPlan.programRevision === '9' && /^modified/i.test(shownPlan.name) ? 'Modified session'
    : shownPlan.kind === 'recovery' ? 'Recovery day' : /match/i.test(shownPlan.name) ? 'Match day'
      : shownPlan.kind === 'sport' ? (/volleyball/i.test(shownPlan.name) ? 'On-court session' : 'Sport session') : 'Strength session';
  const purpose = getSessionPurpose(shownPlan, (day.getDay() + 6) % 7);
  const adjustment = prescription?.reasons.find(reason => reason.code.startsWith('clearance-lifting-')
    || reason.code === 'saved-preparation' || reason.code === 'readiness-yellow' || reason.code === 'readiness-red'
    || reason.code === 'deload' || reason.code === 'match-week' || reason.code === 'post-match');
  const reviewGuidance = adjustment && (adjustment.code.startsWith('clearance-') || adjustment.code === 'saved-preparation');
  const showAdjustment = !active && !completed && adjustment;
  const cadence = useMemo(() => getTodayConsistency({ sessions, activities, plan: weeklyPlan, today }),
    [sessions, activities, weeklyPlan, today]);
  const progress = useMemo(() => getTodayProgress({ sessions, nutritionRecords: nutrition ?? [], performance, today, athleteMode }),
    [sessions, nutrition, performance, today, athleteMode]);
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
    const coveredByToday = offset === 0 && shownPlan.kind === 'sport' && /volleyball/i.test(shownPlan.name)
      && !/match/i.test(shownPlan.name);
    if (athleteMode && !coveredByToday && volleyballSchedule.days.includes((next.getDay() + 6) % 7)
      && (offset > 0 || berlinTime < volleyballSchedule.endTime)) { nextVolleyball = next; break; }
  }
  const weekLabel = cadence.weekStart === reportWeekStart(today) ? 'This week'
    : `Week of ${new Date(`${cadence.weekStart}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const progressLabel = `${cadence.completedGymDays} of ${cadence.plannedGymDays} planned gym days recorded`;
  const logSport = coach && !active && !completed && !otherSession && plan.kind === 'sport';
  const action = otherSession || active ? onTrain : completed ? () => onViewLog(completed) : blockComplete ? onPlan : unscheduled ? onTrain : logSport ? onActivity : onStart;
  const actionLabel = otherSession ? `Resume ${new Date(`${otherSession.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} workout` : active ? 'Continue workout' : completed ? 'View workout'
    : blockComplete ? 'Plan next block' : unscheduled ? 'Choose workout'
      : logSport ? 'Log activity' : adjusted ? 'Start adjusted workout' : plan.kind === 'recovery' ? 'Start recovery' : 'Start workout';
  const sessionMeta = active && shownPlan.kind === 'recovery' && !plannedSetCount ? 'Gentle mobility · follow your stretch checklist'
    : active && shownPlan.kind === 'sport' ? 'On court · reflect after training'
    : active ? `${setCount} / ${plannedSetCount} sets complete`
    : completed ? `${completedMinutes} min · ${completed.kind === 'recovery' ? 'recovery recorded' : completed.kind === 'sport' ? 'training recorded' : `${setCount} completed sets`}`
      : shownPlan.kind === 'sport' ? /match/i.test(shownPlan.name) ? `Match · ${shownPlan.startTime ?? 'time not set'} · log actual duration`
        : `${volleyballSchedule.startTime}–${volleyballSchedule.endTime}${coach ? '' : ' · Berlin time'}`
        : `${referencePrescription?.duration ?? prescription?.duration ?? shownPlan.durationRange ?? `${shownPlan.minutes} min`}${shownPlan.kind === 'recovery' ? ' · mobility & stretching' : ` · ${shownPlan.exercises.filter(exercise => !exercise.optionalWork).length} exercises`}${shownPlan.programRevision === '9' && shownPlan.kind === 'strength' ? ` · ${shownPlan.exercises.filter(exercise => !exercise.optionalWork).reduce((sum, exercise) => sum + exercise.sets, 0)} planned sets` : ''}`;
  const remainingCalories = targets?.calories == null ? null : Math.max(0, Math.round(targets.calories - totals.calories));
  const fuelDetail = remainingCalories === null ? 'Meals & daily targets'
    : `${remainingCalories.toLocaleString('en-GB')} kcal remaining · ${Math.round(totals.protein)}${targets.protein ? ` / ${Math.round(targets.protein)}` : ''} g protein`;

  return <div className={`today-view journal-today${coach ? ' today-view--coach' : ''}`}>
    <section className="day-cover" aria-label="Your day" data-sport={shownPlan.kind === 'sport' && !active && !completed ? 'true' : undefined} data-session-state={active ? 'active' : completed ? 'complete' : shownPlan.kind === 'recovery' ? 'recovery' : 'ready'} data-adjusted={showAdjustment ? 'true' : undefined}>
      <div className="day-cover__edition">
        <p className="day-context" aria-label="Session type">{sessionLabel}</p>
        {prescription && !completed && <span className="day-cover__effort" aria-label="Planned effort">{!active && coach ? referencePrescription?.label ?? prescription.label : prescription.label}</span>}
        <button type="button" className="icon-button" aria-label="Choose training day" onClick={onBrowseTrain ?? onTrain}><CalendarDays size={19} aria-hidden="true" /></button>
      </div>
      <h2 key={`${date}-${title}`} className={`day-cover__title${title.length > 30 ? ' day-cover__title--long' : ''}`}>{title}</h2>
      {showAdjustment && !coach ? <button type="button" className="day-cover__adjustment"
        aria-label={reviewGuidance && onReviewProgram ? 'Review training guidance' : 'View workout adjustments'}
        onClick={reviewGuidance && onReviewProgram ? onReviewProgram : onPreview} disabled={disabled}>
        <span>{adjustment.title}</span><ChevronRight size={16} aria-hidden="true" />
      </button> : <p className="day-cover__purpose">{!coach && prescription?.label === 'Preparation' ? prescription.objective : purpose.subtitle}</p>}
      <div className="day-cover__plan-row"><p className="day-cover__prescription">{sessionMeta}</p>
        {!active && !completed && <button type="button" className="day-cover__preview" disabled={disabled} onClick={onPreview}>{logSport ? 'View session' : 'View workout'}<ChevronRight size={14} aria-hidden="true" /></button>}
      </div>
      {adjusted && <button type="button" className="coach-today-adjustment" onClick={onPreview}><span>{adjustment?.title ?? 'Adjusted recommendation'} · {prescription.workingSets} sets</span><ChevronRight size={15} aria-hidden="true" /></button>}
      {active && plannedSetCount > 0 && <div className="day-cover__track" role="progressbar" aria-label="Current workout" aria-valuemin={0} aria-valuemax={plannedSetCount} aria-valuenow={setCount}><span style={{ width: `${plannedSetCount ? setCount / plannedSetCount * 100 : 0}%` }} /></div>}
      <button className="btn day-cover__start" disabled={disabled} onClick={action}>{actionLabel}<ArrowRight size={20} aria-hidden="true" /></button>
    </section>

    <section className="today-progress" aria-label="Your progress">
      <button type="button" className="today-progress__open" aria-label="View your progress" aria-describedby="today-progress-summary" onClick={onProgress}>
        <span className="today-section-heading">Your progress<ChevronRight size={17} aria-hidden="true" /></span>
        {progress.metrics.length ? <span id="today-progress-summary" className="today-progress__metrics" data-count={progress.metrics.length}>
          {progress.metrics.map((metric, index) => <span key={metric.id} className={`today-progress__metric${index === 0 ? ' today-progress__metric--lead' : ''}`}
            data-positive={metric.positive ? 'true' : undefined}>
            <span className="today-progress__description"><span className="today-progress__label">{metric.label}</span><strong>{metric.name}</strong></span>
            <span className="today-progress__value">{metric.value}<small>{metric.unit}</small></span>
            <span className="today-progress__detail">{metric.detail}</span>
            {metric.comparison && <span className="today-progress__comparison">{metric.comparison}</span>}
          </span>)}
        </span> : <span id="today-progress-summary" className="today-progress__empty"><strong>A clear baseline comes first.</strong><span>Log working sets or a measured test. Your results will appear here.</span></span>}
      </button>
    </section>

    <section className="day-week today-consistency" aria-label="Training progress">
      <button type="button" onClick={onProgress} aria-label={`View training progress: ${progressLabel}`}>
        <span>{weekLabel}</span><span><strong>{cadence.completedGymDays} / {cadence.plannedGymDays}</strong> gym days recorded<ChevronRight size={16} aria-hidden="true" /></span>
      </button>
      <div className="today-consistency__days" role="list" aria-label="Recorded activity this week">{cadence.days.map(item =>
        <div key={item.date} role="listitem" aria-current={item.isToday ? 'date' : undefined}
          aria-label={`${new Date(`${item.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}: ${item.hasGym ? 'gym workout recorded' : item.hasActivity ? 'activity recorded' : 'no activity recorded'}`}
          data-recorded={item.hasActivity ? 'true' : undefined}>
          <span>{item.label}</span><span>{item.hasActivity ? <Check size={15} aria-hidden="true" /> : <i aria-hidden="true" />}</span>
        </div>)}</div>
      <p className="today-consistency__caption">{athleteMode ? `${cadence.volleyballDays} volleyball ${cadence.volleyballDays === 1 ? 'day' : 'days'} recorded` : `${cadence.recordedActivityDays} ${cadence.recordedActivityDays === 1 ? 'day' : 'days'} with recorded activity`}. Planned sessions do not count as completed.</p>
    </section>

    <section className="today-insight" aria-label="Today’s coaching insight">
      <h2>Next focus</h2><p>{progress.insight}</p>
    </section>

    {coach ? <details className="coach-today-more"><summary>More for today<ChevronRight size={15} /></summary><div className="coach-today-more__links">
      <button type="button" onClick={onNutrition} aria-label="View today’s nutrition"><span>Fuel<small>{fuelDetail}</small></span><ChevronRight size={16} /></button>
      <button type="button" onClick={onPlan}>Weekly plan<ChevronRight size={16} /></button>
      <button type="button" onClick={onActivity}>Add activity<Plus size={16} /></button>
      {nextVolleyball && <p>Next on court · {dateKey(nextVolleyball) === date ? 'Today' : nextVolleyball.toLocaleDateString('en-GB', { weekday: 'short' })} · {volleyballSchedule.startTime}–{volleyballSchedule.endTime}</p>}
      {scheduledEvents.map(event => <p key={event.name}>{event.name} · {event.detail}</p>)}
    </div></details> : <div className="day-agenda">
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
    </div>}

    {extras.length > 0 && <section className="day-recorded" aria-label={`${day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} activity timeline`}>
      <div className="day-recorded__heading"><p className="day-caption">Recorded today</p><button type="button" onClick={onActivity}>View all</button></div>
      {extras.slice(0, 3).map(({ activity }) => <button key={activity.id} onClick={onActivity}><span><strong>{activity.name}</strong><span>{activity.durationMinutes} min{activity.distanceKm !== null ? ` · ${activity.distanceKm} km` : ''}</span></span><Check size={16} aria-label="Recorded" /></button>)}
    </section>}

    {!coach && <div className="day-utilities"><button type="button" onClick={onPlan}>{blockComplete ? 'Plan next block' : 'Weekly plan'}<ChevronRight size={16} aria-hidden="true" /></button><button type="button" onClick={onActivity}>Add activity<Plus size={16} aria-hidden="true" /></button></div>}
    <span className="sr-only">{dateKey(day)}</span>
  </div>;
}
