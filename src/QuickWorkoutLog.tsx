import { Fragment, useRef, useState } from 'react';
import { Check, Minus, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { DecimalWeightInput } from './DecimalWeightInput';
import { CompletionIntentGate, type CompletionIntent } from './set-completion';
import { formatPreviousSet } from './previous-performance';
import { TimedSetControls } from './TimedSetControls';
import type { TimedSetAction } from './timed-sets';
import type { FocusedExercise, FocusedSetLog } from './FocusedWorkout';
import { exerciseInputKind, hasRecordedLoad, measuredSprintSeconds, measurementInputLabel } from './exercise-input';
import { lastSetSuggestion } from './set-autofill';
import { findTrainingPair } from './training-flow';
import { ReactionCue } from './ReactionCue';
import { LoadStepControl } from './LoadStepControl';
import { adjustedWorkoutLoad, exerciseLoadIncrement, plannedRepetitions } from './workout-input-steps';
import { ProgressionCue } from './ProgressionCue';
import { getProgressionRecommendation, type ProgressionContext } from './performance-insights';
import type { ReportSession } from './weekly-report';
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
  onLoadIncrementChange?: (exerciseKey: string, increment: number) => unknown;
  sessions?: readonly ReportSession[];
  date?: string;
  context?: ProgressionContext;
}

