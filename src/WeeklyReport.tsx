import { useState } from 'react';
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
}

function displayDate(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
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

export function WeeklyReport({ sessions, activities, plan, bodyWeight, initialWeek, nutritionRecords }: WeeklyReportProps) {
  const [weekStart, setWeekStart] = useState(() => reportWeekStart(initialWeek ?? currentReportDate()));
  const report = getWeeklyReport({ weekStart, sessions, activities, plan, bodyWeight, nutritionRecords });

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
    <div className="panel-heading"><div><h2>Weekly report</h2><p className="small-note">A short review of your saved training.</p></div></div>
    <div className="weekly-report-navigation">
      <button type="button" className="weekly-report-arrow" aria-label="Previous report week" onClick={() => setWeekStart(shiftReportDate(weekStart, -7))}><ChevronLeft size={20} aria-hidden="true" /></button>
      <p className="weekly-report-dates" aria-live="polite">{displayDate(report.weekStart)} – {displayDate(report.weekEnd)}</p>
      <button type="button" className="weekly-report-arrow" aria-label="Next report week" onClick={() => setWeekStart(shiftReportDate(weekStart, 7))}><ChevronRight size={20} aria-hidden="true" /></button>
    </div>
    <button type="button" className="weekly-report-current" onClick={() => setWeekStart(reportWeekStart(currentReportDate()))}>This week</button>
    <div className="weekly-report-metrics">
      <div><strong>{report.totals.workouts}</strong><span>completed {report.totals.workouts === 1 ? 'workout' : 'workouts'}</span></div>
      <div><strong>{displayNumber(report.totals.minutes)}</strong><span>recorded minutes</span></div>
      <div><strong>{report.completedPlannedGymDays}/{report.plannedGymDays}</strong><span>planned gym days</span></div>
      <div><strong>{displayNumber(report.totals.activeCalories)}</strong><span>active kcal logged / est.</span></div>
    </div>
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
      {report.performance.length > 0 && <details className="weekly-report-performance"><summary>Exercise comparisons ({report.performance.length})</summary><p className="small-note">Last week's latest matching session → this week's best completed set or measurement. Compare the same setup; heavier sets with fewer reps do not automatically mean more strength.</p><ul>{report.performance.map(comparison => <li key={JSON.stringify([comparison.key, comparison.kind, comparison.name])}><strong>{comparison.name}</strong><span>{performanceLabel(comparison)}</span></li>)}</ul></details>}
      <h3>Next week</h3>
      <ul>{report.actions.map(action => <li key={action}>{action}</li>)}</ul>
    </div>
    <p className="small-note weekly-report-note">Completed workouts and undeleted extra activities only. Calories are estimates or device readings; unrecorded food and exercise are unknown. Targets follow your current plan.</p>
    <p className="small-note weekly-report-sources">Nutrition guidance: <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/" target="_blank" rel="noreferrer">ISSN protein position stand</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/26920240/" target="_blank" rel="noreferrer">ACSM sports nutrition</a></p>
    <button type="button" className="weekly-report-download" onClick={downloadReport}><Download size={17} aria-hidden="true" />Download weekly report</button>
  </section>;
}
