import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import './daily-readiness.css';

export type DailyFeeling = 'great' | 'normal' | 'tired' | 'poor';
const choices: { value: DailyFeeling; title: string; detail: string }[] = [
  { value: 'great', title: 'Great', detail: 'Ready to push' },
  { value: 'normal', title: 'Normal', detail: 'Ready to train' },
  { value: 'tired', title: 'Tired', detail: 'Reduce some work' },
  { value: 'poor', title: 'Poor', detail: 'Recovery recommended' },
];

/** One explicit response for one calendar date; this never grants clearance. */
export function DailyReadiness({ date, feeling, disabled = false, guidanceLimited = false,
  onChange, onReviewGuidance, onAdvanced }: {
  date: string;
  feeling?: DailyFeeling;
  disabled?: boolean;
  guidanceLimited?: boolean;
  onChange: (feeling: DailyFeeling | undefined) => Promise<boolean>;
  onReviewGuidance?: () => void;
  onAdvanced?: () => void;
}) {
  const pending = useRef(false);
  const currentDate = useRef(date); currentDate.current = date;
  const [busy, setBusy] = useState<DailyFeeling | 'clear' | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setError(''); }, [date]);
  async function choose(value: DailyFeeling | undefined) {
    if (disabled || pending.current || value === feeling || currentDate.current !== date) return;
    pending.current = true; setBusy(value ?? 'clear'); setError('');
    try {
      if (!(await onChange(value)) && currentDate.current === date) setError('Could not save this check-in. Your previous response stays.');
    } catch { if (currentDate.current === date) setError('Could not save this check-in. Try again.'); }
    finally { pending.current = false; setBusy(null); }
  }
  return <section className="daily-readiness" aria-label="Daily readiness" data-date={date}>
    <div className="daily-readiness__heading"><h3>How are you feeling?</h3>
      <span role="status">{busy ? 'Saving…' : feeling ? 'Saved for this date' : 'Readiness unknown'}</span>
    </div>
    <div className="daily-readiness__choices" role="group" aria-label="How are you feeling today?">
      {choices.map(choice => <button key={choice.value} type="button" aria-label={`${choice.title} — ${choice.detail}`}
        aria-pressed={feeling === choice.value} disabled={disabled || busy !== null}
        onClick={() => void choose(choice.value)}>
        <span><strong>{choice.title}</strong><small>{choice.detail}</small></span>
        <span className="daily-readiness__mark" aria-hidden="true">{feeling === choice.value && <Check size={13} strokeWidth={2.5} />}</span>
      </button>)}
    </div>
    {guidanceLimited && <p className="daily-readiness__guidance">Your recorded guidance still limits training.{onReviewGuidance && <button type="button" className="text-button" onClick={onReviewGuidance}>Review guidance<ChevronRight size={14} aria-hidden="true" /></button>}</p>}
    <details className="daily-readiness__details"><summary>About this check-in</summary>
      <p>Your response applies only to {date}. Great and Normal retain the eligible full prescription; Tired reduces demanding work; Poor recommends recovery. Missing readiness is unknown. This is your report, not a medical recovery measurement.</p>
      {onAdvanced && <button type="button" className="text-button" disabled={disabled || busy !== null} onClick={onAdvanced}>Add optional recovery details<ChevronRight size={14} aria-hidden="true" /></button>}
      {feeling && <button type="button" className="text-button" disabled={disabled || busy !== null} onClick={() => void choose(undefined)}>Clear readiness for this date</button>}
    </details>
    {error && <p className="daily-readiness__error" role="alert">{error}</p>}
  </section>;
}
