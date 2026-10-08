import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronRight, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { DecimalWeightInput } from './DecimalWeightInput';
import { ExerciseGuide } from './ExerciseGuide';
import { formatDuration, formatElapsedTime, measurementLabel } from './domain';
import './focused-workout.css';

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
}

export interface FocusedWorkoutProps {
  sessionId: string;
  editing?: boolean;
  exercises: FocusedExercise[];
  now: number;
  previous: (exercise: FocusedExercise) => { exercise: { logs: FocusedSetLog[] } } | null;
  onSet: (exerciseKey: string, setId: string, patch: Partial<FocusedSetLog>) => void;
  onDone: (exerciseKey: string, setId: string, done: boolean) => void;
  onTimer: (exerciseKey: string) => void;
  renderAllSets: (exercise: FocusedExercise, index: number) => ReactNode;
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
  return `${log.kg == null ? 'Bodyweight' : `${number(log.kg)} kg`} × ${log.reps ?? '—'}`;
}

/** The existing session mutations remain the only source of workout data. */
export function FocusedWorkout({ sessionId, editing = false, exercises, now, previous, onSet, onDone, onTimer, renderAllSets }: FocusedWorkoutProps) {
  const initialExercise = exercises.find((exercise) => exercise.logs.some((log) => !log.done)) ?? exercises[0];
  const [exerciseKey, setExerciseKey] = useState(initialExercise?.key);
  const [setId, setSetId] = useState<string | null>(null);
  const [allSetsOpen, setAllSetsOpen] = useState(false);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const invalidWeightInputs = useRef(new Set<string>());
  const pendingCompletion = useRef<{ exerciseKey: string; setId: string } | null>(null);

  useEffect(() => {
    const first = exercises.find((exercise) => exercise.logs.some((log) => !log.done)) ?? exercises[0];
    setExerciseKey(first?.key);
    setSetId(null);
    setAllSetsOpen(false);
    pendingCompletion.current = null;
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
      setSetId(nextSet.id);
      return;
    }
    const nextExercise = [...exercises.slice(index + 1), ...exercises.slice(0, index)]
      .find((exercise) => exercise.logs.some((log) => !log.done));
    if (nextExercise) {
      setExerciseKey(nextExercise.key);
      setSetId(nextExercise.logs.find((log) => !log.done)!.id);
    }
  }, [editing, exercises, onSet]);

  const exerciseIndex = exercises.findIndex((exercise) => exercise.key === exerciseKey);
  const exercise = exercises[exerciseIndex] ?? initialExercise;
  if (!exercise) return null;
  const log = exercise.logs.find((entry) => entry.id === setId)
    ?? exercise.logs.find((entry) => !entry.done) ?? exercise.logs[0];
  const setIndex = exercise.logs.findIndex((entry) => entry.id === log.id);
  const previousLogs = previous(exercise)?.exercise.logs.filter((entry) => entry.done) ?? [];
  const timedInMinutes = exercise.mode === 'timed' && exercise.target.includes('min');
  const allDone = exercises.every((entry) => entry.logs.every((entry) => entry.done));
  const nextExercise = exercises.slice(exerciseIndex + 1).find((entry) => entry.logs.some((entry) => !entry.done));

  function selectExercise(entry: FocusedExercise) {
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
      <section className="focused-exercise" aria-label="Current exercise">
        <div className="focused-exercise__eyebrow">
          <span>{allDone ? 'All sets complete' : `${exercise.group} · ${exerciseIndex + 1} of ${exercises.length}`}</span>
          <button type="button" className="focused-exercise__text-action" aria-expanded={allSetsOpen}
            onClick={() => { pendingCompletion.current = null; setAllSetsOpen(!allSetsOpen); }}>
            {allSetsOpen ? 'Current set' : 'All sets'}
          </button>
        </div>
        <h2 className="focused-exercise__name">{exercise.name}</h2>
        <p className="focused-exercise__target">{exercise.target}{exercise.perSide ? ' / side' : ''}</p>
        {allSetsOpen ? (
          <div className="focused-workout__all-sets">{renderAllSets(exercise, Math.max(0, exerciseIndex))}</div>
        ) : (
          <>
            <div className="focused-exercise__set-heading">
              <strong>Set {setIndex + 1} <span>of {exercise.logs.length}</span></strong>
              <span className="focused-exercise__previous">Previous <b>{previousLabel(exercise, previousLogs[setIndex])}</b></span>
            </div>
            <div className="focused-set-controls" key={`${exercise.key}-${log.id}`}>
              {!exercise.measurement && exercise.mode !== 'timed' && (
                <label className="focused-set-field">
                  <span>{exercise.mode === 'bodyweight' ? 'Added weight' : 'Weight'} <small>kg</small></span>
                  <DecimalWeightInput value={log.kg} placeholder={exercise.mode === 'bodyweight' ? 'BW' : '0'}
                    label={`${exercise.name} set ${setIndex + 1} weight in kilograms`}
                    onValidityChange={(valid) => valid ? invalidWeightInputs.current.delete(log.id) : invalidWeightInputs.current.add(log.id)}
                    onChange={(kg, valid) => onSet(exercise.key, log.id, { kg, ...(!valid ? { done: false } : {}) })} />
                </label>
              )}
              <label className="focused-set-field">
                <span>{exercise.mode === 'timed' ? 'Duration' : 'Reps'}{exercise.mode === 'timed' && <small>{timedInMinutes ? 'min' : 'sec'}</small>}</span>
                <input className="set-input" type="number" min="0"
                  max={exercise.mode === 'timed' ? timedInMinutes ? 1440 : 86400 : 1000}
                  step={timedInMinutes ? '0.1' : '1'} inputMode={timedInMinutes ? 'decimal' : 'numeric'}
                  placeholder={exercise.target.match(/\d+/)?.[0] ?? '0'}
                  aria-label={`${exercise.name} set ${setIndex + 1} ${exercise.mode === 'timed' ? timedInMinutes ? 'minutes' : 'seconds' : 'reps'}`}
                  value={exercise.mode === 'timed' ? log.seconds == null ? '' : number(log.seconds / (timedInMinutes ? 60 : 1)).replace(/,/g, '') : log.reps ?? ''}
                  onChange={(event) => {
                    const next = amount(event.target.value, exercise.mode === 'timed' ? timedInMinutes ? 1440 : 86400 : 1000);
                    onSet(exercise.key, log.id, exercise.mode === 'timed'
                      ? { seconds: next == null ? null : next * (timedInMinutes ? 60 : 1) }
                      : { reps: next == null ? null : Math.trunc(next) });
                  }} />
              </label>
              {exercise.measurement && (
                <label className="focused-set-field">
                  <span>{exercise.measurement === 'touch' ? 'Highest touch' : exercise.measurement === 'height' ? 'Jump height' : 'Distance'} <small>cm · optional</small></span>
                  <input className="set-input" type="number" min="0" max="1000" step="0.1" inputMode="decimal" placeholder="—"
                    aria-label={`${exercise.name} set ${setIndex + 1} ${measurementLabel(exercise)}`}
                    value={log.measurementCm ?? ''}
                    onChange={(event) => onSet(exercise.key, log.id, { measurementCm: amount(event.target.value, 1000) })} />
                </label>
              )}
            </div>
            {exercise.mode === 'timed' && !editing && (
              <button type="button" className={`focused-movement-timer${exercise.runningSince != null ? ' is-running' : ''}`}
                onClick={() => onTimer(exercise.key)} aria-label={`${exercise.runningSince == null ? 'Start' : 'Stop'} timer for ${exercise.name}`}>
                <Timer size={18} aria-hidden="true" />
                <strong>{formatElapsedTime(formatDuration(exercise, now))}</strong>
                <span>{exercise.runningSince == null ? 'Start timer' : 'Stop timer'}</span>
                {exercise.runningSince == null ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
              </button>
            )}
            <button type="button" className={`btn focused-complete-set${log.done ? ' secondary' : ''}`}
              aria-label={`${log.done ? 'Undo' : 'Complete'} ${exercise.name} set ${setIndex + 1}`} onClick={completeSet}>
              {log.done ? <RotateCcw size={19} aria-hidden="true" /> : <Check size={20} aria-hidden="true" />}
              {log.done ? 'Undo set' : 'Complete set'}
            </button>
            <div className="focused-exercise__set-selector" role="group" aria-label={`Sets for ${exercise.name}`}>
              {exercise.logs.map((entry, index) => (
                <button type="button" key={entry.id} className={`${entry.id === log.id ? ' is-current' : ''}${entry.done ? ' is-done' : ''}`}
                  aria-label={`View ${exercise.name} set ${index + 1}${entry.done ? ', complete' : ''}`}
                  aria-pressed={entry.id === log.id} onClick={() => { pendingCompletion.current = null; setSetId(entry.id); }}>
                  {entry.done ? <Check size={15} aria-hidden="true" /> : index + 1}
                </button>
              ))}
            </div>
            <ExerciseGuide exercise={exercise} key={exercise.key} />
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
      {nextExercise && <p className="focused-workout__next">Up next <span>{nextExercise.name}</span></p>}
      {allDone && <p className="focused-workout__finished" role="status">All sets complete. Finish when you’re ready.</p>}
    </div>
  );
}
