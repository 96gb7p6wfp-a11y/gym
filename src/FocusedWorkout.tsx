import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronRight, Ellipsis, Minus, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { DecimalWeightInput } from './DecimalWeightInput';
import { ExerciseGuide } from './ExerciseGuide';
import { measurementLabel } from './domain';
import { TimedSetControls } from './TimedSetControls';
import type { TimedSetAction } from './timed-sets';
import { findTrainingPair, firstUnfinishedStep, nextStepAfterCompletion, restAfterCompletedSet, type SupersetLink } from './training-flow';
import './focused-workout.css';
import { findLibraryExercise } from './exercise-library';
import { getProgressionRecommendation, type ProgressionContext } from './performance-insights';
import { ProgressionCue } from './ProgressionCue';
import type { ReportSession } from './weekly-report';
import { completedSetCue, setQualityCue } from './set-encouragement';
import { previousSetReuse } from './workout-reuse';
import { CompletionIntentGate, type CompletionIntent } from './set-completion';
import { formatPreviousSet } from './previous-performance';
import { QuickWorkoutLog } from './QuickWorkoutLog';
import { EquipmentLabelEditor } from './EquipmentLabel';

export interface FocusedSetLog {
  id: string;
  kg: number | null;
  reps: number | null;
  seconds: number | null;
  rir: number | null;
  done: boolean;
  measurementCm?: number | null;
}

export interface FocusedExercise {
  key: string;
  name: string;
  group: string;
  target: string;
  mode: 'weight' | 'bodyweight' | 'timed';
  rest: number;
  perSide: boolean;
  cue?: string;
  measurement?: 'touch' | 'height' | 'distance';
  logs: FocusedSetLog[];
  elapsedMs: number;
  runningSince: number | null;
  timerSetId?: string | null;
  exerciseId?: string;
  targetRpe?: number;
  quantityUnit?: 'm';
  benefit?: string;
  superset?: SupersetLink;
  preparationOnly?: boolean;
  equipmentLabel?: string;
}

export interface FocusedWorkoutProps {
  sessionId: string;
  editing?: boolean;
  exercises: FocusedExercise[];
  now: number;
  previous: (exercise: FocusedExercise) => { exercise: { logs: FocusedSetLog[]; measurement?: FocusedExercise['measurement'] } } | null;
  onSet: (exerciseKey: string, setId: string, patch: Partial<FocusedSetLog>) => void;
  onDone: (exerciseKey: string, setId: string, done: boolean, intent?: CompletionIntent) => boolean;
  onUndoLast?: () => boolean;
  canUndoLast?: boolean;
  lastCompletedTarget?: { exerciseKey: string; setId: string };
  onTimer: (exerciseKey: string, options?: TimedSetAction) => void;
  renderAllSets: (exercise: FocusedExercise, index: number) => ReactNode;
  sessions?: readonly ReportSession[];
  date?: string;
  context?: ProgressionContext;
  onExerciseAction?: (key: string) => void;
  athleteMode?: boolean;
  onEquipmentChange?: (exerciseKey: string, label: string | undefined) => Promise<boolean | void> | boolean | void;
}

const amount = (raw: string, maximum: number) => raw.trim() === ''
  ? null : Math.min(maximum, Math.max(0, Number(raw.replace(',', '.')) || 0));

