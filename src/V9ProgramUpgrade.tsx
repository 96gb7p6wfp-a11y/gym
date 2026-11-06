import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { reviewV9ProgramUpgrade, type V9ProgramUpgradeOptions } from './master-program-upgrade';
import type { PlanDay } from './workout-customization';
import { masterWeekStart } from './volleyball-master-plan';
import './v9-program-upgrade.css';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
type Profile = Parameters<typeof reviewV9ProgramUpgrade>[0];
type DraftChoice = 'review-later' | 'replace' | 'keep';

function V9Day({ day, label, expanded = false }: { day: PlanDay; label: string; expanded?: boolean }) {
  const working = day.exercises.filter(exercise => !exercise.optionalWork);
  const sets = working.reduce((sum, exercise) => sum + exercise.sets, 0);
  return <details className="v9-upgrade__day" open={expanded || undefined}>
    <summary><span><small>{label}</small><strong>{day.name}</strong><small>{day.durationRange ?? `${day.minutes} min`}{working.length ? ` · ${working.length} exercises · ${sets} sets` : ''}</small></span></summary>
    {day.subtitle && <p>{day.subtitle}</p>}
    {working.length > 0 ? <ol>{working.map((exercise, index) => <li key={exercise.key}>
      {exercise.section && exercise.section !== working[index - 1]?.section && <h4>{exercise.section}</h4>}
      <strong>{exercise.name}</strong><span>{exercise.sets} × {exercise.target}{exercise.perSide ? ' / side' : ''}{exercise.restRange ? ` · ${exercise.restRange} rest` : exercise.rest ? ` · ${exercise.rest} sec rest` : ''}{exercise.targetRir != null ? ` · RIR ${exercise.targetRir}` : ''}</span>
      {exercise.equipmentLabel && <small>{exercise.equipmentLabel}</small>}
    </li>)}</ol> : <p>Rest, easy movement or actual sport exposure. No completed training is created.</p>}
    {day.extraSession && <section className="v9-upgrade__extra"><h4>Optional · {day.extraSession.name}</h4><ul>{day.extraSession.exercises.map(exercise => <li key={exercise.key}><strong>{exercise.name}</strong><span>{exercise.sets} × {exercise.target}</span></li>)}</ul></section>}
  </details>;
}

