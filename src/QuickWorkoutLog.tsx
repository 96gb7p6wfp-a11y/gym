import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { DecimalWeightInput } from './DecimalWeightInput';
import { CompletionIntentGate, type CompletionIntent } from './set-completion';
import { formatPreviousSet } from './previous-performance';
import { TimedSetControls } from './TimedSetControls';
import type { TimedSetAction } from './timed-sets';
import type { FocusedExercise, FocusedSetLog } from './FocusedWorkout';
import { lastSetSuggestion } from './set-autofill';
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

function QuickSetRow({ sessionId, exercise, log, index, previous, onSet, onDone, onTimer, onSelect, onInvalidChange, now, editing }: Pick<QuickWorkoutLogProps, 'sessionId' | 'onSet' | 'onDone' | 'onTimer' | 'onSelect' | 'onInvalidChange' | 'now' | 'editing'> & {
  exercise: FocusedExercise; log: FocusedSetLog; index: number; previous?: FocusedSetLog;
}) {
  const target = { sessionId, exerciseKey: exercise.key, setId: log.id };
  const [gate] = useState(() => new CompletionIntentGate(target));
  const [, renderGate] = useState(0);
  const [invalidWeight, setInvalidWeight] = useState(false);
  const metric = formatPreviousSet(exercise, previous);
  const timed = exercise.mode === 'timed';
  const inMinutes = /\bmin(?:ute)?s?\b/i.test(exercise.target);
  const name = `${exercise.name} set ${index + 1}`;
  const ready = gate.isArmed(target);
  const lastSet = !editing && !log.done ? lastSetSuggestion(exercise, log.id) : null;
  const canCopy = lastSet && (log.kg !== lastSet.kg || log.reps !== lastSet.reps);

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

  return <div className={`quick-set${timed ? ' quick-set--timed' : ''}${log.done ? ' is-complete' : ''}`} role="group" aria-label={`Quick log ${name}`}>
    <span className="quick-set__number" aria-label={`Set ${index + 1}`}>{index + 1}</span>
    <span className="quick-set__previous" aria-label={`Previous ${name}`}>{metric ?? '—'}</span>
    {timed ? <input className="set-input quick-set__duration" type="number" min="0" max={inMinutes ? 1440 : 86400}
      step={inMinutes ? '0.1' : '1'} inputMode={inMinutes ? 'decimal' : 'numeric'}
      aria-label={`${name} ${inMinutes ? 'minutes' : 'seconds'}`} value={log.seconds == null ? '' : Number((log.seconds / (inMinutes ? 60 : 1)).toFixed(1))}
      placeholder={exercise.target.match(/\d+(?:[.,]\d+)?/)?.[0] ?? '0'}
      onChange={event => { const value = numberInput(event.target.value, inMinutes ? 1440 : 86400, !inMinutes); edit({ seconds: value == null ? null : Math.round(value * (inMinutes ? 60 : 1)) }); }} />
      : <>
        {exercise.measurement ? <input className="set-input" type="number" min="0" max="1000" step="0.1" inputMode="decimal"
          aria-label={`${name} ${exercise.measurement === 'touch' ? 'maximum touch' : exercise.measurement === 'height' ? 'jump height' : 'distance'} in centimetres`}
          value={log.measurementCm ?? ''} placeholder="cm" onChange={event => edit({ measurementCm: numberInput(event.target.value, 1000, false) })} />
          : <DecimalWeightInput value={log.kg} placeholder={exercise.mode === 'bodyweight' ? 'BW' : 'kg'} label={`${name} weight in kilograms`}
            onValidityChange={valid => { setInvalidWeight(!valid); onInvalidChange(log.id, !valid); }}
            onChange={(kg, valid) => edit({ kg, ...(!valid ? { done: false } : {}) })} />}
        <input className="set-input" type="number" min="0" max="1000" step="1" inputMode="numeric"
          aria-label={`${name} ${exercise.quantityUnit === 'm' ? 'distance in metres' : 'reps'}`} value={log.reps ?? ''}
          placeholder={exercise.target.match(/\d+/)?.[0] ?? '0'} onChange={event => edit({ reps: numberInput(event.target.value, 1000) })} />
      </>}
    <button type="button" className="quick-set__complete" disabled={log.done || !ready}
      aria-label={`${log.done ? 'Completed' : 'Complete'} ${name}`} aria-pressed={log.done} onClick={complete}>
      {log.done ? <Check size={19} aria-hidden="true" /> : <span aria-hidden="true">✓</span>}
    </button>
    {canCopy && lastSet && <div className="quick-set__review"><button type="button" onClick={() => edit(lastSet)}
      aria-label={`Copy previous completed set to ${name}`}>
      Copy set {index} · {lastSet.kg == null ? 'bodyweight' : `${lastSet.kg} kg`} × {lastSet.reps}
    </button></div>}
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

/** Compact rows edit the exact same session records used by Focus. */
export function QuickWorkoutLog(props: QuickWorkoutLogProps) {
  const { sessionId, exercises, previous, onSet, onSelect, onEquipment, onUndoLast, canUndoLast, athleteMode } = props;
  return <section className="quick-workout" aria-label="Quick Log workout">
    <div className="quick-workout__intro"><p>All working sets. Tap a value to edit it.</p>
      {onUndoLast && <button type="button" className="text-button" disabled={!canUndoLast} onClick={onUndoLast}>Undo last set</button>}
    </div>
    {exercises.map(exercise => {
      const prior = previous(exercise)?.exercise;
      const timed = exercise.mode === 'timed';
      return <section key={exercise.key} className="quick-exercise" aria-label={`Quick log ${exercise.name}`}>
        <header><h2>{exercise.name}</h2><p>{exercise.target}{exercise.perSide ? ' per side' : ''}</p>
          {onEquipment && !timed && !exercise.measurement && <button type="button" className="text-button" onClick={() => onEquipment(exercise.key)} aria-label={`Equipment for ${exercise.name}`}>{exercise.equipmentLabel ?? 'Add equipment label'}</button>}
          {!onEquipment && exercise.equipmentLabel && <p>{exercise.equipmentLabel}</p>}
        </header>
        <div className={`quick-log-head${timed ? ' quick-log-head--timed' : ''}`} aria-hidden="true"><span>Set</span><span>Previous</span>
          {timed ? <span>Time · {/\bmin(?:ute)?s?\b/i.test(exercise.target) ? 'min' : 'sec'}</span> : <><span>{exercise.measurement ? 'cm' : 'kg'}</span><span>{exercise.quantityUnit === 'm' ? 'm' : 'Reps'}</span></>}
          <span>Done</span>
        </div>
        {exercise.logs.map((log, index) => <QuickSetRow key={`${sessionId}-${exercise.key}-${log.id}`} {...props}
          exercise={exercise} log={log} index={index} previous={prior?.logs[index]} />)}
        <details className="quick-exercise__effort"><summary>{athleteMode ? 'Effort' : 'Effort & advanced'} <span>Optional</span></summary>
          <p>RIR: How many more reps you could complete. RPE: How hard the effort felt.</p>
          {exercise.logs.map((log, index) => <label key={log.id}>Set {index + 1} · RIR<input type="number" min="0" max="10" step="1" inputMode="numeric"
            aria-label={`${exercise.name} set ${index + 1} reps in reserve`} value={log.rir ?? ''}
            onChange={event => { onSelect(exercise.key, log.id); onSet(exercise.key, log.id, { rir: numberInput(event.target.value, 10) }); }} /></label>)}
          {!athleteMode && <p>Primer: A short preparation session before a demanding activity. Complex Pair: Two linked exercises performed in a prescribed sequence.</p>}
        </details>
      </section>;
    })}
  </section>;
}
