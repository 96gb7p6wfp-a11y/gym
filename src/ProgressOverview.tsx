import { useMemo, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { ActivityRecord } from './activities';
import type { PerformanceData } from './performance-data';
import { getApproachAdvantage, getPerformanceSummary, type StrengthChange } from './performance-insights';
import { coachJumpSummary, coachPeriodLabel, coachPeriodStart, getCoachConsistency, getCoachJumpSeries, getCoachStrengthTrends, primaryCoachJump, type CoachProgressPeriod } from './coach-progress';
import { getProgressTakeaway } from './coaching-summary';
import { getTrendCoordinates } from './progress-chart';
import { currentReportDate, shiftReportDate, type ReportNutritionRecord, type ReportPlanDay, type ReportSession } from './weekly-report';
import './progress-overview.css';

interface ProgressOverviewProps {
  sessions: readonly ReportSession[];
  activities: readonly ActivityRecord[];
  plan: readonly ReportPlanDay[];
  bodyWeight?: number | null;
  nutritionRecords?: readonly ReportNutritionRecord[];
  performance?: PerformanceData;
  today?: string;
  athleteMode?: boolean;
  onViewJourney?: () => void;
  onViewStrength?: () => void;
  onViewPerformance?: () => void;
  onViewHistory?: () => void;
  onViewWeek?: () => void;
  onStartStrength?: () => void;
  strengthActionLabel?: string;
  initialMetric?: ChartMetric | null;
  onMetricChange?: (metric: ChartMetric) => void;
  onLogWeight?: () => void;
  onLogJump?: () => void;
}
export type ChartMetric = 'jump' | 'weight' | 'strength';
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`;
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const capitalized = (value: string) => `${value[0].toUpperCase()}${value.slice(1)}`;

export function ProgressOverview({ sessions, activities, plan, bodyWeight, nutritionRecords, performance, today = currentReportDate(), athleteMode = true, onViewJourney, onViewStrength, onViewPerformance, onViewHistory, onViewWeek, onStartStrength, strengthActionLabel = 'Start a strength workout', initialMetric, onMetricChange, onLogWeight, onLogJump }: ProgressOverviewProps) {
  const summary = getPerformanceSummary({ sessions, activities, plan, bodyWeight: bodyWeight ?? undefined, nutritionRecords, performance, today });
  const [period, setPeriod] = useState<CoachProgressPeriod>('4w');
  const [selectedLift, setSelectedLift] = useState<string | null>(null);
  const [jumpType, setJumpType] = useState<'approach' | 'standing' | null>(null);
  const [jumpSetup, setJumpSetup] = useState<string | null>(null);
  const strengthTrends = useMemo(() => getCoachStrengthTrends(sessions, today, period), [sessions, today, period]);
  const jumpSeries = useMemo(() => getCoachJumpSeries(sessions, performance?.jumps ?? [], today, period), [sessions, performance?.jumps, today, period]);
  const historicalStrengthAvailable = useMemo(() => period !== 'all' && strengthTrends.length === 0
    ? getCoachStrengthTrends(sessions, today, 'all').length > 0 : false, [sessions, today, period, strengthTrends]);
  const selectedStrength = strengthTrends.find(item => item.id === selectedLift) ?? strengthTrends[0];
  const activeJumpType = jumpType ?? (jumpSeries.some(item => item.type === 'approach') ? 'approach' : jumpSeries.some(item => item.type === 'standing') ? 'standing' : 'approach');
  const activeJump = jumpSeries.find(item => item.key === jumpSetup && item.type === activeJumpType)
    ?? primaryCoachJump(jumpSeries, activeJumpType);
  const safeJumps = (['approach', 'standing', 'block'] as const).flatMap(type => {
    const series = primaryCoachJump(jumpSeries, type); return series ? [coachJumpSummary(series)] : [];
  });
  const safeStrengthChanges: StrengthChange[] = strengthTrends.flatMap(item => item.previous && item.unit === 'kg' ? [{
    id: item.id, name: item.name, previous: item.previous.value, current: item.latest.value, reps: item.latest.reps,
    percent: (item.latest.value - item.previous.value) / item.previous.value * 100,
    previousDate: item.previous.date, currentDate: item.latest.date, sessionCount: item.recordedDays,
    equipmentLabel: item.equipmentLabel, effort: item.effortMatched ? 'matched' : 'unrecorded', rir: item.effortMatched ? item.latest.rir : null,
  }] : []);
  const takeaway = getProgressTakeaway({ ...summary, jumps: safeJumps, strengthChanges: safeStrengthChanges });
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric | null>(initialMetric ?? null);
  function selectMetric(next: ChartMetric) { setSelectedMetric(next); onMetricChange?.(next); }
  const weight = summary.weight;
  const primaryWeight = weight.current;
  const weightPoints = weight.weeks.filter(point => point.adequate && point.date >= coachPeriodStart(today, period));
  const jump = activeJump ? coachJumpSummary(activeJump) : undefined;
  const jumpPoints = activeJump?.points ?? [];
  const consistency = useMemo(() => getCoachConsistency(sessions, activities, today, period), [sessions, activities, today, period]);
  const advantage = getApproachAdvantage(performance?.jumps ?? [], today).latest;
  const availableMetrics: ChartMetric[] = athleteMode ? ['strength', 'jump', 'weight'] : ['strength', 'weight'];
  const metric = selectedMetric && availableMetrics.includes(selectedMetric) ? selectedMetric
    : athleteMode ? (selectedStrength || historicalStrengthAvailable ? 'strength' : jumpPoints.length ? 'jump' : weight.points.length ? 'weight' : 'jump') : 'strength';
  const chartPoints = metric === 'jump'
    ? jumpPoints.map(point => ({ date: point.date, value: point.cm }))
    : weightPoints.map(point => ({ date: point.date, value: point.kg }));
  const coordinates = getTrendCoordinates(chartPoints, 340, 158, 12);
  const strengthCoordinates = getTrendCoordinates(selectedStrength?.points.map(point => ({ date: point.date, value: point.value })) ?? [], 340, 104, 10);
  const chartLabel = metric === 'jump'
    ? jump ? `${capitalized(jump.type)} jump trend: ${number(jumpPoints[0]?.cm ?? jump.current)} to ${number(jumpPoints.at(-1)?.cm ?? jump.current)} centimetres across ${jumpPoints.length} recorded test days` : ''
    : `Body weight trend: weekly averages from ${number(weightPoints[0]?.kg ?? 0)} to ${number(weightPoints.at(-1)?.kg ?? 0)} kilograms`;
  const viewDetails = athleteMode ? onViewPerformance ?? onViewStrength : undefined;
  const weightSource = weight.points.length ? 'Latest check-in' : 'Profile weight';
  const jumpName = `${capitalized(activeJumpType)} jump`;
  const title = metric === 'jump' ? jumpName : metric === 'weight' ? 'Body weight' : selectedStrength?.name ?? 'Strength';
  const value = metric === 'jump' ? jump?.current ?? null : metric === 'weight' ? primaryWeight : selectedStrength?.latest.value ?? null;
  const unit = value === null ? '' : metric === 'jump' ? 'cm' : metric === 'strength' ? selectedStrength?.unit ?? 'kg' : 'kg';
  const emptyAction = value === null ? metric === 'jump' ? onLogJump : metric === 'weight' ? onLogWeight : onStartStrength : undefined;
  const emptyActionLabel = metric === 'jump' ? 'Log jump' : metric === 'weight' ? 'Log body weight' : strengthActionLabel;
  const showJumpCheckIn = athleteMode && metric === 'jump' && onLogJump && value !== null;
  const showWeightCheckIn = metric === 'weight' && onLogWeight && value !== null;
  const change = metric === 'jump' ? activeJump?.change : metric === 'weight' ? weightPoints.length >= 2 ? weightPoints.at(-1)!.kg - weightPoints[0].kg : null : selectedStrength?.change;
  const changeText = change == null ? null : `${signed(change)} ${unit}`;
  const comparison = metric === 'jump'
    ? changeText ? 'since the previous comparable test' : jump ? `Latest test · ${shortDate(activeJump!.latest.date)}` : 'No jump tests yet'
    : metric === 'weight'
      ? changeText ? 'in weekly averages' : weightSource
      : selectedStrength ? `${selectedStrength.unit === 'kg' ? `at ${selectedStrength.latest.reps} reps` : `${number(selectedStrength.latest.kg)} kg added load`} · ${selectedStrength.effortMatched ? `RIR ${selectedStrength.latest.rir} matched` : !selectedStrength.previous && selectedStrength.latest.rir !== null ? `RIR ${selectedStrength.latest.rir} recorded` : 'effort unrecorded'}` : 'No comparable sets yet';
  const otherMetrics: { metric: ChartMetric; title: string; value: string; note: string }[] = [
    { metric: 'jump', title: jumpName, value: jump ? `${number(jump.current)} cm` : '—',
      note: jump?.change30Days != null ? `${signed(jump.change30Days)} cm across test days` : jump ? 'Latest jump height' : 'Add your first test' },
    { metric: 'weight', title: 'Body weight', value: primaryWeight === null ? '—' : `${number(primaryWeight)} kg`,
      note: weight.change30Days !== null ? `${signed(weight.change30Days)} kg in weekly averages` : weightSource },
    { metric: 'strength', title: 'Matched-rep load', value: selectedStrength ? `${number(selectedStrength.latest.value)} ${selectedStrength.unit}` : '—',
      note: selectedStrength ? `${selectedStrength.name} · ${selectedStrength.recordedDays} recorded days` : 'Log comparable sets on two days' },
  ];

  return <section className="progress-overview progress-native" aria-label="Progress overview">
    {value !== null && <section className="progress-takeaway" aria-label="Progress summary">
      {metric === 'strength' && selectedStrength ? <p><strong>{selectedStrength.change == null ? `${selectedStrength.name}: ${selectedStrength.configurationNote ? 'latest recorded performance' : 'first baseline recorded'}.` : `${selectedStrength.name}: ${signed(selectedStrength.change)} ${selectedStrength.unit} ${selectedStrength.unit === 'kg' ? `at the same ${selectedStrength.latest.reps} reps` : 'at the same added load'}.`}</strong>{' '}{selectedStrength.improvementAcrossDays ? `Performance rose across ${selectedStrength.recordedDays} comparable days with matching RIR. ` : ''}{selectedStrength.configurationNote ? selectedStrength.configurationNote : !selectedStrength.previous ? 'Repeat this exercise on another day with the same equipment, repetition target and effort.' : selectedStrength.effortMatched ? 'Repeat the same setup and prescribed effort before changing load.' : 'Record RIR and keep the same setup to judge effort fairly.'}</p>
        : metric === 'weight' ? <p><strong>{weightPoints.length >= 2 ? `Weekly average ${weightPoints.at(-1)!.kg === weightPoints[0].kg ? 'is stable' : `is ${weightPoints.at(-1)!.kg > weightPoints[0].kg ? 'up' : 'down'} ${number(Math.abs(weightPoints.at(-1)!.kg - weightPoints[0].kg))} kg`} across ${weightPoints.length} recorded weeks.` : 'Body weight, with context.'}</strong>{' '}{weightPoints.length >= 2 ? 'Compare morning averages; one-day fluctuations can be normal fluid changes.' : 'Recorded check-ins build your trend. A profile weight alone does not create a weekly comparison.'}</p>
          : <p><strong>{takeaway.observation}</strong>{' '}{takeaway.nextStep}</p>}
    </section>}
    <div className="progress-lens-card">
    <div className="progress-chart-selector" role="group" aria-label="Chart metric">
      {availableMetrics.map(item => <button key={item} type="button"
        aria-pressed={metric === item} onClick={() => selectMetric(item)}>{item === 'weight' ? 'Body weight' : capitalized(item)}</button>)}
    </div>

    {(value !== null || metric === 'strength' && historicalStrengthAvailable) && <div className="progress-period-selector" role="group" aria-label="Chart period">{(['4w', '12w', 'all'] as const).map(item => <button type="button" key={item} aria-pressed={period === item} onClick={() => setPeriod(item)}>{coachPeriodLabel(item)}</button>)}</div>}
    {metric === 'strength' && strengthTrends.length > 0 && <label className="progress-lift-select">Exercise<select aria-label="Strength exercise" value={selectedStrength?.id} onChange={event => setSelectedLift(event.target.value)}>{strengthTrends.map(item => <option value={item.id} key={item.id}>{item.name}{item.equipmentLabel ? ` · ${item.equipmentLabel}` : ''}</option>)}</select></label>}
    {metric === 'jump' && jumpSeries.length > 0 && <div className="progress-jump-selector" role="group" aria-label="Jump test type">{(['approach', 'standing'] as const).map(item => <button type="button" aria-pressed={activeJumpType === item} key={item} onClick={() => { setJumpType(item); setJumpSetup(null); }}>{capitalized(item)} vertical</button>)}</div>}
    {metric === 'jump' && jumpSeries.filter(item => item.type === activeJumpType).length > 1 && <label className="progress-lift-select">Test setup<select aria-label="Jump test setup" value={activeJump?.key} onChange={event => setJumpSetup(event.target.value)}>{jumpSeries.filter(item => item.type === activeJumpType).map((item, index) => <option key={item.key} value={item.key}>{item.conditions || (item.source === 'workout' ? 'Workout measurements' : 'Setup not recorded')} · {shortDate(item.latest.date)} · {index + 1}</option>)}</select></label>}
    <section key={metric} className="progress-trend" aria-label={metric === 'jump' ? 'Jump performance' : metric === 'weight' ? 'Body weight trend' : 'Strength trend'}>
      {value === null ? <div className="progress-lens-empty">
        <p className="progress-period">{metric === 'strength' ? `Strength · ${coachPeriodLabel(period).toLowerCase()}` : title}</p>
        <h2 className="progress-lens-title">{metric === 'jump' ? 'Your first jump.' : metric === 'weight' ? 'Begin with a check-in.' : historicalStrengthAvailable ? 'Your history, in context.' : 'Build your strength baseline.'}</h2>
        <p className="progress-lens-empty__copy">{metric === 'jump' ? 'Enter reach and touch heights to calculate your jump.' : metric === 'weight'
          ? 'Log body weight on different mornings. Three check-in days spread across four days build a weekly comparison.'
          : historicalStrengthAvailable ? `No strength sets were recorded in these ${coachPeriodLabel(period).toLowerCase()}. Choose All time to review your earlier records, or log the next session.` : 'Complete working sets for the same exercise on two different days. Match your equipment and rep target to compare lifting load.'}</p>
        {emptyAction && <button type="button" className="btn progress-empty-action" onClick={emptyAction}><Plus size={18} aria-hidden="true" />{emptyActionLabel}</button>}
      </div> : <>
      <p className="progress-period">{coachPeriodLabel(period)}</p>
      <h2 className="progress-lens-title">{title}</h2>
      <div className="progress-lens-value" aria-label={`${title}: ${value === null ? 'not recorded' : `${number(value)} ${unit}`}`}>
        <span>{value === null ? '—' : number(value)}</span>{unit && <small>{unit}</small>}
      </div>
      <p className="progress-lens-comparison">{changeText && <strong>{changeText}</strong>}<span>{comparison}</span></p>

      <div className="progress-plot">
        {metric === 'strength' ? selectedStrength?.previous ? <>
          <div className="progress-strength-comparison" role="img" aria-label={`${selectedStrength.name} strength trend: ${number(selectedStrength.previous.value)} to ${number(selectedStrength.latest.value)} ${selectedStrength.unit === 'kg' ? `kilograms at ${selectedStrength.latest.reps} reps` : `reps at ${number(selectedStrength.latest.kg)} kilograms added load`}`}>
            {[['Previous', selectedStrength.previous], ['Latest', selectedStrength.latest]].map(([label, point]) => {
              const item = point as typeof selectedStrength.latest;
              return <div key={String(label)}><span>{String(label)}</span><div><i style={{ width: `${Math.max(4, item.value / Math.max(...selectedStrength.points.map(p => p.value)) * 100)}%` }} /></div><strong>{number(item.value)}<small>{selectedStrength.unit}{selectedStrength.unit === 'kg' ? ` × ${item.reps}` : ''}</small></strong></div>;
            })}
          </div>
          {strengthCoordinates.length >= 3 && <svg className="progress-native-chart progress-strength-history" viewBox="0 0 340 104" role="img" aria-label={`${selectedStrength.name} recorded history: ${selectedStrength.recordedDays} comparable training days`}><path d="M10 94H330" className="progress-chart-baseline" /><polyline points={strengthCoordinates.map(point => `${point.x},${point.y}`).join(' ')} className="progress-chart-line" />{strengthCoordinates.map(point => <circle key={point.date} cx={point.x} cy={point.y} r={3} className="progress-chart-dot" />)}</svg>}
          <p className="progress-chart-caption">{shortDate(selectedStrength.previous.date)} → {shortDate(selectedStrength.latest.date)} · {selectedStrength.recordedDays} comparable recorded days<br />{selectedStrength.unit === 'kg' ? `${selectedStrength.latest.reps} reps in both sets` : `Same ${number(selectedStrength.latest.kg)} kg added load`} · {selectedStrength.equipmentLabel ?? 'Equipment not labeled; verify the same setup'}</p>
          <p className="progress-chart-caption">{selectedStrength.effortMatched ? `RIR ${selectedStrength.latest.rir} in both comparisons.` : 'Effort was not recorded for both comparisons.'} A load change alone does not establish greater strength.</p>
        </> : <div className="progress-chart-empty"><p>{selectedStrength?.configurationNote ? selectedStrength.configurationNote : selectedStrength ? `One comparable ${selectedStrength.name} day recorded. Repeat the same equipment, repetition target and effort to build your trend.` : 'Log the same movement on two days to compare your strength.'}</p>{selectedStrength && onStartStrength && <button type="button" className="text-button" onClick={onStartStrength}>{strengthActionLabel}</button>}</div>
          : coordinates.length > 1 ? <>
            <svg className={`progress-native-chart progress-${metric}-chart`} viewBox="0 0 340 158" role="img" aria-label={chartLabel}>
              <path d="M12 146H328" className="progress-chart-baseline" />
              <polygon points={`${coordinates[0].x},146 ${coordinates.map(point => `${point.x},${point.y}`).join(' ')} ${coordinates.at(-1)!.x},146`} className="progress-chart-area" />
              <polyline pathLength="1" points={coordinates.map(point => `${point.x},${point.y}`).join(' ')} className="progress-chart-line" />
              {coordinates.map((point, index) => <circle key={point.date} cx={point.x} cy={point.y} r={index === coordinates.length - 1 ? 4 : 2.5} className="progress-chart-dot" />)}
            </svg>
            <div className="progress-chart-dates"><span>{shortDate(chartPoints[0].date)}</span><span>{shortDate(chartPoints.at(-1)!.date)}</span></div>
          </> : <div className="progress-chart-empty"><p>{metric === 'jump'
            ? jumpPoints.length ? 'One test day recorded. Your next test builds the trend.' : jump ? 'Add another test to compare this month.' : 'Record a baseline. Your progress begins with a measured jump.'
            : weight.points.length ? 'Weekly trends need at least 3 check-in days spread across the week.' : 'Your profile weight is a starting point. Log a check-in to begin your trend.'}</p></div>}
      </div>
      {metric === 'jump' && activeJump && <p className="progress-jump-context">Latest valid test · {shortDate(activeJump.latest.date)} · Personal best {number(activeJump.best)} cm in this setup<br />{activeJump.conditions || 'Test conditions not recorded; repeat the same setup for useful comparisons.'}{activeJump.previous ? ` · Previous ${number(activeJump.previous.cm)} cm` : ''}</p>}
      {metric === 'weight' && weight.weeklyAverage !== null && <p className="progress-weight-caption">Average of {weight.weeklyDays} {weight.weeklyDays === 1 ? 'check-in day' : 'check-in days'} this week</p>}
      </>}
    </section>

    {(showWeightCheckIn || showJumpCheckIn) && <div className="progress-check-ins">
      {showJumpCheckIn && <button type="button" className={metric === 'jump' ? 'is-contextual' : ''} onClick={onLogJump}><Plus size={17} aria-hidden="true" />Log jump</button>}
      {showWeightCheckIn && <button type="button" className={metric === 'weight' ? 'is-contextual' : ''} onClick={onLogWeight}><Plus size={17} aria-hidden="true" />Log body weight</button>}
    </div>}
    </div>

    {athleteMode && <section className="progress-athlete-measures" aria-label="Volleyball progress">
      <h3>On the court</h3><div className="progress-verticals">{(['standing', 'approach'] as const).map(type => { const test = primaryCoachJump(jumpSeries, type); return <button type="button" key={type} onClick={() => { setJumpType(type); setJumpSetup(null); selectMetric('jump'); }} aria-label={`View ${type} vertical jump`}><span>{capitalized(type)} vertical</span><strong>{test ? number(test.latest.cm) : '—'}{test && <small>cm</small>}</strong><small>{test ? `${shortDate(test.latest.date)} · best ${number(test.best)} cm` : 'Record a measured test'}</small></button>; })}</div>
      <button type="button" className="progress-advantage-row" onClick={viewDetails} disabled={!viewDetails}><span><strong>Approach Advantage</strong><small>{advantage ? `${shortDate(advantage.date)} · matched test setup` : 'Pair standing + approach heights in one test'}</small></span><b>{advantage ? `${signed(advantage.advantageCm)} cm` : '—'}</b><ChevronRight size={16} aria-hidden="true" /></button>
      {primaryCoachJump(jumpSeries, 'approach')?.latest.date && primaryCoachJump(jumpSeries, 'approach')!.latest.date < shiftReportDate(today, -14) && <p className="progress-fresh-test">Your last approach test was {shortDate(primaryCoachJump(jumpSeries, 'approach')!.latest.date)}. Record a fresh test when practical; missing tests do not establish improvement or decline.</p>}
    </section>}
    <div className="progress-supporting-metrics" aria-label="Other progress">
      {otherMetrics.filter(item => item.metric !== metric && availableMetrics.includes(item.metric) && (!athleteMode || item.metric !== 'jump')).map(item => <button key={item.metric} type="button"
        className="progress-supporting-row" aria-label={`View ${item.title.toLowerCase()} progress`} onClick={() => selectMetric(item.metric)}>
        <span><strong>{item.title}</strong><small>{item.note}</small></span>
        <b>{item.value}</b><ChevronRight size={16} aria-hidden="true" />
      </button>)}
      {weight.weeklyAverage !== null && <div className="progress-consistency" aria-label="Weekly body weight"><span><strong>Weekly body-weight average</strong><small>{weight.weeklyDays} recorded days · single-day changes can be fluid or normal variation</small></span><b>{number(weight.weeklyAverage)} kg</b></div>}
      <div className="progress-consistency" aria-label="Training consistency">
        <span><strong>Gym days recorded</strong><small>{coachPeriodLabel(period)} · {consistency.gymSessions} gym{athleteMode ? ` · ${consistency.volleyballRecords} volleyball records` : ' workouts logged'}</small></span>
        <b>{consistency.gymDays ? `${consistency.gymDays} days` : '—'}</b>
      </div>
    </div>
    <div className="progress-overview-links">
      {onViewJourney && <button type="button" onClick={onViewJourney}><span>Training journey</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {viewDetails && <button type="button" onClick={viewDetails}><span>Performance details</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onViewStrength && onViewStrength !== viewDetails && <button type="button" onClick={onViewStrength}><span>Strength history</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {onViewHistory && <button type="button" onClick={onViewHistory}><span>View history</span><ChevronRight size={18} aria-hidden="true" /></button>}
      {athleteMode && onViewWeek && <button type="button" onClick={onViewWeek}><span>Weekly report</span><ChevronRight size={18} aria-hidden="true" /></button>}
    </div>
  </section>;
}
