import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { rebaseObjectChanges } from './profile-updates';
import './sunday-match-schedule.css';

export interface SundayMatch {
  date: string;
  scheduled: boolean;
  startTime?: string;
  opponent?: string;
  location?: string;
  notes?: string;
}
const emptyMatch = (date: string): SundayMatch => ({ date, scheduled: false });
function validSunday(date: string): boolean {
  const value = new Date(`${date}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value.getTime())
    && value.toISOString().slice(0, 10) === date && value.getUTCDay() === 0;
}
function normalizeMatch(match: SundayMatch): SundayMatch {
  const { startTime, opponent, location, notes, ...rest } = match;
  return { ...rest, ...(startTime ? { startTime } : {}), ...(opponent?.trim() ? { opponent: opponent.trim() } : {}),
    ...(location?.trim() ? { location: location.trim() } : {}), ...(notes?.trim() ? { notes: notes.trim() } : {}) };
}

/** Edits one actual Sunday, never an eight-week index or completed activity. */
export function SundayMatchSchedule({ date, match, disabled = false, readOnlyReason, onSave }: {
  date: string;
  match?: SundayMatch;
  disabled?: boolean;
  readOnlyReason?: string;
  onSave: (match: SundayMatch) => Promise<boolean>;
}) {
  const saved = match?.date === date ? match : emptyMatch(date);
  const fingerprint = JSON.stringify(saved);
  const previous = useRef(structuredClone(saved));
  const currentDate = useRef(date); currentDate.current = date;
  const [draft, setDraft] = useState<SundayMatch>(() => structuredClone(saved));
  const pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const next = JSON.parse(fingerprint) as SundayMatch;
    setDraft(current => previous.current.date === next.date
      ? rebaseObjectChanges(previous.current, next, current) : structuredClone(next));
    previous.current = next;
    setError('');
  }, [fingerprint]);
  const valid = validSunday(date);
  const locked = disabled || busy || Boolean(readOnlyReason) || !valid || draft.date !== date;
  const title = valid ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' }).format(new Date(`${date}T12:00:00Z`)) : 'Choose a Sunday';
  const dirty = JSON.stringify(normalizeMatch(draft)) !== JSON.stringify(normalizeMatch(saved));
  async function save(next: SundayMatch) {
    if (locked || pending.current || currentDate.current !== date || next.date !== date) return;
    if (next.startTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(next.startTime)) { setError('Enter a valid match time or leave it blank.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const normalized = normalizeMatch(next);
      const saved = await onSave(normalized);
      if (currentDate.current !== next.date) return;
      if (saved) setDraft(normalized);
      else setError('The schedule could not save. Your previous match selection stays.');
    } catch (reason) { if (currentDate.current === next.date) setError(reason instanceof Error ? reason.message : 'Could not save this match. Try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="sunday-match" aria-label="Sunday match schedule" data-date={date}>
    <div className="sunday-match__heading"><div><p>{title}</p><h3>{draft.scheduled ? 'Volleyball Match' : 'Match or recovery'}</h3></div>
      <button type="button" className="sunday-match__switch" role="switch" aria-label="Match scheduled" aria-checked={draft.scheduled}
        disabled={locked} onClick={() => void save({ ...draft, scheduled: !draft.scheduled })}>
        <span>{draft.scheduled ? 'On' : 'Off'}</span><span className="sunday-match__track" aria-hidden="true"><span>{draft.scheduled && <Check size={12} strokeWidth={3} />}</span></span>
      </button>
    </div>
    <p className="sunday-match__effect">{draft.scheduled ? 'Saturday becomes a short primer or rest. No heavy Lower B is added.' : 'Saturday keeps full Lower B as its reference. Sunday remains recovery.'}</p>
    {draft.scheduled && <details className="sunday-match__details"><summary>Match details (optional)<ChevronRight size={16} aria-hidden="true" /></summary>
      <p className="small-note">Leave unknown details blank. Time uses Europe/Berlin.</p>
      <label className="field-label">Match start time<input type="time" aria-label="Match start time" disabled={locked} value={draft.startTime ?? ''} onChange={event => setDraft({ ...draft, startTime: event.target.value })} /></label>
      <label className="field-label">Opponent<input type="text" aria-label="Opponent" autoComplete="off" maxLength={100} disabled={locked} value={draft.opponent ?? ''} onChange={event => setDraft({ ...draft, opponent: event.target.value })} /></label>
      <label className="field-label">Location<input type="text" aria-label="Location" autoComplete="off" maxLength={160} disabled={locked} value={draft.location ?? ''} onChange={event => setDraft({ ...draft, location: event.target.value })} /></label>
      <label className="field-label">Match notes<textarea aria-label="Match notes" rows={2} maxLength={500} disabled={locked} value={draft.notes ?? ''} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      <button className="btn secondary full" type="button" disabled={locked || !dirty} onClick={() => void save(draft)}>{busy ? 'Saving…' : 'Save match details'}</button>
      <p className="small-note" role="status">{dirty ? 'Details are not saved yet.' : 'Match details are saved for this Sunday.'}</p>
    </details>}
    {readOnlyReason && <p className="sunday-match__notice">{readOnlyReason}</p>}
    {error && <p className="sunday-match__error" role="alert">{error}</p>}
  </section>;
}
