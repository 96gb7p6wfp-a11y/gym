import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { DecimalWeightInput } from './DecimalWeightInput';
import { CompletionIntentGate, type CompletionIntent } from './set-completion';
import { formatPreviousSet } from './previous-performance';
import { TimedSetControls } from './TimedSetControls';
import type { TimedSetAction } from './timed-sets';
import type { FocusedExercise, FocusedSetLog } from './FocusedWorkout';
import { exerciseInputKind, hasRecordedLoad, measurementInputLabel } from './exercise-input';
import './quick-workout-log.css';

interface QuickWorkoutLogProps {
  sessionId: string;
  exercises: FocusedExercise[];
  previous: (exercise: FocusedExercise) => { exercise: { logs: FocusedSetLog[] } } | null;
  onSet: (exerciseKey: string, setId: string, patch: Partial<FocusedSetLog>) => void;
  onDone: (exerciseKey: string, setId: string, done: boolean, intent?: CompletionIntent) => boolean;
  onTimer: (exerciseKey: string, options?: TimedSetAction) => void;
  onSelect: (exerciseKey: string, setId: string) => void;
  onInvalidChange: (id: string, invalid: boolean) => void;
  onEquipment?: (exerciseKey: string) => void;
  onUndoLast?: () => boolean;
  canUndoLast?: boolean;
  athleteMode: boolean;
  now: number;
  editing: boolean;
}

