import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { getTrainingJourney, journeyChange, type JourneyRange } from './training-journey';
import { getTrendCoordinates } from './progress-chart';
import type { PerformanceData } from './performance-data';
import type { ReportNutritionRecord, ReportSession } from './weekly-report';
import './training-journey.css';

const num = (n:number) => n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
const signed = (n:number) => `${n>0?'+':''}${num(n)}`;
const short = (date:string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit', timeZone:'UTC' });

export default function TrainingJourney({ sessions, nutritionRecords, performance, today, onViewSession }: {
  sessions: readonly ReportSession[]; nutritionRecords?: readonly ReportNutritionRecord[]; performance?: PerformanceData;
  today: string; onViewSession?: (id:string)=>void;
}) {
  const [range,setRange] = useState<JourneyRange>(84);
  const [metric,setMetric] = useState<string|null>(null);
  const [seriesId,setSeriesId] = useState<string|null>(null);
  const [pointIndex,setPointIndex] = useState<number|null>(null);
  const result = useMemo(()=>getTrainingJourney({ sessions,nutritionRecords,performance,today,range }),[sessions,nutritionRecords,performance,today,range]);
  const metrics = ['strength','jump','weight'].filter(kind=>result.series.some(s=>s.metric===kind));
  const activeMetric = metric && metrics.includes(metric) ? metric : metrics[0];
  const choices = result.series.filter(s=>s.metric===activeMetric);
  const series = choices.find(s=>s.id===seriesId) ?? choices[0];
  const change = series && journeyChange(series);
  const selectedIndex = series ? Math.min(pointIndex ?? series.points.length-1,series.points.length-1) : 0;
  const point = series?.points[selectedIndex];
  const points = series?.points ?? [];
  const coordinates = getTrendCoordinates(points,320,160,20);
  const minimum = points.length ? Math.min(...points.map(p=>p.value)) : 0;
  const maximum = points.length ? Math.max(...points.map(p=>p.value)) : 0;
  const maxSets = Math.max(1,...result.weeks.map(w=>w.sets));
  function resetSelection() {setSeriesId(null);setPointIndex(null);}
  return <section className="training-journey" aria-label="Training journey">
    <div className="journey-intro"><p className="eyebrow">Your work, over time</p><h2>See what changed.</h2><p>Follow your lifting load, jump tests and body-weight trends.</p></div>
    <div className="journey-ranges" role="group" aria-label="Journey period">{([{value:28,label:'4 weeks'},{value:84,label:'12 weeks'},{value:'all',label:'All history'}] as const).map(item=><button key={item.value} type="button" aria-pressed={range===item.value} onClick={()=>{setRange(item.value);resetSelection();}}>{item.label}</button>)}</div>
    <p className="journey-period">{result.start} – {result.end}</p>
    <dl className="journey-totals"><div><dt>Gym days</dt><dd>{result.gymDays}</dd></div><div><dt>Workouts</dt><dd>{result.gymWorkouts}</dd></div><div><dt>Working sets</dt><dd>{result.sets}</dd></div></dl>
    <section className="journey-card" aria-label="Dated results">
      {series ? <>
        <div className="journey-metrics" role="group" aria-label="Result metric">{metrics.map(kind=><button type="button" key={kind} aria-pressed={activeMetric===kind} onClick={()=>{setMetric(kind);resetSelection();}}>{kind==='weight'?'Body weight':kind==='jump'?'Jump':'Lifting load'}</button>)}</div>
        <label className="journey-choice">Result<select aria-label="Journey result" value={series.id} onChange={e=>{setSeriesId(e.target.value);setPointIndex(null);}}>{choices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <div className="journey-result"><span>{series.name}</span><strong>{num(points.at(-1)!.value)}<small>{series.unit}</small></strong><p>{change ? `${signed(change.delta)} ${series.unit} since ${short(change.first.date)}` : 'One test day · no change comparison yet'}</p></div>
        <p className="journey-context">{series.context}</p>
        {coordinates.length>1 ? <div className="journey-chart"><div className="journey-scale"><span>Recorded range · {num(minimum)}–{num(maximum)} {series.unit}</span></div><svg viewBox="0 0 320 160" role="img" aria-label={`${series.name}: ${points.map(p=>`${p.date}, ${num(p.value)} ${series.unit}`).join('; ')}`}><path d="M20 140H300" className="journey-baseline"/><polyline points={coordinates.map(p=>`${p.x},${p.y}`).join(' ')} />{coordinates.map((p,index)=><circle key={`${p.date}:${index}`} cx={p.x} cy={p.y} r={index===selectedIndex?5:3} />)}</svg><div className="journey-chart-dates"><span>{short(points[0].date)}</span><span>{short(points.at(-1)!.date)}</span></div></div> : <p className="journey-no-trend">Another recorded day builds a trend. A single result is a baseline.</p>}
        <p className="journey-context">{points.length} recorded {activeMetric==='weight'?'weeks':'sessions / test days'} · calendar spacing · vertical scale fitted to the recorded range</p>
        <label className="journey-choice">Inspect a record<select aria-label="Inspect journey record" value={selectedIndex} onChange={e=>setPointIndex(Number(e.target.value))}>{points.map((p,index)=><option key={`${p.date}:${index}`} value={index}>{p.date} · {num(p.value)} {series.unit}{p.rir===null?'':` · RIR ${p.rir}`}</option>)}</select></label>
        {point && <div className="journey-selected" role="status"><span>{point.date} · {num(point.value)} {series.unit}{series.metric==='strength'?` · ${point.rir===null?'RIR unrecorded':`RIR ${point.rir}`}`:''}</span>{point.sessionId && onViewSession && <button className="text-button" type="button" onClick={()=>onViewSession(point.sessionId!)}>View workout<ChevronRight size={16}/></button>}</div>}
        {series.metric==='strength' && change && (change.first.rir===null || change.last.rir===null || change.first.rir!==change.last.rir) && <p className="journey-context">Effort differs or was unrecorded. This load change alone does not prove greater strength.</p>}
      </> : <div className="journey-empty"><h3>Your results start with real records.</h3><p>Log a completed weighted set, a measured jump, or body-weight check-ins. Nothing here is filled with sample results.</p>{result.sparseWeightDays>0 && <p>{result.sparseWeightDays} body-weight check-in days recorded. Weekly comparisons need at least 3 days spread across 4 days.</p>}</div>}
    </section>
    <details className="journey-work"><summary>Weekly training · {result.weeks.length} weeks<ChevronRight size={18}/></summary><p>Completed gym work only. Rest and unlogged days are not failures. Volume is weight × reps, not a measure of fitness or volleyball performance.</p>{result.weeks.slice(-52).map(w=><div className="journey-week" key={w.date}><span>{short(w.date)}<small>{w.days} gym days · {w.workouts} workouts</small></span><div><i style={{width:`${w.sets/maxSets*100}%`}}/><b>{w.sets} sets</b><small>{num(w.volumeKg)} kg weighted work</small></div></div>)}{result.weeks.length>52 && <p>Showing the latest 52 weeks; totals and result filters include the full selected period.</p>}</details>
    <details className="journey-logs"><summary>Workouts in this period · {result.sessions.length}</summary><p>Open a saved workout to see or correct its original entries.</p>{result.sessions.slice().reverse().slice(0,100).map(s=><button key={s.id} type="button" disabled={!onViewSession} onClick={()=>onViewSession?.(s.id)}><span><strong>{s.name}</strong><small>{s.date}</small></span><ChevronRight size={18}/></button>)}{result.sessions.length>100&&<p>Latest 100 shown here. All records remain available in History.</p>}</details>
  </section>;
}
