import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { ActivityRecord } from './activities';
import type { PerformanceData } from './performance-data';
import { getPerformanceSummary } from './performance-insights';
import { getProgressTakeaway } from './coaching-summary';
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
  const takeaway = getProgressTakeaway(summary);
  // Follow available records until the user explicitly chooses a metric.
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric | null>(null);
  const weight = summary.weight;
  const primaryWeight = weight.weeklyAverage ?? weight.current;
  const weightPoints = weight.weeks.filter(point => point.adequate && point.date >= shiftReportDate(today, -30));
  // A touch result is not a jump height. Never combine the two test protocols.
  const jump = summary.jumps.find(item => item.type === 'approach' && item.measurement === 'height')
    ?? summary.jumps.find(item => item.measurement === 'height');
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
  const weightSource = weight.weeklyAverage !== null ? 'This week’s average'
    : weight.points.length ? 'Latest check-in' : 'Profile weight';
  const jumpName = `${jump ? capitalized(jump.type) : 'Approach'} jump`;
  const title = metric === 'jump' ? jumpName : metric === 'weight' ? 'Body weight' : strength?.name ?? 'Strength';
  const value = metric === 'jump' ? jump?.current ?? null : metric === 'weight' ? primaryWeight : strength?.current ?? null;
  const unit = value === null ? '' : metric === 'jump' ? 'cm' : 'kg';
  const emptyAction = value === null ? metric === 'jump' ? onLogJump : metric === 'weight' ? onLogWeight : undefined : undefined;
  const showJumpCheckIn = onLogJump && !(value === null && metric === 'jump');
  const showWeightCheckIn = onLogWeight && !(value === null && metric === 'weight');
  const change = metric === 'jump' ? jump?.change30Days : metric === 'weight' ? weight.change30Days : strength ? strength.current - strength.previous : null;
  const changeText = change == null ? null : `${signed(change)} ${metric === 'jump' ? 'cm' : 'kg'}`;
  const comparison = metric === 'jump'
    ? changeText ? 'across recorded test days' : jump ? `Latest test · ${shortDate(jump.points.at(-1)!.date)}` : 'No jump tests yet'
    : metric === 'weight'
      ? changeText ? 'in weekly averages' : weightSource
      : strength ? `at ${strength.reps} reps · same movement` : 'No comparable sets yet';
  const otherMetrics: { metric: ChartMetric; title: string; value: string; note: string }[] = [
    { metric: 'jump', title: jumpName, value: jump ? `${number(jump.current)} cm` : '—',
      note: jump?.change30Days != null ? `${signed(jump.change30Days)} cm across test days` : jump ? 'Latest jump height' : 'Add your first test' },
    { metric: 'weight', title: 'Body weight', value: primaryWeight === null ? '—' : `${number(primaryWeight)} kg`,
      note: weight.change30Days !== null ? `${signed(weight.change30Days)} kg in weekly averages` : weightSource },
    { metric: 'strength', title: 'Strength', value: strength ? `${signed(strength.percent)}%` : '—',
      note: strength ? `${strength.name} · ${strength.reps} reps` : 'Log comparable sets on two days' },
  ];

  return <section className="progress-overview progress-native" aria-label="Progress overview">
    <section className="progress-takeaway" aria-label="Progress summary">
      <p><strong>{takeaway.observation}</strong>{' '}{takeaway.nextStep}</p>
    </section>
    <div className="progress-lens-card">
    <div className="progress-chart-selector" role="group" aria-label="Chart metric">
      {(['jump', 'weight', 'strength'] as const).map(item => <button key={item} type="button"
        aria-pressed={metric === item} onClick={() => setSelectedMetric(item)}>{capitalized(item)}</button>)}
    </div>

    <section className="progress-trend" aria-label={metric === 'jump' ? 'Jump performance' : metric === 'weight' ? 'Body weight trend' : 'Strength trend'}>
      {value === null ? <div className="progress-lens-empty">
        <p className="progress-period">{title}</p>
        <h2 className="progress-lens-title">{metric === 'jump' ? 'Your first jump.' : metric === 'weight' ? 'Begin with a check-in.' : 'Build your strength baseline.'}</h2>
        {metric !== 'jump' && <p className="progress-lens-empty__copy">{metric === 'weight'
          ? 'Log your weight to follow a steadier weekly trend.'
          : 'Log the same movement on two days to see how your strength changes.'}</p>}
        {emptyAction && <button type="button" className="btn progress-empty-action" onClick={emptyAction}><Plus size={18} aria-hidden="true" />{metric === 'jump' ? 'Log jump' : 'Log weight'}</button>}
      </div> : <>
      <p className="progress-period">Last 30 days</p>
      <h2 className="progress-lens-title">{title}</h2>
      <div className="progress-lens-value" aria-label={`${title}: ${value === null ? 'not recorded' : `${number(value)} ${unit}`}`}>
        <span>{value === null ? '—' : number(value)}</span>{unit && <small>{unit}</small>}
      </div>
      <p className="progress-lens-comparison">{changeText && <strong>{changeText}</strong>}<span>{comparison}</span></p>

      <div className="progress-plot">
        {metric === 'strength' ? strength ? <>
          <div className="progress-strength-comparison" role="img" aria-label={`${strength.name} strength trend: ${number(strength.previous)} to ${number(strength.current)} kilograms at ${strength.reps} reps`}>
            {[['Previous', strength.previous], ['Latest', strength.current]].map(([label, amount]) => <div key={String(label)}>
              <span>{label}</span><div><i style={{ width: `${Math.max(4, Number(amount) / Math.max(strength.previous, strength.current) * 100)}%` }} /></div>
              <strong>{number(Number(amount))}<small>kg</small></strong>
            </div>)}
          </div>
          <p className="progress-chart-caption">{signed(strength.percent)}% load · matched reps, different training days</p>
        </> : <div className="progress-chart-empty"><p>Log the same movement on two days to compare your strength.</p></div>
          : coordinates.length > 1 ? <>
            <svg className={`progress-native-chart progress-${metric}-chart`} viewBox="0 0 340 158" role="img" aria-label={chartLabel}>
              <path d="M12 146H328" className="progress-chart-baseline" />
              <polygon points={`${coordinates[0].x},146 ${coordinates.map(point => `${point.x},${point.y}`).join(' ')} ${coordinates.at(-1)!.x},146`} className="progress-chart-area" />
              <polyline points={coordinates.map(point => `${point.x},${point.y}`).join(' ')} className="progress-chart-line" />
              {coordinates.map((point, index) => <circle key={point.date} cx={point.x} cy={point.y} r={index === coordinates.length - 1 ? 4 : 2.5} className="progress-chart-dot" />)}
            </svg>
            <div className="progress-chart-dates"><span>{shortDate(chartPoints[0].date)}</span><span>{shortDate(chartPoints.at(-1)!.date)}</span></div>
          </> : <div className="progress-chart-empty"><p>{metric === 'jump'
            ? jumpPoints.length ? 'One test day recorded. Your next test builds the trend.' : jump ? 'Add another test to compare this month.' : 'Record a baseline. Your progress begins with a measured jump.'
            : weight.points.length ? 'Weekly trends need at least 3 check-in days spread across the week.' : 'Your profile weight is a starting point. Log a check-in to begin your trend.'}</p></div>}
      </div>
      {metric === 'weight' && weight.weeklyAverage !== null && <p className="progress-weight-caption">Average of {weight.weeklyDays} {weight.weeklyDays === 1 ? 'check-in day' : 'check-in days'} this week</p>}
      </>}
    </section>

    {(showWeightCheckIn || showJumpCheckIn) && <div className="progress-check-ins">
      {showJumpCheckIn && <button type="button" className={metric === 'jump' ? 'is-contextual' : ''} onClick={onLogJump}><Plus size={17} aria-hidden="true" />Log jump</button>}
      {showWeightCheckIn && <button type="button" className={metric === 'weight' ? 'is-contextual' : ''} onClick={onLogWeight}><Plus size={17} aria-hidden="true" />Log weight</button>}
    </div>}
    </div>

    <div className="progress-supporting-metrics" aria-label="Other progress">
      {otherMetrics.filter(item => item.metric !== metric).map(item => <button key={item.metric} type="button"
        className="progress-supporting-row" aria-label={`View ${item.title.toLowerCase()} progress`} onClick={() => setSelectedMetric(item.metric)}>
        <span><strong>{item.title}</strong><small>{item.note}</small></span>
        <b>{item.value}</b><ChevronRight size={16} aria-hidden="true" />
      </button>)}
      <div className="progress-consistency" aria-label="Training consistency">
        <span><strong>Gym consistency</strong><small>{summary.gymSessions} gym · {summary.volleyballSessions} volleyball logged</small></span>
        <b>{summary.consistencyPercent === null || !summary.gymSessions ? '—' : `${number(summary.consistencyPercent)}%`}</b>
      </div>
    </div>
    <div className="progress-overview-links">
      {viewDetails && <button type="button" onClick={viewDetails}><span>Performance details</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onViewStrength && onViewStrength !== viewDetails && <button type="button" onClick={onViewStrength}><span>Strength history</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onViewHistory && <button type="button" onClick={onViewHistory}><span>View history</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onViewWeek && <button type="button" onClick={onViewWeek}><span>Weekly report</span><ChevronRight size={18} aria-hidden="true" /></button>}
    </div>
  </section>;
}
