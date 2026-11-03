import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { V131_NUTRITION_START, V131_NUTRITION_MACRO_KCAL } from './nutrition-goals';
import './nutrition-calculator.css';

type Targets = { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; goalWeight: number | null };
type ProposedTargets = { calories: number; protein: number; carbs: number; fat: number; goalWeight?: number | null };

/** Lives inside Daily targets: viewing a programme never changes saved food targets. */
export function AthleticNutritionProposal({ currentTargets, disabled, onApplyTargets }: {
  currentTargets: Targets; disabled: boolean;
  onApplyTargets: (targets: ProposedTargets) => Promise<void>;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function apply() {
    if (disabled || busy) return;
    setBusy(true); setError('');
    try {
      const { calories, protein, carbs, fat } = V131_NUTRITION_START;
      await onApplyTargets({ calories, protein, carbs, fat,
        goalWeight: currentTargets.goalWeight ?? 66.5 });
      setReviewing(false); setMessage('V13.1 targets saved. Review your weekly weight trend before adjusting.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your targets could not save. Try again.'); }
    finally { setBusy(false); }
  }
  return <section className="nutrition-program-proposal" aria-label="V13.1 nutrition recommendation">
    {!reviewing ? <button type="button" className="nutrition-tool-row" disabled={disabled || busy} onClick={() => { setReviewing(true); setMessage(''); setError(''); }}><span><strong>V13.1 starting targets</strong><small>Review athletic muscle gain</small></span><ChevronRight size={18} aria-hidden="true" /></button> : <>
      <h3>Review V13.1 targets</h3>
      <strong className="nutrition-calculator__calories">3,050 <span>kcal/day</span></strong>
      <dl className="nutrition-calculator__macros"><div><dt>Protein</dt><dd>130 g</dd></div><div><dt>Carbs</dt><dd>420 g</dd></div><div><dt>Fat</dt><dd>95 g</dd></div></dl>
      <p className="small-note">An adjustable starting estimate, not a measured requirement. Macros provide about {V131_NUTRITION_MACRO_KCAL.toLocaleString('en-GB')} kcal.</p>
      <p className="small-note">Initial goal: 66–67 kg, gaining about 0.1–0.25 kg/week. {currentTargets.goalWeight == null ? 'Your goal weight will start at 66.5 kg.' : `Your saved ${currentTargets.goalWeight} kg goal stays.`}</p>
      <p className="small-note">Replaces daily calories and macros. Your food, weight records and routine stay.</p>
      <button type="button" className="btn full" disabled={disabled || busy} onClick={() => void apply()}>{busy ? 'Saving…' : 'Apply V13.1 targets'}</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => setReviewing(false)}>Keep current targets</button>
    </>}
    {error && <p className="nutrition-error" role="alert">{error}</p>}
    {message && <p className="small-note" role="status">{message}</p>}
  </section>;
}