const numberInput = (raw: string, maximum: number, integer = true) => {
  if (raw.trim() === '') return null;
  const parsed = Number(raw.replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  const value = Math.min(maximum, Math.max(0, parsed));
  return integer ? Math.trunc(value) : value;
};

function QuickSetRow({ sessionId, exercise, log, index, previous, onSet, onDone, onTimer, onSelect, onInvalidChange, now, editing, showLoad, onLoadInteraction, onLoadValidityChange }: Pick<QuickWorkoutLogProps, 'sessionId' | 'onSet' | 'onDone' | 'onTimer' | 'onSelect' | 'onInvalidChange' | 'now' | 'editing'> & {
  exercise: FocusedExercise; log: FocusedSetLog; index: number; previous?: FocusedSetLog;
  showLoad: boolean; onLoadInteraction: () => void; onLoadValidityChange: (id: string, invalid: boolean) => void;
}) {
  const target = { sessionId, exerciseKey: exercise.key, setId: log.id };
  const [gate] = useState(() => new CompletionIntentGate(target));
  const [, renderGate] = useState(0);
  const [invalidWeight, setInvalidWeight] = useState(false);
  const metric = formatPreviousSet(exercise, previous);
  const kind = exerciseInputKind(exercise);
  const timed = kind === 'duration';
  const optionalLoad = kind === 'bodyweight' || timed;
  const inMinutes = /\bmin(?:ute)?s?\b/i.test(exercise.target);
  const name = `${exercise.name} set ${index + 1}`;
  const ready = gate.isArmed(target);

  function arm() {
    gate.arm(target);
    renderGate(value => value + 1);
    onSelect(exercise.key, log.id);
  }

  function edit(patch: Partial<FocusedSetLog>) {
    arm();
    onSet(exercise.key, log.id, patch);
  }

  function complete() {
    if (log.done) return;
    if (invalidWeight) { toast.error('Enter a valid weight before completing this set.'); return; }
    const intent = gate.claim(target);
    if (!intent) return;
    renderGate(value => value + 1);
    onSelect(exercise.key, log.id);
    if (!onDone(exercise.key, log.id, true, intent)) arm();
  }

  const weightInput = <DecimalWeightInput value={log.kg} placeholder={optionalLoad ? '0' : 'kg'} label={`${name} weight in kilograms`}
    onValidityChange={valid => {
      if (!valid && optionalLoad) onLoadInteraction();
      setInvalidWeight(!valid); onInvalidChange(log.id, !valid); onLoadValidityChange(log.id, !valid);
    }}
    onChange={(kg, valid) => {
      // Latch before a cleared/invalid value removes the positive-load fallback.
      if (optionalLoad) onLoadInteraction();
      edit({ kg, ...(!valid ? { done: false } : {}) });
    }} />;
  const singleQuantity = kind === 'bodyweight' && !showLoad || timed && !showLoad;

  return <div className={`quick-set${timed ? ' quick-set--timed' : ''}${singleQuantity ? ' quick-set--single' : ''}${log.done ? ' is-complete' : ''}`} role="group" aria-label={`Quick log ${name}`}>
    <span className="quick-set__number" aria-label={`Set ${index + 1}`}>{index + 1}</span>
    <span className="quick-set__previous" aria-label={`Previous ${name}`}>{metric ?? '—'}</span>
    {timed ? <>
      {showLoad && weightInput}
      <input className="set-input quick-set__duration" type="number" min="0" max={inMinutes ? 1440 : 86400}
        step={inMinutes ? '0.1' : '1'} inputMode={inMinutes ? 'decimal' : 'numeric'}
        aria-label={`${name} ${inMinutes ? 'minutes' : 'seconds'}`} value={log.seconds == null ? '' : Number((log.seconds / (inMinutes ? 60 : 1)).toFixed(1))}
        placeholder={exercise.target.match(/\d+(?:[.,]\d+)?/)?.[0] ?? '—'}
        onChange={event => { const value = numberInput(event.target.value, inMinutes ? 1440 : 86400, !inMinutes); edit({ seconds: value == null ? null : Math.round(value * (inMinutes ? 60 : 1)) }); }} />
    </> : <>
      {kind === 'measurement' ? <input className="set-input" type="number" min="0" max="1000" step="0.1" inputMode="decimal"
        aria-label={`${name} ${measurementInputLabel(exercise).toLowerCase()} in centimetres`}
        value={log.measurementCm ?? ''} placeholder="cm" onChange={event => edit({ measurementCm: numberInput(event.target.value, 1000, false) })} />
        : (kind === 'weight' || showLoad) && weightInput}
      <input className="set-input" type="number" min="0" max="1000" step="1" inputMode="numeric"
        aria-label={`${name} ${exercise.quantityUnit === 'm' ? 'distance in metres' : 'reps'}`} value={log.reps ?? ''}
        placeholder={exercise.target.match(/\d+/)?.[0] ?? '—'} onChange={event => edit({ reps: numberInput(event.target.value, 1000) })} />
    </>}
    <button type="button" className="quick-set__complete" disabled={log.done || !ready}
      aria-label={`${log.done ? 'Completed' : 'Complete'} ${name}`} aria-pressed={log.done} onClick={complete}>
      {log.done && <Check size={19} aria-hidden="true" />}
    </button>
    {!log.done && !ready && <div className="quick-set__review"><button type="button" onClick={arm} aria-label={`Ready for ${name}`}>Review & ready</button></div>}
    {timed && !log.done && <details className="quick-set__timer"><summary>Set {index + 1} timer</summary>
      <TimedSetControls setId={log.id} exerciseKey={exercise.key} exerciseName={exercise.name} setNumber={index + 1}
        seconds={log.seconds} target={exercise.target} elapsedMs={exercise.elapsedMs} runningSince={exercise.runningSince}
        timerSetId={exercise.timerSetId ?? null} now={now} editing={editing} done={log.done} prefill={false}
        label={`${name} timer duration`} onInteraction={arm}
        onSecondsChange={seconds => onSet(exercise.key, log.id, { seconds })} onTimer={onTimer} />
    </details>}
  </div>;
}

function QuickExercise(props: QuickWorkoutLogProps & { exercise: FocusedExercise }) {
  const { sessionId, exercise, previous, onSet, onSelect, onEquipment, athleteMode } = props;
  const kind = exerciseInputKind(exercise);
  const timed = kind === 'duration';
  const optionalLoad = kind === 'bodyweight' || timed;
  const recordedLoad = hasRecordedLoad(exercise.logs);
  const [loadOpen, setLoadOpen] = useState(() => recordedLoad);
  const invalidLoads = useRef(new Set<string>());
  const showLoad = optionalLoad && (loadOpen || recordedLoad);
  const singleQuantity = optionalLoad && !showLoad;
  const prior = previous(exercise)?.exercise;
  const inMinutes = /\bmin(?:ute)?s?\b/i.test(exercise.target);
  const quantityLabel = timed ? inMinutes ? 'Minutes' : 'Seconds' : exercise.quantityUnit === 'm' ? 'Metres' : 'Reps';

  function toggleLoad() {
    if (loadOpen && invalidLoads.current.size) {
      toast.error('Correct the invalid added weight before hiding it.'); return;
    }
    setLoadOpen(value => !value);
  }

  return <section className="quick-exercise" aria-label={`Quick log ${exercise.name}`}>
    <header><h2>{exercise.name}</h2><p>{exercise.target}{exercise.perSide ? ' per side' : ''}</p>
      {exercise.equipmentLabel && <p className="quick-exercise__equipment">{exercise.equipmentLabel}</p>}
    </header>
    <div className={`quick-log-head${singleQuantity ? ' quick-log-head--single' : ''}`} aria-hidden="true">
      <span>Set</span><span>Previous</span>
      {kind === 'measurement' ? <span>{exercise.measurement === 'touch' ? 'Touch' : exercise.measurement === 'height' ? 'Height' : 'Distance'}<small>cm</small></span>
        : (kind === 'weight' || showLoad) && <span>{optionalLoad ? 'Added' : 'Weight'}<small>kg</small></span>}
      <span>{quantityLabel}</span><span>Done</span>
    </div>
    {exercise.logs.map((log, index) => <QuickSetRow key={`${sessionId}-${exercise.key}-${log.id}`} {...props}
      exercise={exercise} log={log} index={index} previous={prior?.logs[index]} showLoad={showLoad}
      onLoadInteraction={() => setLoadOpen(true)} onLoadValidityChange={(id, invalid) => { if (invalid) invalidLoads.current.add(id); else invalidLoads.current.delete(id); }} />)}
    <details className="quick-exercise__effort"><summary>Details <span>Optional</span></summary>
      {optionalLoad && !recordedLoad && <button type="button" className="text-button quick-exercise__load" aria-label={`${showLoad ? 'Hide' : 'Add'} load for ${exercise.name}`}
        aria-expanded={showLoad} onClick={toggleLoad}>{showLoad ? 'Hide added load' : 'Add load · kg'}</button>}
      {optionalLoad && <p>Added weight is optional. Existing recorded load stays visible; opening or hiding fields never changes it.</p>}
      {onEquipment && kind !== 'measurement' && <button type="button" className="text-button" onClick={() => onEquipment(exercise.key)} aria-label={`Equipment for ${exercise.name}`}>{exercise.equipmentLabel ? 'Edit equipment label' : 'Add equipment label'}</button>}
      <p>RIR: How many more reps you could complete. RPE: How hard the effort felt.</p>
      {exercise.logs.map((log, index) => <label key={log.id}>Set {index + 1} · RIR<input type="number" min="0" max="10" step="1" inputMode="numeric"
        aria-label={`${exercise.name} set ${index + 1} reps in reserve`} value={log.rir ?? ''}
        onChange={event => { onSelect(exercise.key, log.id); onSet(exercise.key, log.id, { rir: numberInput(event.target.value, 10) }); }} /></label>)}
      {!athleteMode && <p>Primer: A short preparation session before a demanding activity. Complex Pair: Two linked exercises performed in a prescribed sequence.</p>}
    </details>
  </section>;
}

/** Compact rows edit the exact same session records used by Focus. */
export function QuickWorkoutLog(props: QuickWorkoutLogProps) {
  const { sessionId, exercises, onUndoLast, canUndoLast } = props;
  return <section className="quick-workout" aria-label="Quick Log workout">
    <div className="quick-workout__intro"><p>All working sets. Tap a value to edit.</p>
      {onUndoLast && <button type="button" className="text-button" disabled={!canUndoLast} onClick={onUndoLast}>Undo last set</button>}
    </div>
    {exercises.map(exercise => <QuickExercise key={`${sessionId}-${exercise.key}`} {...props} exercise={exercise} />)}
  </section>;
}
