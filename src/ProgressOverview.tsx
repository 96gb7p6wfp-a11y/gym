import { ChevronRight, Plus } from 'lucide-react';
import type { ActivityRecord } from './activities';
import type { PerformanceData } from './performance-data';
import { getPerformanceSummary } from './performance-insights';
import { currentReportDate, getWeeklyReport, shiftReportDate, type ReportNutritionRecord, type ReportPlanDay, type ReportSession } from './weekly-report';
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

export function ProgressOverview({ sessions, activities, plan, bodyWeight, nutritionRecords, performance, today = currentReportDate(), onViewStrength, onViewPerformance, onViewHistory, onViewWeek, onLogWeight, onLogJump }: ProgressOverviewProps) {
  const summary = getPerformanceSummary({ sessions, activities, plan, bodyWeight, nutritionRecords, performance, today });
  const report = getWeeklyReport({ weekStart: today, sessions, activities, plan, bodyWeight, nutritionRecords });
  const weight = summary.weight;
  const points = weight.weeks.filter(point => point.adequate && point.date >= shiftReportDate(today, -30));
  const primaryWeight = weight.weeklyAverage ?? weight.current;
  const jump = summary.jumps.find(item => item.type === 'approach' && item.measurement === 'height') ?? summary.jumps.find(item => item.measurement === 'height');
  const min = Math.min(...points.map(point => point.kg)), max = Math.max(...points.map(point => point.kg));
  const y = (kg: number) => 70 - (kg - min) / Math.max(0.5, max - min) * 46;
  const coordinates = points.map((point, index) => `${12 + index / Math.max(1, points.length - 1) * 276},${y(point.kg)}`).join(' ');
  const viewDetails = onViewPerformance ?? onViewStrength;
  return <section className="progress-overview" aria-label="Progress overview">
    <section className="progress-weight-summary">
      <div className="progress-summary-heading"><div><p className="progress-insight-label">Last 30 days</p><h2>Body weight</h2></div>{onLogWeight && <button type="button" className="progress-check-in" onClick={onLogWeight}><Plus size={16} aria-hidden="true" />Check in</button>}</div>
      <div className="progress-weight-value"><strong>{primaryWeight === null ? '—' : number(primaryWeight)}</strong><span>kg</span></div>
      <div className="progress-weight-caption"><span>{weight.weeklyAverage !== null ? `This week’s average · ${weight.weeklyDays} ${weight.weeklyDays === 1 ? 'day' : 'days'}` : weight.points.length ? 'Latest check-in' : 'Profile weight'}</span><span>{weight.change30Days === null ? 'Regular check-ins build a useful trend' : `${signed(weight.change30Days)} kg · weekly averages over 30 days`}</span></div>
      {points.length > 1 && <svg className="progress-weight-chart" viewBox="0 0 300 92" role="img" aria-label={`Body weight trend: weekly averages from ${number(points[0].kg)} to ${number(points.at(-1)!.kg)} kilograms`}><path d="M12 82H288" className="progress-weight-baseline" /><polyline points={coordinates} className="progress-weight-line" /><circle cx={288} cy={y(points.at(-1)!.kg)} r="4" className="progress-weight-dot" /></svg>}
      {weight.insight && <p className="progress-coaching-note">{weight.insight}</p>}
    </section>
    <div className="progress-focus-insights">
      <section aria-label="Jump performance"><p className="progress-insight-label">{jump ? `${jump.type[0].toUpperCase()}${jump.type.slice(1)} jump` : 'Your main goal'}</p><h2>Vertical jump</h2><strong className="progress-insight-value">{jump ? number(jump.current) : '—'}<span>cm</span></strong><p className="progress-insight-note">{jump ? jump.change30Days === null ? `Best ${number(jump.best)} cm` : `${signed(jump.change30Days)} cm in 30 days` : 'Record a jump to start your trend.'}</p>{onLogJump && <button type="button" className="progress-inline-link" onClick={onLogJump}><Plus size={15} aria-hidden="true" />Log jump</button>}</section>
      <section aria-label="Training consistency"><p className="progress-insight-label">Last 30 days</p><h2>Training</h2><strong className="progress-insight-value">{summary.gymSessions}<span>{summary.gymSessions === 1 ? 'gym session' : 'gym sessions'}</span></strong><p className="progress-insight-note">{summary.volleyballSessions} volleyball · {summary.consistencyPercent === null ? 'Follow your weekly plan' : `${summary.consistencyPercent}% consistency`}</p><div className="progress-consistency-days" aria-label="This week's recorded activity">{report.dates.map((date, index) => { const recorded = sessions.some(session => session.date === date && session.status === 'completed' && session.deletedAt == null) || activities.some(record => record.activity.date === date && record.activity.deletedAt === null); return <span key={date} className={recorded ? 'recorded' : ''} aria-label={`${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index]}${recorded ? ': activity recorded' : ': no activity recorded'}`}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>; })}</div></section>
    </div>
    {summary.strengthChanges.some(item => item.percent > 0) && <p className="progress-short-insight">{summary.insights.find(item => item.includes(' reps.'))}</p>}
    {viewDetails && <button type="button" className="progress-details-button" onClick={viewDetails}>Performance details<ChevronRight size={18} aria-hidden="true" /></button>}
    <div className="progress-overview-links">
      {onViewHistory && <button type="button" onClick={onViewHistory}><span><strong>View history</strong><small>Workouts & activities</small></span><ChevronRight size={19} aria-hidden="true" /></button>}
      {onViewWeek && <button type="button" onClick={onViewWeek}><span><strong>Weekly report</strong><small>A short training review</small></span><ChevronRight size={19} aria-hidden="true" /></button>}
    </div>
  </section>;
}
