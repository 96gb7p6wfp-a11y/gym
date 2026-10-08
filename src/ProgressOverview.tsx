import { ChevronRight, Plus } from 'lucide-react';
import type { ActivityRecord } from './activities';
import { NutritionPayloadSchema } from './domain.js';
import { currentReportDate, getWeeklyReport, shiftReportDate, type PerformanceComparison, type ReportNutritionRecord, type ReportPlanDay, type ReportSession } from './weekly-report';
import './progress-overview.css';

interface ProgressOverviewProps {
  sessions: readonly ReportSession[];
  activities: readonly ActivityRecord[];
  plan: readonly ReportPlanDay[];
  bodyWeight?: number;
  nutritionRecords?: readonly ReportNutritionRecord[];
  today?: string;
  onViewStrength?: () => void;
  onViewHistory?: () => void;
  onViewWeek?: () => void;
  onLogWeight?: () => void;
}

const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`;

function comparisonCopy(comparison: PerformanceComparison) {
  const change = comparison.current - comparison.previous;
  if (comparison.kind === 'weight') {
    return { value: `${signed(change)} kg`, note: `${number(comparison.previous)} → ${number(comparison.current)} kg · ${comparison.currentReps} reps` };
  }
  const kind = { height: 'Jump height', touch: 'Highest touch', distance: 'Jump distance' }[comparison.kind];
  return { value: `${signed(change)} cm`, note: `${kind} · ${number(comparison.current)} cm` };
}

export function ProgressOverview({ sessions, activities, plan, bodyWeight, nutritionRecords, today = currentReportDate(), onViewStrength, onViewHistory, onViewWeek, onLogWeight }: ProgressOverviewProps) {
  const report = getWeeklyReport({ weekStart: today, sessions, activities, plan, bodyWeight, nutritionRecords });
  const saved = sessions.filter(session => session.status === 'completed' && session.deletedAt == null && session.date <= today);
  const monthGymSessions = saved.filter(session => session.kind === 'strength' && session.date.startsWith(today.slice(0, 7))).length;
  const checks = (nutritionRecords ?? []).flatMap(record => {
    if (record.date > today || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return [];
    const parsed = NutritionPayloadSchema.safeParse(record.payload);
    return parsed.success && parsed.data.kind === 'weight' ? [{ date: record.date, kg: parsed.data.kg }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  const latest = checks.at(-1);
  const points = checks.filter(check => check.date >= shiftReportDate(today, -30)).slice(-12);
  const weight = latest?.kg ?? (bodyWeight !== undefined && Number.isFinite(bodyWeight) ? bodyWeight : null);
  const weightChange = points.length >= 2 ? points.at(-1)!.kg - points[0].kg : null;
  // Load comparisons describe the same rep count. A heavier, shorter set is
  // useful in the detailed chart, but does not establish a strength increase.
  const comparable = report.performance.filter(item => item.kind !== 'weight' || item.previousReps === item.currentReps);
  const comparison = comparable.find(item => item.kind !== 'weight' && item.current > item.previous)
    ?? comparable.find(item => item.current > item.previous) ?? comparable[0];
  const strength = comparison ? comparisonCopy(comparison) : null;
  const activeDates = new Set([
    ...saved.map(session => session.date),
    ...activities.filter(record => record.activity.deletedAt === null && record.activity.date <= today).map(record => record.activity.date),
  ]);
  const month = new Date(`${today}T12:00:00`).toLocaleDateString('en-GB', { month: 'long' });
  const minWeight = Math.min(...points.map(point => point.kg));
  const maxWeight = Math.max(...points.map(point => point.kg));
  const coordinates = points.map((point, index) => `${12 + index / Math.max(1, points.length - 1) * 276},${72 - (point.kg - minWeight) / Math.max(0.5, maxWeight - minWeight) * 52}`).join(' ');

  return <section className="progress-overview" aria-label="Progress overview">
    <section className="progress-weight-summary">
      <div className="progress-summary-heading"><h2>Body weight</h2>{onLogWeight && <button type="button" className="progress-check-in" onClick={onLogWeight}><Plus size={16} aria-hidden="true" />Check in</button>}</div>
      <div className="progress-weight-value"><strong>{weight === null ? '—' : number(weight)}</strong><span>kg</span></div>
      <div className="progress-weight-caption"><span>{latest ? 'Latest check-in' : 'Profile weight'}</span><span>{weightChange === null ? 'Build your trend with check-ins' : `${signed(weightChange)} kg across ${points.length} recent check-ins`}</span></div>
      {points.length > 1 && <svg className="progress-weight-chart" viewBox="0 0 300 92" role="img" aria-label={`Body weight trend: ${number(points[0].kg)} to ${number(points.at(-1)!.kg)} kilograms across ${points.length} check-ins`}><path d="M12 82H288" className="progress-weight-baseline" /><polyline points={coordinates} className="progress-weight-line" /><circle cx={288} cy={72 - (points.at(-1)!.kg - minWeight) / Math.max(0.5, maxWeight - minWeight) * 52} r="4" className="progress-weight-dot" /></svg>}
    </section>
    <div className="progress-focus-insights">
      <section aria-label="Training consistency"><p className="progress-insight-label">{month}</p><h2>Training</h2><strong className="progress-insight-value">{monthGymSessions}<span>{monthGymSessions === 1 ? 'gym session' : 'gym sessions'}</span></strong><p className="progress-insight-note">{report.completedPlannedGymDays}/{report.plannedGymDays} planned gym days this week</p><div className="progress-consistency-days" aria-label="This week's recorded activity">{report.dates.map((date, index) => <span key={date} className={activeDates.has(date) ? 'recorded' : ''} aria-label={`${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index]}${activeDates.has(date) ? ': activity recorded' : ': no activity recorded'}`}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>)}</div></section>
      <section aria-label="Strength and jump insight"><p className="progress-insight-label">This week</p><h2>{comparison?.kind === 'weight' ? 'Strength' : comparison ? 'Jump' : 'Strength + jump'}</h2><strong className="progress-insight-value">{strength?.value ?? 'Keep going'}</strong><p className="progress-insight-note">{comparison?.name ?? 'Log matching sessions to see your change.'}</p>{strength && <p className="progress-insight-context">{strength.note}</p>}{onViewStrength && <button type="button" className="progress-inline-link" onClick={onViewStrength}>View details<ChevronRight size={16} aria-hidden="true" /></button>}</section>
    </div>
    <div className="progress-overview-links">
      {onViewHistory && <button type="button" onClick={onViewHistory}><span><strong>View history</strong><small>Workouts & activities</small></span><ChevronRight size={19} aria-hidden="true" /></button>}
      {onViewWeek && <button type="button" onClick={onViewWeek}><span><strong>Weekly report</strong><small>A short training review</small></span><ChevronRight size={19} aria-hidden="true" /></button>}
    </div>
  </section>;
}
