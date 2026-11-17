import { useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import type { PreWorkoutChoice, PreWorkoutDecision } from './pre-workout';
import './pre-workout.css';

export interface PreWorkoutRecommendation {
  name: string;
  kind: 'strength' | 'sport' | 'recovery';
  exercises: number;
  sets: number;
  detail?: string;
  changes?: { name: string; before: string; after: string }[];
}
export function PreWorkoutCheck({ date, name, disabled = false, guidanceLimited = false,
  onOpenChange, onReviewGuidance, originalReference, recommendation, onContinue }: {
  date: string; name: string; disabled?: boolean; guidanceLimited?: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewGuidance?: () => void;
  originalReference?: Pick<PreWorkoutRecommendation, 'name' | 'exercises' | 'sets'>;
  recommendation: (decision: Exclude<PreWorkoutDecision, 'rest'>) => PreWorkoutRecommendation;
  onContinue: (choice: PreWorkoutChoice) => Promise<boolean>;
}) {
  const [fit, setFit] = useState<boolean | null>(null);
  const [decision, setDecision] = useState<PreWorkoutDecision | null>(null);
  const [warmedUp, setWarmedUp] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const locked = disabled || busy;
  const resting = decision === 'rest';
  const plan = decision && decision !== 'rest' ? recommendation(decision) : null;
  const recovery = plan?.kind === 'recovery';
  const action = resting ? 'Confirm rest day' : warmedUp === false ? recovery ? 'Recovery preparation' : 'Quick warm-up'
    : recovery ? 'Start recovery' : decision === 'lighter' ? 'Start lighter workout' : 'Start workout';
  async function continueTraining() {
    if (locked || pending.current || fit === null || decision === null || (!resting && warmedUp === null)) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (!(await onContinue({ fit, decision, warmedUp: warmedUp === true }))) {
        setError('Could not start safely. Your saved workouts stay unchanged. Please try again.');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={(open: boolean) => { if (!locked) onOpenChange(open); }}>
    <DialogContent className="app-dialog pre-workout-sheet">
      <DialogHeader className=""><DialogTitle className="">Ready to Train?</DialogTitle><DialogDescription className="">{name}</DialogDescription></DialogHeader>
      <p className="pre-workout__date">{new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
      <fieldset className="pre-workout__question"><legend>Feeling fit to train?</legend>
        <div role="group" aria-label="Feeling fit to train?">
          <button type="button" disabled={locked} aria-label="Yes — fit to train" aria-pressed={fit === true} onClick={() => { setFit(true); setDecision('original'); setError(''); }}><span>Yes</span>{fit === true && <Check size={17} aria-hidden="true" />}</button>
          <button type="button" disabled={locked} aria-pressed={fit === false} onClick={() => { setFit(false); setDecision(null); setError(''); }}><span>Not quite</span>{fit === false && <Check size={17} aria-hidden="true" />}</button>
        </div>
      </fieldset>
      {fit === false && <section className="pre-workout__adjustment" aria-label="Choose today's training">
        <p>Nothing changes until you choose. If movement hurts, you feel unwell or landings are unstable, choose recovery or rest.</p>
        <div role="group" aria-label="Training adjustment">
          <button type="button" disabled={locked} aria-pressed={decision === 'original'} onClick={() => setDecision('original')}>Continue original workout{decision === 'original' && <Check size={17} aria-hidden="true" />}</button>
          <button type="button" disabled={locked} aria-pressed={decision === 'lighter'} onClick={() => setDecision('lighter')}>Use suggested lighter workout{decision === 'lighter' && <Check size={17} aria-hidden="true" />}</button>
          <button type="button" disabled={locked} aria-pressed={decision === 'recovery'} onClick={() => setDecision('recovery')}>Switch to recovery session{decision === 'recovery' && <Check size={17} aria-hidden="true" />}</button>
          <button type="button" disabled={locked} aria-pressed={resting} onClick={() => setDecision('rest')}>Rest today{resting && <Check size={17} aria-hidden="true" />}</button>
        </div>
      </section>}
      {!resting && <fieldset className="pre-workout__question"><legend>Warmed up?</legend>
        <div role="group" aria-label="Warmed up?">
          <button type="button" disabled={locked} aria-label="Yes — already warmed up" aria-pressed={warmedUp === true} onClick={() => setWarmedUp(true)}><span>Yes</span>{warmedUp === true && <Check size={17} aria-hidden="true" />}</button>
          <button type="button" disabled={locked} aria-pressed={warmedUp === false} onClick={() => setWarmedUp(false)}><span>Not yet</span>{warmedUp === false && <Check size={17} aria-hidden="true" />}</button>
        </div>
      </fieldset>}
      {resting && <p className="pre-workout__rest" role="status">No session will be logged. Your original workout and history stay unchanged; no catch-up work is added.</p>}
      {plan && (fit === false || guidanceLimited) && <div className="pre-workout__recommendation" role="status" aria-label="Starting prescription">
        <strong>{plan.name}</strong><span>{recovery ? 'Comfortable movement · full rest is also valid' : `${plan.exercises} exercises · ${plan.sets} working sets`}</span>
        {plan.detail && <p>{plan.detail}</p>}
        {!!plan.changes?.length && <details className="pre-workout__changes"><summary>Review {plan.changes.length} {plan.changes.length === 1 ? 'change' : 'changes'}</summary>
          <ul>{plan.changes.map((change, index) => <li key={`${change.name}-${index}`}><strong>{change.name}</strong><span>Original: {change.before}</span><span>For this session: {change.after}</span></li>)}</ul>
        </details>}
      </div>}
      {fit === false && originalReference && <details className="pre-workout__original"><summary>Original workout reference</summary>
        <strong>{originalReference.name}</strong><p>{originalReference.exercises} exercises · {originalReference.sets} working sets</p>
        <p>This stays saved. Any selected adjustment applies only to the session you start. Your medical guidance still applies.</p>
      </details>}
      {guidanceLimited && <div className="pre-workout__guidance"><p>Your saved guidance still limits heavy or impact work. Continuing the original cannot bypass these limits.</p>
        {onReviewGuidance && <button type="button" className="text-button" disabled={locked} onClick={onReviewGuidance}>Review training guidance<ChevronRight size={15} aria-hidden="true" /></button>}
      </div>}
      {!resting && <p className="pre-workout__note">{warmedUp ? 'Use specific lighter ramp-up sets before heavy or explosive work, even when already warm.' : 'Preparation is matched to this workout, including gradual loading or jump preparation when needed.'}</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      <button type="button" className="btn full pre-workout__start" disabled={locked || fit === null || decision === null || (!resting && warmedUp === null)} onClick={() => void continueTraining()}>{busy ? resting ? 'Closing…' : 'Preparing…' : action}</button>
    </DialogContent>
  </Dialog>;
}