const numberInput = (raw: string, maximum: number, integer = true) => {
  if (raw.trim() === '') return null;
  const parsed = Number(raw.replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  const value = Math.min(maximum, Math.max(0, parsed));
  return integer ? Math.trunc(value) : value;
};

function QuickSetRow({ sessionId, exercise, log, index, previous, onSet, onDone, onTimer, onSelect, onInvalidChange, now, editing, showLoad, onLoadInteraction, onLoadValidityChange, adjusting, onAdjust, onAdjustmentFinished }: Pick<QuickWorkoutLogProps, 'sessionId' | 'onSet' | 'onDone' | 'onTimer' | 'onSelect' | 'onInvalidChange' | 'now' | 'editing'> & {
  exercise: FocusedExercise; log: FocusedSetLog; index: number; previous?: FocusedSetLog;
  showLoad: boolean; onLoadInteraction: () => void; onLoadValidityChange: (id: string, invalid: boolean) => void;
  adjusting: boolean; onAdjust: () => void; onAdjustmentFinished: () => void;
}) {
  const target = { sessionId, exerciseKey: exercise.key, setId: log.id };
  const [gate] = useState(() => new CompletionIntentGate(target));
  const [, renderGate] = useState(0);
  const [invalidWeight, setInvalidWeight] = useState(false);
  const [reuseRevision, setReuseRevision] = useState(0);
  const metric = formatPreviousSet(exercise, previous);
  const kind = exerciseInputKind(exercise);
  const timed = kind === 'duration';
  const optionalLoad = kind === 'bodyweight' || timed || (kind === 'distance' && showLoad);
  const inMinutes = /\bmin(?:ute)?s?\b/i.test(exercise.target);
  const name = `${exercise.name} set ${index + 1}`;
  const ready = gate.isArmed(target);
  const lastSet = !editing && !log.done ? lastSetSuggestion(exercise, log.id) : null;
  const canCopyLast = lastSet && (lastSet.patch.kg !== log.kg || lastSet.patch.reps !== log.reps);
  const hasLastSetSuggestion = !log.done && Object.values(log.inputSources ?? {}).includes('last-set');
  const weightStep = exerciseLoadIncrement(exercise);
  const reusePrevious = !editing && !log.done && previous?.done && (kind === 'weight' || kind === 'bodyweight')
    && previous.reps != null && previous.reps > 0 && (kind === 'bodyweight' || previous.kg != null)
    && (previous.kg !== log.kg || previous.reps !== log.reps);

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
    else onAdjustmentFinished();
  }

  function stepWeight(direction: -1 | 1) {
    if (invalidWeight) { toast.error('Correct the weight before using the adjustment buttons.'); return; }
    edit({ kg: adjustedWorkoutLoad(log.kg, direction, weightStep) });
  }

  const weightInput = <DecimalWeightInput key={reuseRevision} value={log.kg} placeholder={optionalLoad ? '0' : 'kg'} label={`${name} weight in kilograms`}
    onValidityChange={valid => {
      if (!valid && optionalLoad) onLoadInteraction();
      setInvalidWeight(!valid); onInvalidChange(log.id, !valid); onLoadValidityChange(log.id, !valid);
    }}
    onChange={(kg, valid) => {
      // Latch before a cleared/invalid value removes the positive-load fallback.
      if (optionalLoad) onLoadInteraction();
      edit({ kg, ...(!valid ? { done: false } : {}) });
    }} />;
  const singleQuantity = (kind === 'bodyweight' || kind === 'distance' || timed) && !showLoad;

  return <div className={`quick-set${timed ? ' quick-set--timed' : ''}${singleQuantity ? ' quick-set--single' : ''}${log.done ? ' is-complete' : ''}`} role="group" aria-label={`Quick log ${name}`}
    // Button focus happens before pointerup. Changing row height there can move
    // Copy/Complete away from the finger and cancel the click. Keep the toolbar
    // stable until an explicit input/edit action or a finished button action.
    onFocusCapture={event => { if (!log.done && event.target instanceof HTMLInputElement) onAdjust(); }}>
    <span className="quick-set__number" aria-label={`Set ${index + 1}`}>{index + 1}</span>
    {log.done ? <span className="quick-set__previous" aria-label={`Previous ${name}`}>{metric ?? '—'}</span>
      : <button type="button" className="quick-set__previous quick-set__adjust-target" aria-label={`Previous ${name}`}
        title="Adjust this set" onClick={onAdjust}>{metric ?? '—'}</button>}
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
    {adjusting && !log.done && (kind === 'weight' || kind === 'bodyweight') && <div className="quick-set__adjustments" role="group" aria-label={`Adjust ${name}`}>
      {(kind === 'weight' || showLoad) && <div><button type="button" aria-label={`Decrease ${name} weight by ${weightStep} kg`} onClick={() => stepWeight(-1)}><Minus size={17} aria-hidden="true" /></button><small>{weightStep} kg</small><button type="button" aria-label={`Increase ${name} weight by ${weightStep} kg`} onClick={() => stepWeight(1)}><Plus size={17} aria-hidden="true" /></button></div>}
      <div><button type="button" aria-label={`Decrease ${name} reps`} onClick={() => edit({ reps: Math.max(1, (log.reps ?? plannedRepetitions(exercise.target) ?? 1) - 1) })}><Minus size={17} aria-hidden="true" /></button><small>Reps</small><button type="button" aria-label={`Increase ${name} reps`} onClick={() => edit({ reps: Math.min(1000, (log.reps ?? plannedRepetitions(exercise.target) ?? 0) + 1) })}><Plus size={17} aria-hidden="true" /></button></div>
    </div>}
    {reusePrevious && previous && <div className="quick-set__review"><button type="button" aria-label={`Reuse previous ${name} weights and reps`}
      onClick={() => {
        setReuseRevision(value => value + 1); setInvalidWeight(false);
        onInvalidChange(log.id, false); onLoadValidityChange(log.id, false);
        if (optionalLoad && (previous.kg ?? 0) > 0) onLoadInteraction();
        edit({ kg: previous.kg, reps: previous.reps });
        onAdjustmentFinished();
      }}><RotateCcw size={14} aria-hidden="true" />Use previous</button></div>}
    {hasLastSetSuggestion && <p className="quick-set__suggestion" aria-label={`${name} suggestion`}>Last-set suggestion · editable</p>}
    {canCopyLast && lastSet && <div className="quick-set__review"><button type="button"
      aria-label={`Copy last completed ${exercise.name} set ${lastSet.sourceSetNumber} to set ${index + 1}`}
      onClick={() => {
        setReuseRevision(value => value + 1);
        setInvalidWeight(false);
        onInvalidChange(log.id, false);
        onLoadValidityChange(log.id, false);
        if (optionalLoad && lastSet.patch.kg != null && lastSet.patch.kg > 0) onLoadInteraction();
        edit(lastSet.patch);
        onAdjustmentFinished();
      }}>Use set {lastSet.sourceSetNumber} · {lastSet.patch.kg == null ? 'bodyweight' : `${lastSet.patch.kg} kg`} × {lastSet.patch.reps}</button></div>}
    {!log.done && !ready && <div className="quick-set__review"><button type="button" onClick={arm} aria-label={`Ready for ${name}`}>Review & ready</button></div>}
    {timed && !log.done && <details className="quick-set__timer"><summary>Set {index + 1} timer</summary>
      <TimedSetControls setId={log.id} exerciseKey={exercise.key} exerciseName={exercise.name} setNumber={index + 1}
        seconds={log.seconds} target={exercise.target} elapsedMs={exercise.elapsedMs} runningSince={exercise.runningSince}
        timerSetId={exercise.timerSetId ?? null} now={now} editing={editing} done={log.done} prefill={false}
        label={`${name} timer duration`} onInteraction={arm}
        onSecondsChange={seconds => onSet(exercise.key, log.id, { seconds })} onTimer={onTimer} />
    </details>}
    {kind === 'distance' && exercise.prescribedDistanceM != null && <details className="quick-set__timer"><summary>Set {index + 1} measured time · optional</summary>
      <label className="field-label">Measured sprint seconds<input className="set-input" type="number" min="0" max="86400" step="0.01" inputMode="decimal"
        aria-label={`${name} measured sprint seconds`} value={log.seconds ?? ''} placeholder="Not measured"
        onChange={event => edit({ seconds: measuredSprintSeconds(event.target.value) })} /></label>
      <p className="small-note">Only enter a measured time. Sprint tests keep timing methods separate for comparisons.</p>
    </details>}
  </div>;
}

