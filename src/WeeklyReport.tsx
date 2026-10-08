import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { ActivityRecord } from './activities';
import { currentReportDate, getWeeklyReport, reportWeekStart, shiftReportDate, type PerformanceComparison, type ReportNutritionRecord, type ReportPlanDay, type ReportSession } from './weekly-report';
import './weekly-report.css';

export interface WeeklyReportProps {
  sessions: readonly ReportSession[];
  activities: readonly ActivityRecord[];
  plan: readonly ReportPlanDay[];
  bodyWeight?: number;
  initialWeek?: string;
  nutritionRecords?: readonly ReportNutritionRecord[];
  onWeekChange?: (weekStart: string) => void;
}

function displayDate(value: string, year = false): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' });
}

function displayNumber(value: number): string {
  return value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

function counted(value: number, singular: string, plural: string): string {
  return `${displayNumber(value)} ${value === 1 ? singular : plural}`;
}

function performanceLabel(comparison: PerformanceComparison): string {
  if (comparison.kind === 'weight') return `${displayNumber(comparison.previous)} kg × ${comparison.previousReps} → ${displayNumber(comparison.current)} kg × ${comparison.currentReps}`;
  const label = { touch: 'highest touch', height: 'jump height', distance: 'distance' }[comparison.kind];
  return `${label}: ${displayNumber(comparison.previous)} → ${displayNumber(comparison.current)} cm`;
}

export function WeeklyReport({ sessions, activities, plan, bodyWeight, initialWeek, nutritionRecords, onWeekChange }: WeeklyReportProps) {
  const [weekStart, setWeekStart] = useState(() => reportWeekStart(initialWeek ?? currentReportDate()));
  useEffect(() => { onWeekChange?.(weekStart); }, [weekStart, onWeekChange]);
  const report = getWeeklyReport({ weekStart, sessions, activities, plan, bodyWeight, nutritionRecords });
  const weekDates = new Set(report.dates);
  const weekSessions = sessions.filter(session => session.status === 'completed' && session.deletedAt == null && weekDates.has(session.date));
  const gymSessions = weekSessions.filter(session => session.kind === 'strength').length;
  const volleyballSessions = weekSessions.filter(session => session.kind === 'sport' && /volley/i.test(session.name)).length;
  const minutes = Math.round(report.totals.minutes);
  const trainingTime = minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`;
  const bestComparison = report.performance.find(comparison => comparison.current > comparison.previous
    && (comparison.kind !== 'weight' || comparison.previousReps === comparison.currentReps));
  const recommendation = report.actions.find(action => /hard cardio|recovery feels poor/.test(action)) ?? report.actions[0];

  function downloadReport() {
    const blob = new Blob([JSON.stringify({ app: 'Setline', exportedAt: new Date().toISOString(), report }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `setline-weekly-report-${report.weekStart}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="panel weekly-report" aria-label="Weekly training report">
    <div className="panel-heading"><h2>Your week</h2></div>
    <div className="weekly-report-navigation">
      <button type="button" className="weekly-report-arrow" aria-label="Previous report week" onClick={() => setWeekStart(shiftReportDate(weekStart, -7))}><ChevronLeft size={20} aria-hidden="true" /></button>
      <p className="weekly-report-dates" aria-live="polite">{displayDate(report.weekStart)} – {displayDate(report.weekEnd, true)}</p>
      <button type="button" className="weekly-report-arrow" aria-label="Next report week" onClick={() => setWeekStart(shiftReportDate(weekStart, 7))}><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
    <button type="button" className="weekly-report-current" onClick={() => setWeekStart(reportWeekStart(currentReportDate()))}>This week</button>
    <div className="weekly-report-metrics">
      <div><strong>{gymSessions}</strong><span>gym {gymSessions === 1 ? 'session' : 'sessions'}</span></div>
      <div><strong>{volleyballSessions}</strong><span>volleyball {volleyballSessions === 1 ? 'session' : 'sessions'}</span></div>
      <div><strong>{trainingTime}</strong><span>training time</span></div>
      <div><strong>{report.completedPlannedGymDays}/{report.plannedGymDays}</strong><span>planned gym days</span></div>
    </div>
    {bestComparison && <div className="weekly-report-highlight"><span>Best progress</span><strong>{bestComparison.name}</strong><p>{performanceLabel(bestComparison)}</p></div>}
    <div className="weekly-report-recommendation"><h3>{report.hasData ? 'Next week' : 'Start here'}</h3><p>{recommendation}</p></div>
    <details className="weekly-report-disclosure">
      <summary>Report details</summary>
      <div className="weekly-report-expanded">
        <p className="weekly-report-details">{counted(report.totals.workouts, 'completed workout', 'completed workouts')} · {displayNumber(report.totals.minutes)} recorded minutes · {displayNumber(report.totals.activeCalories)} active kcal logged / est.</p>
        <p className="weekly-report-details">{counted(report.totals.completedSets, 'completed set', 'completed sets')} · {displayNumber(report.totals.volumeKg)} kg volume · {counted(report.totals.extraActivities, 'extra activity', 'extra activities')}</p>
        {(report.totals.runKm > 0 || report.totals.cycleKm > 0) && <p className="weekly-report-details">{displayNumber(report.totals.runKm)} km running · {displayNumber(report.totals.cycleKm)} km cycling <span>(known distances)</span></p>}
        <p className="weekly-report-details">{!report.nutrition.available
          ? 'Meal logs have not loaded; food intake is unknown.'
          : report.nutrition.mealsLogged === 0
            ? 'No meals logged this week; food intake is unknown.'
            : `${counted(report.nutrition.mealsLogged, 'meal', 'meals')} logged on ${report.nutrition.mealLoggedDays}/7 days · ${displayNumber(report.nutrition.meanLoggedProteinGrams!)} g protein/day recorded on logged days. Partial logs; unrecorded meals are unknown.`}</p>
        <div className="weekly-report-analysis" aria-live="polite">
          <h3>This week</h3>
          <ul>{report.insights.map(insight => <li key={insight}>{insight}</li>)}</ul>
          {report.performance.length > 0 && <section className="weekly-report-performance"><h3>Exercise comparisons ({report.performance.length})</h3><p className="small-note">Last week's latest matching session → this week's best completed set or measurement. Compare the same setup; heavier sets with fewer reps do not automatically mean more strength.</p><ul>{report.performance.map(comparison => <li key={JSON.stringify([comparison.key, comparison.kind, comparison.name])}><strong>{comparison.name}</strong><span>{performanceLabel(comparison)}</span></li>)}</ul></section>}
          <h3>Next week</h3>
          <ul>{report.actions.map(action => <li key={action}>{action}</li>)}</ul>
        </div>
        <p className="small-note weekly-report-note">Completed workouts and undeleted extra activities only. Calories are estimates or device readings; unrecorded food and exercise are unknown. Targets follow your current plan.</p>
        <p className="small-note weekly-report-sources">Nutrition guidance: <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/" target="_blank" rel="noreferrer">ISSN protein position stand</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/26920240/" target="_blank" rel="noreferrer">ACSM sports nutrition</a></p>
      </div>
    </details>
    <button type="button" className="weekly-report-download" onClick={downloadReport}><Download size={17} aria-hidden="true" />Download weekly report</button>
  </section>;
}
