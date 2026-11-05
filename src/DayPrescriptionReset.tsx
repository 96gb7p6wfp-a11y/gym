import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { compareWorkoutPrescriptions } from './training-prescription';
import type { PlanDay } from './workout-customization';

const sets = (plan: PlanDay) => plan.exercises.filter(exercise => !exercise.optionalWork)
  .reduce((sum, exercise) => sum + exercise.sets, 0);

/** A reviewed date-only escape from an obsolete reduced draft, never a history reset. */
export function DayPrescriptionReset({ open, onOpenChange, date, currentPlan, weeklyPlan, onConfirm, disabled = false }: {
  open: boolean; onOpenChange: (open: boolean) => void; date: string;
  currentPlan: PlanDay; weeklyPlan: PlanDay;
  onConfirm: () => Promise<boolean>; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const changes = compareWorkoutPrescriptions(currentPlan, weeklyPlan);
  return <Dialog open={open} onOpenChange={(next: boolean) => { if (!inFlight.current) onOpenChange(next); }}>
    <DialogContent className="app-dialog">
      <DialogHeader className=""><DialogTitle className="">Review this date’s reset</DialogTitle><DialogDescription className="">{date} · Review before changing your planned workout.</DialogDescription></DialogHeader>
      <p>A date-specific edit can retain an earlier reduced prescription after your guidance or readiness changes. Resetting uses the current weekly prescription for this date, with your current guidance, readiness and match schedule still applied.</p>
      <div className="preview-session-details"><h3>Current date edit</h3><p>{currentPlan.name} · {sets(currentPlan)} planned sets</p></div>
      <div className="preview-session-details"><h3>After reset</h3><p>{weeklyPlan.name} · {sets(weeklyPlan)} planned sets</p></div>
      {changes.length > 0 && <details className="workout-prescription__changes"><summary>Review exercise changes<span>{changes.length}</span></summary>
        <ul aria-label="Date reset changes">{changes.map(change => <li key={`${change.key}-${change.kind}`}><strong>{change.name}</strong>
          <p><span>Current</span>{change.before}</p><p><span>After reset</span>{change.after}</p>
        </li>)}</ul>
      </details>}
      <p className="small-note">Only this date’s plan edit and preparation checks are removed. Your weekly plan, custom templates and all recorded workouts stay unchanged. A full recovery copy is saved first; a failed safety copy stops this action.</p>
      <button type="button" className="btn full" disabled={disabled || busy} onClick={async () => {
        if (inFlight.current) return;
        inFlight.current = true; setBusy(true); setError('');
        try { if (await onConfirm()) onOpenChange(false); else setError('This date could not be reset. Your saved edit stays.'); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'This date could not be reset.'); }
        finally { inFlight.current = false; setBusy(false); }
      }}>{busy ? 'Saving…' : 'Use current weekly prescription'}</button>
      <button type="button" className="btn secondary full" disabled={busy} onClick={() => onOpenChange(false)}>Keep my date edit</button>
      {error && <p role="alert">{error}</p>}
    </DialogContent>
  </Dialog>;
}
