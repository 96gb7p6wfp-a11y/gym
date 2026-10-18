import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronRight, Ellipsis, Minus, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { DecimalWeightInput } from './DecimalWeightInput';
import { ExerciseGuide } from './ExerciseGuide';
import { measurementLabel } from './domain';
import { TimedSetControls } from './TimedSetControls';
import type { TimedSetAction } from './timed-sets';
import { findComplexPair, firstUnfinishedStep, nextStepAfterCompletion } from './training-flow';
import './focused-workout.css';
import { findLibraryExercise } from './exercise-library';
import { getProgressionRecommendation, type ProgressionContext } from './performance-insights';
import { ProgressionCue } from './ProgressionCue';
import type { ReportSession } from './weekly-report';

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
}

export interface FocusedWorkoutProps {
  sessionId: string;
  editing?: boolean;
  exercises: FocusedExercise[];
  now: number;
  previous: (exercise: FocusedExercise) => { exercise: { logs: FocusedSetLog[] } } | null;
  onSet: (exerciseKey: string, setId: string, patch: Partial<FocusedSetLog>) => void;
  onDone: (exerciseKey: string, setId: string, done: boolean) => void;
  onTimer: (exerciseKey: string, options?: TimedSetAction) => void;
  renderAllSets: (exercise: FocusedExercise, index: number) => ReactNode;
  sessions?: readonly ReportSession[];
  date?: string;
  context?: ProgressionContext;
  onExerciseAction?: (key: string) => void;
}

const number = (value: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value);
const amount = (raw: string, maximum: number) => raw.trim() === ''
  ? null : Math.min(maximum, Math.max(0, Number(raw.replace(',', '.')) || 0));

function previousLabel(exercise: FocusedExercise, log: FocusedSetLog | undefined): string {
  if (!log) return 'First session';
  if (exercise.measurement) return log.measurementCm == null
    ? `${log.reps ?? '—'} reps` : `${number(log.measurementCm)} cm`;
  if (exercise.mode === 'timed') {
    const inMinutes = exercise.target.includes('min');
    return `${number((log.seconds ?? 0) / (inMinutes ? 60 : 1))} ${inMinutes ? 'min' : 'sec'}`;
  }
  return `${log.kg == null ? 'Bodyweight' : `${number(log.kg)} kg`} × ${log.reps ?? '—'}${exercise.quantityUnit ? ' m' : ''}`;
}

