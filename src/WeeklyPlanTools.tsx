import { useState } from 'react';
import { ArrowLeftRight, ChevronRight, Leaf, Plus, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { WEEKDAYS } from './domain.js';
import type { CustomWorkout, PlanDay } from './workout-customization';
import './workout-builder.css';

type WeeklyPlanToolsProps = {
  plan: PlanDay[];
  onChange: (plan: PlanDay[]) => Promise<boolean | void> | boolean | void;
  templates?: CustomWorkout[];
  onCreateWorkout: (day?: number) => void;
  onEditTemplate?: (workout: CustomWorkout) => void;
  /** The parent owns confirmation and persistence for restoring recommendations. */
  onReset?: () => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
};

/** Week-level actions stay together instead of adding controls to seven day forms. */
export function WeeklyPlanTools({ plan, onChange, templates = [], onCreateWorkout, onEditTemplate, onReset, disabled = false }: WeeklyPlanToolsProps) {
  const [day, setDay] = useState((new Date().getDay() + 6) % 7);
  const [action, setAction] = useState<'move' | 'replace' | 'recovery' | 'schedule' | null>(null);
  const [scheduleTemplate, setScheduleTemplate] = useState<CustomWorkout | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = plan[day];

  async function save(next: PlanDay[]) {
    if (busy || disabled) return;
    setBusy(true); setError('');
    try {
      const result = await onChange(next);
      if (result === false) throw new Error('Could not save your plan. Try again.');
      setAction(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your plan. Try again.'); }
    finally { setBusy(false); }
  }

  function applyTemplate(template: CustomWorkout, targetDay = day) {
    const { id: _id, ...workout } = structuredClone(template);
    // Replacing a main workout does not silently remove a separate primer.
    const replacement: PlanDay = { ...workout, ...(plan[targetDay].extraSession ? { extraSession: plan[targetDay].extraSession } : {}) };
    void save(plan.map((item, index) => index === targetDay ? replacement : item));
  }

  return <section className="weekly-plan-tools" aria-label="Weekly plan tools">
    <details className="weekly-plan-customize">
      <summary>Customize week <ChevronRight size={18} aria-hidden /></summary>
      <div className="weekly-plan-days" role="group" aria-label="Day to customize">
        {WEEKDAYS.map((name: string, index: number) => <button key={name} type="button" aria-label={`Customize ${name}`} aria-pressed={index === day} disabled={busy || disabled} onClick={() => { setDay(index); setError(''); }}>{name.slice(0, 3)}</button>)}
      </div>
      {selected && <>
        <div className="weekly-plan-selected"><span>{WEEKDAYS[day]}</span><h3>{selected.name}</h3></div>
        <div className="weekly-plan-actions">
          <button className="text-button" type="button" disabled={busy || disabled} onClick={() => { setAction('move'); setError(''); }}><ArrowLeftRight size={17} /> Move</button>
          <button className="text-button" type="button" disabled={busy || disabled} onClick={() => { setAction('replace'); setError(''); }}>Replace workout <ChevronRight size={16} /></button>
          <button className="text-button" type="button" disabled={busy || disabled || selected.kind === 'recovery' && selected.exercises.length === 0} onClick={() => { setAction('recovery'); setError(''); }}><Leaf size={17} /> Recovery day</button>
        </div>
      </>}
      <p className="weekly-plan-note">Changes apply to future workouts. Your history stays unchanged.</p>
      {onReset && <button type="button" className="text-button weekly-plan-reset" disabled={busy || disabled} onClick={() => { setError(''); void Promise.resolve().then(() => onReset()).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not restore your plan.')); }}><RotateCcw size={16} /> Reset to recommended plan</button>}
      {error && action === null && <p className="builder-error" role="alert">{error}</p>}
    </details>

    <div className="saved-workouts-heading"><h3>Custom workouts</h3><button type="button" className="text-button" disabled={busy || disabled || templates.length >= 100} onClick={() => onCreateWorkout()}><Plus size={17} /> Create workout</button></div>
    {templates.length ? <ul className="saved-workouts-list">{templates.map(template => <li key={template.id}><button type="button" className="saved-workout-row" disabled={busy || disabled} onClick={() => { setScheduleTemplate(template); setAction('schedule'); setError(''); }} aria-label={`Schedule ${template.name}`}><span><strong>{template.name}</strong><span>{template.exercises.length} exercises · {template.minutes} min</span></span><ChevronRight size={18} aria-hidden /></button>{onEditTemplate && <button className="text-button" type="button" aria-label={`Edit custom workout ${template.name}`} disabled={busy || disabled} onClick={() => onEditTemplate(template)}>Edit</button>}</li>)}</ul> : <p className="weekly-plan-note">Save a session you can use any day.</p>}

    <Dialog open={action !== null} onOpenChange={(next: boolean) => { if (!next && !busy) { setAction(null); setError(''); } }}>
      <DialogContent className="app-dialog weekly-plan-sheet">
        <DialogHeader className="">
          <DialogTitle className="">{action === 'move' ? 'Move workout' : action === 'replace' ? 'Choose workout' : action === 'schedule' ? 'Choose a day' : 'Make it a recovery day?'}</DialogTitle>
          <DialogDescription className="">{action === 'move' ? `Swap ${WEEKDAYS[day]} with another day.` : action === 'replace' ? `Use a saved workout on ${WEEKDAYS[day]}.` : action === 'schedule' ? `Add ${scheduleTemplate?.name ?? 'your workout'} to your week.` : `Replace ${selected?.name ?? 'this workout'} on ${WEEKDAYS[day]}. Your saved history is kept.`}</DialogDescription>
        </DialogHeader>
        {action === 'move' && <>
          <div className="weekly-plan-destination-list">{WEEKDAYS.map((name: string, index: number) => index !== day && <button key={name} type="button" className="weekly-plan-destination" aria-label={`Swap ${WEEKDAYS[day]} with ${name}`} disabled={busy || disabled} onClick={() => { const next = [...plan]; [next[day], next[index]] = [next[index], next[day]]; void save(next); }}><span><strong>{name}</strong><span>{plan[index]?.name}</span></span><ArrowLeftRight size={18} aria-hidden /></button>)}</div>
          {(selected?.kind === 'sport' || plan.some((item, index) => index !== day && item.kind === 'sport')) && <p className="weekly-plan-note">Volleyball reminders follow your volleyball schedule.</p>}
        </>}
        {action === 'replace' && <>
          {templates.length > 0 && <div className="weekly-plan-destination-list">{templates.map(template => <button key={template.id} type="button" className="weekly-plan-destination" aria-label={`Use ${template.name} on ${WEEKDAYS[day]}`} disabled={busy || disabled} onClick={() => applyTemplate(template)}><span><strong>{template.name}</strong><span>{template.exercises.length} exercises · {template.minutes} min</span></span><ChevronRight size={18} aria-hidden /></button>)}</div>}
          {!templates.length && <p className="weekly-plan-note">Create a workout, then add it to your week.</p>}
          <button type="button" className="btn secondary full" disabled={busy || disabled || templates.length >= 100} onClick={() => { setAction(null); onCreateWorkout(day); }}><Plus size={18} /> Create workout for {WEEKDAYS[day]}</button>
        </>}
        {action === 'schedule' && scheduleTemplate && <div className="weekly-plan-destination-list">{WEEKDAYS.map((name: string, index: number) => <button key={name} type="button" className="weekly-plan-destination" aria-label={`Use ${scheduleTemplate.name} on ${name}`} disabled={busy || disabled} onClick={() => applyTemplate(scheduleTemplate, index)}><span><strong>{name}</strong><span>{plan[index]?.name}</span></span><ChevronRight size={18} aria-hidden /></button>)}</div>}
        {action === 'recovery' && <div className="weekly-plan-recovery"><p>Restore performance. Keep movement easy.</p><button type="button" className="btn full" disabled={busy || disabled} onClick={() => void save(plan.map((item, index) => index === day ? { name: 'Recovery', goal: 'recovery', kind: 'recovery', minutes: 20, note: 'Restore performance. Keep movement easy.', exercises: [], warmup: [], cooldown: item.cooldown ?? [] } : item))}>{busy ? 'Saving…' : 'Set recovery day'}</button><button type="button" className="text-button" disabled={busy} onClick={() => setAction(null)}>Keep workout</button></div>}
        {error && <p className="builder-error" role="alert">{error}</p>}
        {busy && action !== 'recovery' && <p className="weekly-plan-note" role="status">Saving…</p>}
      </DialogContent>
    </Dialog>
  </section>;
}

export default WeeklyPlanTools;