/** The existing session mutations remain the only source of workout data. */
export function FocusedWorkout({ sessionId, editing = false, exercises, now, previous, onSet, onDone, onUndoLast, canUndoLast = false, lastCompletedTarget, onTimer, renderAllSets, sessions = [], date = new Date().toISOString().slice(0, 10), context, onExerciseAction, athleteMode = true, onEquipmentChange }: FocusedWorkoutProps) {
  const initialStep = firstUnfinishedStep(exercises);
  const initialExercise = exercises.find(exercise => exercise.key === initialStep?.exerciseKey) ?? exercises[0];
  const [exerciseKey, setExerciseKey] = useState(initialExercise?.key);
  const [setId, setSetId] = useState<string | null>(initialStep?.setId ?? null);
  const [allSetsOpen, setAllSetsOpen] = useState(false);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [reuseRevision, setReuseRevision] = useState(0);
  const [layout, setLayout] = useState<'focus' | 'quick'>('focus');
  const [equipmentTarget, setEquipmentTarget] = useState<string | null>(null);
  const [setFeedback, setSetFeedback] = useState<{ id: string; text: string } | null>(null);
  const [, updateCompletionState] = useState(0);
  const initialTarget = initialExercise && (initialStep?.setId ?? initialExercise.logs[0]?.id);
  const [completionGate] = useState(() => new CompletionIntentGate(initialExercise && initialTarget
    ? { sessionId, exerciseKey: initialExercise.key, setId: initialTarget } : undefined));
  const invalidWeightInputs = useRef(new Set<string>());
  const pendingCompletion = useRef<{ exerciseKey: string; setId: string } | null>(null);
  const exerciseCard = useRef<HTMLElement | null>(null);
  const shownExercise = useRef(exerciseKey);

  useEffect(() => {
    if (!setFeedback) return;
    const timeout = window.setTimeout(() => setSetFeedback(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [setFeedback]);

  useEffect(() => {
    if (shownExercise.current === exerciseKey) return;
    shownExercise.current = exerciseKey;
    exerciseCard.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [exerciseKey]);

  useEffect(() => {
    const first = firstUnfinishedStep(exercises);
    setExerciseKey(first?.exerciseKey ?? exercises[0]?.key);
    setSetId(first?.setId ?? null);
    setAllSetsOpen(false);
    setSetFeedback(null);
    pendingCompletion.current = null;
    const exercise = exercises.find(entry => entry.key === first?.exerciseKey) ?? exercises[0];
    const targetId = first?.setId ?? exercise?.logs[0]?.id;
    completionGate.reset(exercise && targetId ? { sessionId, exerciseKey: exercise.key, setId: targetId } : undefined);
    updateCompletionState(value => value + 1);
    invalidWeightInputs.current.clear();
    setLayout('focus');
    setEquipmentTarget(null);
    // A restored or different workout starts at its first unfinished set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (editing) {
      pendingCompletion.current = null;
      return;
    }
    const pending = pendingCompletion.current;
    if (!pending) return;
    const index = exercises.findIndex((exercise) => exercise.key === pending.exerciseKey);
    const current = exercises[index];
    const completed = current?.logs.find((log) => log.id === pending.setId);
    if (!completed?.done) return;
    pendingCompletion.current = null;
    const next = nextStepAfterCompletion(exercises, current.key, completed.id);
    const nextMovement = exercises.find(entry => entry.key === next?.exerciseKey);
    const pair = findTrainingPair(exercises, current.key);
    const nextInPair = pair && nextMovement && nextMovement.key !== current.key
      && findTrainingPair(exercises, nextMovement.key)?.startIndex === pair.startIndex
      ? nextMovement.name : undefined;
    const previousMovement = previous(current)?.exercise;
    const previousLogs = previousMovement?.logs ?? [];
    const completedIndex = current.logs.findIndex(entry => entry.id === completed.id);
    setSetFeedback({
      id: `${current.key}-${completed.id}`,
      text: completedSetCue({
        exercise: { ...current, category: findLibraryExercise(current)?.category }, completed, previous: previousLogs[completedIndex],
        previousMeasurement: previousMovement?.measurement,
        setNumber: completedIndex + 1, totalSets: current.logs.length,
        allDone: exercises.every(entry => entry.logs.every(entry => entry.done)),
        movementDone: current.logs.every(entry => entry.done), nextInPair,
        hasRest: restAfterCompletedSet(exercises, current.key, completed.id) > 0,
        easeBack: context?.lowFatigueSession || context?.readiness?.energy === 'low'
          || context?.readiness?.soreness === 'high',
      }),
    });
    if (next) {
      setExerciseKey(next.exerciseKey);
      setSetId(next.setId);
    }
  }, [context, editing, exercises, onSet, previous]);

  const exerciseIndex = exercises.findIndex((exercise) => exercise.key === exerciseKey);
  const exercise = exercises[exerciseIndex] ?? initialExercise;
  if (!exercise) return null;
  const log = exercise.logs.find((entry) => entry.id === setId)
    ?? exercise.logs.find((entry) => !entry.done) ?? exercise.logs[0];
  if (!log) return null;
  const target = { sessionId, exerciseKey: exercise.key, setId: log.id };
  const completionReady = completionGate.isArmed(target);
  const setIndex = exercise.logs.findIndex((entry) => entry.id === log.id);
  const previousLogs = previous(exercise)?.exercise.logs ?? [];
  const previousMetric = formatPreviousSet(exercise, previousLogs[setIndex]);
  const reuse = !editing && !log.done ? previousSetReuse(exercise, setIndex, sessions, date, sessionId) : null;
  const libraryExercise = findLibraryExercise(exercise);
  const recommendation = getProgressionRecommendation(exercise, sessions, date,
    exercise.preparationOnly ? { ...context, lowFatigueSession: true } : context);
  const qualityCue = setQualityCue({ ...exercise, category: libraryExercise?.category },
    exercise.preparationOnly || recommendation.kind === 'reduce' || context?.lowFatigueSession
      || context?.readiness?.energy === 'low' || context?.readiness?.soreness === 'high');
  const weightStep = (log.kg ?? 0) >= 40 ? 2.5 : .5;
  const pair = findTrainingPair(exercises, exercise.key);
  const rounds = pair?.pairedRounds ?? 0;
  const pairedSet = pair && (pair.kind === 'complex' || setIndex < pair.pairedRounds);
  const allDone = exercises.every((entry) => entry.logs.every((entry) => entry.done));
  const anticipated = nextStepAfterCompletion(exercises.map(entry => entry.key === exercise.key
    ? { ...entry, logs: entry.logs.map(set => set.id === log.id ? { ...set, done: true } : set) } : entry), exercise.key, log.id);
  const nextExercise = exercises.find(entry => entry.key === anticipated?.exerciseKey);
  const equipmentExercise = exercises.find(entry => entry.key === equipmentTarget);

  function pauseMovementTimer() {
    const running = exercises.find(entry => entry.runningSince != null);
    if (running) onTimer(running.key, running.timerSetId
      ? { action: 'pause', setId: running.timerSetId } : undefined);
  }

  function selectExercise(entry: FocusedExercise) {
    pauseMovementTimer();
    pendingCompletion.current = null;
    setExerciseKey(entry.key);
    setSetId(null);
    setAllSetsOpen(false);
    setMovementsOpen(false);
    setSetFeedback(null);
    const selected = entry.logs.find(set => !set.done) ?? entry.logs[0];
    if (selected) armSet(entry.key, selected.id);
  }

  function armSet(key: string, id: string) {
    completionGate.arm({ sessionId, exerciseKey: key, setId: id });
    updateCompletionState(value => value + 1);
  }

  function editSet(patch: Partial<FocusedSetLog>) {
    // An actual input/stepper/reuse action deliberately selects this set.
    // Automatic selection and parent rerenders never call this function.
    armSet(exercise.key, log.id);
    onSet(exercise.key, log.id, patch);
  }

  function completeSet() {
    if (invalidWeightInputs.current.has(log.id)) {
      toast.error('Enter a weight between 0 and 2,000 kg using . or ,');
      return;
    }
    const intent = completionGate.claim(target);
    if (!intent) return;
    updateCompletionState(value => value + 1);
    if (log.done) setSetFeedback(null);
    if (!editing && !log.done) pendingCompletion.current = { exerciseKey: exercise.key, setId: log.id };
    if (!onDone(exercise.key, log.id, !log.done, intent)) {
      pendingCompletion.current = null;
      armSet(exercise.key, log.id);
    }
  }

  function undoLastSet(): boolean {
    const undoTarget = lastCompletedTarget;
    if (!onUndoLast?.()) return false;
    pendingCompletion.current = null;
    completionGate.reset();
    updateCompletionState(value => value + 1);
    setSetFeedback(null);
    if (undoTarget) {
      setExerciseKey(undoTarget.exerciseKey);
      setSetId(undoTarget.setId);
    }
    return true;
  }

  function changeLayout(next: 'focus' | 'quick') {
    if (layout === next) return;
    if (invalidWeightInputs.current.size) {
      toast.error('Correct the invalid weight before changing the logging view.');
      return;
    }
    pendingCompletion.current = null;
    setLayout(next);
  }

  function selectQuickSet(key: string, id: string) {
    pendingCompletion.current = null;
    setExerciseKey(key);
    setSetId(id);
    armSet(key, id);
  }

  return (
    <div className="focused-workout" data-session-id={sessionId}>
      <div className="workout-layout-switch" role="group" aria-label="Workout logging layout">
        <button type="button" aria-pressed={layout === 'focus'} onClick={() => changeLayout('focus')}>Focus</button>
        <button type="button" aria-pressed={layout === 'quick'} onClick={() => changeLayout('quick')}>Quick Log</button>
      </div>
      {layout === 'quick' ? <QuickWorkoutLog sessionId={sessionId} exercises={exercises} previous={previous} onSet={onSet} onDone={onDone}
        onTimer={onTimer} onSelect={selectQuickSet} onInvalidChange={(id, invalid) => { if (invalid) invalidWeightInputs.current.add(id); else invalidWeightInputs.current.delete(id); }}
        onEquipment={onEquipmentChange ? key => setEquipmentTarget(key) : undefined} onUndoLast={onUndoLast ? undoLastSet : undefined}
        canUndoLast={canUndoLast} athleteMode={athleteMode} now={now} editing={editing} /> : <>
      <section className="focused-exercise" aria-label="Current exercise" ref={exerciseCard}>
        <div className="focused-stage-topline">
          <span aria-label={allDone ? 'All sets complete' : `Exercise ${exerciseIndex + 1} of ${exercises.length}`}>{allDone ? 'Complete' : `${String(exerciseIndex + 1).padStart(2, '0')} / ${String(exercises.length).padStart(2, '0')}`}</span>
          <div className="focused-stage-tools">
            <button type="button" className="focused-exercise__text-action"
              disabled={completionReady || log.done} onClick={() => armSet(exercise.key, log.id)}
              title="Review the selected set, then tap Ready to log it"
              aria-label={`Ready for ${exercise.name} set ${setIndex + 1}`}>Ready</button>
            {!editing && onUndoLast && <button type="button" className="icon-button" aria-label="Undo last set"
              disabled={!canUndoLast} onClick={undoLastSet}><RotateCcw size={18} aria-hidden="true" /></button>}
            <button type="button" className="focused-exercise__text-action" aria-expanded={allSetsOpen}
              onClick={() => { pendingCompletion.current = null; setAllSetsOpen(!allSetsOpen); }}>
              {allSetsOpen ? 'Current set' : 'All sets'}
            </button>
            {onExerciseAction && <button type="button" className="icon-button" aria-label={`Options for ${exercise.name}`} onClick={() => onExerciseAction(exercise.key)}><Ellipsis size={22} aria-hidden="true" /></button>}
          </div>
        </div>
        <div className="focused-exercise-title"><h2 className="focused-exercise__name">{exercise.name}</h2></div>
        {!exercise.measurement && exercise.mode !== 'timed' && onEquipmentChange && <button type="button" className="focused-equipment-label text-button"
          aria-label={`Equipment for ${exercise.name}`} onClick={() => setEquipmentTarget(exercise.key)}>{exercise.equipmentLabel ?? 'Add equipment label'}</button>}
        {!onEquipmentChange && exercise.equipmentLabel && <p className="small-note">{exercise.equipmentLabel}</p>}
        {(exercise.benefit || libraryExercise) && <p className="focused-exercise-benefit">{exercise.benefit ?? libraryExercise?.primaryBenefit}</p>}
        {athleteMode && pair && pairedSet && <div className="focused-pair" role="group" aria-label={`${pair.kind === 'superset' ? 'Superset' : 'Complex pair'} ${pair.label}`}>
          <div className="focused-pair__heading">
            <span>{pair.kind === 'superset' ? 'Superset' : 'Complex'} {pair.label}</span><strong>Round {setIndex + 1} <span>of {rounds}</span></strong>
          </div>
          <div className="focused-pair__steps">{[pair.first, pair.second].map((entry, index) => {
            const roundLog = entry.logs[setIndex];
            return <button type="button" key={entry.key} aria-label={`View ${entry.name} in pair ${pair.label}`}
              aria-pressed={entry.key === exercise.key} disabled={!roundLog}
              onClick={() => { pauseMovementTimer(); pendingCompletion.current = null; setSetFeedback(null); setExerciseKey(entry.key); setSetId(roundLog?.id ?? null); setAllSetsOpen(false); if (roundLog) armSet(entry.key, roundLog.id); }}>
              <span className="focused-pair__position">{roundLog?.done ? <Check size={15} aria-hidden="true" /> : `${pair.label}${index + 1}`}</span>
              <span><strong>{entry.name}</strong></span>
              <span className="focused-pair__state">{entry.key === exercise.key ? 'Now' : roundLog?.done ? 'Done' : 'Next'}</span>
            </button>;
          })}</div>
          <p>{pair.kind === 'superset' ? `Move to the partner, then rest ${pair.restAfterRound} sec after the pair. Rest longer if needed.` : exercise.rest > 0 ? `${exercise.rest % 60 === 0 ? `${exercise.rest / 60} min` : `${exercise.rest} sec`} rest between steps` : 'Follow your planned rest'}</p>
        </div>}
        {athleteMode && pair?.kind === 'superset' && !pairedSet && <p className="small-note">Extra standalone set · keep your normal rest.</p>}
        {allSetsOpen ? (
          <div className="focused-workout__all-sets">{renderAllSets(exercise, Math.max(0, exerciseIndex))}</div>
        ) : (
          <>
            <div className="focused-working-set">
              <div className="focused-exercise__set-heading">
                <div className="focused-exercise__set-position"><strong>Set {setIndex + 1} <span>of {exercise.logs.length}</span></strong>
                  <span className="focused-exercise__target">{exercise.target}{exercise.perSide ? ' / side' : ''}{athleteMode && exercise.targetRpe ? ` · RPE ${exercise.targetRpe}` : ''}</span>
                </div>
                {previousMetric && <span className="focused-exercise__previous">Previous <b>{previousMetric}</b></span>}
              </div>
              {reuse && <button type="button" className="focused-reuse" aria-label={`Reuse previous ${exercise.name} set ${setIndex + 1} weights and reps`}
                onClick={() => {
                  invalidWeightInputs.current.delete(log.id);
                  setReuseRevision(value => value + 1);
                  editSet(reuse.patch);
                }}><RotateCcw size={15} aria-hidden="true" /><span>Reuse {formatPreviousSet(exercise, { ...log, ...reuse.patch, measurementCm: null, done: true })}<small>Previous workout · {reuse.date}</small></span></button>}
              {exercise.mode === 'timed' ? <TimedSetControls key={`${exercise.key}-${log.id}`} setId={log.id}
                seconds={log.seconds} target={exercise.target} exerciseKey={exercise.key} exerciseName={exercise.name}
                elapsedMs={exercise.elapsedMs} runningSince={exercise.runningSince} timerSetId={exercise.timerSetId ?? null}
                now={now} editing={editing} setNumber={setIndex + 1} done={log.done} prefill={completionReady}
                onInteraction={() => armSet(exercise.key, log.id)}
                onSecondsChange={seconds => onSet(exercise.key, log.id, { seconds })} onTimer={onTimer} /> :
              <div className="focused-set-controls" key={`${exercise.key}-${log.id}`}>
                {!exercise.measurement && (
                  <div className="focused-set-field">
                    <span>{exercise.mode === 'bodyweight' ? 'Added weight' : 'Weight'} <small>kg</small></span>
                    <div className="focused-number-stepper"><DecimalWeightInput key={reuseRevision} value={log.kg} placeholder={exercise.mode === 'bodyweight' ? 'BW' : '0'}
                      label={`${exercise.name} set ${setIndex + 1} weight in kilograms`}
                      onValidityChange={(valid) => valid ? invalidWeightInputs.current.delete(log.id) : invalidWeightInputs.current.add(log.id)}
                      onChange={(kg, valid) => editSet({ kg, ...(!valid ? { done: false } : {}) })} />
                      <div className="focused-number-stepper__actions">
                        <button type="button" aria-label={`Decrease ${exercise.name} weight by ${weightStep} kg`} onClick={() => editSet({ kg: Math.max(0, Math.round(((log.kg ?? 0) - weightStep) * 10) / 10) })}><Minus size={18} aria-hidden="true" /></button>
                        <button type="button" aria-label={`Increase ${exercise.name} weight by ${weightStep} kg`} onClick={() => editSet({ kg: Math.min(2000, Math.round(((log.kg ?? 0) + weightStep) * 10) / 10) })}><Plus size={18} aria-hidden="true" /></button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="focused-set-field">
                  <span>{exercise.quantityUnit === 'm' ? 'Distance · m / side' : 'Reps'}</span>
                  <div className="focused-number-stepper"><input className="set-input" type="number" min="0"
                    max={1000} step="1" inputMode="numeric"
                    placeholder={exercise.target.match(/\d+/)?.[0] ?? '0'}
                    aria-label={`${exercise.name} set ${setIndex + 1} ${exercise.quantityUnit === 'm' ? 'distance in metres' : 'reps'}`}
                    value={log.reps ?? ''}
                    onChange={(event) => {
                      const next = amount(event.target.value, 1000);
                      editSet({ reps: next == null ? null : Math.trunc(next) });
                    }} />
                    <div className="focused-number-stepper__actions">
                      <button type="button" aria-label={`Decrease ${exercise.name} ${exercise.quantityUnit ? 'distance' : 'reps'}`} onClick={() => editSet({ reps: Math.max(1, (log.reps ?? Number(exercise.target.match(/\d+/)?.[0] ?? 1)) - 1) })}><Minus size={18} aria-hidden="true" /></button>
                      <button type="button" aria-label={`Increase ${exercise.name} ${exercise.quantityUnit ? 'distance' : 'reps'}`} onClick={() => editSet({ reps: Math.min(1000, (log.reps ?? Number(exercise.target.match(/\d+/)?.[0] ?? 0)) + 1) })}><Plus size={18} aria-hidden="true" /></button>
                    </div>
                  </div>
                </div>
                {exercise.measurement && (
                  <div className="focused-set-field focused-set-field--measurement">
                    <span>{exercise.measurement === 'touch' ? 'Highest touch' : exercise.measurement === 'height' ? 'Jump height' : 'Distance'} <small>cm · optional</small></span>
                    <input className="set-input" type="number" min="0" max="1000" step="0.1" inputMode="decimal" placeholder="—"
                      aria-label={`${exercise.name} set ${setIndex + 1} ${measurementLabel(exercise)}`}
                      value={log.measurementCm ?? ''}
                      onChange={(event) => editSet({ measurementCm: amount(event.target.value, 1000) })} />
                  </div>
                )}
              </div>}
              {!editing && <p className="focused-set-encouragement" role="status" aria-label="Set focus" aria-atomic="true"
                data-feedback={setFeedback ? 'complete' : 'ready'}>
                <span key={setFeedback?.id ?? `${exercise.key}-focus`}><strong>{setFeedback ? <Check className="focused-set-receipt" size={16} aria-hidden="true" /> : 'Coach'}</strong>{' · '}{setFeedback?.text ?? qualityCue}</span>
              </p>}
              <button type="button" className={`btn focused-complete-set${log.done ? ' secondary' : ''}`}
                disabled={!completionReady}
                aria-label={`${log.done ? 'Undo' : 'Complete'} ${exercise.name} set ${setIndex + 1}`} onClick={completeSet}>
                {log.done ? <RotateCcw size={19} aria-hidden="true" /> : <Check size={20} aria-hidden="true" />}
                {log.done ? 'Undo set' : 'Complete set'}
              </button>
              {athleteMode && !log.done && exercise.mode !== 'timed' && <div className="focused-rir" role="group" aria-label="Quick reps in reserve">
                <span>Reps in reserve · optional <button type="button" className="focused-rir-clear" aria-label="Clear reps in reserve" aria-pressed={log.rir == null} onClick={() => editSet({ rir: null })}>Clear</button></span>
                <div>{[0, 1, 2, 3, 4, 5].map(rir => <button key={rir} type="button" aria-label={`${rir} reps in reserve`} aria-pressed={log.rir === rir}
                  onClick={() => editSet({ rir })}>{rir}</button>)}
                </div>
              </div>}
              <div className="focused-exercise__set-selector" role="group" aria-label={`Sets for ${exercise.name}`}>
                {exercise.logs.map((entry, index) => (
                  <button type="button" key={entry.id} className={`${entry.id === log.id ? ' is-current' : ''}${entry.done ? ' is-done' : ''}`}
                    aria-label={`View ${exercise.name} set ${index + 1}${entry.done ? ', complete' : ''}`}
                    aria-pressed={entry.id === log.id} onClick={() => { pauseMovementTimer(); pendingCompletion.current = null; setSetFeedback(null); setSetId(entry.id); armSet(exercise.key, entry.id); }}>
                    {entry.done ? <Check size={15} aria-hidden="true" /> : index + 1}
                  </button>
                ))}
              </div>
            </div>
            <ExerciseGuide exercise={exercise} key={exercise.key} />
            {(!log.done || !athleteMode) && <details className="focused-effort"><summary>{athleteMode ? 'Effort' : 'Effort & advanced'} <span>{log.rir == null ? 'Optional' : `${log.rir} reps in reserve`}</span></summary>
              {!log.done && <label className="field-label">Reps in reserve<input type="number" min="0" max="10" step="1" inputMode="numeric" aria-label={`${exercise.name} set ${setIndex + 1} reps in reserve`} value={log.rir ?? ''} onChange={event => editSet({ rir: event.target.value === '' ? null : Math.min(10, Math.max(0, Number(event.target.value))) })} /></label>}
              <p className="small-note">RIR: How many more reps you could complete.</p>
              {!athleteMode && <><p className="small-note">RPE: How hard the effort felt.{exercise.targetRpe ? ` Planned effort: ${exercise.targetRpe}.` : ''}</p>
                <p className="small-note">Primer: A short preparation session before a demanding activity.</p>
                <p className="small-note">Complex Pair: Two linked exercises performed in a prescribed sequence.{pair ? ` Your ${pair.first.name} and ${pair.second.name} follow this sequence.` : ''}</p>
                {!editing && ['load', 'reps', 'hold', 'reduce'].includes(recommendation.kind) && <ProgressionCue recommendation={recommendation} onApply={log.done ? undefined : () => editSet({ ...(recommendation.kg !== undefined ? { kg: recommendation.kg } : {}), ...(recommendation.reps !== undefined ? { reps: recommendation.reps } : {}) })} />}
              </>}
            </details>}
            {athleteMode && !editing && ['load', 'reps', 'hold', 'reduce'].includes(recommendation.kind) && <ProgressionCue recommendation={recommendation} onApply={log.done ? undefined : () => editSet({ ...(recommendation.kg !== undefined ? { kg: recommendation.kg } : {}), ...(recommendation.reps !== undefined ? { reps: recommendation.reps } : {}) })} />}
          </>
        )}
      </section>
      <details className="focused-movements" open={movementsOpen} onToggle={(event) => setMovementsOpen(event.currentTarget.open)}>
        <summary><span>Movements</span><small>{exercises.filter((entry) => entry.logs.every((entry) => entry.done)).length} / {exercises.length} complete</small><ChevronRight size={17} aria-hidden="true" /></summary>
        <div className="focused-movements__list">
          {exercises.map((entry, index) => {
            const completed = entry.logs.filter((entry) => entry.done).length;
            return (
              <button type="button" key={entry.key} aria-label={`Train ${entry.name}`} aria-pressed={entry.key === exercise.key}
                className={entry.key === exercise.key ? 'is-current' : ''} onClick={() => selectExercise(entry)}>
                <span className="focused-movements__number">{completed === entry.logs.length ? <Check size={17} aria-hidden="true" /> : String(index + 1).padStart(2, '0')}</span>
                <span><strong>{entry.name}</strong><small>{completed} / {entry.logs.length} sets</small></span><ChevronRight size={16} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </details>
      {nextExercise && <p className="focused-workout__next">{pair && findTrainingPair(exercises, nextExercise.key)?.startIndex === pair.startIndex
        ? pair.kind === 'superset' && (anticipated?.setIndex ?? 0) >= pair.pairedRounds ? 'Extra standalone set' : `Next in pair · round ${anticipated?.round}` : 'Up next'}<span>{nextExercise.name}</span></p>}
      {allDone && <p className="focused-workout__finished" role="status">All sets complete. Finish when you’re ready.</p>}
      </>}
      {equipmentExercise && onEquipmentChange && <EquipmentLabelEditor open onOpenChange={open => { if (!open) setEquipmentTarget(null); }}
        exerciseName={equipmentExercise.name} label={equipmentExercise.equipmentLabel}
        onSave={label => onEquipmentChange(equipmentExercise.key, label)} />}
    </div>
  );
}