/** The existing session mutations remain the only source of workout data. */
export function FocusedWorkout({ sessionId, editing = false, exercises, now, previous, onSet, onDone, onTimer, renderAllSets, sessions = [], date = new Date().toISOString().slice(0, 10), context, onExerciseAction }: FocusedWorkoutProps) {
  const initialStep = firstUnfinishedStep(exercises);
  const initialExercise = exercises.find(exercise => exercise.key === initialStep?.exerciseKey) ?? exercises[0];
  const [exerciseKey, setExerciseKey] = useState(initialExercise?.key);
  const [setId, setSetId] = useState<string | null>(initialStep?.setId ?? null);
  const [allSetsOpen, setAllSetsOpen] = useState(false);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const invalidWeightInputs = useRef(new Set<string>());
  const pendingCompletion = useRef<{ exerciseKey: string; setId: string } | null>(null);
  const exerciseCard = useRef<HTMLElement | null>(null);
  const shownExercise = useRef(exerciseKey);

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
    pendingCompletion.current = null;
    invalidWeightInputs.current.clear();
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
    const nextSet = current.logs.find((log) => !log.done);
    if (nextSet) {
      // Keep the next set quick to log, without changing a value already entered.
      if (current.mode !== 'timed') {
        const patch: Partial<FocusedSetLog> = {};
        if (nextSet.kg == null && completed.kg != null) patch.kg = completed.kg;
        if (nextSet.reps == null && completed.reps != null) patch.reps = completed.reps;
        if (Object.keys(patch).length) onSet(current.key, nextSet.id, patch);
      }
    }
    const next = nextStepAfterCompletion(exercises, current.key, completed.id);
    if (next) {
      setExerciseKey(next.exerciseKey);
      setSetId(next.setId);
    }
  }, [editing, exercises, onSet]);

  const exerciseIndex = exercises.findIndex((exercise) => exercise.key === exerciseKey);
  const exercise = exercises[exerciseIndex] ?? initialExercise;
  if (!exercise) return null;
  const log = exercise.logs.find((entry) => entry.id === setId)
    ?? exercise.logs.find((entry) => !entry.done) ?? exercise.logs[0];
  const setIndex = exercise.logs.findIndex((entry) => entry.id === log.id);
  const previousLogs = previous(exercise)?.exercise.logs.filter((entry) => entry.done) ?? [];
  const libraryExercise = findLibraryExercise(exercise);
  const recommendation = getProgressionRecommendation(exercise, sessions, date, context);
  const weightStep = (log.kg ?? 0) >= 40 ? 2.5 : .5;
  const pair = findComplexPair(exercises, exercise.key);
  const rounds = pair ? Math.max(pair.first.logs.length, pair.second.logs.length) : 0;
  const allDone = exercises.every((entry) => entry.logs.every((entry) => entry.done));
  const anticipated = nextStepAfterCompletion(exercises.map(entry => entry.key === exercise.key
    ? { ...entry, logs: entry.logs.map(set => set.id === log.id ? { ...set, done: true } : set) } : entry), exercise.key, log.id);
  const nextExercise = exercises.find(entry => entry.key === anticipated?.exerciseKey);

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
  }

  function completeSet() {
    if (invalidWeightInputs.current.has(log.id)) {
      toast.error('Enter a weight between 0 and 2,000 kg using . or ,');
      return;
    }
    if (!editing && !log.done) pendingCompletion.current = { exerciseKey: exercise.key, setId: log.id };
    onDone(exercise.key, log.id, !log.done);
  }

  return (
    <div className="focused-workout" data-session-id={sessionId}>
      <section className="focused-exercise" aria-label="Current exercise" ref={exerciseCard}>
        <div className="focused-stage-topline">
          <span>{allDone ? 'All sets complete' : `Exercise ${String(exerciseIndex + 1).padStart(2, '0')} of ${String(exercises.length).padStart(2, '0')}`}</span>
          <div className="focused-stage-tools">
            <button type="button" className="focused-exercise__text-action" aria-expanded={allSetsOpen}
              onClick={() => { pendingCompletion.current = null; setAllSetsOpen(!allSetsOpen); }}>
              {allSetsOpen ? 'Current set' : 'All sets'}
            </button>
            {onExerciseAction && <button type="button" className="icon-button" aria-label={`Options for ${exercise.name}`} onClick={() => onExerciseAction(exercise.key)}><Ellipsis size={22} aria-hidden="true" /></button>}
          </div>
        </div>
        <div className="focused-exercise-title"><h2 className="focused-exercise__name">{exercise.name}</h2></div>
        {libraryExercise && <p className="focused-exercise-benefit">{libraryExercise.primaryBenefit}</p>}
        {pair && <div className="focused-pair" role="group" aria-label={`Complex pair ${pair.label}`}>
          <div className="focused-pair__heading">
            <span>Complex {pair.label}</span><strong>Round {setIndex + 1} <span>of {rounds}</span></strong>
          </div>
          <div className="focused-pair__steps">{[pair.first, pair.second].map((entry, index) => {
            const roundLog = entry.logs[setIndex];
            return <button type="button" key={entry.key} aria-label={`View ${entry.name} in pair ${pair.label}`}
              aria-pressed={entry.key === exercise.key} disabled={!roundLog}
              onClick={() => { pauseMovementTimer(); pendingCompletion.current = null; setExerciseKey(entry.key); setSetId(roundLog?.id ?? null); setAllSetsOpen(false); }}>
              <span className="focused-pair__position">{roundLog?.done ? <Check size={15} aria-hidden="true" /> : `${pair.label}${index + 1}`}</span>
              <span><strong>{entry.name}</strong></span>
              <span className="focused-pair__state">{entry.key === exercise.key ? 'Now' : roundLog?.done ? 'Done' : 'Next'}</span>
            </button>;
          })}</div>
          <p>{exercise.rest > 0 ? `${exercise.rest % 60 === 0 ? `${exercise.rest / 60} min` : `${exercise.rest} sec`} rest between steps` : 'Follow your planned rest'}</p>
        </div>}
        {allSetsOpen ? (
          <div className="focused-workout__all-sets">{renderAllSets(exercise, Math.max(0, exerciseIndex))}</div>
        ) : (
          <>
            <div className="focused-working-set">
              <div className="focused-exercise__set-heading">
                <div className="focused-exercise__set-position"><strong>Set {setIndex + 1} <span>of {exercise.logs.length}</span></strong>
                  <span className="focused-exercise__target">{exercise.target}{exercise.perSide ? ' / side' : ''}{exercise.targetRpe ? ` · RPE ${exercise.targetRpe}` : ''}</span>
                </div>
                <span className="focused-exercise__previous">Previous <b>{previousLabel(exercise, previousLogs[setIndex])}</b></span>
              </div>
              {exercise.mode === 'timed' ? <TimedSetControls key={`${exercise.key}-${log.id}`} setId={log.id}
                seconds={log.seconds} target={exercise.target} exerciseKey={exercise.key} exerciseName={exercise.name}
                elapsedMs={exercise.elapsedMs} runningSince={exercise.runningSince} timerSetId={exercise.timerSetId ?? null}
                now={now} editing={editing} setNumber={setIndex + 1} done={log.done}
                onSecondsChange={seconds => onSet(exercise.key, log.id, { seconds })} onTimer={onTimer} /> :
              <div className="focused-set-controls" key={`${exercise.key}-${log.id}`}>
                {!exercise.measurement && (
                  <div className="focused-set-field">
                    <span>{exercise.mode === 'bodyweight' ? 'Added weight' : 'Weight'} <small>kg</small></span>
                    <div className="focused-number-stepper"><DecimalWeightInput value={log.kg} placeholder={exercise.mode === 'bodyweight' ? 'BW' : '0'}
                      label={`${exercise.name} set ${setIndex + 1} weight in kilograms`}
                      onValidityChange={(valid) => valid ? invalidWeightInputs.current.delete(log.id) : invalidWeightInputs.current.add(log.id)}
                      onChange={(kg, valid) => onSet(exercise.key, log.id, { kg, ...(!valid ? { done: false } : {}) })} />
                      <div className="focused-number-stepper__actions">
                        <button type="button" aria-label={`Decrease ${exercise.name} weight by ${weightStep} kg`} onClick={() => onSet(exercise.key, log.id, { kg: Math.max(0, Math.round(((log.kg ?? 0) - weightStep) * 10) / 10) })}><Minus size={18} aria-hidden="true" /></button>
                        <button type="button" aria-label={`Increase ${exercise.name} weight by ${weightStep} kg`} onClick={() => onSet(exercise.key, log.id, { kg: Math.min(2000, Math.round(((log.kg ?? 0) + weightStep) * 10) / 10) })}><Plus size={18} aria-hidden="true" /></button>
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
                      onSet(exercise.key, log.id, { reps: next == null ? null : Math.trunc(next) });
                    }} />
                    <div className="focused-number-stepper__actions">
                      <button type="button" aria-label={`Decrease ${exercise.name} ${exercise.quantityUnit ? 'distance' : 'reps'}`} onClick={() => onSet(exercise.key, log.id, { reps: Math.max(1, (log.reps ?? Number(exercise.target.match(/\d+/)?.[0] ?? 1)) - 1) })}><Minus size={18} aria-hidden="true" /></button>
                      <button type="button" aria-label={`Increase ${exercise.name} ${exercise.quantityUnit ? 'distance' : 'reps'}`} onClick={() => onSet(exercise.key, log.id, { reps: Math.min(1000, (log.reps ?? Number(exercise.target.match(/\d+/)?.[0] ?? 0)) + 1) })}><Plus size={18} aria-hidden="true" /></button>
                    </div>
                  </div>
                </div>
                {exercise.measurement && (
                  <div className="focused-set-field focused-set-field--measurement">
                    <span>{exercise.measurement === 'touch' ? 'Highest touch' : exercise.measurement === 'height' ? 'Jump height' : 'Distance'} <small>cm · optional</small></span>
                    <input className="set-input" type="number" min="0" max="1000" step="0.1" inputMode="decimal" placeholder="—"
                      aria-label={`${exercise.name} set ${setIndex + 1} ${measurementLabel(exercise)}`}
                      value={log.measurementCm ?? ''}
                      onChange={(event) => onSet(exercise.key, log.id, { measurementCm: amount(event.target.value, 1000) })} />
                  </div>
                )}
              </div>}
              <button type="button" className={`btn focused-complete-set${log.done ? ' secondary' : ''}`}
                aria-label={`${log.done ? 'Undo' : 'Complete'} ${exercise.name} set ${setIndex + 1}`} onClick={completeSet}>
                {log.done ? <RotateCcw size={19} aria-hidden="true" /> : <Check size={20} aria-hidden="true" />}
                {log.done ? 'Undo set' : 'Complete set'}
              </button>
              <div className="focused-exercise__set-selector" role="group" aria-label={`Sets for ${exercise.name}`}>
                {exercise.logs.map((entry, index) => (
                  <button type="button" key={entry.id} className={`${entry.id === log.id ? ' is-current' : ''}${entry.done ? ' is-done' : ''}`}
                    aria-label={`View ${exercise.name} set ${index + 1}${entry.done ? ', complete' : ''}`}
                    aria-pressed={entry.id === log.id} onClick={() => { pauseMovementTimer(); pendingCompletion.current = null; setSetId(entry.id); }}>
                    {entry.done ? <Check size={15} aria-hidden="true" /> : index + 1}
                  </button>
                ))}
              </div>
            </div>
            <ExerciseGuide exercise={exercise} key={exercise.key} />
            {!log.done && <details className="focused-effort"><summary>Effort <span>{log.rir == null ? 'Optional' : `${log.rir} reps in reserve`}</span></summary><label className="field-label">Reps in reserve<input type="number" min="0" max="10" step="1" inputMode="numeric" aria-label={`${exercise.name} set ${setIndex + 1} reps in reserve`} value={log.rir ?? ''} onChange={event => onSet(exercise.key, log.id, { rir: event.target.value === '' ? null : Math.min(10, Math.max(0, Number(event.target.value))) })} /></label><p className="small-note">How many more clean reps could you do?</p></details>}
            {!editing && ['load', 'reps', 'hold', 'reduce'].includes(recommendation.kind) && <ProgressionCue recommendation={recommendation} onApply={log.done ? undefined : () => onSet(exercise.key, log.id, { ...(recommendation.kg !== undefined ? { kg: recommendation.kg } : {}), ...(recommendation.reps !== undefined ? { reps: recommendation.reps } : {}) })} />}
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
      {nextExercise && <p className="focused-workout__next">{pair && findComplexPair(exercises, nextExercise.key)?.startIndex === pair.startIndex ? `Next in pair · round ${anticipated?.round}` : 'Up next'}<span>{nextExercise.name}</span></p>}
      {allDone && <p className="focused-workout__finished" role="status">All sets complete. Finish when you’re ready.</p>}
    </div>
  );
}
