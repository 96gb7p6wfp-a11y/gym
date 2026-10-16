import { ChevronRight, Plus } from 'lucide-react';
import type { ActivityRecord } from './activities';
import type { PerformanceData } from './performance-data';
import { getPerformanceSummary } from './performance-insights';
import { getTrendCoordinates } from './progress-chart';
import { getTrainingCadence } from './training-cadence';
import { currentReportDate, shiftReportDate, type ReportNutritionRecord, type ReportPlanDay, type ReportSession } from './weekly-report';
import './progress-overview.css';

interface ProgressOverviewProps {
  sessions: readonly ReportSession[];
  activities: readonly ActivityRecord[];
  plan: readonly ReportPlanDay[];
  bodyWeight?: number;
  nutritionRecords?: readonly ReportNutritionRecord[];
  performance?: PerformanceData;
  today?: string;
  onViewStrength?: () => void;
  onViewPerformance?: () => void;
  onViewHistory?: () => void;
  onViewWeek?: () => void;
  onLogWeight?: () => void;
  onLogJump?: () => void;
}
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`;
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function ProgressOverview({ sessions, activities, plan, bodyWeight, nutritionRecords, performance, today = currentReportDate(), onViewStrength, onViewPerformance, onViewHistory, onViewWeek, onLogWeight, onLogJump }: ProgressOverviewProps) {
  const summary = getPerformanceSummary({ sessions, activities, plan, bodyWeight, nutritionRecords, performance, today });
  const cadence = getTrainingCadence({ sessions, activities, plan, today });
  const weight = summary.weight;
  const weightPoints = weight.weeks.filter(point => point.adequate && point.date >= shiftReportDate(today, -30));
  const primaryWeight = weight.weeklyAverage ?? weight.current;
  const weightCoordinates = getTrendCoordinates(weightPoints.map(point => ({ date: point.date, value: point.kg })), 160, 64, 6);
  // Height and highest touch are different tests. Never merge them into one chart.
  const jump = summary.jumps.find(item => item.type === 'approach' && item.measurement === 'height') ?? summary.jumps.find(item => item.measurement === 'height');
  const jumpPoints = jump?.points.filter(point => point.date >= shiftReportDate(today, -29)) ?? [];
  const jumpCoordinates = getTrendCoordinates(jumpPoints.map(point => ({ date: point.date, value: point.cm })), 340, 132, 12);
  const strength = summary.strengthChanges[0];
  const viewDetails = onViewPerformance ?? onViewStrength;
  return <section className="progress-overview" aria-label="Progress overview">
    <section className="progress-jump-summary" aria-label="Jump performance">
      <div className="progress-summary-heading">
        <div><p className="progress-insight-label">Your performance</p><h2>Vertical jump</h2></div>
        {onLogJump && <button type="button" className="progress-check-in" onClick={onLogJump}><Plus size={16} aria-hidden="true" />Log jump</button>}
      </div>
      {jump ? <>
        <div className="progress-jump-value"><strong>{number(jump.current)}</strong><span>cm</span></div>
        <div className="progress-jump-context"><span>{jump.type[0].toUpperCase()}{jump.type.slice(1)} jump</span><span>{jump.change30Days === null ? `Best ${number(jump.best)} cm` : `${signed(jump.change30Days)} cm · 30 days`}</span></div>
        {jumpCoordinates.length > 1 ? <div className="progress-jump-visual">
          <svg className="progress-jump-chart" viewBox="0 0 340 132" role="img" aria-label={`${jump.type[0].toUpperCase()}${jump.type.slice(1)} jump trend: ${number(jumpPoints[0].cm)} to ${number(jumpPoints.at(-1)!.cm)} centimetres across ${jumpPoints.length} recorded test days`}>
            <path d="M12 120H328" className="progress-chart-baseline" />
            <polyline points={jumpCoordinates.map(point => `${point.x},${point.y}`).join(' ')} className="progress-jump-line" />
            {jumpCoordinates.map((point, index) => <circle key={point.date} cx={point.x} cy={point.y} r={index === jumpCoordinates.length - 1 ? 4 : 2.5} className="progress-jump-dot" />)}
          </svg>
          <div className="progress-chart-dates"><span>{shortDate(jumpPoints[0].date)}</span><span>{shortDate(jumpPoints.at(-1)!.date)}</span></div>
        </div> : <p className="progress-baseline-note">{jumpPoints.length === 1 ? `Baseline · ${shortDate(jumpPoints[0].date)}. Your next test builds the trend.` : `Latest test · ${shortDate(jump.points.at(-1)!.date)}`}</p>}
      </> : <div className="progress-jump-empty"><p>No jump tests yet.</p><span>Log your baseline. See your takeoff improve.</span></div>}
    </section>

    <div className="progress-key-trends">
      <section className="progress-weight-summary" aria-label="Body weight progress">
        <div className="progress-summary-heading"><h2>Body weight</h2>{onLogWeight && <button type="button" className="progress-text-action" onClick={onLogWeight}>Check in<Plus size={15} aria-hidden="true" /></button>}</div>
        <div className="progress-weight-visual">
          <div className="progress-weight-value"><strong>{primaryWeight === null ? '—' : number(primaryWeight)}</strong><span>kg</span></div>
          {weightCoordinates.length > 1 && <svg className="progress-weight-chart" viewBox="0 0 160 64" role="img" aria-label={`Body weight trend: weekly averages from ${number(weightPoints[0].kg)} to ${number(weightPoints.at(-1)!.kg)} kilograms`}><polyline points={weightCoordinates.map(point => `${point.x},${point.y}`).join(' ')} className="progress-weight-line" /><circle cx={weightCoordinates.at(-1)!.x} cy={weightCoordinates.at(-1)!.y} r="3" className="progress-weight-dot" /></svg>}
        </div>
        <div className="progress-weight-caption"><span>{weight.weeklyAverage !== null ? `This week’s average · ${weight.weeklyDays} ${weight.weeklyDays === 1 ? 'day' : 'days'}` : weight.points.length ? 'Latest check-in' : 'Profile weight'}</span><span>{weight.change30Days === null ? 'Regular check-ins build your trend' : `${signed(weight.change30Days)} kg · weekly averages over 30 days`}</span></div>
        {weight.insight && <p className="progress-coaching-note">{weight.insight}</p>}
      </section>
      <section className="progress-strength-summary" aria-label="Strength progress">
        <div className="progress-summary-heading"><h2>Strength</h2>{onViewStrength && <button type="button" className="progress-text-action" onClick={onViewStrength}>View<ChevronRight size={16} aria-hidden="true" /></button>}</div>
        {strength ? <><div className="progress-strength-value"><strong>{signed(strength.current - strength.previous)}</strong><span>kg</span></div><p className="progress-strength-name">{strength.name}</p><p className="progress-trend-caption">{number(strength.previous)} → {number(strength.current)} kg · {strength.reps} reps · 30 days</p></> : <><p className="progress-strength-empty">Your next baseline</p><p className="progress-trend-caption">Compare the same movement and reps over time.</p></>}
      </section>
    </div>

    <section className="progress-cadence" aria-label="Training consistency">
      <div className="progress-summary-heading"><div><p className="progress-insight-label">This week</p><h2>Keep showing up.</h2></div><div className="progress-cadence-total"><strong>{cadence.completedGymDays}</strong>{cadence.plannedGymDays > 0 && <span>/ {cadence.plannedGymDays}</span>}<small>gym days</small></div></div>
      <div className="progress-consistency-days" aria-label="This week's recorded activity">{cadence.days.map((day, index) => <div key={day.date} className={`progress-cadence-day ${day.status}${day.isToday ? ' is-today' : ''}`} aria-label={`${dayNames[index]}, ${shortDate(day.date)}: ${day.hasGym ? 'gym completed' : day.hasActivity ? 'activity recorded' : day.kind === 'recovery' ? 'recovery day' : day.date > today ? 'training planned' : 'no activity recorded'}`}><span className="progress-cadence-day-mark" aria-hidden="true">{day.hasActivity ? <span className="progress-cadence-check">✓</span> : <span className="progress-cadence-pip" />}</span><span className="progress-cadence-day-label">{day.label}</span></div>)}</div>
      {cadence.volleyballDays > 0 && <p className="progress-cadence-caption">{cadence.volleyballDays} volleyball {cadence.volleyballDays === 1 ? 'day' : 'days'} recorded</p>}
    </section>

    <div className="progress-overview-links">
      {viewDetails && <button type="button" className="progress-details-button" onClick={viewDetails}><span>Performance details</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onViewHistory && <button type="button" onClick={onViewHistory}><span>View history</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onViewWeek && <button type="button" onClick={onViewWeek}><span>Weekly report</span><ChevronRight size={18} aria-hidden="true" /></button>}
    </div>
  </section>;
}
