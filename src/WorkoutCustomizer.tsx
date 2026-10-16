import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowRight, ChevronRight, Dumbbell, Ellipsis, Plus, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { ExerciseLibrarySheet } from './ExerciseLibrarySheet';
import { findLibraryExercise, toPlanExercise, type LibraryExercise } from './exercise-library';
import { addSessionExercise, adjustSessionSets, moveSessionExercise, removeSessionExercise, replaceSessionExercise, type EditableSession } from './workout-customization';
import type { ReadinessEntry } from './performance-data';
import './workout-customizer.css';

interface Props {
  session: EditableSession;
  selectedKey: string | null;
  onSelectedKeyChange: (key: string | null) => void;
  onChange: (session: EditableSession) => Promise<void> | void;
  onSaveAs: () => void;
  readiness?: ReadinessEntry;
  onReadiness: (entry: ReadinessEntry) => Promise<void>;
  disabled?: boolean;
}
type LibraryAction = { kind: 'add' | 'replace' | 'alternative'; key?: string };

/** Session tools change a snapshot; saving a template is always explicit. */
export function WorkoutCustomizer({ session, selectedKey, onSelectedKeyChange, onChange, onSaveAs, readiness, onReadiness, disabled = false }: Props) {
  const [library, setLibrary] = useState<LibraryAction | null>(null);
  const [view, setView] = useState<'menu' | 'move' | 'effort' | 'remove'>('menu');
  const [sessionOpen, setSessionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const selecting = useRef(false);
  const [error, setError] = useState('');
  const [energy, setEnergy] = useState<ReadinessEntry['energy'] | null>(null);
  const [soreness, setSoreness] = useState<ReadinessEntry['soreness'] | null>(null);
  const locked = busy || disabled;
  const exercise = session.exercises.find(row => row.key === selectedKey);
  const done = exercise?.logs.filter(log => log.done).length ?? 0;
  const remaining = exercise?.logs.filter(log => !log.done).length ?? 0;

  function close() { onSelectedKeyChange(null); setView('menu'); setError(''); }
  async function change(next: EditableSession) {
    if (writing.current || disabled) return;
    writing.current = true; setBusy(true); setError('');
    try { await onChange(next); close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Your workout could not save.'); }
    finally { writing.current = false; setBusy(false); }
  }
  function apply(transform: () => EditableSession) {
    if (writing.current || disabled) return;
    try { void change(transform()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Check your workout.'); }
  }
  function choose(item: LibraryExercise) {
    if (!library) return;
    selecting.current = true;
    if (writing.current || disabled) { setError('Wait for your current changes to save.'); return; }
    const planned = toPlanExercise(item);
    apply(() => library.kind === 'replace' && library.key
      ? replaceSessionExercise(session, library.key, planned)
      : addSessionExercise(session, planned, library.key));
    setLibrary(null);
  }
  function loadChange(factor: number) {
    if (!exercise) return;
    const item = findLibraryExercise(exercise);
    if (factor > 1 && ['Power', 'Plyometric', 'Speed'].includes(item?.category ?? '')) {
      setError('Keep explosive work fast. Progress quality before load.'); return;
    }
    const hasLoad = exercise.logs.some(log => !log.done && log.kg != null && log.kg > 0);
    if (!hasLoad) { setError('Enter a working weight first.'); return; }
    apply(() => ({ ...session, exercises: session.exercises.map(row => row.key !== exercise.key ? row : {
      ...row, logs: row.logs.map(log => log.done || log.kg == null ? log : { ...log, kg: Math.round(log.kg * factor * 10) / 10 }),
    }) }));
  }
  async function checkIn() {
    if (!energy || !soreness || writing.current || disabled) return;
    writing.current = true; setBusy(true); setError('');
    try {
      await onReadiness({ id: readiness?.id ?? crypto.randomUUID(), date: session.date, energy, soreness });
      setSessionOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your check-in could not save.'); }
    finally { writing.current = false; setBusy(false); }
  }

  return <div className="workout-customizer">
    <div className="workout-customizer__launchers">
      <button type="button" className="text-button" disabled={disabled || busy || session.exercises.length >= 40} onClick={() => { setError(''); setLibrary({ kind: 'add' }); }}><Plus size={18} /> Add exercise</button>
      <button type="button" className="text-button" disabled={disabled || busy} onClick={() => { setError(''); setEnergy(readiness?.energy ?? null); setSoreness(readiness?.soreness ?? null); setSessionOpen(true); }}><Ellipsis size={20} /> Workout options</button>
    </div>
    {error && !exercise && !sessionOpen && <p className="builder-error" role="alert">{error}</p>}
    <Dialog open={!!exercise && !library} onOpenChange={(open: boolean) => { if (!open && !busy) close(); }}>
      <DialogContent className="app-dialog exercise-actions-sheet">
        <DialogHeader className=""><DialogTitle className="">{view === 'move' ? 'Move exercise' : view === 'effort' ? 'Adjust effort' : view === 'remove' ? 'Remove exercise?' : exercise?.name ?? 'Exercise'}</DialogTitle>
          <DialogDescription className="">{done > 0 ? 'Logged sets stay in your history.' : 'Change this workout. Your weekly plan stays as saved.'}</DialogDescription></DialogHeader>
        {exercise && view === 'menu' && <div className="exercise-action-list">
          <button type="button" disabled={!remaining || locked} onClick={() => setLibrary({ kind: 'replace', key: exercise.key })}><RefreshCw size={18} /><span>{done ? 'Replace remaining sets' : 'Replace exercise'}</span><ChevronRight size={17} /></button>
          <button type="button" disabled={locked} onClick={() => setLibrary({ kind: remaining ? 'replace' : 'alternative', key: exercise.key })}><Dumbbell size={18} /><span>View alternatives</span><ChevronRight size={17} /></button>
          <button type="button" disabled={locked} onClick={() => setView('move')}><ArrowDown size={18} /><span>Move exercise</span><ChevronRight size={17} /></button>
          <button type="button" disabled={locked || session.exercises.length >= 40} onClick={() => setLibrary({ kind: 'add', key: exercise.key })}><Plus size={18} /><span>Add exercise after</span><ChevronRight size={17} /></button>
          <button type="button" disabled={locked || !remaining} onClick={() => setView('effort')}><SlidersHorizontal size={18} /><span>Adjust effort</span><ChevronRight size={17} /></button>
          <button type="button" disabled={locked || !remaining} className="destructive-text" onClick={() => setView('remove')}><Trash2 size={18} /><span>{done ? 'Remove remaining sets' : 'Remove exercise'}</span></button>
        </div>}
        {exercise && view === 'move' && <div className="exercise-action-list">{session.exercises.map((row, index) => <button type="button" key={row.key} disabled={row.key === exercise.key || busy} aria-label={`Move ${exercise.name} to position ${index + 1}`} onClick={() => apply(() => moveSessionExercise(session, exercise.key, index))}><span className="muted">{index + 1}</span><span>{row.name}</span><ArrowRight size={17} /></button>)}</div>}
        {exercise && view === 'effort' && <div className="exercise-action-list">
          <p className="small-note">Adjust remaining work. Keep enough energy for volleyball.</p>
          <button type="button" disabled={locked} onClick={() => loadChange(.95)}><ArrowDown size={18} /><span>Reduce load by 5%</span></button>
          <button type="button" disabled={locked || exercise.logs.length <= Math.max(1, done)} onClick={() => apply(() => adjustSessionSets(session, exercise.key, exercise.logs.length - 1))}><ArrowDown size={18} /><span>One fewer set</span></button>
          <button type="button" disabled={locked} onClick={() => loadChange(1.025)}><ArrowUp size={18} /><span>Increase load by 2.5%</span></button>
          <button type="button" disabled={locked || exercise.logs.length >= 20} onClick={() => apply(() => adjustSessionSets(session, exercise.key, exercise.logs.length + 1))}><Plus size={18} /><span>Add one set</span></button>
        </div>}
        {exercise && view === 'remove' && <><p className="small-note">{done ? `${done} completed sets will stay. Only unfinished sets are removed.` : 'Remove this movement from the current workout.'}</p><button type="button" className="btn full" disabled={locked} onClick={() => apply(() => removeSessionExercise(session, exercise.key))}>{busy ? 'Saving…' : done ? 'Remove remaining sets' : 'Remove exercise'}</button><button type="button" className="text-button" onClick={() => setView('menu')}>Keep exercise</button></>}
        {error && <p className="builder-error" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
    <ExerciseLibrarySheet open={!!library} onOpenChange={open => {
      if (!open) {
        setLibrary(null);
        // Selecting auto-closes the library. Keep the original action sheet and
        // any save/validation error until the mutation actually succeeds.
        if (!selecting.current) close();
        selecting.current = false;
      }
    }} onSelect={choose} title={library?.kind === 'alternative' ? 'Add an alternative' : undefined}
      replacementFor={library?.kind === 'replace' || library?.kind === 'alternative' ? session.exercises.find(row => row.key === library.key) : undefined} />
    <Dialog open={sessionOpen} onOpenChange={(open: boolean) => { if (!busy) setSessionOpen(open); }}>
      <DialogContent className="app-dialog workout-options-sheet"><DialogHeader className=""><DialogTitle className="">Your session</DialogTitle><DialogDescription className="">Adjust to how you feel. Consistency beats extra fatigue.</DialogDescription></DialogHeader>
        <div className="readiness-check"><h3>How do you feel?</h3><div>{(['low', 'normal', 'high'] as const).map(value => <button type="button" key={value} aria-pressed={energy === value} disabled={locked} onClick={() => setEnergy(value)}>{value === 'low' ? 'Low energy' : value === 'high' ? 'Feeling strong' : 'Ready'}</button>)}</div>
          <h3 className="readiness-soreness-label">Leg soreness</h3><div>{(['low', 'moderate', 'high'] as const).map(value => <button type="button" key={value} aria-label={`${value} leg soreness`} aria-pressed={soreness === value} disabled={locked} onClick={() => setSoreness(value)}>{value === 'low' ? 'Low' : value === 'moderate' ? 'Moderate' : 'High'}</button>)}</div>
          <button type="button" className="btn full readiness-save" disabled={locked || !energy || !soreness} onClick={() => void checkIn()}>Save check-in</button>
        </div>
        <button type="button" className="menu-row" disabled={locked} onClick={() => { setSessionOpen(false); onSaveAs(); }}><span>Save as custom workout</span><ChevronRight size={18} /></button>
        {error && <p className="builder-error" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  </div>;
}
