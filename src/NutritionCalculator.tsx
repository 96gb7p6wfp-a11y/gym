import { useEffect, useState } from 'react';
import {
  calculateNutritionGoal, validateNutritionGoalInput, NUTRITION_GOAL_SOURCES, PERSONAL_NUTRITION_START,
  type NutritionGoalInput, type NutritionGoalSettings,
} from './nutrition-goals';
import './nutrition-calculator.css';

interface Props {
  profile?: NutritionGoalSettings;
  bodyWeight: number;
  disabled: boolean;
  onProfileSave: (input: NutritionGoalInput) => Promise<boolean | void>;
  onApplyTargets: (targets: { calories: number; protein: number; fat: number; carbs: number }) => Promise<void>;
}

type Draft = { [K in keyof NutritionGoalInput]: string };

function toDraft(input: NutritionGoalInput): Draft {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)])) as Draft;
}

function toInput(draft: Draft): NutritionGoalInput {
  const numeric = (key: keyof Draft) => draft[key].trim() === '' ? Number.NaN : Number(draft[key].replace(',', '.'));
  return {
    age: numeric('age'), heightCm: numeric('heightCm'), bodyWeightKg: numeric('bodyWeightKg'),
    activityFactor: numeric('activityFactor'), surplusKcal: numeric('surplusKcal'),
    sex: draft.sex as NutritionGoalInput['sex'],
  };
}

