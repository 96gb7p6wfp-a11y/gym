import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { DEFAULT_TRAINING_PREFERENCES, TrainingPreferencesSchema, type TrainingPreferences } from './onboarding';
import './onboarding.css';

type Props = {
  open: boolean;
  initialPreferences?: TrainingPreferences;
  editing?: boolean;
  disabled?: boolean;
  onComplete: (preferences: TrainingPreferences, options: { applyPlan: boolean }) => Promise<boolean>;
  onSkip?: () => Promise<boolean>;
  onOpenChange?: (open: boolean) => void;
};
const goals: { value: TrainingPreferences['goal']; label: string; detail: string }[] = [
  { value: 'muscle', label: 'Build muscle', detail: 'Grow with consistent strength training.' },
  { value: 'strength', label: 'Get stronger', detail: 'Build strength at a comfortable pace.' },
  { value: 'fitness', label: 'General fitness', detail: 'Move more and build a lasting routine.' },
  { value: 'performance', label: 'Improve athletic performance', detail: 'Build a foundation for your sport.' },
  { value: 'own', label: 'Track my own workouts', detail: 'Start with an empty workout and make it yours.' },
];
const experience: { value: TrainingPreferences['experience']; label: string; detail: string }[] = [
  { value: 'beginner', label: 'Beginner', detail: 'New to training, or building a routine again.' },
  { value: 'intermediate', label: 'Intermediate', detail: 'Comfortable with a regular training routine.' },
  { value: 'advanced', label: 'Advanced', detail: 'Experienced and ready to tailor your training.' },
];
const equipment: { value: TrainingPreferences['equipment'][number]; label: string }[] = [
  { value: 'bodyweight', label: 'Bodyweight' }, { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bands', label: 'Resistance bands' }, { value: 'machines', label: 'Machines & cables' }, { value: 'barbell', label: 'Barbell' },
];

/** Preferences are a draft until one validated profile save succeeds. */
export function Onboarding({ open, initialPreferences, editing = false, disabled = false, onComplete, onSkip, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<TrainingPreferences>(() => structuredClone(initialPreferences ?? DEFAULT_TRAINING_PREFERENCES));
  const [sport, setSport] = useState(initialPreferences?.sport ?? '');
  const [applyPlan, setApplyPlan] = useState(!editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) { setStep(0); setDraft(structuredClone(initialPreferences ?? DEFAULT_TRAINING_PREFERENCES)); setSport(initialPreferences?.sport ?? ''); setApplyPlan(!editing); setError(''); }
  }, [open]);
  const locked = disabled || busy;
  function update(patch: Partial<TrainingPreferences>) { setDraft(current => ({ ...current, ...patch })); setError(''); }
  async function finish(skip = false) {
    if (locked) return;
    const parsed = TrainingPreferencesSchema.safeParse({ ...draft, ...(sport.trim() ? { sport: sport.trim() } : { sport: undefined }) });
    if (!skip && !parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check your preferences.'); return; }
    setBusy(true); setError('');
    try {
      const saved = skip ? await onSkip?.() : await onComplete(parsed.success ? parsed.data : draft, { applyPlan });
      if (saved) onOpenChange?.(false);
      else setError('Your preferences could not save. Try again.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your preferences could not save. Try again.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(next: boolean) => { if (editing && !locked) onOpenChange?.(next); }}>
    <DialogContent className="app-dialog onboarding-dialog" showCloseButton={editing} onEscapeKeyDown={(event: { preventDefault(): void }) => { if (!editing) event.preventDefault(); }} onInteractOutside={(event: { preventDefault(): void }) => event.preventDefault()}>
      <DialogHeader className=""><p className="onboarding-edition">{editing ? 'Your training preferences' : 'Welcome to Setline'} · {step + 1} of 3</p>
        <DialogTitle className="">{step === 0 ? 'What brings you here?' : step === 1 ? 'Where are you starting?' : 'Make it fit your life'}</DialogTitle>
        <DialogDescription className="">{step === 0 ? 'Choose a starting point. You can change this later.' : step === 1 ? 'We’ll keep your starting plan comfortable and easy to edit.' : 'No personal measurements needed. Your data stays on this device.'}</DialogDescription>
      </DialogHeader>
      <div className="onboarding-body">
        {step === 0 && <fieldset className="onboarding-options"><legend className="sr-only">Your goal</legend>{goals.map(goal => <label key={goal.value} className="onboarding-choice">
          <input type="radio" name="onboarding-goal" value={goal.value} checked={draft.goal === goal.value} onChange={() => update({ goal: goal.value })} disabled={locked} />
          <span><strong>{goal.label}</strong><small>{goal.detail}</small></span><Check size={18} aria-hidden="true" />
        </label>)}</fieldset>}
        {step === 1 && <fieldset className="onboarding-options"><legend className="sr-only">Your experience</legend>{experience.map(item => <label key={item.value} className="onboarding-choice">
          <input type="radio" name="onboarding-experience" value={item.value} checked={draft.experience === item.value} onChange={() => update({ experience: item.value })} disabled={locked} />
          <span><strong>{item.label}</strong><small>{item.detail}</small></span><Check size={18} aria-hidden="true" />
        </label>)}</fieldset>}
        {step === 2 && <div className="onboarding-setup">
          <label className="field-label">Training days per week<select value={draft.daysPerWeek} onChange={event => update({ daysPerWeek: Number(event.target.value) })} disabled={locked}>{[1, 2, 3, 4, 5, 6].map(days => <option key={days} value={days}>{days} {days === 1 ? 'day' : 'days'}</option>)}</select></label>
          <fieldset className="onboarding-location"><legend>Where will you train?</legend>{(['gym', 'home'] as const).map(value => <label key={value}><input type="radio" name="onboarding-location" checked={draft.location === value} onChange={() => update({ location: value })} disabled={locked} />{value === 'gym' ? 'Gym' : 'Home'}</label>)}</fieldset>
          <fieldset className="onboarding-equipment"><legend>Available equipment</legend>{equipment.map(item => <label key={item.value}><input type="checkbox" checked={draft.equipment.includes(item.value)} disabled={locked} onChange={event => update({ equipment: event.target.checked ? [...draft.equipment, item.value] : draft.equipment.filter(value => value !== item.value) })} />{item.label}</label>)}</fieldset>
          <label className="field-label">Sport · optional<input type="text" maxLength={40} autoComplete="off" placeholder="For example, volleyball" value={sport} disabled={locked} onChange={event => { setSport(event.target.value); setError(''); }} /></label>
          {draft.experience === 'beginner' && draft.daysPerWeek > 3 && <p className="small-note">Start with three strength sessions. Extra selected days are easy movement, so you can build a comfortable routine.</p>}
          {draft.goal === 'own' ? <p className="small-note">Your next step is an empty workout. Add the exercises you want to track.</p> : <p className="small-note">Your starting plan uses your equipment. Specialized athlete programs are available separately.</p>}
          {editing && <label className="onboarding-apply"><input type="checkbox" checked={applyPlan} onChange={event => setApplyPlan(event.target.checked)} disabled={locked} /><span>Apply a new starting plan<small>{applyPlan ? 'Replaces your weekly plan. Saved workouts and history stay.' : 'Keep my current weekly plan.'}</small></span></label>}
        </div>}
      </div>
      {error && <p className="onboarding-error" role="alert">{error}</p>}
      <div className="onboarding-actions">
        {step > 0 && <button type="button" className="text-button" disabled={locked} onClick={() => { setStep(value => value - 1); setError(''); }}><ArrowLeft size={16} />Back</button>}
        <button type="button" className="btn" disabled={locked} onClick={() => step < 2 ? setStep(value => value + 1) : void finish()}>{busy ? 'Saving…' : step < 2 ? 'Continue' : editing ? 'Save preferences' : draft.goal === 'own' ? 'Create my workout' : 'Start training'}{!busy && <ArrowRight size={17} />}</button>
      </div>
      {!editing && onSkip && <button type="button" className="text-button onboarding-skip" disabled={locked} onClick={() => void finish(true)}>Skip setup · use a simple starting plan</button>}
    </DialogContent>
  </Dialog>;
}
