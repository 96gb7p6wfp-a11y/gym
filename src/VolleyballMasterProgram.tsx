import { useEffect, useState, type MouseEvent } from 'react';
import { MasterProgramSettingsSchema, getMasterProgramPhase, getMasterProgramWeek, type MasterProgramSettings, type MasterReadiness } from './volleyball-master-plan';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './components/ui';
import './volleyball-master-program.css';

export function VolleyballMasterProgram({ settings, defaultStartDate, selectedDate, onSave, disabled = false }: {
  settings?: MasterProgramSettings; defaultStartDate: string; selectedDate: string;
  onSave: (settings: MasterProgramSettings | undefined) => Promise<boolean>; disabled?: boolean;
}) {
  const [draft, setDraft] = useState<MasterProgramSettings>(settings ?? { version: 1, startDate: defaultStartDate, matchWeeks: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [restore, setRestore] = useState(false);
  useEffect(() => { setDraft(settings ?? { version: 1, startDate: defaultStartDate, matchWeeks: [] }); }, [settings, defaultStartDate]);
  const week = settings && getMasterProgramWeek(settings.startDate, selectedDate);
  async function save(next: MasterProgramSettings | undefined) {
    const parsed = next && MasterProgramSettingsSchema.safeParse(next);
    if (parsed && !parsed.success) { setError('Choose a valid Monday and match weeks.'); return; }
    setBusy(true); setError('');
    try { if (await onSave(parsed ? parsed.data : undefined)) setRestore(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the program.'); }
    finally { setBusy(false); }
  }
  const locked = disabled || busy;
  return <section className="master-program" aria-label="8-week volleyball-first program">
    <div className="master-program__heading"><div><p className="eyebrow">8-WEEK MASTER PLAN</p><h2>Volleyball first</h2></div><span>{week ? `Week ${week} · ${getMasterProgramPhase(week)}` : settings ? selectedDate < settings.startDate ? `Starts ${settings.startDate}` : 'Block complete' : 'Ready when you are'}</span></div>
    <p className="master-program__purpose">Jump higher. Hit harder. Stay fresh for volleyball.</p>
    <details className="master-program__config" open={!settings}>
      <summary>{settings ? 'Schedule & options' : 'Set up your block'}</summary>
      <label className="field-label">Start Monday<input type="date" value={draft.startDate} onChange={event => setDraft({ ...draft, startDate: event.target.value })} /></label>
      <fieldset className="master-program__matches"><legend>Sunday match weeks</legend><p>No match selected means Hard Lower B on Saturday and recovery Sunday.</p>
        <div>{Array.from({ length: 8 }, (_, index) => index + 1).map(value => <label key={value}><input type="checkbox" checked={draft.matchWeeks.includes(value)} onChange={event => setDraft({ ...draft, matchWeeks: event.target.checked ? [...draft.matchWeeks, value].sort((a, b) => a - b) : draft.matchWeeks.filter(item => item !== value) })} /><span>Week {value}</span></label>)}</div>
      </fieldset>
      <details><summary>Optional work</summary><div className="master-program__optional">
        {([['mondayArms', 'Monday · 2 curl + 2 pushdown sets'], ['thursdayArms', 'Thursday · 2 hammer curl + 2 pushdown sets'], ['tuesdayPogos', 'Tuesday · 1–2 light pogo sets']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={draft.optional?.[key] ?? false} onChange={event => setDraft({ ...draft, optional: { mondayArms: false, thursdayArms: false, tuesdayPogos: false, ...draft.optional, [key]: event.target.checked } })} />{label}</label>)}
        <p>Only if time and recovery allow. Skip pogos with calf or Achilles tightness.</p></div></details>
      <button className="btn full" type="button" disabled={locked} onClick={() => void save(draft)}>{busy ? 'Saving…' : settings ? 'Save program' : 'Use this plan'}</button>
      {!settings && <p className="small-note">Your current weekly plan is kept so you can return to it. History stays unchanged. No Sunday match is assumed.</p>}
    </details>
    <details className="master-program__rules"><summary>Training rules & retest</summary>
      <h3>Approach project</h3><p>FAST → LONG PENULTIMATE → QUICK PLANT → ARMS → UP.</p><p>Tuesday technique, Wednesday maximal approach, Friday volleyball. Saturday adds quality jumps only without a Sunday match.</p>
      <p>Your approximate reference: reach 235 cm, standing touch ~310 cm, approach touch 315–317 cm. That suggests ~75 cm standing and ~80–82 cm approach height: a 5–7 cm approach advantage. These estimates are not inserted as test records.</p>
      <h3>Build · deload · retest</h3><p>Weeks 1–3: build clean strength and approach technique. Week 4: reduce strength sets about 40–50%. Weeks 5–7: build again. Week 8: lower strength volume, fewer jumps, high-quality intent.</p>
      <h3>Progress without grinding</h3><p>Hack Squat 70 kg at 6/5/5: repeat 70. Clean 6/6/6 with ~2 reps left: consider a small increase. The app uses two comparable sessions for conservative suggestions. Weeks alone never trigger more weight.</p><p>Compounds usually RIR 1–3. Isolation work may occasionally reach RIR 0–1 on the last set. Explosive work stops before speed falls. Drop-jump boxes never increase automatically.</p>
      <h3>Saturday readiness</h3><p>Green: normal sleep, legs and jumps, no pain. Yellow: heavy legs, poor sleep, calf tightness or ~3–5% lower jump—reduce jumping 30–50%, omit hurdles; no grinding. Red: sharp or worsening pain, painful movement, poor landings or a clear drop over 5%—no maximal jumps.</p><p>Increasing joint, nerve-like, Achilles or low-back pain is a stop signal. Do not force the session; seek assessment for persistent or worsening symptoms.</p>
      <h3>Week 8 retest</h3><p>Body weight · standing reach · standing vertical/CMJ · approach touch · Hack Squat · pull-ups. Use the same shoes, location, warm-up and approach. Record weight and jumps in Progress; record lift/reps in Train. Keep reach and test conditions in workout notes.</p>
      <h3>Muscle gain that helps volleyball</h3><p>Watch weekly average weight alongside pull-ups, strength and approach jump. Gain gradually while keeping jump and speed stable or improving. Review persistent jump loss rather than chasing scale weight.</p>
      <h3>Supporting work</h3><p>Back → shoulders → abs → upper chest → arms. Core covers bracing, anti-rotation, lateral control and controlled flexion. Foot work stays small and consistent: mobility, arch control, soleus, calves, tibialis and crisp contacts.</p>
    </details>
    {settings && <button className="text-button" type="button" disabled={locked} onClick={() => setRestore(true)}>Return to saved plan</button>}
    {error && <p role="alert" className="builder-error">{error}</p>}
    <AlertDialog open={restore} onOpenChange={setRestore}><AlertDialogContent className="app-dialog"><AlertDialogHeader className=""><AlertDialogTitle className="">Return to your saved plan?</AlertDialogTitle><AlertDialogDescription className="">The plan from before this block returns. History, meals, measurements and active workouts stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className=""><AlertDialogCancel className="">Keep program</AlertDialogCancel><AlertDialogAction className="" disabled={locked} onClick={(event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); void save(undefined); }}>Restore saved plan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

export function MasterProgramReadiness({ settings, date, disabled, onSave }: {
  settings: MasterProgramSettings; date: string; disabled?: boolean;
  onSave: (settings: MasterProgramSettings) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => new Date(`${date}T12:00:00Z`).getUTCDay() === 6 && !settings.readiness?.some(row => row.date === date));
  useEffect(() => { setExpanded(new Date(`${date}T12:00:00Z`).getUTCDay() === 6 && !settings.readiness?.some(row => row.date === date)); }, [date]);
  const week = getMasterProgramWeek(settings.startDate, date);
  if (!week) return null;
  const status = settings.readiness?.find(row => row.date === date)?.status;
  async function select(value: MasterReadiness) {
    setBusy(true); setError('');
    try { await onSave({ ...settings, readiness: [...(settings.readiness ?? []).filter(row => row.date !== date), { date, status: value }] }); }
    catch { setError('Could not save readiness. Try again.'); }
    finally { setBusy(false); }
  }
  return <details className="master-readiness" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>Readiness{status ? ` · ${status[0].toUpperCase()}${status.slice(1)}` : ' · check during warm-up'}</summary>
    <p>Friday PE and volleyball count. Check your legs, sleep, pain and jump quality before Saturday work.</p>
    <div role="group" aria-label="Program readiness">{(['green', 'yellow', 'red'] as const).map(value => <button className="btn secondary" type="button" key={value} disabled={disabled || busy} aria-pressed={status === value} onClick={() => void select(value)}>{value[0].toUpperCase()}{value.slice(1)}</button>)}</div>
    <p>{status === 'red' ? 'No maximal jumping. Painful or worsening movement: stop and choose recovery.' : status === 'yellow' ? 'Jump sets reduced ~30–50%; hurdles removed. Strength stays controlled.' : status === 'green' ? 'Full prescribed session. Quality still comes first.' : 'Green: normal, pain-free. Yellow: heavy/tight, poor sleep or ~3–5% jump drop. Red: sharp/worsening pain, poor landings or >5% drop.'}</p>
    {error && <p role="alert">{error}</p>}
  </details>;
}
