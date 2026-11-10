import { useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import type { PreWorkoutFeeling } from './pre-workout';
import './pre-workout.css';

export interface PreWorkoutRecommendation {
  name: string;
  kind: 'strength' | 'sport' | 'recovery';
  exercises: number;
  sets: number;
  detail?: string;
}
export function PreWorkoutCheck({ date, name, disabled = false, guidanceLimited = false,
  onOpenChange, onReviewGuidance, recommendation, onContinue }: {
  date: string; name: string; disabled?: boolean; guidanceLimited?: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewGuidance?: () => void;
  recommendation: (feeling: PreWorkoutFeeling) => PreWorkoutRecommendation;
  onContinue: (choice: { feeling: PreWorkoutFeeling; warmedUp: boolean }) => Promise<boolean>;
}) {
  const [feeling, setFeeling] = useState<PreWorkoutFeeling | null>(null);
  const [warmedUp, setWarmedUp] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const locked = disabled || busy;
  const plan = feeling ? recommendation(feeling) : null;
  const recovery = plan?.kind === 'recovery';
  const action = warmedUp === false ? recovery ? 'Recovery preparation' : 'Quick warm-up'
    : recovery ? 'Start recovery' : feeling === 'tired' ? 'Start lighter workout' : 'Start workout';
  async function continueTraining() {
    if (locked || pending.current || feeling === null || warmedUp === null) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (!(await onContinue({ feeling, warmedUp }))) setError('Could not start safely. Your saved workouts stay unchanged. Please try again.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={(open: boolean) => { if (!locked) onOpenChange(open); }}>
    <DialogContent className="app-dialog pre-workout-sheet">
      <DialogHeader className=""><DialogTitle className="">Ready to Train?</DialogTitle><DialogDescription className="">{name}</DialogDescription></DialogHeader>
      <p className="pre-workout__date">{new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
      <fieldset className="pre-workout__question"><legend>Feeling fit to train?</legend>
        <div role="group" aria-label="Feeling fit to train?">
          <button type="button" disabled={locked} aria-label="Yes — fit to train" aria-pressed={feeling === 'normal'} onClick={() => setFeeling('normal')}><span>Yes</span>{feeling === 'normal' && <Check size={17} aria-hidden="true" />}</button>
          <button type="button" disabled={locked} aria-pressed={feeling === 'tired' || feeling === 'poor'} onClick={() => setFeeling('poor')}><span>Not quite</span>{feeling !== null && feeling !== 'normal' && <Check size={17} aria-hidden="true" />}</button>
        </div>
      </fieldset>
      {feeling !== null && feeling !== 'normal' && <div className="pre-workout__adjustment">
        <p>Choose recovery if you feel unwell, movement hurts or landings feel unstable. Full rest is also valid.</p>
        <div role="group" aria-label="Training adjustment">
          <button type="button" disabled={locked} aria-pressed={feeling === 'poor'} onClick={() => setFeeling('poor')}>Recovery</button>
          <button type="button" disabled={locked} aria-pressed={feeling === 'tired'} onClick={() => setFeeling('tired')}>Just tired — lighter training</button>
        </div>
      </div>}
      <fieldset className="pre-workout__question"><legend>Warmed up?</legend>
        <div role="group" aria-label="Warmed up?">
          <button type="button" disabled={locked} aria-label="Yes — already warmed up" aria-pressed={warmedUp === true} onClick={() => setWarmedUp(true)}><span>Yes</span>{warmedUp === true && <Check size={17} aria-hidden="true" />}</button>
          <button type="button" disabled={locked} aria-pressed={warmedUp === false} onClick={() => setWarmedUp(false)}><span>Not yet</span>{warmedUp === false && <Check size={17} aria-hidden="true" />}</button>
        </div>
      </fieldset>
      {plan && (feeling !== 'normal' || guidanceLimited) && <div className="pre-workout__recommendation" role="status" aria-label="Starting prescription">
        <strong>{plan.name}</strong><span>{recovery ? 'Comfortable movement · full rest is also valid' : `${plan.exercises} exercises · ${plan.sets} working sets`}</span>
        {plan.detail && <p>{plan.detail}</p>}
      </div>}
      {guidanceLimited && <div className="pre-workout__guidance"><p>Your saved guidance still limits heavy or impact work.</p>
        {onReviewGuidance && <button type="button" className="text-button" disabled={locked} onClick={onReviewGuidance}>Review training guidance<ChevronRight size={15} aria-hidden="true" /></button>}
      </div>}
      <p className="pre-workout__note">{warmedUp ? 'Use specific lighter ramp-up sets before heavy or explosive work, even when already warm.' : 'Preparation is matched to this workout, including gradual loading or jump preparation when needed.'}</p>
      {error && <p className="error-text" role="alert">{error}</p>}
      <button type="button" className="btn full pre-workout__start" disabled={locked || feeling === null || warmedUp === null} onClick={() => void continueTraining()}>{busy ? 'Preparing…' : action}</button>
    </DialogContent>
  </Dialog>;
}