/** The proposal is read-only until one explicit future-plan confirmation. */
export function V9ProgramUpgrade({ open, onOpenChange, profile, today, activeDates = [], onApply, disabled = false }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  today: string;
  activeDates?: readonly string[];
  onApply: (options: V9ProgramUpgradeOptions) => Promise<boolean | void>;
  disabled?: boolean;
}) {
  const activeKey = JSON.stringify([...activeDates].sort());
  const proposal = useMemo(() => {
    try { return { review: reviewV9ProgramUpgrade(profile, today, { activeDates: [...activeDates] }), error: '' }; }
    catch (reason) { return { review: null, error: reason instanceof Error ? reason.message : 'Your current plan could not be reviewed.' }; }
  }, [profile, today, activeKey]);
  const review = proposal.review;
  const alreadyV9 = profile.masterProgram?.revision === '9';
  const fingerprint = JSON.stringify(review);
  const previous = useRef({ open: false, fingerprint });
  const inFlight = useRef(false);
  const [stage, setStage] = useState<'offer' | 'schedule'>('offer');
  const [choices, setChoices] = useState<Record<string, DraftChoice>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (open && (!previous.current.open || previous.current.fingerprint !== fingerprint)) {
      setChoices({}); setAcknowledged(false); setError('');
      setNotice(previous.current.open ? 'Your saved setup changed. Review the current proposal and choose again.' : '');
      if (!previous.current.open) setStage('offer');
    }
    previous.current = { open, fingerprint };
  }, [open, fingerprint]);
  const locked = disabled || busy;
  const needsAcknowledgement = Boolean(review?.needsReview.length);
  async function apply() {
    if (!review || locked || inFlight.current || (needsAcknowledgement && !acknowledged)) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await onApply({
        weeklyCustomizationPolicy: acknowledged ? 'recommendations' : 'preserve',
        replaceDraftKeys: review.upcomingDrafts.filter(row => choices[row.key] === 'replace').map(row => row.key),
        keepDraftKeys: review.upcomingDrafts.filter(row => choices[row.key] === 'keep' && row.canKeep).map(row => row.key),
        activeDates: [...activeDates],
      });
      if (result === false) setError('V9 could not be saved. Your current plan and records stay unchanged.');
      else onOpenChange(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'V9 could not be applied. Your current plan stays.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(next: boolean) => { if (!inFlight.current) onOpenChange(next); }}>
    <DialogContent className="app-dialog v9-upgrade-sheet">
      <DialogHeader className=""><DialogTitle className="">{stage === 'offer' ? alreadyV9 ? 'Review V9 Upcoming Workouts' : 'Upgrade Training Plan to V9' : 'Review Weekly Schedule'}</DialogTitle>
        <DialogDescription className="">Volleyball Performance Plan V9 — Collegiate-Style Performance</DialogDescription></DialogHeader>
      {stage === 'offer' ? <>
        <p>{alreadyV9 ? 'Review your saved V9 week and choose which upcoming date edits to keep or replace. A confirmed Sunday match still selects the separate Saturday primer.' : 'Four substantial gym sessions around Tuesday and Friday volleyball. Saturday has two separate templates: full Lower B without a Sunday match, or a short primer before a confirmed match.'}</p>
        <div className="v9-upgrade__facts"><p><strong>App stays Setline V18</strong><span>V9 is a training prescription, not an app downgrade.</span></p><p><strong>Your records stay</strong><span>{alreadyV9 ? 'Your current V9 plan and existing archive stay. Review only the upcoming date edits you choose to change.' : 'The current plan is archived.'} History, active workouts, recorded weights, nutrition, settings and your reported guidance are preserved.</span></p></div>
        <p className="small-note">This proposal does not grant medical clearance. Actual sessions still use your recorded impact/lifting guidance, readiness and phase. No training or test results are marked complete.</p>
        <button type="button" className="btn full" disabled={locked || !review} onClick={() => setStage('schedule')}>Review Weekly Schedule</button>
      </> : review && <>
        <p className="small-note">{alreadyV9 ? 'Your saved V9 week stays unchanged. This review applies only your upcoming date-edit choices.' : 'Proposed V9 base · full prescriptions before readiness and guidance.'} {profile.masterProgram ? `Your cycle starts ${profile.masterProgram.startDate}. Its start and confirmed match settings are retained; this action does not restart the block.` : `Your new V9 block starts ${masterWeekStart(today)}. No Sunday match is assumed.`}</p>
        <section aria-label="V9 weekly schedule"><h3>{alreadyV9 ? 'Your saved V9 week · no Sunday match' : 'Four gym sessions · no Sunday match'}</h3>{review.schedule.map((day, index) => <V9Day key={index} day={day} label={weekdays[index]} expanded={index === 5} />)}</section>
        <section aria-label="V9 match-week weekend"><h3>Confirmed Sunday match</h3>{review.matchWeekend.map((day, index) => <V9Day key={index} day={day} label={weekdays[index + 5]} />)}<p className="small-note">A confirmed match selects the separate Saturday primer. Unknown match time stays unset. No additional Sunday gym session is added.</p></section>
        {review.preserved.length > 0 && <details className="v9-upgrade__changes"><summary>Compatible settings kept · {review.preserved.length}</summary><ul>{review.preserved.map((item, index) => <li key={index}><strong>{weekdays[item.day]} · {item.dayName}</strong><p>{item.message}</p></li>)}</ul></details>}
        {needsAcknowledgement && <section className="v9-upgrade__review" aria-label="V9 customization review"><h3>Review your intentional changes</h3><ul>{review.needsReview.map((item, index) => <li key={index}><strong>{weekdays[item.day]} · {item.dayName}</strong><p>{item.message}</p></li>)}</ul>
          <label className="v9-upgrade__ack"><input type="checkbox" checked={acknowledged} disabled={locked} aria-label="Use V9 recommendations for unmapped weekly edits" onChange={event => setAcknowledged(event.target.checked)} /><span>Use the V9 recommendations for weekly edits that cannot safely carry over. Archive my previous plan for restoration.</span></label>
        </section>}
        {review.upcomingDrafts.length > 0 && <section className="v9-upgrade__review" aria-label="Upcoming date-specific workouts"><h3>Upcoming date edits</h3><p>Choose what changes. Unreviewed intentional edits remain stored and use the V9 recommendation until you review them. Obsolete preparation checks refresh with V9 when you apply; the safety copy retains the previous setup.</p>
          {review.upcomingDrafts.map(row => <div className="v9-upgrade__draft" key={row.key}><strong>{row.date} · {row.slot === 'extra' ? 'Optional session' : 'Main session'}</strong><p>{row.name} · {row.currentExerciseCount} exercises · {row.currentWorkingSets} sets</p><p>{row.reason}</p>
            {row.recommendedName && <p>V9 · {row.recommendedName} · {row.recommendedExerciseCount} exercises · {row.recommendedWorkingSets} sets</p>}
            {row.disposition === 'active-preserved' ? <p className="small-note">Active snapshot preserved. No replacement is available.</p> : <label className="field-label">For this date<select aria-label={`V9 choice for ${row.date} ${row.slot}`} disabled={locked} value={choices[row.key] ?? 'review-later'} onChange={event => setChoices({ ...choices, [row.key]: event.target.value as DraftChoice })}>
              <option value="review-later">{row.disposition === 'reviewed-custom' ? 'Keep my already reviewed date edit' : row.disposition === 'preparation-preserved' ? 'Keep current preparation checks' : row.disposition === 'preparation-refresh' ? 'Refresh obsolete preparation checks with V9' : 'Keep stored; use V9 until reviewed'}</option><option value="replace">{row.recommendedName ? 'Replace date edit with V9 recommendation' : 'Remove obsolete extra-slot edit'}</option>{row.canKeep && <option value="keep">Keep my reviewed custom workout for this date</option>}
            </select></label>}
          </div>)}
        </section>}
        <p className="small-note">A complete safety copy is saved before applying. Past and active workout snapshots stay unchanged. Later date edits remain separate from the weekly program.</p>
        <button type="button" className="btn full" disabled={locked || (needsAcknowledgement && !acknowledged)} onClick={() => void apply()}>{busy ? 'Applying…' : 'Apply V9 to Future Workouts'}</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => setStage('offer')}>Back to overview</button>
      </>}
      {(notice || proposal.error || error) && <p role={proposal.error || error ? 'alert' : 'status'}>{error || proposal.error || notice}</p>}
      <button type="button" className="btn secondary full" disabled={busy} onClick={() => onOpenChange(false)}>Keep current program</button>
    </DialogContent>
  </Dialog>;
}
