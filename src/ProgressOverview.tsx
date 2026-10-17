import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { ActivityRecord } from './activities';
import type { PerformanceData } from './performance-data';
import { getPerformanceSummary } from './performance-insights';
import { getTrendCoordinates } from './progress-chart';
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
type ChartMetric = 'jump' | 'weight' | 'strength';
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`;
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const capitalized = (value: string) => `${value[0].toUpperCase()}${value.slice(1)}`;

export function ProgressOverview({ sessions, activities, plan, bodyWeight, nutritionRecords, performance, today = currentReportDate(), onViewStrength, onViewPerformance, onViewHistory, onViewWeek, onLogWeight, onLogJump }: ProgressOverviewProps) {
  const summary = getPerformanceSummary({ sessions, activities, plan, bodyWeight, nutritionRecords, performance, today });
  // Null follows available live data, including records loaded after the first render.
  // Once a person chooses a chart, new records never move them to another chart.
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric | null>(null);
  const weight = summary.weight;
  const primaryWeight = weight.weeklyAverage ?? weight.current;
  const weightPoints = weight.weeks.filter(point => point.adequate && point.date >= shiftReportDate(today, -30));
  // Height and touch are different tests; touch results never enter the height trend.
  const jump = summary.jumps.find(item => item.type === 'approach' && item.measurement === 'height') ?? summary.jumps.find(item => item.measurement === 'height');
  const jumpPoints = jump?.points.filter(point => point.date >= shiftReportDate(today, -29)) ?? [];
  const strength = summary.strengthChanges[0];
  const metric = selectedMetric ?? (jumpPoints.length ? 'jump' : weight.points.length ? 'weight' : strength ? 'strength' : 'jump');
  const chartPoints = metric === 'jump'
    ? jumpPoints.map(point => ({ date: point.date, value: point.cm }))
    : weightPoints.map(point => ({ date: point.date, value: point.kg }));
  const coordinates = getTrendCoordinates(chartPoints, 340, 158, 12);
  const chartLabel = metric === 'jump'
    ? jump ? `${capitalized(jump.type)} jump trend: ${number(jumpPoints[0]?.cm ?? jump.current)} to ${number(jumpPoints.at(-1)?.cm ?? jump.current)} centimetres across ${jumpPoints.length} recorded test days` : ''
    : `Body weight trend: weekly averages from ${number(weightPoints[0]?.kg ?? 0)} to ${number(weightPoints.at(-1)?.kg ?? 0)} kilograms`;
  const viewDetails = onViewPerformance ?? onViewStrength;
  const insight = summary.insights[0] ?? (summary.gymSessions ? 'Keep jumps crisp as you build consistent training.' : 'Log your first session to build a clear baseline.');

  return <section className="progress-overview progress-native" aria-label="Progress overview">
    <p className="progress-period">Last 30 days</p>
    <dl className="progress-metrics">
      <div className="progress-metric" aria-label="Body weight progress">
        <dd>{weight.change30Days !== null ? signed(weight.change30Days) : primaryWeight === null ? '—' : number(primaryWeight)}<span>{primaryWeight === null ? '' : 'kg'}</span></dd>
        <dt>Body weight</dt>
        <p>{weight.change30Days !== null ? 'Change in weekly averages' : weight.weeklyAverage !== null ? 'This week’s average' : weight.points.length ? 'Latest check-in' : 'Profile weight'}</p>
      </div>
      <div className="progress-metric">
        <dd>{jump?.change30Days !== null && jump?.change30Days !== undefined ? signed(jump.change30Days) : jump ? number(jump.current) : '—'}<span>{jump ? 'cm' : ''}</span></dd>
        <dt>{jump ? `${capitalized(jump.type)} jump` : 'Approach jump'}</dt>
        <p>{jump?.change30Days !== null && jump?.change30Days !== undefined ? 'Change across test days' : jump ? 'Latest jump height' : 'Add your first test'}</p>
      </div>
      <div className="progress-metric" aria-label="Strength progress">
        <dd>{strength ? signed(strength.percent) : '—'}<span>{strength ? '%' : ''}</span></dd>
        <dt>Strength</dt>
        <p>{strength ? `${strength.name} · ${strength.reps} reps` : 'Comparable sets build the trend'}</p>
      </div>
      <div className="progress-metric" aria-label="Training consistency">
        <dd>{summary.consistencyPercent === null ? '—' : number(summary.consistencyPercent)}<span>{summary.consistencyPercent === null ? '' : '%'}</span></dd>
        <dt>Training consistency</dt>
        <p>{summary.gymSessions} gym · {summary.volleyballSessions} volleyball</p>
      </div>
    </dl>

    <section className="progress-trend" aria-label={metric === 'jump' ? 'Jump performance' : metric === 'weight' ? 'Body weight trend' : 'Strength trend'}>
      <div className="progress-chart-selector" role="group" aria-label="Chart metric">
        {(['jump', 'weight', 'strength'] as const).map(value => <button key={value} type="button" aria-pressed={metric === value} onClick={() => setSelectedMetric(value)}>{capitalized(value)}</button>)}
      </div>
      <div className="progress-chart-heading">
        <h2>{metric === 'jump' ? `${jump ? capitalized(jump.type) : 'Approach'} jump` : metric === 'weight' ? 'Weekly average' : strength?.name ?? 'Strength'}</h2>
        <span>{metric === 'jump' ? 'cm' : metric === 'weight' ? 'kg' : strength ? `${strength.reps} reps` : 'Same movement · same reps'}</span>
      </div>
      {metric === 'strength' ? strength ? <>
        <div className="progress-strength-comparison" role="img" aria-label={`${strength.name} strength trend: ${number(strength.previous)} to ${number(strength.current)} kilograms at ${strength.reps} reps`}>
          {[['Previous', strength.previous], ['Latest', strength.current]].map(([label, value]) => <div key={String(label)}><span>{label}</span><div><i style={{ width: `${Math.max(4, Number(value) / Math.max(strength.previous, strength.current) * 100)}%` }} /></div><strong>{number(Number(value))}<small>kg</small></strong></div>)}
        </div>
        <p className="progress-chart-caption">{signed(strength.current - strength.previous)} kg at the same rep count.</p>
      </> : <div className="progress-chart-empty"><strong>Make your next set count.</strong><p>Log the same movement on two days to see your strength trend.</p></div> : coordinates.length > 1 ? <>
        <svg className={`progress-native-chart progress-${metric}-chart`} viewBox="0 0 340 158" role="img" aria-label={chartLabel}>
          <path d="M12 146H328" className="progress-chart-baseline" />
          <polyline points={coordinates.map(point => `${point.x},${point.y}`).join(' ')} className="progress-chart-line" />
          {coordinates.map((point, index) => <circle key={point.date} cx={point.x} cy={point.y} r={index === coordinates.length - 1 ? 4 : 2.5} className="progress-chart-dot" />)}
        </svg>
        <div className="progress-chart-dates"><span>{shortDate(chartPoints[0].date)}</span><span>{shortDate(chartPoints.at(-1)!.date)}</span></div>
      </> : <div className="progress-chart-empty">
        <strong>{metric === 'jump' ? jumpPoints.length ? `${number(jumpPoints[0].cm)} cm` : jump ? `${number(jump.current)} cm` : 'Your first jump starts here.' : primaryWeight === null ? 'Start with a check-in.' : `${number(primaryWeight)} kg`}</strong>
        <p>{metric === 'jump' ? jumpPoints.length ? `Baseline · ${shortDate(jumpPoints[0].date)}. Your next test builds the trend.` : jump ? `Latest test · ${shortDate(jump.points.at(-1)!.date)}. Add a test to compare this month.` : 'Log your baseline to follow your takeoff.' : 'Regular check-ins build a steadier trend than daily fluctuations.'}</p>
      </div>}
      {metric === 'weight' && <div className="progress-weight-caption"><span>{weight.weeklyAverage !== null ? `This week’s average · ${weight.weeklyDays} ${weight.weeklyDays === 1 ? 'day' : 'days'}` : weight.points.length ? 'Latest check-in' : 'Profile weight'}</span><span>{weight.change30Days === null ? 'Weekly trends need at least 3 check-in days spread across the week.' : `${signed(weight.change30Days)} kg · weekly averages over 30 days`}</span></div>}
    </section>

    {(onLogWeight || onLogJump) && <div className="progress-check-ins">
      {onLogWeight && <button type="button" onClick={onLogWeight}><Plus size={18} aria-hidden="true" />Log weight</button>}
      {onLogJump && <button type="button" onClick={onLogJump}><Plus size={18} aria-hidden="true" />Log jump</button>}
    </div>}
    <p className="progress-single-insight">{insight}</p>
    <div className="progress-overview-links">
      {viewDetails && <button type="button" onClick={viewDetails}><span>Performance details</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onViewStrength && onViewStrength !== viewDetails && <button type="button" onClick={onViewStrength}><span>Strength history</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onViewHistory && <button type="button" onClick={onViewHistory}><span>View history</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onViewWeek && <button type="button" onClick={onViewWeek}><span>Weekly report</span><ChevronRight size={18} aria-hidden="true" /></button>}
    </div>
  </section>;
}