export default function NutritionCalculator({ profile, bodyWeight, disabled, onProfileSave, onApplyTargets }: Props) {
  const [draft, setDraft] = useState(() => toDraft({ ...PERSONAL_NUTRITION_START, ...profile, bodyWeightKg: bodyWeight }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    setDraft(toDraft({ ...PERSONAL_NUTRITION_START, ...profile, bodyWeightKg: bodyWeight }));
  }, [profile?.age, profile?.heightCm, profile?.sex, profile?.activityFactor, profile?.surplusKcal, bodyWeight]);
  let estimate: ReturnType<typeof calculateNutritionGoal> | null = null;
  try { estimate = calculateNutritionGoal(toInput(draft)); } catch { /* Validation appears when the user saves. */ }
  function update(key: keyof Draft, value: string) {
    setDraft(current => ({ ...current, [key]: value }));
    setError(''); setMessage('');
  }
  function loadSharedDetails() {
    setDraft(toDraft(PERSONAL_NUTRITION_START));
    setMessage('Shared details loaded. Save when ready.'); setError('');
  }
  async function save(applyTargets: boolean) {
    if (busy || disabled) return;
    setError(''); setMessage('');
    let input: NutritionGoalInput;
    let result: NonNullable<typeof estimate> | null = null;
    try { input = toInput(draft); validateNutritionGoalInput(input); if (applyTargets) result = calculateNutritionGoal(input); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Check your calculation details.'); return; }
    setBusy(true);
    try {
      const saved = await onProfileSave(input);
      if (saved === false) throw new Error('Your calculation details could not be saved.');
      if (applyTargets && result) await onApplyTargets(result);
      setMessage(applyTargets ? 'Daily targets saved. Your existing meals and weight logs are unchanged.' : 'Calculation details saved. Your daily targets are unchanged.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Try again.'); }
    finally { setBusy(false); }
  }
  return <section className="panel nutrition-calculator" aria-labelledby="nutrition-calculator-heading">
    <div className="panel-heading"><h3 id="nutrition-calculator-heading">Daily weight-gain estimate</h3><span className="small-label">Starting point</span></div>
    {estimate ? <>
      <strong className="nutrition-calculator__calories">{estimate.calories.toLocaleString('en-GB')} <span>kcal/day</span></strong>
      <dl className="nutrition-calculator__macros">
        <div><dt>Protein</dt><dd>{estimate.protein} g</dd></div>
        <div><dt>Carbs</dt><dd>{estimate.carbs} g</dd></div>
        <div><dt>Fat</dt><dd>{estimate.fat} g</dd></div>
      </dl>
    </> : <p>Choose an energy equation and valid details below, or edit your targets manually.</p>}
    <p className="small-note">Activity level already includes gym and volleyball. Logged workout calories are not added again.</p>
    {!profile && <button className="text-button nutrition-calculator__shared" disabled={busy} onClick={loadSharedDetails}>Use my shared details (18 years, 180 cm, 64 kg)</button>}
    <details className="nutrition-calculator__details">
      <summary>Edit calculation details</summary>
      <div className="nutrition-calculator__fields">
        <label className="field-label">Age<input type="number" min={18} max={100} step={1} value={draft.age} onChange={e => update('age', e.target.value)} /></label>
        <label className="field-label">Height · cm<input type="number" min={100} max={250} value={draft.heightCm} onChange={e => update('heightCm', e.target.value)} /></label>
        <label className="field-label">Weight for calculation · kg<input type="text" inputMode="decimal" value={draft.bodyWeightKg} onChange={e => update('bodyWeightKg', e.target.value)} /></label>
        <label className="field-label">Energy equation<select aria-label="Energy equation" value={draft.sex} onChange={e => update('sex', e.target.value)}><option value="male">Male</option><option value="female">Female</option><option value="unspecified">Prefer not to specify</option></select></label>
        <label className="field-label nutrition-calculator__wide">Activity level<select aria-label="Activity level" value={draft.activityFactor} onChange={e => update('activityFactor', e.target.value)}>
          <option value="1.2">Mostly sedentary · 1.2</option><option value="1.4">Lightly active · 1.4</option><option value="1.55">Moderately active · 1.55</option><option value="1.65">Gym 4× + volleyball 2× weekly · 1.65</option><option value="1.8">Very active · 1.8</option><option value="2">Highly active · 2.0</option>
          {![1.2, 1.4, 1.55, 1.65, 1.8, 2].includes(Number(draft.activityFactor)) && <option value={draft.activityFactor}>Custom · {draft.activityFactor}</option>}
        </select></label>
        <label className="field-label nutrition-calculator__wide">Daily calorie surplus · kcal<input type="number" min={0} max={500} step={50} value={draft.surplusKcal} onChange={e => update('surplusKcal', e.target.value)} /></label>
      </div>
      <div className="nutrition-calculator__actions">
        <button className="text-button" disabled={busy} onClick={loadSharedDetails}>Use my shared details</button>
        <button className="btn secondary" disabled={disabled || busy} onClick={() => void save(false)}>{busy ? 'Saving…' : 'Save calculation details'}</button>
      </div>
    </details>
    <button className="btn full" disabled={disabled || busy || !estimate} onClick={() => void save(true)}>{busy ? 'Saving…' : 'Use these daily targets'}</button>
    <p className="small-note">This replaces your chosen daily targets only when you tap the button. You can edit them afterward.</p>
    {error && <p className="nutrition-error" role="alert">{error}</p>}
    {message && <p className="small-note" role="status">{message}</p>}
    <details className="nutrition-calculator__details">
      <summary>How the estimate works</summary>
      {estimate && <p>Resting energy ≈ {estimate.bmr} kcal. × activity level {draft.activityFactor} ≈ {estimate.maintenanceKcal} kcal maintenance. + {draft.surplusKcal} kcal, rounded to 100 kcal.</p>}
      <p>Protein ≈ 2 g/kg; a useful range is 1.6–2.2 g/kg. Fat ≈ 24% of calories. Carbs = (calories − protein × 4 − fat × 9) ÷ 4.</p>
      <p>Compare weekly average morning weights. Aim for roughly 0.1–0.2 kg/week. If there is no gradual gain after 2–3 weeks, add 100–150 kcal/day; if gain stays much faster, reduce slightly.</p>
      <p className="small-note">These are adult estimates. Activity, appetite and recovery vary; adjust using trends rather than one day's weight.</p>
      <ul>{NUTRITION_GOAL_SOURCES.map(source => <li key={source.url}><a className="text-button" href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul>
    </details>
  </section>;
}