function QuickExercise(props: QuickWorkoutLogProps & { exercise: FocusedExercise }) {
  const { sessionId, exercise, previous, onSet, onSelect, onEquipment, athleteMode, onLoadIncrementChange } = props;
  const kind = exerciseInputKind(exercise);
  const timed = kind === 'duration';
  const recordedLoad = hasRecordedLoad(exercise.logs);
  const [loadOpen, setLoadOpen] = useState(() => recordedLoad);
  const [adjustingSetId, setAdjustingSetId] = useState<string | null>(null);
  const [appliedVersions, setAppliedVersions] = useState<Record<string, number>>({});
  const optionalLoad = kind === 'bodyweight' || timed || (kind === 'distance' && (recordedLoad || loadOpen));
  const invalidLoads = useRef(new Set<string>());
  const showLoad = optionalLoad && (loadOpen || recordedLoad);
  const singleQuantity = (optionalLoad || kind === 'distance') && !showLoad;
  const prior = previous(exercise)?.exercise;
  const inMinutes = /\bmin(?:ute)?s?\b/i.test(exercise.target);
  const quantityLabel = timed ? inMinutes ? 'Minutes' : 'Seconds' : exercise.quantityUnit === 'm' ? 'Metres' : 'Reps';
  const recommendation = getProgressionRecommendation(exercise, props.sessions ?? [], props.date ?? new Date().toISOString().slice(0, 10),
    { ...props.context, loadIncrementKg: exerciseLoadIncrement(exercise), ...(exercise.preparationOnly ? { lowFatigueSession: true } : {}) });

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
    {exercise.logs.map((log, index) => <QuickSetRow key={`${sessionId}-${exercise.key}-${log.id}-${appliedVersions[log.id] ?? 0}`} {...props}
      exercise={exercise} log={log} index={index} previous={prior?.logs[index]} showLoad={showLoad}
      adjusting={adjustingSetId === log.id} onAdjust={() => setAdjustingSetId(log.id)} onAdjustmentFinished={() => setAdjustingSetId(null)}
      onLoadInteraction={() => setLoadOpen(true)} onLoadValidityChange={(id, invalid) => { if (invalid) invalidLoads.current.add(id); else invalidLoads.current.delete(id); }} />)}
    <details className="quick-exercise__effort"><summary>Details <span>Optional</span></summary>
      {(kind === 'weight' || showLoad) && onLoadIncrementChange && <LoadStepControl exercise={exercise} onChange={increment => onLoadIncrementChange(exercise.key, increment)} />}
      {optionalLoad && !recordedLoad && <button type="button" className="text-button quick-exercise__load" aria-label={`${showLoad ? 'Hide' : 'Add'} load for ${exercise.name}`}
        aria-expanded={showLoad} onClick={toggleLoad}>{showLoad ? 'Hide added load' : 'Add load · kg'}</button>}
      {optionalLoad && <p>Added weight is optional. Existing recorded load stays visible; opening or hiding fields never changes it.</p>}
      {exercise.restRange && <p>Prescribed rest · {exercise.restRange}. Timer starts at {exercise.rest} sec and stays adjustable.</p>}
      {exercise.targetRir != null && <p>Planned effort · RIR {exercise.targetRir}. Recorded effort remains optional.</p>}
      {onEquipment && kind !== 'measurement' && kind !== 'distance' && <button type="button" className="text-button" onClick={() => onEquipment(exercise.key)} aria-label={`Equipment for ${exercise.name}`}>{exercise.equipmentLabel ? 'Edit equipment label' : 'Add equipment label'}</button>}
      {kind !== 'distance' && <p>RIR: How many more reps you could complete. RPE: How hard the effort felt.</p>}
      {kind !== 'distance' && exercise.logs.map((log, index) => <label key={log.id}>Set {index + 1} · RIR<input type="number" min="0" max="10" step="1" inputMode="numeric"
        aria-label={`${exercise.name} set ${index + 1} reps in reserve`} value={log.rir ?? ''}
        onChange={event => { onSelect(exercise.key, log.id); onSet(exercise.key, log.id, { rir: numberInput(event.target.value, 10) }); }} /></label>)}
      {!athleteMode && <p>Primer: A short preparation session before a demanding activity. Complex Pair: Two linked exercises performed in a prescribed sequence.</p>}
      {exercise.exerciseId === 'split-step-reaction' && <ReactionCue key={exercise.key} />}
      {!props.editing && ['load', 'reps', 'hold', 'reduce'].includes(recommendation.kind) && <ProgressionCue recommendation={recommendation}
        onApply={['load', 'reps'].includes(recommendation.kind) ? () => {
          const target = exercise.logs.find(log => !log.done);
          if (!target) return;
          if (recommendation.kg !== undefined) {
            invalidLoads.current.delete(target.id);
            props.onInvalidChange(target.id, false);
            setAppliedVersions(current => ({ ...current, [target.id]: (current[target.id] ?? 0) + 1 }));
          }
          onSelect(exercise.key, target.id);
          onSet(exercise.key, target.id, { ...(recommendation.kg !== undefined ? { kg: recommendation.kg } : {}), ...(recommendation.reps !== undefined ? { reps: recommendation.reps } : {}) });
        } : undefined} />}
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
    {exercises.map((exercise, index) => {
      const pair = exercise.section ? findTrainingPair(exercises, exercise.key) : null;
      return <Fragment key={`${sessionId}-${exercise.key}`}>
        {exercise.section && exercise.section !== exercises[index - 1]?.section && <h3 className="eyebrow">{exercise.section}</h3>}
        {pair?.kind === 'complex' && pair.first.key === exercise.key && <p className="small-note" role="note" aria-label={`Complex pair ${pair.label} sequence`}>
          {pair.pairedRounds} rounds: {pair.first.name} → rest {pair.first.restRange ?? `${pair.first.rest ?? 0} sec`} → {pair.second.name} → rest {pair.second.restRange ?? `${pair.second.rest ?? 0} sec`} → repeat. Alternate one set of each movement; these are the complete working sets, not additional sets.
        </p>}
        <QuickExercise {...props} exercise={exercise} />
      </Fragment>;
    })}
  </section>;
}
